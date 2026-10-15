// Run from the Open IoT project root. Only repairs the local Compose database.
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function repairSettings(text) {
  const config = parseEnv(text);
  let url;
  try { url = new URL(config.DATABASE_URL); }
  catch { throw new Error('DATABASE_URL is missing or invalid in .env.'); }
  const port = Number(config.POSTGRES_PORT || 5433);
  if (!Number.isInteger(port) || port < 1 || port > 65535 ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      Number(url.port || 5432) !== port || url.username !== 'openiot' ||
      url.pathname !== '/openiot_m1' || url.search || url.hash) {
    throw new Error('This repair supports only the local Compose openiot/openiot_m1 database at POSTGRES_PORT. Remote and installer databases are not changed.');
  }
  let password;
  try { password = decodeURIComponent(url.password); }
  catch { throw new Error('DATABASE_URL contains invalid password encoding.'); }
  if (!password || /[\r\n\0]/.test(password)) throw new Error('DATABASE_URL needs a non-empty, single-line password.');
  if (!config.POSTGRES_PASSWORD) throw new Error('POSTGRES_PASSWORD is missing in .env.');
  if (Buffer.from(config.TOKEN_ENCRYPTION_KEY || '', 'base64').length !== 32) {
    throw new Error('The existing TOKEN_ENCRYPTION_KEY is missing or invalid. Restore your original key; do not regenerate it.');
  }
  return { config, port, password, connectionString: url.href };
}
export function passwordSql(password) {
  return `SET standard_conforming_strings = on;\nALTER ROLE openiot PASSWORD '${password.replaceAll("'", "''")}';\n`;
}

export async function repair() {
  if (!existsSync('compose.yaml') || !existsSync('scripts/migrate.js') || !existsSync('.env')) {
    throw new Error('Run this script from your Open-IoT folder containing compose.yaml, package.json and .env.');
  }
  const {config,port,password,connectionString} = repairSettings(readFileSync('.env','utf8'));
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== config.DATABASE_URL) {
    throw new Error('This terminal overrides DATABASE_URL. In PowerShell run Remove-Item Env:DATABASE_URL, then rerun this script. Your .env is unchanged.');
  }
  const require = createRequire(resolve('package.json'));
  let Client;
  try { ({Client} = require('pg')); }
  catch { throw new Error('Dependencies are missing. Run npm ci first.'); }
  const env = {...process.env,...config};
  // Explicit compose file prevents unrelated override files selecting another service.
  const compose = args => ['compose','--env-file','.env','-f','compose.yaml',...args];
  function run(program,args,label,input) {
    const result = spawnSync(program,args,{env,input,encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:4*1024*1024});
    if (result.error || result.status !== 0) throw new Error(label);
    return result.stdout.trim();
  }
  console.log('1/4 Starting the local Docker database (existing data is retained)...');
  run('docker',compose(['up','-d','--wait','postgres']), 'Could not start PostgreSQL. Open Docker Desktop, check the database port is free, and retry.');
  const mapping = run('docker',compose(['port','postgres','5432']), 'Could not verify the Docker database port.');
  if (mapping !== `127.0.0.1:${port}`) throw new Error('Docker port mapping does not match .env. Stopped without changing any password.');
  async function connect() {
    const client = new Client({connectionString,connectionTimeoutMillis:5000,query_timeout:5000});
    try { await client.connect(); await client.query('SELECT 1'); }
    finally { await client.end().catch(()=>{}); }
  }
  console.log('2/4 Checking database authentication...');
  try { await connect(); console.log('Password already works; no reset needed.'); }
  catch (error) {
    if (error.code !== '28P01') throw new Error('Database connection failed for a reason other than a password mismatch. No password was changed.');
    console.log('Repairing the database password to match DATABASE_URL in .env...');
    // Password is sent over stdin, never included in command arguments or printed.
    run('docker',compose(['exec','-T','postgres','psql','-X','-q','-U','openiot','-d','openiot_m1','-v','ON_ERROR_STOP=1']),
      'Could not repair the database through its local connection. Keep your data and request help; do not delete the volume.',passwordSql(password));
    try { await connect(); }
    catch { throw new Error('Password repair ran but TCP verification failed. Keep your data and check the database address.'); }
  }
  console.log('3/4 Database connection verified. Applying migrations...');
  const output = run(process.execPath,['scripts/migrate.js'], 'Database connection works, but migrations failed. Run npm run migrate to see the migration error.');
  if (output) console.log(output);
  console.log('4/4 Done. Run npm run dev to start Open IoT.');
  console.log('Your .env, encryption key, accounts and device data were preserved.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  repair().catch(error=>{ console.error(`Repair stopped: ${error.message}`); process.exitCode=1; });
}

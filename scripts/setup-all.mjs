// Full source installation and startup, launched from any working directory.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { repair } from './repair-db.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const [major,minor]=process.versions.node.split('.').map(Number);
function run(program,args,{npm=false,env=process.env}={}) {
  return new Promise((resolve,reject)=>{
    // Only fixed npm commands defined below are passed to cmd.exe; no user input.
    const child=process.platform==='win32' && npm
      ? spawn(process.env.ComSpec || 'cmd.exe',['/d','/s','/c',`npm ${args.join(' ')}`],{stdio:'inherit',env})
      : spawn(program,args,{stdio:'inherit',env});
    child.once('error',()=>reject(new Error(`Could not run ${program}. Check that it is installed and available in PATH.`)));
    child.once('exit',(code,signal)=>{
      if(code===0 || signal==='SIGINT' || code===130) resolve();
      else reject(new Error(`${program} did not finish successfully. Resolve the error above and run setup again.`));
    });
  });
}
async function portFree(port,host,label) {
  await new Promise((resolve,reject)=>{
    const server=createServer();
    server.once('error',()=>reject(new Error(`${label} port ${port} is unavailable. Stop the other Open IoT server/service or change the port in .env, then retry.`)));
    server.listen(port,host,()=>server.close(resolve));
  });
}
async function main() {
  if(major<22 || (major===22 && minor<12)) throw new Error('Install Node.js 24 (minimum 22.12), then run this script again.');
  console.log('\nOpen IoT — complete source setup\nRequires Node.js and a running Docker installation. Existing data is retained.\n');
  console.log('[1/6] Checking Docker and Compose...');
  await run('docker',['info','--format','{{.ServerVersion}}']);
  await run('docker',['compose','version']);
  console.log('[2/6] Preparing configuration...');
  await run(process.execPath,['scripts/setup.js']);
  const config=parseEnv(readFileSync('.env','utf8'));
  if(process.env.DATABASE_URL && process.env.DATABASE_URL!==config.DATABASE_URL) throw new Error('The terminal overrides DATABASE_URL. In PowerShell run Remove-Item Env:DATABASE_URL and retry.');
  const env={...process.env,...config};
  console.log('[3/6] Checking application ports...');
  await portFree(Number(config.PORT || 3000),config.HOST || '127.0.0.1','API');
  await portFree(5173,'0.0.0.0','Dashboard');
  if(config.MQTT_ENABLED==='true') await portFree(Number(config.MQTT_PORT || 1883),config.MQTT_HOST || '127.0.0.1','MQTT');
  console.log('[4/6] Installing locked dependencies (Internet required)...');
  await run('npm',['ci'],{npm:true,env});
  console.log('[5/6] Starting PostgreSQL and preparing database...');
  await repair();
  console.log(`[6/6] Starting Open IoT. Open ${config.APP_ORIGIN || 'http://localhost:5173'} after Vite is ready.`);
  console.log('Create an account in the dashboard. Keep this window open; press Ctrl+C to stop the app.');
  await run('npm',['run','dev'],{npm:true,env});
}
// Keep the parent alive long enough for the foreground child to handle Ctrl+C.
process.on('SIGINT',()=>{});
main().catch(error=>{console.error(`\nSetup stopped: ${error.message}`);process.exitCode=1;});

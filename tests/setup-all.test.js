import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('complete setup orchestrates dependencies, password repair, migration and dev without changing config',{skip:process.platform==='win32'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'openiot-setup-'));
 try {
  for(const p of ['scripts','bin','node_modules/pg'])mkdirSync(join(dir,p),{recursive:true});
  for(const p of ['setup-all.mjs','repair-db.mjs','setup.js'])copyFileSync(resolve('scripts',p),join(dir,'scripts',p));
  writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  writeFileSync(join(dir,'bin/package.json'),'{"type":"commonjs"}');
  writeFileSync(join(dir,'compose.yaml'),'services: {}');
  const config=`POSTGRES_PASSWORD=test-password\nDATABASE_URL=postgres://openiot:test-password@127.0.0.1:5433/openiot_m1\nTOKEN_ENCRYPTION_KEY=${Buffer.alloc(32,1).toString('base64')}\nPORT=0\nMQTT_ENABLED=false\n`;
  writeFileSync(join(dir,'.env'),config);
  writeFileSync(join(dir,'scripts/migrate.js'),"import {appendFileSync} from 'node:fs'; appendFileSync('steps','migrate\\n');");
  writeFileSync(join(dir,'node_modules/pg/index.js'),`const fs=require('node:fs'); exports.Client=class {async connect(){if(!fs.existsSync('repaired'))throw Object.assign(new Error('hidden-secret'),{code:'28P01'});}async query(){}async end(){}};`);
  const stub=(name,body)=>writeFileSync(join(dir,'bin',name),`#!${process.execPath}\n${body}`,{mode:0o755});
  stub('npm',`require('node:fs').appendFileSync('steps',process.argv.slice(2).join(' ')+'\\n');`);
  stub('docker',`const fs=require('node:fs'); const a=process.argv.slice(2); if(a.includes('port'))console.log('127.0.0.1:5433'); if(a.includes('exec')){const sql=fs.readFileSync(0,'utf8');if(!sql.includes("ALTER ROLE openiot PASSWORD 'test-password'"))process.exit(1);fs.writeFileSync('repaired','yes');fs.appendFileSync('steps','repair\\n');}`);
  const env={...process.env,PATH:join(dir,'bin')+':'+process.env.PATH};delete env.DATABASE_URL;
  const result=spawnSync(process.execPath,[join(dir,'scripts/setup-all.mjs')],{cwd:dir,env,encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(readFileSync(join(dir,'steps'),'utf8'),'ci\nrepair\nmigrate\nrun dev\n');
  assert.equal(readFileSync(join(dir,'.env'),'utf8'),config);
  assert.ok(!result.stdout.includes('test-password'));
  assert.ok(!result.stderr.includes('hidden-secret'));
 } finally {rmSync(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('fresh setup uses matching database port, random credentials, and never overwrites configuration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'openiot-setup-'));try{
 const script=fileURLToPath(new URL('../scripts/setup.js',import.meta.url));
 execFileSync(process.execPath,[script],{cwd:dir});
 const first=await readFile(join(dir,'.env'),'utf8');
 const vars=Object.fromEntries(first.trim().split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
 assert.equal(new URL(vars.DATABASE_URL).port,vars.POSTGRES_PORT);
 assert.equal(vars.POSTGRES_PORT,'5433');assert.equal(vars.MQTT_ENABLED,'true');assert.equal(vars.MQTT_HOST,'127.0.0.1');
 assert.equal(Buffer.from(vars.TOKEN_ENCRYPTION_KEY,'base64').length,32);assert.match(vars.POSTGRES_PASSWORD,/^[0-9a-f]{36}$/);
 execFileSync(process.execPath,[script],{cwd:dir});assert.equal(await readFile(join(dir,'.env'),'utf8'),first);
 }finally{await rm(dir,{recursive:true,force:true});}
});

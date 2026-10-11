import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('release check accepts sample config but rejects private environment files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'openiot-release-'));try{
 await mkdir(join(dir,'scripts'));
 await copyFile(new URL('../scripts/check-release.mjs',import.meta.url),join(dir,'scripts/check-release.mjs'));
 await writeFile(join(dir,'.env.example'),'DEVICE_TOKEN=YOUR_DEVICE_TOKEN\n');
 const run=()=>spawnSync(process.execPath,['scripts/check-release.mjs'],{cwd:dir,encoding:'utf8'});
 assert.equal(run().status,0);
 await writeFile(join(dir,'.env'),'PRIVATE_TEST_PLACEHOLDER=true\n');
 const r=run();assert.equal(r.status,1);assert.match(r.stderr,/private configuration/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

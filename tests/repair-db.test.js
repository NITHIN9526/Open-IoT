import test from 'node:test';
import assert from 'node:assert/strict';
import { repairSettings, passwordSql } from '../scripts/repair-db.mjs';
const key=Buffer.alloc(32,1).toString('base64');
const settings=(url='postgres://openiot:original@127.0.0.1:5433/openiot_m1')=>`DATABASE_URL=${url}\nPOSTGRES_PASSWORD=original\nTOKEN_ENCRYPTION_KEY=${key}\n`;
test('repair targets local Compose and keeps original key and config',()=>{
 const result=repairSettings(settings());
 assert.equal(result.port,5433);assert.equal(result.password,'original');
 assert.equal(result.config.TOKEN_ENCRYPTION_KEY,key);
});
test('rejects remote, installer, unexpected database and URL options',()=>{
 for(const url of ['postgres://openiot:p@example.com:5433/openiot_m1','postgres://openiot:p@localhost:5440/openiot','postgres://admin:p@localhost:5433/openiot_m1','postgres://openiot:p@localhost:5433/other','postgres://openiot:p@localhost:5433/openiot_m1?host=example.com']) {
  assert.throws(()=>repairSettings(settings(url)),/only the local Compose/);
 }
});
test('URL passwords decoded and SQL quoted without command injection',()=>{
 const password="quote'back\\slash$()";
 const cfg=repairSettings(settings(`postgres://openiot:${encodeURIComponent(password)}@localhost:5433/openiot_m1`));
 assert.equal(cfg.password,password);
 assert.equal(passwordSql(cfg.password),"SET standard_conforming_strings = on;\nALTER ROLE openiot PASSWORD 'quote''back\\slash$()';\n");
 for(const p of ['','bad%0Aline','bad%00null','bad%XX']) assert.throws(()=>repairSettings(settings(`postgres://openiot:${p}@localhost:5433/openiot_m1`)));
});
test('missing encryption key stops repair instead of regenerating credentials',()=>{
 assert.throws(()=>repairSettings(settings().replace(key,'')),/original key/);
});

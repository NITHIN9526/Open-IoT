import test from 'node:test';
import assert from 'node:assert/strict';
import { cppString, generateSecrets, privateIPv4 } from '../web/src/firmware-generator.js';
const settings = () => ({ ssid: 'Home', password: 'wifi-password', host: '192.168.1.50', deviceId: '8876252e-8646-4d45-8802-9f07ab32058d', token: 'A'.repeat(43), channels: [{ pin: 'V1', gpio: 23, activeLow: true }] });
test('firmware generation safely encodes UTF-8 and C++ injection characters', () => {
  const input = 'Wi-Fi "\\\né123';
  const literal = cppString(input);
  assert.match(literal, /^"(?:\\[0-7]{3})*"$/);
  const bytes = Array.from(literal.matchAll(/\\([0-7]{3})/g), m => parseInt(m[1], 8));
  assert.equal(new TextDecoder().decode(new Uint8Array(bytes)), input);
  const output = generateSecrets({ ...settings(), ssid: input });
  assert.ok(output.includes(literal));
  assert.ok(output.includes('{"V1", 23, true}'));
  assert.ok(!output.includes('LED_PIN'));
});
test('generator rejects invalid addresses, credentials and conflicting wiring', () => {
  for (const host of ['localhost','https://example.com','127.0.0.1','192.168.1.256','192.168.1.1:1883','8.8.8.8']) assert.equal(privateIPv4(host), false);
  for (const host of ['10.0.0.1','172.16.0.1','192.168.0.1']) assert.equal(privateIPv4(host), true);
  for (const patch of [{token:'bad'},{deviceId:'bad'},{ssid:'a'.repeat(33)},{password:'a'.repeat(64)},{channels:[]},{channels:[{pin:'V32',gpio:23,activeLow:true}]},{channels:[{pin:'V1',gpio:34,activeLow:true}]}]) assert.throws(() => generateSecrets({...settings(),...patch}));
  assert.throws(() => generateSecrets({...settings(), channels:[{pin:'V1',gpio:23,activeLow:true},{pin:'V2',gpio:23,activeLow:false}]}), /different GPIO/);
  assert.throws(() => generateSecrets({...settings(), channels:[{pin:'V1',gpio:23,activeLow:true},{pin:'V1',gpio:22,activeLow:false}]}), /unique/);
  assert.doesNotThrow(() => generateSecrets({...settings(), password:''}));
});

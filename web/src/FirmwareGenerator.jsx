import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import { defaultGpios, gpioOptions, generateSecrets, privateIPv4 } from './firmware-generator.js';
import mainCpp from '../../firmware/esp32-relays/src/main.cpp?raw';
import platformioIni from '../../firmware/esp32-relays/platformio.ini?raw';
import './firmware-generator.css';

export function FirmwareGenerator() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]), [selected, setSelected] = useState('');
  const [ssid, setSsid] = useState(''), [password, setPassword] = useState(''), [token, setToken] = useState('');
  const [host, setHost] = useState(() => privateIPv4(location.hostname) ? location.hostname : '');
  const [deviceId, setDeviceId] = useState(''), [channels, setChannels] = useState([{ pin: 'V1', gpio: 23, activeLow: true }]);
  const [pins, setPins] = useState(null), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
  const [error, setError] = useState(''), [files, setFiles] = useState(null), [notice, setNotice] = useState('');
  useEffect(() => {
    setDevices([]); setSelected(''); setToken(''); setPassword(''); setFiles(null); setPins(null);
    if (!user) return;
    const controller = new AbortController();
    // /devices is paginated. Load every page so older devices remain selectable.
    (async () => {
      const all = [];
      for (let page = 1; ; page++) {
        const result = await api(`/devices?page=${page}`, { signal: controller.signal });
        all.push(...result.devices);
        if (result.devices.length < result.pageSize) break;
      }
      if (!controller.signal.aborted) setDevices(all.filter(d => d.deviceType === 'esp32'));
    })().catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [user?.id]);
  useEffect(() => {
    setFiles(null); setToken(''); setPins(null); setError('');
    if (!selected) { setLoading(false); return; }
    const controller = new AbortController();
    setDeviceId(selected); setLoading(true);
    api(`/devices/${selected}/state`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      const outputs = result.pins.filter(p => p.dataType === 'boolean' && p.direction === 'output');
      setPins(outputs);
      setChannels(outputs.slice(0, 8).map((p, i) => ({ pin: p.pin, gpio: defaultGpios[i], activeLow: true })));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, revision]);
  const change = setter => event => { setter(event.target.value); setFiles(null); setNotice(''); };
  function updateChannel(index, key, value) {
    setChannels(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row)); setFiles(null);
  }
  function generate(event) {
    event.preventDefault(); setError(''); setNotice(''); setFiles(null);
    try {
      if (selected && (!pins || channels.some(c => !pins.some(p => p.pin === c.pin)))) throw Error('Reload the device pins and select Boolean outputs.');
      const secrets = generateSecrets({ ssid, password, host: host.trim(), deviceId: deviceId.trim(), token: token.trim(), channels });
      setFiles([['src/main.cpp', mainCpp], ['include/secrets.h', secrets], ['platformio.ini', platformioIni]]);
      setNotice('Code generated. Copy all three files into your PlatformIO project.');
    } catch (e) { setError(e.message); }
  }
  function addChannel() {
    const pin = selected ? pins?.find(p => !channels.some(c => c.pin === p.pin))?.pin : Array.from({ length: 32 }, (_, i) => `V${i}`).find(p => !channels.some(c => c.pin === p));
    const gpio = defaultGpios.find(g => !channels.some(c => Number(c.gpio) === g)) ?? gpioOptions.find(g => !channels.some(c => Number(c.gpio) === g));
    if (pin && gpio !== undefined) { setChannels([...channels, { pin, gpio, activeLow: true }]); setFiles(null); }
  }
  return <section className="firmware-generator" aria-labelledby="firmware-title">
    <h3 id="firmware-title">Generate ESP32 code</h3>
    <p>Create firmware for 1–8 ON/OFF switches on a classic ESP32 DevKit / WROOM board. Choose your GPIO wiring, generate the files, then copy them into PlatformIO.</p>
    <p>Uses Boolean output pins only. It does not add temperature or brightness controls. ESP32-C3/S3 boards, PWM dimming and touch inputs are not included.</p>
    <form onSubmit={generate}>
      {user ? <label>Device<select aria-label="Device" value={selected} onChange={change(setSelected)}><option value="">Enter device ID manually</option>{devices.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label> : <p><Link to="/login">Sign in</Link> to load your devices and virtual pins, or enter them below.</p>}
      <div className="firmware-grid">
        <label>Device ID<input value={deviceId} onChange={change(setDeviceId)} readOnly={Boolean(selected)} required /></label>
        <label>Device token<input type="password" autoComplete="off" value={token} onChange={change(setToken)} required /></label>
        <label>Wi-Fi name<input value={ssid} onChange={change(setSsid)} autoComplete="off" required /></label>
        <label>Wi-Fi password<input type="password" autoComplete="new-password" value={password} onChange={change(setPassword)} /></label>
        <label>Server LAN IP<input value={host} onChange={change(setHost)} placeholder="192.168.1.50" required /></label>
      </div>
      <p>Copy the token from your device settings. Credentials stay in this page’s memory; generated secrets.h contains them. Nothing is saved to browser storage or sent to a code-generation service.</p>
      <h4>Switch connections</h4>
      {selected && <button className="btn btn-secondary btn-sm" type="button" disabled={loading} onClick={() => setRevision(r => r + 1)}>Reload device pins</button>}
      {loading && <p role="status">Loading virtual pins…</p>}
      {selected && pins?.length === 0 && <p>Add a Boolean + Output pin in your device’s Controls tab, then reload its pins here.</p>}
      {channels.map((c, index) => <div className="firmware-channel" key={index}>
        <label>Virtual pin {index + 1}<select aria-label={`Virtual pin ${index + 1}`} value={c.pin} onChange={e => updateChannel(index, 'pin', e.target.value)}>{(selected ? pins ?? [] : Array.from({ length: 32 }, (_, i) => ({ pin: `V${i}` }))).map(p => <option key={p.pin} value={p.pin}>{p.pin}{p.label ? ` — ${p.label}` : ''}</option>)}</select></label>
        <label>GPIO {index + 1}<select aria-label={`GPIO ${index + 1}`} value={c.gpio} onChange={e => updateChannel(index, 'gpio', Number(e.target.value))}>{gpioOptions.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
        <label className="firmware-check"><input type="checkbox" checked={c.activeLow} onChange={e => updateChannel(index, 'activeLow', e.target.checked)} />Active-low {index + 1}</label>
        <button type="button" className="btn btn-secondary btn-sm" aria-label={`Remove channel ${index + 1}`} onClick={() => { setChannels(channels.filter((_, i) => i !== index)); setFiles(null); }}>Remove</button>
      </div>)}
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading || channels.length >= 8 || (Boolean(selected) && (!pins || channels.length >= pins.length))} onClick={addChannel}>Add switch</button>
      <p>GPIO numbers are physical ESP32 pins; V0–V31 are dashboard channels. Create matching Boolean output pins before using manual configuration. Verify your board pinout: GPIO 16/17 may be reserved on PSRAM boards. Active-low means LOW turns the relay on.</p>
      <p>Outputs start OFF and turn OFF after 30 seconds without a server reply. The dashboard retains its last confirmed value. Test the relay logic with low-voltage loads first.</p>
      {error && <p className="firmware-error" role="alert">{error}</p>}
      <div className="firmware-actions"><button className="btn" type="submit" disabled={loading}>Generate code</button><button type="button" className="btn btn-secondary" onClick={() => { setPassword(''); setToken(''); setFiles(null); setNotice('Credentials cleared.'); }}>Clear credentials</button></div>
    </form>
    <p role="status">{notice}</p>
    {files && <div className="firmware-files">{files.map(([name, content]) => <CodeFile key={name} name={name} content={content} />)}
      <h4>Upload to your ESP32</h4><ol><li>Create a PlatformIO project with board <strong>Espressif ESP32 Dev Module</strong> and framework <strong>Arduino</strong>.</li><li>Replace src/main.cpp and platformio.ini, and create include/secrets.h using the files above.</li><li>Enable LAN access and MQTT in your Open IoT server. ESP32 and server must be on the same reachable network; MQTT uses port 1883.</li><li>Connect by USB and choose PlatformIO → Upload. Open Serial Monitor at 115200 baud, then try a dashboard switch.</li></ol><p>Changing dashboard virtual pins or GPIO mappings requires generating and uploading the firmware again. This page generates source code; it does not flash USB devices directly.</p>
    </div>}
  </section>;
}
function CodeFile({ name, content }) {
  const text = useRef(null), [message, setMessage] = useState('');
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(content);
      else {
        text.current.focus(); text.current.select();
        if (!document.execCommand('copy')) throw Error();
      }
      setMessage('Copied!');
    } catch { text.current.focus(); text.current.select(); setMessage('Copy blocked. Code selected — press Ctrl+C (or long-press → Copy).'); }
  }
  return <details className="firmware-file" open={name === 'src/main.cpp'}><summary>{name}{name.endsWith('secrets.h') ? ' — contains credentials' : ''}</summary><button type="button" className="btn btn-secondary btn-sm" onClick={copy}>Copy {name}</button><span role="status">{message}</span><textarea ref={text} aria-label={`${name} code`} readOnly spellCheck={false} value={content} rows={12} /></details>;
}

// Generation is local: never send Wi-Fi credentials or tokens to an API.
export const gpioOptions = [4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
export const defaultGpios = [23, 22, 21, 19, 18, 27, 26, 25];
export function cppString(value) {
  // Encode UTF-8 bytes using fixed-width octal escapes (including quotes and
  // backslashes). Adjacent digits cannot extend an escape or inject C++ code.
  return '"' + Array.from(new TextEncoder().encode(value), byte => '\\' + byte.toString(8).padStart(3, '0')).join('') + '"';
}
export function privateIPv4(host) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const p = host.split('.').map(Number);
  return p.every(n => n <= 255) && (p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168));
}
export function generateSecrets({ ssid, password, host, deviceId, token, channels }) {
  if (!ssid || new TextEncoder().encode(ssid).length > 32 || ssid.includes('\0')) throw Error('Enter a Wi-Fi name of 1–32 UTF-8 bytes.');
  if (password.includes('\0') || new TextEncoder().encode(password).length > 63) throw Error('Wi-Fi password must fit within 63 UTF-8 bytes. Leave it blank only for an open network.');
  if (!privateIPv4(host)) throw Error('Enter the server’s private IPv4 address, such as 192.168.1.50. Do not use localhost, a URL, or the tunnel address.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId)) throw Error('Enter a valid device UUID.');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw Error('Paste the 43-character device token from your device settings.');
  if (!channels.length || channels.length > 8) throw Error('Choose 1–8 Boolean output channels.');
  if (new Set(channels.map(c => c.pin)).size !== channels.length) throw Error('Each virtual pin must be unique.');
  if (new Set(channels.map(c => Number(c.gpio))).size !== channels.length) throw Error('Each channel needs a different GPIO.');
  for (const channel of channels) {
    if (!/^V(?:[0-9]|[12][0-9]|3[01])$/.test(channel.pin) || !gpioOptions.includes(Number(channel.gpio)) || typeof channel.activeLow !== 'boolean') throw Error('Check the virtual pin, GPIO and active-low setting for every channel.');
  }
  return `#pragma once
#include <Arduino.h>
// Private configuration: do not share or commit this file.
constexpr char WIFI_SSID[] = ${cppString(ssid)};
constexpr char WIFI_PASSWORD[] = ${cppString(password)};
constexpr char MQTT_HOST[] = ${cppString(host)};
constexpr uint16_t MQTT_PORT = 1883;
constexpr char DEVICE_ID[] = ${cppString(deviceId)};
constexpr char DEVICE_TOKEN[] = ${cppString(token)};
struct Channel { const char *pin; uint8_t gpio; bool activeLow; };
constexpr Channel CHANNELS[] = {
${channels.map(c => `  {"${c.pin}", ${Number(c.gpio)}, ${c.activeLow}},`).join('\n')}
};
constexpr size_t CHANNEL_COUNT = sizeof(CHANNELS) / sizeof(CHANNELS[0]);
`;
}

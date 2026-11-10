// Pure rules for what the page lets cross to the Android host (and take back). No imports, so the tests load it
// as it is. The link rules are the same as renderer/external-links.cjs (desktop) and LinkPolicy.java (the host
// checks again); scripts/test-android-midi.js runs all three on one list of good and hostile addresses.
const DESTINATIONS = new Set([
  'https://ko-fi.com/scizers', 'https://ko-fi.com/scizers/',
  'https://github.com/scizerss/keylight-piano', 'https://github.com/scizerss/keylight-piano/issues',
  'https://github.com/scizerss/keylight-piano/releases', 'https://github.com/scizerss/keylight-piano/releases/latest',
  'https://github.com/demixme/GRAB'
])
const ISSUE_NEW = 'https://github.com/scizerss/keylight-piano/issues/new'
const ENCODED = /^(?:[A-Za-z0-9\-._~!*'()]|%[0-9A-F]{2})+$/

export function isAllowedLink(value) {
  if (typeof value !== 'string') return false
  if (DESTINATIONS.has(value)) return true
  if (value.length > 2000 || !value.startsWith(ISSUE_NEW + '?')) return false
  const pairs = value.slice(ISSUE_NEW.length + 1).split('&')
  if (pairs.length !== 2) return false
  const keys = []
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    if (at < 1) return false
    const key = pair.slice(0, at), val = pair.slice(at + 1)
    if (!['title', 'body'].includes(key) || !ENCODED.test(val) || /%25/.test(val)) return false
    keys.push(key)
  }
  if (new Set(keys).size !== 2) return false
  try { const u = new URL(value); return u.origin === 'https://github.com' && u.pathname === '/scizerss/keylight-piano/issues/new' && !u.username && !u.password && !u.port && !u.hash } catch (_e) { return false }
}

const text = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) : '')
const HEX4 = /^0x[0-9a-f]{4}$/
/**
 * The host's answer to the "Support my device" USB read, rebuilt field by field: only the named fields survive,
 * so a serial number or a device path the host should never send cannot reach the report. Anything malformed
 * reads as "not available" (null).
 */
export function cleanUsb(raw) {
  if (!raw || typeof raw !== 'object' || raw.ok !== true || !Array.isArray(raw.devices)) return null
  const devices = []
  for (const d of raw.devices.slice(0, 12)) {
    if (!d || !HEX4.test(d.vendorId) || !HEX4.test(d.productId)) continue
    devices.push({
      vendorId: d.vendorId, productId: d.productId, product: text(d.product), manufacturer: text(d.manufacturer),
      bcdDevice: /^\d{1,3}\.\d{1,3}$/.test(d.bcdDevice) ? d.bcdDevice : '', class: d.class === 'audio' ? 'audio' : '',
      subclass: Number.isInteger(d.subclass) && d.subclass >= 0 && d.subclass < 256 ? d.subclass : 0,
      protocol: Number.isInteger(d.protocol) && d.protocol >= 0 && d.protocol < 256 ? d.protocol : 0
    })
  }
  const os = raw.os && typeof raw.os === 'object' ? { platform: 'android', release: text(raw.os.release).slice(0, 40), arch: text(raw.os.arch).slice(0, 20) } : { platform: 'android', release: '', arch: '' }
  return { ok: true, devices, source: 'UsbManager', reason: '', os, redact: [] }
}

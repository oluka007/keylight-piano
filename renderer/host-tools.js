// What the page needs from the device it runs on and the browser alone does not give: opening a link, copying text,
// reading the USB descriptors for "Support my device". On the desktop these are the browser and the preload bridge;
// on Android they go through the host bridge, which checks everything again (HostTools.java, LinkPolicy.java).
import { IS_ANDROID } from './platform.js'
import { nativeRequest } from './android-midi.js'
import { isAllowedLink, cleanUsb } from './host-policy.js'
// the iPhone/iPad app's host (ios-host.js) sets this before the page loads; both apps speak the same bridge
const IS_NATIVE_HOST = IS_ANDROID || !!globalThis.__keylightIOS

export async function copyText(text) {
  let browserFailed = false
  if (!IS_NATIVE_HOST) {
    try { await navigator.clipboard.writeText(text); return } catch (_e) { browserFailed = true }
  }
  if (IS_NATIVE_HOST) { try { await nativeRequest('clipboard', { text }); return } catch (_e) { browserFailed = true } }
  if (browserFailed) {
    const area = document.createElement('textarea')
    area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'
    document.body.append(area); area.select()
    const ok = document.execCommand('copy'); area.remove()
    if (!ok) throw new Error('copy refused')
  }
}

export function openExternal(url) {
  if (!isAllowedLink(url)) return false
  if (IS_NATIVE_HOST) { nativeRequest('openLink', { url }).catch(() => {}); return true }
  window.open(url, '_blank', 'noopener')
  return true
}

export async function usbProbe() {
  if (window.keylightNative && window.keylightNative.deviceUsb) return window.keylightNative.deviceUsb()
  if (IS_ANDROID) { try { return cleanUsb(await nativeRequest('deviceUsb')) || { ok: false, devices: [], reason: 'not available', os: { platform: 'android', release: '', arch: '' }, redact: [] } } catch (_e) { return null } }
  return null
}

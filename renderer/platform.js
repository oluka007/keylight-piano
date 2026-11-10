// Which computer Keylight runs on, for the few words and steps that differ. The page has
// no Node (contextIsolation), so it asks the browser. ?platform=win (or mac) shows the
// other one's page, for screenshots and checks on one machine.
const forced = new URLSearchParams(location.search).get('platform')
const reported = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
export const IS_ANDROID = forced ? forced === 'android' : /Android/i.test(navigator.userAgent)
// The iPhone/iPad app (ios/): its WKWebView host sets __keylightIOS before the page loads (iPadOS reports a Mac user agent).
export const IS_IOS = forced ? forced === 'ios' : !IS_ANDROID && (!!globalThis.__keylightIOS || /iPhone|iPad|iPod/i.test(navigator.userAgent))
// Either phone/tablet app: a native host does MIDI, export, links and the clipboard over the same bridge (android-midi.js).
export const IS_NATIVE_HOST = IS_ANDROID || IS_IOS
export const IS_WIN = forced ? forced === 'win' : !IS_NATIVE_HOST && /^win/i.test(reported)

// "Reset your progress on this Mac?" and the like
export const THIS_COMPUTER = IS_NATIVE_HOST ? 'this device' : IS_WIN ? 'this computer' : 'this Mac'
// where main.js saves takes: app.getPath('videos')/Keylight
export const TAKES_FOLDER = IS_NATIVE_HOST ? 'a location you choose' : IS_WIN ? 'Videos › Keylight' : 'Movies › Keylight'

// A touch screen is the way in (a phone or tablet, with no mouse): hints then say "tap" and drop the computer-key shortcuts.
// A Bluetooth keyboard changes nothing here; the shortcuts overlay appears once a real key has been pressed (see android.js).
export const TOUCH = IS_NATIVE_HOST || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches)

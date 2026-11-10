// Unit test for main.js isTakeDownload(): node scripts/test-take-download.js
// main.js saves a download without asking only when it is a take of this app: named
// keylight-take-YYYYMMDD-HHMMSS.(mp4|webm|json) AND downloaded from a blob: URL of the
// page's own origin (keylight://app, renderer/app-scheme.cjs). Everything else, the old
// http://127.0.0.1:47821 page included, is left to the normal download flow.
const assert = require('node:assert/strict')
const path = require('node:path')
const { isTakeDownload } = require(path.join(__dirname, '..', 'main.js'))

const ORIGIN = 'keylight://app'
const ID = '4f3c2a1b-9d8e-4c7b-a6f5-0e1d2c3b4a59'
const BLOB = `blob:${ORIGIN}/${ID}`
let n = 0
const yes = (name, url = BLOB, origin = ORIGIN) => { assert.equal(isTakeDownload(name, url, origin), true, `${name} from ${url} should be saved`); n++ }
const no = (name, url = BLOB, origin = ORIGIN) => { assert.equal(isTakeDownload(name, url, origin), false, `${name} from ${url} should be left alone`); n++ }

// takes of this page (a blob URL as the page makes it: blob:keylight://app/<uuid>)
yes('keylight-take-20261030-172642.mp4')
yes('keylight-take-20261030-172642.webm')
yes('keylight-take-20261030-172642.json')
yes('keylight-take-20261030-172642.mp4', `blob:${ORIGIN}/${ID.toUpperCase()}`)
assert.equal(isTakeDownload('keylight-take-20261030-172642.mp4', BLOB), true, 'the app origin is the default'); n++

// other names
no('keylight-take-20261030-172642.mov')
no('keylight-take-20261030-172642.MP4')
no('keylight-take-2026103-172642.mp4')
no('keylight-take-20261030-172642 (1).mp4')
no('keylight-take-20261030-172642.mp4.exe')
no('../keylight-take-20261030-172642.mp4')
no('sub/keylight-take-20261030-172642.mp4')
no('my-video.mp4')
no('')
no(null)

// other places, the old page address among them
no('keylight-take-20261030-172642.mp4', `blob:http://127.0.0.1:47821/${ID}`)
no('keylight-take-20261030-172642.mp4', `blob:keylight://app.evil.com/${ID}`)
no('keylight-take-20261030-172642.mp4', `blob:keylight://evil/${ID}`)
no('keylight-take-20261030-172642.mp4', `blob:keylight://appx/${ID}`)
no('keylight-take-20261030-172642.mp4', `blob:https://example.com/${ID}`)
no('keylight-take-20261030-172642.mp4', `keylight://app/keylight-take-20261030-172642.mp4`)
no('keylight-take-20261030-172642.mp4', `https://example.com/keylight-take-20261030-172642.mp4`)
no('keylight-take-20261030-172642.mp4', 'file:///Users/someone/keylight-take-20261030-172642.mp4')
no('keylight-take-20261030-172642.mp4', 'data:video/mp4;base64,AAAA')
no('keylight-take-20261030-172642.mp4', BLOB + '/more')
no('keylight-take-20261030-172642.mp4', BLOB + '#x')
no('keylight-take-20261030-172642.mp4', `blob:${ORIGIN}/${ID}x`)
no('keylight-take-20261030-172642.mp4', `blob:${ORIGIN}//${ID}`)
// no origin known, or a nonsense one
for (const origin of ['', null, 42, {}]) { assert.equal(isTakeDownload('keylight-take-20261030-172642.mp4', BLOB, origin), false, 'origin ' + origin); n++ }
assert.equal(isTakeDownload('keylight-take-20261030-172642.mp4', undefined, ORIGIN), false, 'no URL'); n++

console.log(`take download filter: ${n} cases pass`)

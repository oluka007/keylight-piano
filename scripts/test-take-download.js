// Unit test for main.js isTakeDownload(): node scripts/test-take-download.js
// main.js saves a download without asking only when it is a take of this app: named
// keylight-take-YYYYMMDD-HHMMSS.(mp4|webm|json) AND downloaded from a blob: URL of the
// page's own origin (http://127.0.0.1:<the port it is served on>). Everything else is
// left to the normal download flow.
const assert = require('node:assert/strict')
const path = require('node:path')
const { isTakeDownload } = require(path.join(__dirname, '..', 'main.js'))

const PORT = 47821
const BLOB = `blob:http://127.0.0.1:${PORT}/4f3c2a1b-9d8e-4c7b-a6f5-0e1d2c3b4a59`
let n = 0
const yes = (name, url = BLOB, port = PORT) => { assert.equal(isTakeDownload(name, url, port), true, `${name} from ${url} should be saved`); n++ }
const no = (name, url = BLOB, port = PORT) => { assert.equal(isTakeDownload(name, url, port), false, `${name} from ${url} should be left alone`); n++ }

// takes of this page
yes('keylight-take-20261030-172642.mp4')
yes('keylight-take-20261030-172642.webm')
yes('keylight-take-20261030-172642.json')
yes('keylight-take-20261030-172642.mp4', BLOB.toUpperCase().replace('BLOB:HTTP', 'blob:http'))

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

// other places
no('keylight-take-20261030-172642.mp4', `blob:http://127.0.0.1:${PORT + 1}/4f3c2a1b-9d8e-4c7b-a6f5-0e1d2c3b4a59`)
no('keylight-take-20261030-172642.mp4', `blob:http://localhost:${PORT}/4f3c2a1b-9d8e-4c7b-a6f5-0e1d2c3b4a59`)
no('keylight-take-20261030-172642.mp4', `blob:https://example.com/4f3c2a1b-9d8e-4c7b-a6f5-0e1d2c3b4a59`)
no('keylight-take-20261030-172642.mp4', `http://127.0.0.1:${PORT}/keylight-take-20261030-172642.mp4`)
no('keylight-take-20261030-172642.mp4', `https://example.com/keylight-take-20261030-172642.mp4`)
no('keylight-take-20261030-172642.mp4', 'file:///Users/someone/keylight-take-20261030-172642.mp4')
no('keylight-take-20261030-172642.mp4', 'data:video/mp4;base64,AAAA')
no('keylight-take-20261030-172642.mp4', BLOB + '/more')
no('keylight-take-20261030-172642.mp4', BLOB + '#x')
no('keylight-take-20261030-172642.mp4', `blob:http://127.0.0.1:${PORT}.evil.com/4f3c2a1b-9d8e-4c7b-a6f5-0e1d2c3b4a59`)
// no port known (the server is not up), or a nonsense one
for (const port of [0, undefined, null, 'abc', 70000, 47821.5]) { assert.equal(isTakeDownload('keylight-take-20261030-172642.mp4', BLOB, port), false, 'port ' + port); n++ }
assert.equal(isTakeDownload('keylight-take-20261030-172642.mp4', undefined, PORT), false, 'no URL'); n++

console.log(`take download filter: ${n} cases pass`)

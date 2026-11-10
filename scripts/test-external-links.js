const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { isAllowedExternalUrl, bindExternalNavigation } = require('../renderer/external-links.cjs')

const cases = [
  ['https://ko-fi.com/scizers', true],
  ['https://ko-fi.com/scizers/', true],
  ['https://github.com/scizerss/keylight-piano/releases/latest', true],
  ['https://github.com/scizerss/keylight-piano/issues', true],
  ['https://github.com/demixme/GRAB', true],
  ['https://github.com/demixme/GRAB/', false],
  ['https://github.com/demixme/GRAB-evil', false],
  ['http://ko-fi.com/scizers', false],
  ['https://ko-fi.com.evil.example/scizers', false],
  ['https://ko-fi.com@evil.example/scizers', false],
  ['https://evil.example@ko-fi.com/scizers', false],
  ['https://ko-fi.com/scizers?redirect=https://evil.example', false],
  ['https://ko-fi.com/scizers#another-page', false],
  ['https://ko-fi.com:444/scizers', false],
  ['https://github.com/scizerss/keylight-piano-evil', false],
  ['file:///Applications/Keylight.app', false],
  ['javascript:alert(1)', false],
  ['data:text/html,hello', false],
  ['', false],
  [null, false],
  [123, false]
]

for (const [url, allowed] of cases) assert.equal(isAllowedExternalUrl(url), allowed, String(url))
const contents = new EventEmitter()
let openWindow
contents.setWindowOpenHandler = (handler) => { openWindow = handler }
const opened = []
bindExternalNavigation(contents, { isOwn: (url) => url === 'http://127.0.0.1:1234/index.html', open: (url) => opened.push(url) })
assert.deepEqual(openWindow({ url: 'https://ko-fi.com/scizers' }), { action: 'deny' })
assert.deepEqual(opened, ['https://ko-fi.com/scizers'])
assert.deepEqual(openWindow({ url: 'https://evil.example' }), { action: 'deny' })
assert.equal(opened.length, 1)
let prevented = false
contents.emit('will-navigate', { preventDefault: () => { prevented = true } }, 'http://127.0.0.1:1234/index.html')
assert.equal(prevented, false)
contents.emit('will-navigate', { preventDefault: () => { prevented = true } }, 'https://evil.example')
assert.equal(prevented, true)
assert.equal(opened.length, 1)
prevented = false
contents.emit('will-navigate', { preventDefault: () => { prevented = true } }, 'https://ko-fi.com/scizers')
assert.equal(prevented, true)
assert.deepEqual(opened, ['https://ko-fi.com/scizers', 'https://ko-fi.com/scizers'])
console.log(`external navigation: ${cases.length} URL cases and window/navigation boundaries passed`)

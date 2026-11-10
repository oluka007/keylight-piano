// Stands in for the real blocksd in scripts/test-blocksd-supervisor.js: reads web_port from
// the --config file, answers WebSocket "discover" requests like blocksd does, prints a few log
// lines, exits on SIGTERM, and exits 1 when it cannot bind its port.
// FAKE_BLOCKSD_EXIT_MS: exit by itself after that long (a crashing daemon).
// FAKE_BLOCKSD_IGNORE_TERM=1: ignores SIGTERM (a stubborn daemon).
// FAKE_BLOCKSD_PLAIN=1: accepts TCP but never speaks WebSocket (not a blocksd).
const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const args = process.argv.slice(2)
const config = fs.readFileSync(args[args.indexOf('--config') + 1], 'utf8')
const port = Number(/web_port\s*=\s*(\d+)/.exec(config)[1])
const REPLY = JSON.stringify({ type: 'discover_response', devices: [], id: 'keylight-probe' })
function frame(text) {
  const b = Buffer.from(text)
  return Buffer.concat([Buffer.from([0x81, b.length]), b])
}
const srv = http.createServer((_q, r) => r.end('plain'))
srv.on('upgrade', (req, socket) => {
  if (process.env.FAKE_BLOCKSD_PLAIN) return
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n')
  socket.on('data', () => socket.write(frame(REPLY)))
  socket.on('error', () => {})
})
srv.on('error', (e) => { console.error('cannot bind: ' + e.message); process.exit(1) })
srv.listen(port, '127.0.0.1', () => {
  console.log('fake blocksd ready on ' + port)
  console.error('INFO [blocksd.api.server] WebSocket client connected')
  console.error('INFO a stderr line')
})
process.on('SIGTERM', () => { if (!process.env.FAKE_BLOCKSD_IGNORE_TERM) { srv.close(); setTimeout(() => process.exit(0), 50) } })
if (process.env.FAKE_BLOCKSD_EXIT_MS) setTimeout(() => process.exit(3), Number(process.env.FAKE_BLOCKSD_EXIT_MS))

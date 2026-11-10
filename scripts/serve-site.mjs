// Local preview only: node scripts/serve-site.mjs  (then open http://localhost:4173)
// Serves the repository's site-next and site-mockups folders; nothing here is deployed.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  const rel = path === '/' ? '/site-next/index.html' : path.startsWith('/mockups/') ? '/site-mockups/' + path.slice(9) : '/site-next' + (path.endsWith('/') ? path + 'index.html' : path)
  const file = join(root, rel)
  if (!file.startsWith(join(root, 'site-next')) && !file.startsWith(join(root, 'site-mockups'))) { res.writeHead(403).end(); return }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body) } catch { res.writeHead(404).end('not found') }
}).listen(Number(process.env.PORT) || 4173, '127.0.0.1')

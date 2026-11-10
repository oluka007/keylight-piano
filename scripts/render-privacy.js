// Renders docs/PRIVACY.md (headings, paragraphs, lists, **bold**, `code`, links) to one static
// HTML page, e.g. for GitHub Pages: node scripts/render-privacy.js site/privacy.html
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')
const out = process.argv[2]
if (!out) { console.error('usage: node scripts/render-privacy.js <out.html>'); process.exit(2) }
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>')
  .replace(/(https:\/\/[^\s<)]+[^\s<).,])/g, '<a href="$1">$1</a>')
const lines = fs.readFileSync(path.join(root, 'docs/PRIVACY.md'), 'utf8').split('\n')
let html = ''
let list = false
for (const line of lines) {
  const closeList = () => { if (list) { html += '</ul>\n'; list = false } }
  if (/^# /.test(line)) { closeList(); html += `<h1>${inline(line.slice(2))}</h1>\n` }
  else if (/^## /.test(line)) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>\n` }
  else if (/^- /.test(line)) { if (!list) { html += '<ul>\n'; list = true } html += `<li>${inline(line.slice(2))}</li>\n` }
  else if (line.trim()) { closeList(); html += `<p>${inline(line)}</p>\n` }
  else closeList()
}
if (list) html += '</ul>\n'
fs.writeFileSync(out, `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keylight privacy policy</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1b1b2f}code{background:#eee;padding:1px 4px;border-radius:4px}a{color:#0b57d0}</style></head><body>\n${html}</body></html>\n`)

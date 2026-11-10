// Electron batch rasteriser: node_modules/.bin/electron tools/covers/render.js <svgDir> <outDir> [--sheet]
// Loads every *.svg in <svgDir> in one hidden 512x512 window (device scale forced to 1)
// and writes the quantised PNG beside the same name in <outDir>. No network, no other tooling.
const { app, BrowserWindow } = require('electron')
const fs = require('fs'), path = require('path')
const { encodeIndexed } = require('./png.js')
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.disableHardwareAcceleration()
const [svgDir, outDir, size = '512'] = process.argv.slice(2)
const S = +size
const onlyIds = process.env.COVER_ONLY ? process.env.COVER_ONLY.split(',') : null
app.whenReady().then(async () => {
  const files = fs.readdirSync(svgDir).filter((n) => n.endsWith('.svg') && (!onlyIds || onlyIds.includes(n.slice(0, -4)))).sort()
  fs.mkdirSync(outDir, { recursive: true })
  const win = new BrowserWindow({ width: S, height: S, useContentSize: true, frame: false, show: false, webPreferences: { backgroundThrottling: false } })
  let failed = 0
  for (const n of files) {
    const html = path.join(svgDir, n.replace(/\.svg$/, '.html'))
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000;overflow:hidden}svg{display:block;width:${S}px;height:${S}px}</style>${fs.readFileSync(path.join(svgDir, n), 'utf8')}`)
    await win.loadFile(html)
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)')
    await new Promise((r) => setTimeout(r, 80))
    let img = await win.webContents.capturePage({ x: 0, y: 0, width: S, height: S })
    // a retina display captures at 2x: scale back down (a clean supersample) to the exact cover size
    if (img.getSize().width === S * 2) img = img.resize({ width: S, height: S, quality: 'best' })
    const sz = img.getSize()
    if (sz.width !== S || sz.height !== S) { console.error(`${n}: got ${sz.width}x${sz.height}`); failed++; continue }
    const bmp = img.toBitmap() // BGRA
    fs.writeFileSync(path.join(outDir, n.replace(/\.svg$/, '.png')), encodeIndexed(bmp, S, S, process.env.COVER_COLORS ? +process.env.COVER_COLORS : 128))
    fs.unlinkSync(html)
  }
  win.destroy()
  console.log(`rendered ${files.length - failed}/${files.length}`)
  app.exit(failed ? 1 : 0)
})

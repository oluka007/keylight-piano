// Generates the SVG for every Mutopia song cover and rasterises it with the repo's Electron.
//   node tools/covers/build.js                      all covers -> renderer/covers/<id>.png
//   node tools/covers/build.js --only a,b --out DIR  a few covers into another folder
//   node tools/covers/build.js --sheet FILE.png      also a contact sheet (5:4 tiles, as the app crops them)
const fs = require('fs'), path = require('path'), os = require('os')
const { spawnSync } = require('child_process')
const { pathToFileURL } = require('url')
const { compose } = require('./lib.js')
const root = path.resolve(__dirname, '../..')
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
;(async () => {
  const { MUTOPIA_SONGS } = await import(pathToFileURL(path.join(root, 'renderer/songs-mutopia.js')).href)
  const specs = Object.assign({}, ...fs.readdirSync(__dirname).filter((n) => /^scenes-.*\.js$/.test(n)).map((n) => require('./' + n)))
  const ids = MUTOPIA_SONGS.map((s) => s.id)
  const missing = ids.filter((i) => !specs[i]), extra = Object.keys(specs).filter((i) => !ids.includes(i))
  if (arg('--only') == null && (missing.length || extra.length)) { console.error('missing specs:', missing, 'unknown specs:', extra); process.exit(1) }
  const only = arg('--only') ? arg('--only').split(',') : ids.filter((i) => specs[i])
  const out = path.resolve(arg('--out') || path.join(root, 'renderer/covers'))
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-covers-'))
  for (const id of only) fs.writeFileSync(path.join(tmp, id + '.svg'), compose(id, specs[id]))
  if (process.argv.includes('--keep-svg')) console.log('svg in', tmp)
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const electron = path.join(root, 'node_modules/.bin/electron')
  const r = spawnSync(electron, [path.join(__dirname, 'render.js'), tmp, out, '512'], { env, stdio: 'inherit', timeout: 600000 })
  if (r.status !== 0) { console.error('render failed'); process.exit(1) }
  let total = 0
  for (const id of only) { const s = fs.statSync(path.join(out, id + '.png')).size; total += s; if (s > 200 * 1024) console.warn(`${id}: ${(s / 1024) | 0} KB (over 200 KB)`) }
  console.log(`${only.length} covers, ${(total / 1024) | 0} KB total, ${(total / only.length / 1024) | 0} KB avg -> ${out}`)
  if (arg('--sheet')) {
    const sheet = path.join(tmp, 'sheet'); fs.mkdirSync(sheet)
    const per = +(arg('--per') || 12)
    const pages = []
    for (let i = 0; i < only.length; i += per) pages.push(only.slice(i, i + per))
    const names = pages.map((p, n) => {
      const tiles = p.map((id) => { const s = MUTOPIA_SONGS.find((x) => x.id === id); return `<div class="t"><div class="cover"><img src="${pathToFileURL(path.join(out, id + '.png')).href}"><b class="ti">${s.title.replace(/&/g, '&amp;')}</b><i class="lv">${s.level}</i></div><small>${id}</small></div>` }).join('')
      const html = `<body style="margin:0;background:linear-gradient(160deg,#10163a,#1a2060);color:#ccd;font:11px sans-serif"><style>.g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:18px}.cover{aspect-ratio:5/4;border-radius:16px;overflow:hidden;position:relative;box-shadow:0 0 0 1px rgba(255,255,255,.1)}img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}.ti{position:absolute;left:0;right:0;top:7%;text-align:center;color:#f6f1e4;font:600 15px Georgia,serif;letter-spacing:.02em}.lv{position:absolute;left:8px;bottom:8px;font:700 10px sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7cf0c6;background:rgba(7,10,32,.68);border:1px solid rgba(124,240,198,.3);padding:4px 9px;border-radius:99px}small{display:block;padding:4px 2px}</style><div class="g">${tiles}</div>`
      const name = `sheet${n + 1}`; fs.writeFileSync(path.join(sheet, name + '.html'), html); return name
    })
    fs.writeFileSync(path.join(sheet, 'run.js'), `const{app,BrowserWindow}=require('electron');const fs=require('fs');const path=require('path');app.commandLine.appendSwitch('force-device-scale-factor','1');app.disableHardwareAcceleration();app.whenReady().then(async()=>{const w=new BrowserWindow({width:1240,height:${Math.ceil(per / 4) * 330 + 40},useContentSize:true,frame:false,show:false});for(const n of ${JSON.stringify(names)}){await w.loadFile(path.join(__dirname,n+'.html'));await new Promise(r=>setTimeout(r,500));fs.writeFileSync(${JSON.stringify(arg('--sheet').replace(/\.png$/, ''))}+'-'+n.slice(5)+'.png',(await w.webContents.capturePage()).toPNG())}app.exit(0)})`)
    spawnSync(electron, [path.join(sheet, 'run.js')], { env, stdio: 'inherit' })
    console.log('sheets:', arg('--sheet').replace(/\.png$/, '') + '-N.png')
  }
})()

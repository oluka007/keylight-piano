const assert = require('node:assert/strict')

async function main() {
  const { releaseDownloads } = await import('../site/downloads.mjs')
  const asset = (name) => ({ name, browser_download_url: 'https://github.com/scizerss/keylight-piano/releases/download/v0.3.0/' + name })
  const release = { tag_name: 'v0.3.0', assets: [asset('Keylight-0.3.0-mac.zip'), asset('Keylight-0.3.0.dmg'), asset('Keylight-0.3.0-Setup.exe'), asset('Keylight-0.3.0-android.apk')] }
  assert.equal(releaseDownloads(release).mac.name, 'Keylight-0.3.0.dmg')
  assert.equal(releaseDownloads(release).win.name, 'Keylight-0.3.0-Setup.exe')
  assert.equal(releaseDownloads(release).android.name, 'Keylight-0.3.0-android.apk')
  assert.equal(releaseDownloads({ assets: [asset('Keylight-0.2.4-win-x64.zip')] }).win.name, 'Keylight-0.2.4-win-x64.zip')
  assert.equal(releaseDownloads({ assets: [] }).android, null)
  assert.equal(releaseDownloads({ ...release, draft: true }), null)
  assert.equal(releaseDownloads({ ...release, prerelease: true }), null)
  assert.equal(releaseDownloads(null), null)
  for (const url of ['https://github.com.evil.example/scizerss/keylight-piano/releases/download/v0.3.0/Keylight-x.dmg', 'javascript:alert(1)', 'https://github.com/scizerss/keylight-piano/releases/download/v0.3.0/Keylight-x.dmg?redirect=evil']) {
    assert.equal(releaseDownloads({ assets: [{ name: 'Keylight-x.dmg', browser_download_url: url }] }).mac, null)
  }
  console.log('release downloads: installer preference, portable fallback, unpublished platforms and hostile URLs pass')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })

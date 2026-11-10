const repository = 'https://github.com/scizerss/keylight-piano/releases/download/'

export function releaseDownloads(release) {
  if (!release || typeof release !== 'object' || !Array.isArray(release.assets) || release.draft || release.prerelease) return null
  const assets = release.assets.filter((asset) => {
    if (!asset || typeof asset.name !== 'string' || !asset.name.startsWith('Keylight-') || typeof asset.browser_download_url !== 'string') return false
    const link = asset.browser_download_url
    return link.startsWith(repository) && !/[?#\\\s]/.test(link) && link.endsWith('/' + asset.name) && !asset.name.includes('/')
  })
  const pick = (suffixes) => suffixes.map((suffix) => assets.find((asset) => asset.name.toLowerCase().endsWith(suffix))).find(Boolean) || null
  return {
    tag: typeof release.tag_name === 'string' ? release.tag_name.slice(0, 80) : '',
    mac: pick(['.dmg', '-mac.zip']),
    win: pick(['-setup.exe', '-win-x64.zip']),
    android: pick(['.apk'])
  }
}

export async function refreshDownloads(document) {
  const status = document.getElementById('releaseStatus')
  try {
    const response = await fetch('https://api.github.com/repos/scizerss/keylight-piano/releases/latest', { signal: AbortSignal.timeout(6000) })
    if (!response.ok) { status.textContent = 'Open the releases page for available downloads and installation instructions.'; return }
    const release = releaseDownloads(await response.json())
    if (!release) { status.textContent = 'Open the releases page to choose a download.'; return }
    status.textContent = release.tag ? 'Latest published release: ' + release.tag : 'Published downloads'
    for (const platform of ['mac', 'win', 'android']) {
      const asset = release[platform]
      if (!asset) continue
      const link = document.getElementById(platform + 'Download')
      link.href = asset.browser_download_url
      link.textContent = 'Download ' + (asset.name.endsWith('.zip') ? 'ZIP' : asset.name.split('.').pop().toUpperCase())
      if (platform === 'android') document.getElementById('androidStatus').textContent = 'Published Android build. Read its release notes for supported devices and requirements.'
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    status.textContent = 'Release details could not load. The download links still open the releases page.'
  }
}

if (typeof document !== 'undefined') refreshDownloads(document)

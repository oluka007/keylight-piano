const destinations = new Set([
  'https://ko-fi.com/scizers',
  'https://ko-fi.com/scizers/',
  'https://github.com/scizerss/keylight-piano',
  'https://github.com/scizerss/keylight-piano/issues',
  'https://github.com/scizerss/keylight-piano/releases',
  'https://github.com/scizerss/keylight-piano/releases/latest',
  'https://github.com/demixme/GRAB'
])

// A new GitHub issue with a pre-filled title and body. The check reads the raw string, not a parsed
// URL (parsing would tidy away a user name, port, backslash, capital letters or a trailing dot): the
// text must start with the exact address, then carry exactly the keys title and body, each once, once-encoded.
const ISSUE_NEW = 'https://github.com/scizerss/keylight-piano/issues/new'
const ENCODED = /^(?:[A-Za-z0-9\-._~!*'()]|%[0-9A-F]{2})+$/
function isIssueUrl(value) {
  if (value.length > 2000 || !value.startsWith(ISSUE_NEW + '?')) return false
  const query = value.slice(ISSUE_NEW.length + 1)
  const pairs = query.split('&')
  if (pairs.length !== 2) return false
  const keys = []
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    if (at < 1) return false
    const key = pair.slice(0, at), val = pair.slice(at + 1)
    if (!['title', 'body'].includes(key) || !ENCODED.test(val) || /%25/.test(val)) return false
    keys.push(key)
  }
  if (new Set(keys).size !== 2) return false
  try { const u = new URL(value); return u.origin === 'https://github.com' && u.pathname === '/scizerss/keylight-piano/issues/new' && !u.username && !u.password && !u.port && !u.hash } catch (_e) { return false }
}

function isAllowedExternalUrl(value) {
  if (typeof value !== 'string') return false
  return destinations.has(value) || isIssueUrl(value)
}

function bindExternalNavigation(contents, { isOwn, open }) {
  const openAllowed = (url) => { if (isAllowedExternalUrl(url)) open(url) }
  contents.setWindowOpenHandler(({ url }) => {
    openAllowed(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (isOwn(url)) return
    event.preventDefault()
    openAllowed(url)
  })
}

module.exports = { isAllowedExternalUrl, bindExternalNavigation }

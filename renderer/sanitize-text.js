// The one text sanitiser: the device report (page) and the USB probe (main process) both use it.
/* ---------- text hygiene ---------- */
// Paths are removed whole, spaces included, to the end of the line: a folder called "Jane Doe" or a
// song called "Private Song.mid" must not survive in pieces. The cost is some words after a path.
const PATH = new RegExp([
  String.raw`(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\n]*`, String.raw`\\\\[^\n]*`, String.raw`~\/[^\n]*`,
  String.raw`(?:\/Users|\/home|\/private|\/var|\/Volumes|\/tmp|\/etc|\/opt|\/Library|\/Applications|\/System|\/usr|\/mnt|\/media)(?=\/|\s|$|["'<>])[^\n]*`
].join('|'), 'g')
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g
// A labelled serial loses its value whatever the value looks like, up to the next separator. Plain
// "sn" or "serial" (ordinary words) only count with punctuation or a digit after them.
const SERIAL_STRONG = /\b(s\/n|serial\s*(?:number|no\.?|#)|seriennummer|serien-?nr\.?|num[eé]ro de s[eé]rie|uuid|guid|udid|imei)(?![A-Za-z])(\s*[:=#]?\s*)([^\s,;|]{2,})/gi
const SERIAL_WEAK = /\b(sn|serial)\b(\s*[:=#]\s*|\s+(?=[^\s,;|]*\d))([^\s,;|]{2,})/gi
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const MAC = /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi
const LONG_HEX = /\b(?=[0-9a-f]*\d)[0-9a-f]{12,}\b/gi
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Names that are not a person: parts of a computer or a keyboard name that stay readable.
const COMMON = new Set(['mac', 'mini', 'book', 'macbook', 'pro', 'air', 'imac', 'studio', 'pc', 'desktop', 'laptop', 'local', 'piano', 'keyboard', 'keys', 'usb', 'midi', 'the', 'and', 'ipad', 'iphone', 'phone', 'tablet', 'device', 'user', 'admin', 'home', 'music', 'audio', 'port', 'input', 'output', 'host', 'computer', 'windows', 'apple', 'roli'])
// the names this computer knows (user, home folder, host), whole and in parts: "Cjs-Mac-mini" also gives "Cjs",
// "janedoe" also gives "jane" (prefixes of 4 or more letters). Everyday words stay.
const expandCache = new Map()
function expandNames(redact) {
  const key = redact.join('\u0001')
  if (expandCache.has(key)) return expandCache.get(key)
  const out = new Set()
  for (const raw of redact) {
    const whole = String(raw || '').trim()
    if (whole.length >= 3) out.add(whole)
    for (const part of whole.split(/[^A-Za-z]+/)) {
      for (const word of part.split(/(?<=[a-z])(?=[A-Z])/)) {
        if (word.length < 3 || COMMON.has(word.toLowerCase())) continue
        out.add(word); out.add(word + 's')
        for (let n = 4; n < word.length; n++) { const pre = word.slice(0, n); if (!COMMON.has(pre.toLowerCase())) { out.add(pre); out.add(pre + 's') } }
      }
    }
  }
  const list = [...out].sort((a, b) => b.length - a.length).slice(0, 400)
  if (expandCache.size > 20) expandCache.clear()
  expandCache.set(key, list)
  return list
}
// "Jane's iPad": a capitalised word before 's is taken as the owner's name, whatever the system says.
// A name-like word before it is the owner too, so "Jane Doe's" and "Mary Jane Watson's" lose every word.
const NOT_A_NAME = /^(it|that|there|here|what|who|let|he|she|this|where|how|when|which|everyone|everybody|someone|one|nobody|today|tomorrow|its|here|name|port|device|keyboard|piano|everything|something|nothing|anything|sustain|pedal|mod|wheel|key|note|pitch|bend)$/i
const NAME_WORD = String.raw`[A-ZÀ-Þ][a-zß-ɏ]{1,29}`
const POSSESSIVE = new RegExp(String.raw`(?<![A-Za-z0-9])(?:${NAME_WORD}[ -]){0,2}([A-Za-zÀ-ɏ]{2,30})(['\u2019][sS])(?![A-Za-z])`, 'g')

// keepLines: a note may have line breaks.
export function sanitizeText(value, max = 80, { redact = [], keepLines = false } = {}) {
  let text = String(value == null ? '' : value)
  text = keepLines ? text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ') : text.replace(/[\u0000-\u001f\u007f]/g, ' ')
  // names this computer knows (user, home folder, host) go first, before any partial replacement
  const names = expandNames(redact.map(String))
  // adjacent letter runs that together spell a name ("JANE-DOE" for janedoe, "jane_s") go whole
  {
    const letters = new Set(names.map((n) => n.toLowerCase().replace(/[^a-z]/g, '')).filter((n) => n.length >= 3))
    const runs = [...text.matchAll(/[A-Za-z]+/g)]
    const cuts = []
    for (let i = 0; i < runs.length; i++) {
      let joined = ''
      for (let j = i; j < runs.length && j < i + 4; j++) {
        if (j > i && !/^[^A-Za-z0-9\n'\u2019]{1,3}$/.test(text.slice(runs[j - 1].index + runs[j - 1][0].length, runs[j].index))) break
        joined += runs[j][0].toLowerCase()
        if (j > i && letters.has(joined)) { cuts.push([runs[i].index, runs[j].index + runs[j][0].length]); i = j; break }
      }
    }
    for (const [from, to] of cuts.reverse()) text = text.slice(0, from) + '[user]' + text.slice(to)
  }
  for (const n of names) text = text.replace(new RegExp('(?<![A-Za-z0-9])' + escapeRe(n) + '(?![A-Za-z0-9])', 'gi'), '[user]')
  text = text.replace(POSSESSIVE, (m, word, tail) => (NOT_A_NAME.test(word) || COMMON.has(word.toLowerCase()) ? m : '[name]' + tail))
  text = text.replace(PATH, '[path removed]').replace(EMAIL, '[email removed]').replace(SERIAL_STRONG, '$1$2[removed]').replace(SERIAL_WEAK, '$1$2[removed]')
    .replace(UUID, '[id removed]').replace(MAC, '[id removed]').replace(LONG_HEX, '[id removed]')
  text = text.replace(/`{3,}/g, "'''")
  text = keepLines ? text.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() : text.replace(/\s+/g, ' ').trim()
  const chars = [...text]
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() : text
}


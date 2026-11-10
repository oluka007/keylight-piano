// Tracks what a MIDI keyboard announces about MPE zones, pitch-bend range and
// the sustain pedal while reading Control Change messages. Pure ES module: no
// DOM access and no globals beyond the exported factory.

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value)

export function createMpeState() {
  let rpn = []
  let bend = []
  let sustain = []
  let zones = { lower: null, upper: null }

  function clear() {
    rpn = Array.from({ length: 16 }, () => ({ msb: null, lsb: null }))
    bend = new Array(16).fill(null)
    sustain = new Array(16).fill(false)
    zones = { lower: null, upper: null }
  }
  clear()

  function selectedRpn(channel) {
    const { msb, lsb } = rpn[channel]
    if (msb == null || lsb == null) return null
    if (msb === 127 && lsb === 127) return null
    return { msb, lsb }
  }

  function memberChannels(zone) {
    const members = []
    for (let i = 1; i <= zone.count; i++) members.push(zone.master === 0 ? i : 15 - i)
    return members
  }

  function zoneChannels(zone) {
    return zone ? [zone.master, ...memberChannels(zone)] : []
  }

  function zoneOf(channel) {
    const lower = zones.lower
    if (lower) {
      if (channel === lower.master) return { zone: 'lower', role: 'master' }
      if (channel >= 1 && channel <= lower.count) return { zone: 'lower', role: 'member' }
    }
    const upper = zones.upper
    if (upper) {
      if (channel === upper.master) return { zone: 'upper', role: 'master' }
      if (channel >= 15 - upper.count && channel <= 14) return { zone: 'upper', role: 'member' }
    }
    return null
  }

  function overlap(a, b) {
    const used = new Set([a.master, ...memberChannels(a)])
    const other = [b.master, ...memberChannels(b)]
    return other.some((channel) => used.has(channel))
  }

  function resetChannel(channel) {
    sustain[channel] = false
    bend[channel] = null
    rpn[channel] = { msb: null, lsb: null }
  }

  function configureZone(name, members) {
    const before = {
      lower: zoneChannels(zones.lower),
      upper: zoneChannels(zones.upper)
    }
    if (members === 0) {
      zones[name] = null
    } else {
      const master = name === 'lower' ? 0 : 15
      zones[name] = {
        master,
        count: members,
        memberBend: { semitones: 48, cents: 0 },
        masterBend: { semitones: 2, cents: 0 }
      }
      const other = name === 'lower' ? 'upper' : 'lower'
      while (zones[other] && overlap(zones[name], zones[other])) {
        zones[other].count -= 1
        if (zones[other].count <= 0) zones[other] = null
      }
    }
    for (const zone of ['lower', 'upper']) {
      const beforeSet = new Set(before[zone])
      const afterSet = new Set(zoneChannels(zones[zone]))
      for (const channel of beforeSet) if (!afterSet.has(channel)) resetChannel(channel)
      for (const channel of afterSet) if (!beforeSet.has(channel)) resetChannel(channel)
    }
  }

  function storedBend(channel) {
    const value = bend[channel]
    return value ? value.semitones + value.cents / 100 : null
  }

  function zoneBend(zone, role) {
    return role === 'member' ? zones[zone].memberBend : zones[zone].masterBend
  }

  function dataEntry(channel, isMsb, value) {
    const selected = selectedRpn(channel)
    if (!selected) return null
    if (selected.msb === 0 && selected.lsb === 0) {
      const zone = zoneOf(channel)
      const stored = zone
        ? zoneBend(zone.zone, zone.role)
        : bend[channel] || (bend[channel] = { semitones: 0, cents: 0 })
      if (isMsb) stored.semitones = clamp(value, 0, 96)
      else stored.cents = clamp(value, 0, 99)
      const semitones = stored.semitones + stored.cents / 100
      return { type: 'bendRange', channel, semitones }
    }
    if (selected.msb === 0 && selected.lsb === 6) {
      if (channel !== 0 && channel !== 15) return null
      if (!isMsb) return null
      const zone = channel === 0 ? 'lower' : 'upper'
      const members = clamp(value, 0, 15)
      configureZone(zone, members)
      return { type: 'zone', zone, members }
    }
    return null
  }

  function feed(status, d1, d2) {
    if (typeof status !== 'number' || status < 0xB0 || status > 0xBF) return null
    const channel = status & 0x0F
    if (d1 === 101) { rpn[channel].msb = d2; return null }
    if (d1 === 100) { rpn[channel].lsb = d2; return null }
    if (d1 === 99 || d1 === 98) { rpn[channel] = { msb: null, lsb: null }; return null }
    if (d1 === 6) return dataEntry(channel, true, d2)
    if (d1 === 38) return dataEntry(channel, false, d2)
    if (d1 === 64) {
      sustain[channel] = d2 >= 64
      return { type: 'sustain', channel, down: sustain[channel] }
    }
    return null
  }

  function zoneList() {
    const build = (zone) => zone && { master: zone.master, members: memberChannels(zone) }
    return { lower: build(zones.lower) || null, upper: build(zones.upper) || null }
  }

  function bendRangeFor(channel) {
    const zone = zoneOf(channel)
    if (zone) {
      const stored = zoneBend(zone.zone, zone.role)
      return stored.semitones + stored.cents / 100
    }
    return storedBend(channel)
  }

  function sustainFor(channel) {
    if (sustain[channel]) return true
    const zone = zoneOf(channel)
    if (zone && zone.role === 'member') return sustain[zones[zone.zone].master]
    return false
  }

  return {
    feed,
    zones: zoneList,
    zoneOf,
    bendRangeFor,
    sustainFor,
    reset: clear
  }
}

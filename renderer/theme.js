// Design tokens: Keylight's colours and layout constants.
// style.css :root carries the same palette as CSS tokens (the screens and the player canvas
// read those); the canvas and the key lights take the hand, judgement and playground colours
// from here.
export const COLORS = {
  bgMid: '#151245',
  bgDark: '#12122D',
  bgLight: '#221D7A',
  bgExtraLight: '#28228B',
  bgMidLight: '#1A175F',
  navBg: '#28228B',
  navBgLight: '#3B32C5',
  onboardingBg: '#3B32C5',
  body: '#FFFFFF',
  // the original used white at 40%, which fails contrast on every surface; 62% reads at 5.6:1 or better
  bodySecondary: 'rgba(255,255,255,0.62)',
  primaryAction: '#0064C8',
  primaryActionLight: '#3D8BFF',   // links, hover, progress
  secondaryAction: '#64C850',
  connected: '#00A482',
  levelBadge: '#00A482',           // "Level 1" badges on covers
  disconnected: '#FC0423',
  pureWhite: '#FFFFFF',
  notification: '#FC0423',
  listPanel: '#1B175E',
  tooltipBg: '#251975',
  scoring: {
    perfect: '#A3FFEB',
    good: '#FFCE48',
    early: '#B28EF3',
    late: '#FFA0C5',
    missed: '#E16E73',
    gradient: ['#FF9B67', '#FFAB54', '#FFCE48', '#DCFFA0', '#93FF8E']
  },
  stars: { gold: '#F5BE27', silver: '#FFFFFF', empty: 'rgba(255,255,255,0.2)' },
  hand: { left: '#3D8BFF', right: '#FF8A3D' },
  // the Playground's twelve note colours, one per pitch class
  playground: ['#F47676', '#F39271', '#F2B363', '#F0D665', '#F0F36E', '#AAF089',
    '#6DE8A5', '#47CEE1', '#7A9AE6', '#A390EE', '#C386DF', '#F189BE']
}

export const FONTS = {
  // Outfit (renderer/fonts, OFL): a free geometric sans close to the original's look
  regular: '"Outfit", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  display: '"Outfit", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
}

export const LAYOUT = {
  songFooterCollapsed: 74,
  songFooterExpanded: 326,
  cardRadius: 12,
  hudButton: 42,
  hudGap: 5,
  navHeight: 64,
  headerHeight: 56
}

export const NOTE_VIEWS = ['CASCADE', 'RAINBOW', 'COLORNOTE', 'CLASSIC', 'SHEET']
export const NOTE_LABELS = ['off', 'names', 'fingers']
export const MODES = ['WATCH', 'PRACTISE', 'PLAY']

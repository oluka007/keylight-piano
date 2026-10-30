// Which computer Keylight runs on, for the few words and steps that differ. The page has
// no Node (contextIsolation), so it asks the browser. ?platform=win (or mac) shows the
// other one's page, for screenshots and checks on one machine.
const forced = new URLSearchParams(location.search).get('platform')
const reported = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''
export const IS_WIN = forced ? forced === 'win' : /^win/i.test(reported)

// "Reset your progress on this Mac?" and the like
export const THIS_COMPUTER = IS_WIN ? 'this computer' : 'this Mac'
// where main.js saves takes: app.getPath('videos')/Keylight
export const TAKES_FOLDER = IS_WIN ? 'Videos › Keylight' : 'Movies › Keylight'

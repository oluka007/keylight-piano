import { BackupError, EXTENSION, createBackup, restoreBackup } from './backup-format.js'
import { downloadFile } from './download.js'
export { BackupError, MAGIC, VERSION, EXTENSION, createBackup, readBackup, restoreBackup } from './backup-format.js'

const songsText = (count) => count + (count === 1 ? ' song' : ' songs')
export function downloadBackup({ blob, name }) { downloadFile(blob, name) }

export function mountBackupControls(container, { listSongs, saveSongs, storage, notice, onRestored }) {
  const make = (text) => Object.assign(document.createElement('button'), { type: 'button', className: 'ghost', textContent: text })
  const backup = make('Back up songs and progress')
  const restore = make('Restore a backup')
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: EXTENSION, hidden: true })
  let busy = false
  const run = async (action) => {
    if (busy) return
    busy = backup.disabled = restore.disabled = true
    try { await action() } catch (error) {
      if (!(error instanceof Error)) throw error
      notice(error instanceof BackupError ? error.message : 'That did not work: ' + error.message)
    } finally { busy = backup.disabled = restore.disabled = false }
  }
  backup.onclick = () => run(async () => {
    const result = await createBackup({ songs: await listSongs(), storage })
    downloadBackup(result)
    notice(`Backup download requested: ${songsText(result.songs)} with your settings and progress` +
      (result.skipped.length ? `. Left out: ${result.skipped.map((song) => `${song.title} (${song.reason})`).join('; ')}` : ''))
  })
  restore.onclick = () => input.click()
  input.onchange = () => run(async () => {
    const file = input.files && input.files[0]
    input.value = ''
    if (!file) return
    const result = await restoreBackup(file, {
      saveSongs, storage,
      confirm: (plan) => confirm(`Restore the backup from ${new Date(plan.created).toLocaleString()}?\n\n` +
        `${songsText(plan.songs.length)} and ${Object.keys(plan.storage).length} saved settings and progress entries are added. ` +
        'Songs and entries with the same identity are replaced; everything else you have stays.')
    })
    if (result.restored) { notice(`Restored ${songsText(result.songs)} and your settings and progress`); onRestored(result) }
  })
  container.append(backup, restore, input)
  return { backup, restore }
}

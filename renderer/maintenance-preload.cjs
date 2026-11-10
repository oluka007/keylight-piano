// Bridge of the hidden maintenance page (renderer/maintenance.html) only: one call into the
// main process, which answers only the helper window it opened for the current job.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('keylightMaintenance', {
  call: (name, payload) => ipcRenderer.invoke('maintenance', String(name), payload)
})

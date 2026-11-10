// The only bridge between the page and the main process: the experimental Airwave tracking
// source. The page can start/stop Keylight's helper and receive its sanitised messages.
const { contextBridge, ipcRenderer } = require('electron')

const listeners = new Set()
ipcRenderer.on('airwave:message', (_event, message) => { for (const fn of listeners) fn(message) })
const daemonListeners = new Set()
ipcRenderer.on('daemon:status', (_event, status) => { for (const fn of daemonListeners) fn(status) })
contextBridge.exposeInMainWorld('keylightNative', {
  // the light daemon the app runs: { state: starting | ready | failed | external | none, port, reason }
  daemon: {
    status: () => ipcRenderer.invoke('daemon:status'),
    retry: () => ipcRenderer.invoke('daemon:retry'),
    onStatus(fn) { daemonListeners.add(fn); return () => daemonListeners.delete(fn) }
  },
  // the "Support my device" step: USB descriptors read by the main process (no serials, no locations)
  deviceUsb: () => ipcRenderer.invoke('device:usb'),
  airwave: {
    start: () => ipcRenderer.invoke('airwave:start'),
    stop: () => ipcRenderer.invoke('airwave:stop'),
    diagnostics: () => ipcRenderer.invoke('airwave:diagnostics'),
    onMessage(fn) { listeners.add(fn); return () => listeners.delete(fn) }
  }
})

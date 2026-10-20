const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  save: (d) => ipcRenderer.invoke('save', d),
  openExternal: (u) => ipcRenderer.invoke('open-external', u)
});

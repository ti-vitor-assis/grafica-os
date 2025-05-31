/**
 * 
 * @Author Vitor de Assis Passos
 */

const { ipcRenderer, contextBridge } = require('electron')

ipcRenderer.send('db-connect')

contextBridge.exposeInMainWorld('api',{
    dbStatus: (message) => ipcRenderer.on('db-status', message),
})
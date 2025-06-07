/**
 * 
 * @Author Vitor de Assis Passos
 */

const { ipcRenderer, contextBridge } = require('electron')

ipcRenderer.send('db-connect')

// permissões para estabelecer a comunicação entre processos
contextBridge.exposeInMainWorld("api", {
  dbStatus: (message) => ipcRenderer.on("db-status", message),
  aboutExit: () => ipcRenderer.send("about-exit"),
  createCliente: (cliente) => ipcRenderer.send("create-cliente", cliente),
  clientWindow: () => ipcRenderer.on("cliente-window"),
  resetForm: (args) => ipcRenderer.on("reset-form", args),
  cpfDuplicate: (args) => ipcRenderer.on("cpf-duplicate", args),
  searchName: (cliName) => ipcRenderer.send("search-name", cliName),
  searchCpf: (cpfCli) => ipcRenderer.send("search-cpf", cpfCli),
  renderClient: (client) => ipcRenderer.on("render-client", client),
  validateSearch: () => ipcRenderer.send("validate-search"),
  setName: (args) => ipcRenderer.on("set-name", args),
  setCpf: (args) => ipcRenderer.on("set-cpf", args),
  deleteClient: (id) => ipcRenderer.send("delete-client", id),
  updateClient: (client) => ipcRenderer.send("update-client", client),
  searchOrder: (clientOrCpf) => ipcRenderer.send("search-order", clientOrCpf),
  receiveOrder: (args) => ipcRenderer.on("order-result", args),
});

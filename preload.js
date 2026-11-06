/**
 *
 * @Author Vitor de Assis Passos
 */

const { ipcRenderer, contextBridge } = require('electron')

ipcRenderer.send('db-connect')

// permissões para estabelecer a comunicação entre processos
// Os nomes dos canais aqui precisam ser exatamente os mesmos usados no main.js
contextBridge.exposeInMainWorld("api", {
  dbStatus: (message) => ipcRenderer.on("db-status", message),

  // Clientes
  createCliente: (cliente) => ipcRenderer.send("create-cliente", cliente),
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

  // Ordens de Serviço
  createOrder: (order) => ipcRenderer.send("create-order", order),
  updateOrder: (order) => ipcRenderer.send("update-order", order),
  deleteOrder: (id) => ipcRenderer.send("delete-order", id),
  searchOrder: (clienteId) => ipcRenderer.send("search-order", clienteId),
  receiveOrder: (args) => ipcRenderer.on("order-result", args),
});

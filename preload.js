/**
 *
 * @Author Vitor de Assis Passos
 */

const { ipcRenderer, contextBridge } = require('electron')

// Status do banco: o preload escuta desde o início e guarda o último valor.
// Assim, se a resposta chegar antes de a página registrar o callback
// (os scripts do CDN podem demorar a carregar), o status não se perde.
let dbStatusAtual = null
const dbStatusCallbacks = []
ipcRenderer.on('db-status', (event, status) => {
  dbStatusAtual = status
  dbStatusCallbacks.forEach((cb) => cb(event, status))
})

ipcRenderer.send('db-connect')

// permissões para estabelecer a comunicação entre processos
// Os nomes dos canais aqui precisam ser exatamente os mesmos usados no main.js
contextBridge.exposeInMainWorld("api", {
  dbStatus: (callback) => {
    dbStatusCallbacks.push(callback)
    if (dbStatusAtual !== null) callback(null, dbStatusAtual)
  },

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

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

  // Configuração do banco de dados
  openDbConfig: () => ipcRenderer.send("open-db-config"),
  dbConfigInfo: () => ipcRenderer.send("db-config-info"),
  receiveDbConfigInfo: (args) => ipcRenderer.on("db-config-info", args),
  testDbConfig: (url) => ipcRenderer.send("db-config-test", url),
  saveDbConfig: (url) => ipcRenderer.send("db-config-save", url),
  dbConfigResult: (args) => ipcRenderer.on("db-config-result", args),

  // Login e sessão
  loginInfo: () => ipcRenderer.send("login-info"),
  receiveLoginInfo: (args) => ipcRenderer.on("login-info", args),
  login: (dados) => ipcRenderer.send("login", dados),
  createFirstAdmin: (dados) => ipcRenderer.send("create-first-admin", dados),
  loginError: (args) => ipcRenderer.on("login-error", args),
  getSession: () => ipcRenderer.send("get-session"),
  receiveSession: (args) => ipcRenderer.on("session", args),

  // Fornecedores
  createSupplier: (f) => ipcRenderer.send("create-supplier", f),
  searchSupplier: (termo) => ipcRenderer.send("search-supplier", termo),
  updateSupplier: (f) => ipcRenderer.send("update-supplier", f),
  deleteSupplier: (id) => ipcRenderer.send("delete-supplier", id),
  receiveSuppliers: (args) => ipcRenderer.on("supplier-result", args),

  // Insumos (estoque)
  searchSupply: (termo) => ipcRenderer.send("search-supply", termo),
  createSupply: (i) => ipcRenderer.send("create-supply", i),
  updateSupply: (i) => ipcRenderer.send("update-supply", i),
  moveSupply: (mov) => ipcRenderer.send("move-supply", mov),
  deleteSupply: (id) => ipcRenderer.send("delete-supply", id),
  receiveSupplies: (args) => ipcRenderer.on("supply-result", args),
  supplyMoved: (args) => ipcRenderer.on("supply-moved", args),

  // Usuários (administrador)
  listUsers: () => ipcRenderer.send("list-users"),
  receiveUsers: (args) => ipcRenderer.on("users-list", args),
  createUser: (dados) => ipcRenderer.send("create-user", dados),
  updateUser: (dados) => ipcRenderer.send("update-user", dados),

  // Abrir janelas a partir da tela inicial ('clientes', 'os' ou 'produtos')
  openWindow: (nome) => ipcRenderer.send("open-window", nome),

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

  // Produtos
  createProduct: (produto) => ipcRenderer.send("create-product", produto),
  searchProduct: (termo) => ipcRenderer.send("search-product", termo),
  updateProduct: (produto) => ipcRenderer.send("update-product", produto),
  deleteProduct: (id) => ipcRenderer.send("delete-product", id),
  renderProduct: (args) => ipcRenderer.on("render-product", args),
  setProductName: (args) => ipcRenderer.on("set-product-name", args),

  // Ordens de Serviço
  createOrder: (order) => ipcRenderer.send("create-order", order),
  updateOrder: (order) => ipcRenderer.send("update-order", order),
  deleteOrder: (id) => ipcRenderer.send("delete-order", id),
  printOrder: (id) => ipcRenderer.send("print-order", id),
  // filtro: { numero } ou { clienteId }
  searchOrder: (filtro) => ipcRenderer.send("search-order", filtro),
  receiveOrder: (args) => ipcRenderer.on("order-result", args),
  listProducts: () => ipcRenderer.send("list-products"),
  receiveProducts: (args) => ipcRenderer.on("products-list", args),

  // Orçamentos
  createQuote: (q) => ipcRenderer.send("create-quote", q),
  updateQuote: (q) => ipcRenderer.send("update-quote", q),
  deleteQuote: (id) => ipcRenderer.send("delete-quote", id),
  refuseQuote: (id) => ipcRenderer.send("refuse-quote", id),
  convertQuote: (id) => ipcRenderer.send("convert-quote", id),
  printQuote: (id) => ipcRenderer.send("print-quote", id),
  // filtro: { numero } ou { clienteId }
  searchQuote: (filtro) => ipcRenderer.send("search-quote", filtro),
  receiveQuote: (args) => ipcRenderer.on("quote-result", args),

  // Dashboard (tela inicial)
  requestDashboard: () => ipcRenderer.send("dashboard-data"),
  receiveDashboard: (args) => ipcRenderer.on("dashboard-data", args),
  onDashboardChanged: (args) => ipcRenderer.on("dashboard-changed", args),

  // Relatórios: pedido = { tipo, inicio, fim }
  generateReport: (pedido) => ipcRenderer.send("generate-report", pedido),

  // Aviso genérico (caixa de diálogo do sistema)
  warn: (mensagem) => ipcRenderer.send("show-warning", mensagem),
});

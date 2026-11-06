/**
 * Main
 * @author Vitor de Assis Passos
 */

console.log("Executando Processo Principal")

const { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog, shell, powerMonitor, session } = require("electron/main")

const path = require("node:path")

const packageInfo = require("./package.json")

const {
  conectar, desconectar, definirUrl, temUrl, estaConectado, testarConexao, urlDoAmbiente,
} = require('./database.js')
const configuracao = require('./src/configuracao.js')

const clienteModel = require("./src/model/Clientes.js");
const serviceOrderModel = require('./src/model/ServiceOrder.js')
const productModel = require('./src/model/Products.js')
const quoteModel = require('./src/model/Quote.js')
const usuarioModel = require('./src/model/Usuario.js')
const fornecedorModel = require('./src/model/Fornecedor.js')
const insumoModel = require('./src/model/Insumo.js')

const { gerarPDF } = require('./src/print/pdf.js')
const { htmlOS } = require('./src/print/osTemplate.js')
const { htmlOrcamento } = require('./src/print/quoteTemplate.js')
const { htmlRelatorio } = require('./src/print/reportTemplate.js')
const relatorios = require('./src/reports/relatorios.js')
const { limparEntrada } = require('./src/seguranca/entrada.js')
const cripto = require('./src/seguranca/cripto.js')
const arquivoChave = require('./src/seguranca/arquivoChave.js')
const configuracaoModel = require('./src/model/Configuracao.js')
const servicoClientes = require('./src/servicos/clientes.js')
const lgpd = require('./src/servicos/lgpd.js')
const auditoria = require('./src/servicos/auditoria.js')
const migracao = require('./src/servicos/migracao.js')

let win

// Usuário que fez login ({ _id, nome, login, perfil, ativo }) ou null
let usuarioLogado = null

// Registro de auditoria em nome de quem está logado (não espera gravar)
function auditar(acao, referencia, detalhe) {
  auditoria.registrar(usuarioLogado && usuarioLogado.login, acao, referencia, detalhe)
}
let janelaLogin = null

// O que cada perfil pode fazer
const PERMISSOES = {
  administrador: ["clientes", "orcamentos", "os", "produtos", "relatorios", "financeiro", "excluir", "usuarios", "estoque", "configuracao"],
  atendente: ["clientes", "orcamentos", "os", "relatorios"],
  "produção": ["os", "estoque"],
}

function pode(permissao) {
  return !!usuarioLogado && (PERMISSOES[usuarioLogado.perfil] || []).includes(permissao)
}

function avisoSemPermissao(event) {
  const perfil = usuarioLogado ? usuarioLogado.perfil : "sem login"
  dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: "warning",
    title: "Acesso negado",
    message: `Seu perfil (${perfil}) não tem permissão para fazer isso.`,
    buttons: ["OK"],
  })
}

// Registra um handler IPC que só roda se o usuário logado tiver a permissão.
// É aqui que as permissões valem de verdade: esconder botões na tela é só
// conveniência, porque a tela pode ser alterada (ex.: pelo DevTools).
function ipcComPermissao(canal, permissao, handler) {
  ipcOn(canal, (event, ...args) => {
    if (!pode(permissao)) return avisoSemPermissao(event)
    return handler(event, ...args)
  })
}

// Todo handler IPC do app é registrado por aqui: os argumentos que chegam
// das telas passam por limparEntrada() (sem operadores "$" nem __proto__)
function ipcOn(canal, handler) {
  ipcMain.on(canal, (event, ...args) => {
    if (!origemConfiavel(event)) {
      console.log(`IPC "${canal}" recusado: origem desconhecida`)
      return
    }
    return handler(event, ...args.map((arg) => limparEntrada(arg)))
  })
}

// =============================
// =========== TEMA ============

// "claro" ou "escuro", salvo no config.json deste computador
function temaAtual() {
  return configuracao.lerPreferencia("tema", "claro")
}

// Cor de fundo da janela enquanto a tela carrega (evita piscar branco no tema escuro)
function corDeFundo() {
  return temaAtual() === "escuro" ? "#161625" : "#F4F3F8"
}

function aplicarTema(tema) {
  configuracao.salvarPreferencia("tema", tema)
  nativeTheme.themeSource = tema === "escuro" ? "dark" : "light"
  // Todas as janelas abertas trocam na hora
  BrowserWindow.getAllWindows().forEach((janela) => janela.webContents.send("theme-changed", tema))
  // Atualiza a marcação do item "Tema escuro" no menu
  if (usuarioLogado) Menu.setApplicationMenu(Menu.buildFromTemplate(montarMenu()))
}

// O preload pergunta o tema de forma síncrona, antes de a tela aparecer
ipcOn("get-theme", (event) => {
  event.returnValue = temaAtual()
})

ipcOn("toggle-theme", () => {
  aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro")
})

// INICIO - Janelas

// No app instalado não há DevTools nem "Recarregar". Rodando pelo código
// (npm start) eles continuam disponíveis. GRAFICA_SIMULAR_INSTALADO=1 faz o
// modo de desenvolvimento se comportar como o instalado (usado nos testes).
const modoDesenvolvimento = !app.isPackaged && process.env.GRAFICA_SIMULAR_INSTALADO !== "1"

// Opções das telas do app (todas usam o mesmo preload). As três primeiras
// já são o padrão do Electron, mas ficam explícitas: a tela não tem acesso
// ao Node, roda isolada e só fala com o main pelo preload (window.api)
function preferenciasJanela() {
  return {
    preload: path.join(__dirname, "preload.js"),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    devTools: modoDesenvolvimento,
  }
}

// Só as telas do próprio app (arquivos de src/views) podem conversar com o main
function origemConfiavel(event) {
  const frame = event.senderFrame
  if (!frame || !frame.url) return false
  try {
    const url = new URL(frame.url)
    return url.protocol === "file:" && decodeURIComponent(url.pathname).replace(/\\/g, "/").includes("/src/views/")
  } catch (erro) {
    return false
  }
}

// Nenhuma tela abre janelas novas nem navega para fora do app (um link ou
// script malicioso não leva o usuário a um site falso dentro do programa)
app.on("web-contents-created", (_, conteudo) => {
  conteudo.setWindowOpenHandler(() => ({ action: "deny" }))
  conteudo.on("will-navigate", (evento, url) => {
    if (!url.startsWith("file://")) evento.preventDefault()
  })
  conteudo.on("will-attach-webview", (evento) => evento.preventDefault())
})

// Tela de login: é a primeira janela do app
// motivo (opcional): por que a sessão anterior terminou ("inatividade", "bloqueio")
function loginWindow(motivo) {
  nativeTheme.themeSource = temaAtual() === "escuro" ? "dark" : "light"
  Menu.setApplicationMenu(null)
  janelaLogin = new BrowserWindow({
    width: 440,
    height: 640,
    resizable: false,
    maximizable: false,
    backgroundColor: corDeFundo(),
    title: "Gráfica OS · Login",
    webPreferences: preferenciasJanela(),
  })
  janelaLogin.loadFile("./src/views/login.html", {
    query: motivo ? { motivo, minutos: String(MINUTOS_INATIVIDADE) } : {},
  })
  janelaLogin.on("closed", () => {
    janelaLogin = null
  })
}

// Janela principal: só abre depois do login
const createWindow = () => {
  nativeTheme.themeSource = temaAtual() === "escuro" ? "dark" : "light"
  win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: corDeFundo(),
    // Preload
    webPreferences: preferenciasJanela(),
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(montarMenu()))
  win.loadFile("./src/views/index.html")
}

// Cria uma janela modal (filha da janela principal) com o arquivo HTML informado.
// As telas de cadastro usam o tamanho padrão; "opcoes" permite mudar o
// tamanho e passar parâmetros na URL (query), lidos pela tela em location.search
function modalWindow(arquivoHtml, opcoes = {}) {
  if (!win) return null;
  const janela = new BrowserWindow({
    width: opcoes.width || 1180,
    height: opcoes.height || 740,
    minWidth: opcoes.minWidth || 960,
    minHeight: opcoes.minHeight || 600,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: false,
    backgroundColor: corDeFundo(),
    parent: win,
    modal: true,
    webPreferences: preferenciasJanela(),
  });
  janela.loadFile(arquivoHtml, { query: opcoes.query || {} });
  return janela;
}

// Clientes
function costumerRegistrationWindow() {
  return modalWindow("./src/views/costumerRegistration.html");
}

// Ordem de Serviços
function serviceOrderRegistrationWindow() {
  return modalWindow("./src/views/serviceOrderRegistration.html");
}

// Produtos e Serviços
function productRegistrationWindow() {
  return modalWindow("./src/views/productRegistration.html");
}

// Orçamentos
function quoteRegistrationWindow() {
  return modalWindow("./src/views/quoteRegistration.html");
}

// Fornecedores
function supplierRegistrationWindow() {
  return modalWindow("./src/views/supplierRegistration.html");
}

// Estoque de insumos
function stockWindow() {
  return modalWindow("./src/views/stock.html");
}

// Usuários (só administrador)
function userRegistrationWindow() {
  return modalWindow("./src/views/userRegistration.html", { width: 980, height: 660, minWidth: 820 });
}

// Relatórios (tipo = relatório já selecionado ao abrir, ex.: "entregues")
function reportsWindow(tipo) {
  return modalWindow("./src/views/reports.html", {
    width: 960,
    height: 700,
    minWidth: 760,
    minHeight: 560,
    query: tipo ? { tipo } : {},
  });
}

// Botões da tela inicial pedem para abrir uma janela pelo nome.
// Só os nomes desta lista são aceitos.
// O nome da janela é também a permissão necessária para abri-la.
const janelasPorNome = {
  clientes: costumerRegistrationWindow,
  os: serviceOrderRegistrationWindow,
  produtos: productRegistrationWindow,
  orcamentos: quoteRegistrationWindow,
  relatorios: () => reportsWindow(),
  usuarios: userRegistrationWindow,
  fornecedores: supplierRegistrationWindow,
  estoque: stockWindow,
};
// Janelas cujo nome não é igual à permissão
const permissaoDaJanela = { fornecedores: "estoque" };
ipcOn("open-window", (event, nome) => {
  const abrir = janelasPorNome[nome];
  if (!abrir) return;
  if (!pode(permissaoDaJanela[nome] || nome)) return avisoSemPermissao(event);
  abrir();
});

// Sobre
function aboutWindow() {
  dialog.showMessageBox(BrowserWindow.getFocusedWindow() || win, {
    type: "info",
    title: "Sobre",
    message: "Gráfica OS",
    detail:
      `${packageInfo.description}\n\n` +
      `Versão: ${packageInfo.version}\n` +
      `Autor: ${packageInfo.author}\n` +
      `Licença: ${packageInfo.license}`,
    buttons: ["OK"],
  });
}

// =============================
// == CONFIGURAÇÃO DO BANCO ====

// Tela "Configurar banco de dados". Abre sozinha na primeira vez (sem banco
// configurado), pela tela de login quando a conexão falha, ou pelo menu
// Ferramentas (só administrador).
let janelaConfigBanco = null
function dbConfigWindow() {
  if (janelaConfigBanco && !janelaConfigBanco.isDestroyed()) {
    janelaConfigBanco.focus()
    return janelaConfigBanco
  }
  const pai = (usuarioLogado && win) || janelaLogin || undefined
  janelaConfigBanco = new BrowserWindow({
    width: 640,
    height: 640,
    resizable: false,
    backgroundColor: corDeFundo(),
    maximizable: false,
    autoHideMenuBar: true,
    parent: pai,
    modal: !!pai,
    webPreferences: preferenciasJanela(),
  })
  janelaConfigBanco.loadFile("./src/views/dbConfig.html")
  janelaConfigBanco.on("closed", () => {
    janelaConfigBanco = null
    // Primeira configuração cancelada: sem banco não há o que fazer
    if (BrowserWindow.getAllWindows().length === 0) app.quit()
  })
  return janelaConfigBanco
}

// Quem pode mexer na configuração: o administrador logado, ou qualquer um
// enquanto ninguém está logado E o banco não está funcionando (primeira
// configuração ou banco fora do ar). Com o banco funcionando, só o admin.
function podeConfigurarBanco() {
  if (usuarioLogado) return pode("configuracao")
  // Sem ninguém logado: só com o banco fora do ar ou faltando a chave
  return !estaConectado() || estadoChaves === "ausente"
}

ipcOn("open-db-config", (event) => {
  if (!podeConfigurarBanco()) return avisoSemPermissao(event)
  dbConfigWindow()
})

ipcOn("db-config-info", (event) => {
  const salva = configuracao.lerUrlBanco()
  event.reply("db-config-info", {
    origemAmbiente: urlDoAmbiente,
    urlAtual: urlDoAmbiente ? "" : configuracao.mascararUrl(salva),
    conectado: estaConectado(),
    chaves: {
      estado: estadoChaves,
      podeExportar: estadoChaves === "ok" && pode("configuracao"),
      podeImportar: estadoChaves === "ausente" || pode("configuracao"),
    },
  })
})

// ===== Chaves de criptografia dos documentos (CPF/CNPJ) =====
// "ok": este computador tem as chaves deste banco
// "ausente": o banco já tem dados de outro computador e as chaves daqui
//            não batem (é preciso importar o arquivo de chave)
// "pendente": ainda não conectou
let estadoChaves = "pendente"
let preparoChaves = null

function prepararChaves() {
  if (!preparoChaves) {
    preparoChaves = verificarChaves()
      .then(() => estadoChaves === "ok" && migrarBanco())
      .catch((erro) => {
        console.log("Erro ao verificar as chaves:", erro.message)
        preparoChaves = null
      })
  }
  return preparoChaves
}

// Atualiza bancos de versões anteriores (uma vez; ver src/servicos/migracao.js).
// Se falhar, o app segue e tenta de novo na próxima abertura.
async function migrarBanco() {
  try {
    const r = await migracao.migrar({ pastaBackup: path.join(app.getPath("userData"), "backups") })
    if (r.ocupado) console.log("Migração do banco em andamento em outro computador")
    for (const etapa of r.executadas) {
      const resumo = Object.entries(etapa.resultado).map(([k, v]) => `${k}: ${v}`).join(", ")
      console.log(`Migração "${etapa.nome}" concluída (${resumo})`)
      auditoria.registrar("sistema", "migração do banco", etapa.nome, resumo)
    }
    if (r.backup) console.log("Backup (cifrado) antes da migração:", r.backup)
  } catch (erro) {
    console.log("Erro na migração do banco:", erro.message)
  }
}

async function verificarChaves() {
  const locais = configuracao.lerChaves()
  cripto.definirChaves(locais)
  const registro = await configuracaoModel.findById("impressaoChaves")

  if (!registro) {
    // Banco novo (ou de antes da criptografia): este computador define as chaves
    if (!locais) {
      const novas = cripto.gerarChaves()
      configuracao.salvarChaves(novas)
      cripto.definirChaves(novas)
    }
    try {
      await configuracaoModel.create({ _id: "impressaoChaves", valor: cripto.impressaoChaves() })
    } catch (erro) {
      // Outro computador gravou ao mesmo tempo: confere de novo
      if (erro.code === 11000) return verificarChaves()
      throw erro
    }
    estadoChaves = "ok"
    return
  }

  if (locais && registro.valor === cripto.impressaoChaves()) {
    estadoChaves = "ok"
  } else {
    // Não usa chaves que não são deste banco (gravaria dados que os outros
    // computadores não conseguiriam ler)
    cripto.definirChaves(null)
    estadoChaves = "ausente"
  }
}

const MENSAGEM_CHAVE_AUSENTE =
  "Este computador ainda não tem a chave de segurança deste banco. " +
  "Importe o arquivo de chave em \"Configurar banco de dados\"."

// Exporta as chaves num arquivo protegido por senha (só administrador)
ipcComPermissao("export-key", "configuracao", async (event, senha) => {
  const janela = BrowserWindow.fromWebContents(event.sender)
  try {
    if (estadoChaves !== "ok") throw new Error("As chaves deste computador não estão configuradas.")
    const conteudo = arquivoChave.criarArquivo(configuracao.lerChaves(), cripto.impressaoChaves(), senha)
    const { canceled, filePath } = await dialog.showSaveDialog(janela, {
      title: "Salvar arquivo de chave",
      defaultPath: path.join(app.getPath("documents"), "grafica-os-chave.json"),
      filters: [{ name: "Chave do Gráfica OS", extensions: ["json"] }],
    })
    if (canceled || !filePath) return event.reply("key-result", { ok: false, cancelado: true })
    require("node:fs").writeFileSync(filePath, conteudo)
    auditar("chave de segurança exportada")
    event.reply("key-result", { ok: true, mensagem: "Arquivo de chave salvo. Guarde-o em local seguro, junto com a senha." })
  } catch (erro) {
    event.reply("key-result", { ok: false, mensagem: erro.message })
  }
})

// Importa as chaves de outro computador da gráfica
ipcOn("import-key", async (event, pedido) => {
  if (!(estadoChaves === "ausente" || pode("configuracao"))) return avisoSemPermissao(event)
  try {
    const { chaves } = arquivoChave.lerArquivo(String(pedido.conteudo || ""), pedido.senha)
    const anteriores = configuracao.lerChaves()
    cripto.definirChaves(chaves)
    const registro = await configuracaoModel.findById("impressaoChaves")
    if (registro && registro.valor !== cripto.impressaoChaves()) {
      cripto.definirChaves(estadoChaves === "ok" ? anteriores : null)
      throw new Error("Este arquivo de chave é de outro banco de dados.")
    }
    configuracao.salvarChaves(chaves)
    preparoChaves = null
    auditar("chave de segurança importada")
    await prepararChaves()
    event.reply("key-result", { ok: true, importada: true, mensagem: "Chave importada. Este computador já pode usar o sistema." })
    if (!usuarioLogado && janelaLogin) janelaLogin.reload()
  } catch (erro) {
    event.reply("key-result", { ok: false, mensagem: erro.message })
  }
})

ipcOn("db-config-test", async (event, url) => {
  if (!podeConfigurarBanco()) return avisoSemPermissao(event)
  event.reply("db-config-result", await testarConexao(String(url || "").trim()))
})

ipcOn("db-config-save", async (event, url) => {
  if (!podeConfigurarBanco()) return avisoSemPermissao(event)
  if (urlDoAmbiente) return
  url = String(url || "").trim()

  // Só salva uma conexão que funciona
  const teste = await testarConexao(url)
  if (!teste.ok) return event.reply("db-config-result", teste)

  configuracao.salvarUrlBanco(url)
  await desconectar()
  definirUrl(url)
  await conectar()
  // Banco novo: confere de novo se as chaves deste computador servem para ele
  preparoChaves = null
  await prepararChaves()

  // Banco novo = usuários novos: volta para o login (ou abre o login)
  if (usuarioLogado) {
    trocarUsuario()
  } else if (janelaLogin) {
    janelaLogin.reload()
  } else {
    loginWindow()
  }
  if (janelaConfigBanco && !janelaConfigBanco.isDestroyed()) janelaConfigBanco.close()
})

// FIM - Janelas

app.whenReady().then(() => {

  // URL salva pela tela de configuração (se não vier do .env/ambiente)
  if (!urlDoAmbiente) definirUrl(configuracao.lerUrlBanco())

  // Antes do login não há menu (o padrão do Electron, em inglês, não serve)
  Menu.setApplicationMenu(null);

  // Bloquear a tela do Windows (Win+L) encerra a sessão do app
  powerMonitor.on("lock-screen", () => encerrarSessao("bloqueio"));

  // O app não usa câmera, microfone, localização, notificações etc.: nega tudo
  session.defaultSession.setPermissionRequestHandler((conteudo, permissao, responder) => responder(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  // Sem banco configurado: começa pela configuração em vez do login
  if (temUrl()) {
    loginWindow();
  } else {
    dbConfigWindow();
  }

  // Cada janela pede a conexão ao carregar (preload.js) e recebe o status
  // para atualizar o ícone do rodapé
  ipcOn("db-connect", async (event) => {
    const ok = await conectar();
    if (ok) await prepararChaves();
    setTimeout(() => {
      event.reply("db-status", ok ? "conectado" : "desconectado")
    }, 500)
  })
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      loginWindow();
    }
  })
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await desconectar();
});

// =============================
// =========== LOGIN ===========

// Ao abrir, a tela de login pergunta se já existe algum usuário.
// Se não existir (primeiro acesso), ela mostra o cadastro do administrador.
ipcOn("login-info", async (event) => {
  try {
    const total = await usuarioModel.countDocuments();
    await prepararChaves();
    event.reply("login-info", { primeiroAcesso: total === 0, chaveAusente: estadoChaves === "ausente" });
  } catch (error) {
    console.log(error);
    event.reply("login-error", "Não foi possível acessar o banco de dados.");
  }
});

// Login feito: guarda o usuário, abre a janela principal e fecha o login
function entrar(usuario) {
  usuarioLogado = usuario.publico();
  ultimaAtividade = Date.now();
  createWindow();
  if (janelaLogin) janelaLogin.close();
}

// ===== Fim da sessão por inatividade =====
// Sem mexer no app por este tempo, volta para o login (protege o computador
// deixado aberto no balcão). O bloqueio de tela do Windows também encerra.
const MINUTOS_INATIVIDADE = 15;
const LIMITE_INATIVIDADE_MS =
  (Number(process.env.GRAFICA_INATIVIDADE_SEGUNDOS) || MINUTOS_INATIVIDADE * 60) * 1000;
let ultimaAtividade = Date.now();

// As telas avisam quando o usuário mexe no mouse ou no teclado (footer.js)
ipcOn("user-activity", () => {
  ultimaAtividade = Date.now();
});

function encerrarSessao(motivo) {
  if (usuarioLogado) trocarUsuario(motivo);
}

setInterval(() => {
  if (usuarioLogado && Date.now() - ultimaAtividade > LIMITE_INATIVIDADE_MS) encerrarSessao("inatividade");
}, Math.min(30000, LIMITE_INATIVIDADE_MS / 2));

// Tentativas erradas de logins que não existem (em memória). Assim o
// comportamento é o mesmo para login existente e inexistente, e ninguém
// descobre quais logins existem pelo bloqueio.
const falhasSemUsuario = new Map();

function mensagemBloqueio(ate) {
  const minutos = Math.max(1, Math.ceil((ate - Date.now()) / 60000));
  return `Muitas tentativas erradas. Tente de novo em ${minutos} minuto${minutos > 1 ? "s" : ""}.`;
}

ipcOn("login", async (event, dados) => {
  try {
    if (estadoChaves !== "ok") {
      event.reply("login-error", MENSAGEM_CHAVE_AUSENTE);
      return;
    }
    const login = String(dados.login || "").trim().toLowerCase();
    const usuario = await usuarioModel.findOne({ login });

    // Login bloqueado por tentativas erradas
    const bloqueioMemoria = falhasSemUsuario.get(login);
    const bloqueadoAte = usuario ? usuario.estaBloqueado() && usuario.bloqueadoAte : bloqueioMemoria && bloqueioMemoria.ate > Date.now() && bloqueioMemoria.ate;
    if (bloqueadoAte) {
      auditoria.registrar(usuario ? usuario.login : "(login inexistente)", "login bloqueado");
      event.reply("login-error", mensagemBloqueio(bloqueadoAte));
      return;
    }

    // Mesma mensagem para login inexistente e senha errada (não revela quais logins existem)
    if (!usuario || !usuario.ativo || !(await usuario.conferirSenha(dados.senha))) {
      if (usuario) {
        usuario.registrarFalha();
        await usuario.save();
      } else {
        // Bloqueio anterior já vencido: recomeça a contagem
        const bloqueioVencido = bloqueioMemoria && bloqueioMemoria.ate && bloqueioMemoria.ate <= Date.now();
        const registro = !bloqueioMemoria || bloqueioVencido ? { falhas: 0, ate: 0 } : bloqueioMemoria;
        registro.falhas += 1;
        if (registro.falhas >= usuarioModel.LIMITE_TENTATIVAS) {
          registro.ate = Date.now() + usuarioModel.MINUTOS_BLOQUEIO * 60000;
          registro.falhas = 0;
        }
        falhasSemUsuario.set(login, registro);
      }
      // (o texto digitado não é gravado: pode ser uma senha no campo errado)
      auditoria.registrar(usuario ? usuario.login : "(login inexistente)", "login recusado");
      event.reply("login-error", "Login ou senha incorretos.");
      return;
    }

    if (usuario.tentativasFalhas || usuario.bloqueadoAte) {
      usuario.liberarAcesso();
    auditoria.registrar(usuario.login, "entrada");
      await usuario.save();
    }
    entrar(usuario);
  } catch (error) {
    console.log(error);
    event.reply("login-error", "Não foi possível acessar o banco de dados.");
  }
});

// Primeiro acesso: cria o administrador (só funciona se ainda não houver usuários)
ipcOn("create-first-admin", async (event, dados) => {
  try {
    if ((await usuarioModel.countDocuments()) > 0) {
      event.reply("login-error", "O administrador já foi criado. Faça login.");
      return;
    }
    if (estadoChaves !== "ok") {
      event.reply("login-error", MENSAGEM_CHAVE_AUSENTE);
      return;
    }
    const usuario = new usuarioModel({ nome: dados.nome, login: dados.login, perfil: "administrador" });
    await usuario.definirSenha(dados.senha);
    auditoria.registrar(usuario.login, "administrador inicial criado");
    await usuario.save();
    entrar(usuario);
  } catch (error) {
    console.log(error);
    const mensagens = error.errors ? Object.values(error.errors).map((e) => e.message) : [error.message];
    event.reply("login-error", mensagens.join(" "));
  }
});

// Qualquer tela pode perguntar quem está logado (rodapé, permissões)
ipcOn("get-session", (event) => {
  event.reply("session", usuarioLogado && {
    ...usuarioLogado,
    permissoes: PERMISSOES[usuarioLogado.perfil] || [],
  });
});

// Volta para a tela de login, fechando as outras janelas
// motivo (opcional): "inatividade" ou "bloqueio", mostrado na tela de login
function trocarUsuario(motivo) {
  auditar("saída", "", motivo || "");
  usuarioLogado = null;
  loginWindow(motivo);
  BrowserWindow.getAllWindows()
    .filter((janela) => janela !== janelaLogin)
    // (ao destruir a principal, as modais filhas também são destruídas)
    .forEach((janela) => {
      if (!janela.isDestroyed()) janela.destroy();
    });
  win = null;
}



// ===============================================
// ================== CLIENTES ===================
// Validação, cifragem do CPF/CNPJ e o que vai para as telas: src/servicos/clientes.js

// Erro ao salvar cliente: CPF/CNPJ repetido, documento inválido ou campo obrigatório
async function avisoErroCliente(event, error) {
  const janela = BrowserWindow.fromWebContents(event.sender);
  if (error.code === 11000) {
    await dialog.showMessageBox(janela, {
      type: "error",
      title: "Atenção!",
      message: "CPF/CNPJ já cadastrado.\nVerifique o número digitado.",
      buttons: ["OK"],
    });
    event.reply("cpf-duplicate");
    return;
  }
  if (error.errors) return avisoErroValidacao(error);
  await dialog.showMessageBox(janela, { type: "error", title: "Atenção!", message: error.message, buttons: ["OK"] });
  if (/CPF|CNPJ/.test(error.message)) event.reply("cpf-duplicate");
}

// ======== CREATE =========
ipcComPermissao("create-cliente", "clientes", async (event, cliente) => {
  try {
    const novo = await clienteModel.create(servicoClientes.dadosClienteDaTela(cliente));
    auditar("cliente cadastrado", `cliente ${novo._id}`);
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: "Cliente adicionado com sucesso",
      buttons: ["OK"],
    });
    if (result.response === 0) event.reply("reset-form");
  } catch (error) {
    if (!error.errors && error.code !== 11000 && !/CPF|CNPJ/.test(error.message)) console.log(error.message);
    avisoErroCliente(event, error);
  }
});

// ======== READ =========

// validação da busca
ipcOn("validate-search", () => {
  dialog.showMessageBox({
    type: "warning",
    title: "Atenção",
    message: "Preencha o campo de busca",
    buttons: ["OK"],
  });
});

// Resposta comum das buscas de cliente.
// pedido: { termo, ficha } — ficha = tela de Clientes, que recebe os dados
// completos (só para quem pode cadastrar clientes); as outras telas recebem
// o documento mascarado.
async function responderBuscaCliente(event, pedido, clientes, canalNaoEncontrado) {
  if (clientes.length === 0) {
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "warning",
      title: "Aviso",
      message: "Cliente não cadastrado.\nDeseja cadastrar este cliente?",
      defaultId: 0,
      buttons: ["SIM", "NÃO"],
    });
    event.reply(result.response === 0 ? canalNaoEncontrado : "reset-form");
    return;
  }
  const completo = !!(pedido && pedido.ficha) && pode("clientes");
  const lista = clientes.map((c) => servicoClientes.clienteParaTela(c, { completo }));
  // Ficha completa (com o CPF/CNPJ inteiro) aberta: fica registrado quem viu
  if (completo) auditar("ficha de cliente consultada", clientes.slice(0, 5).map((c) => `cliente ${c._id}`).join(", "));
  event.reply("render-client", JSON.stringify(lista));
}

// Aceita o pedido novo ({ termo, ficha }) ou só o texto
const termoDaBusca = (pedido) => String(pedido && typeof pedido === "object" ? pedido.termo : pedido || "").trim();

// Por nome (ou nome fantasia), em parte do texto
ipcOn("search-name", async (event, pedido) => {
  try {
    const regex = new RegExp(escapeRegex(termoDaBusca(pedido)), "i");
    const clientes = await clienteModel.find({ $or: [{ nome: regex }, { nomeFantasia: regex }] }).sort({ nome: 1 });
    await responderBuscaCliente(event, pedido, clientes, "set-name");
  } catch (error) {
    console.log(error.message);
  }
});

// Por CPF/CNPJ exato (com ou sem pontuação), pelo índice cifrado
ipcOn("search-cpf", async (event, pedido) => {
  try {
    const digitos = cripto.soDigitos(termoDaBusca(pedido));
    const clientes = [11, 14].includes(digitos.length)
      ? await clienteModel.find({ documentoBusca: cripto.indiceBusca(digitos) })
      : [];
    await responderBuscaCliente(event, pedido, clientes, "set-cpf");
  } catch (error) {
    console.log(error.message);
  }
});

// ======== UPDATE =========
ipcComPermissao("update-client", "clientes", async (event, cliente) => {
  try {
    const atual = await clienteModel.findById(cliente._id);
    if (!atual) return;
    if (atual.anonimizado) throw new Error("Este cliente foi anonimizado (LGPD) e não pode mais ser alterado.");
    atual.set(servicoClientes.dadosClienteDaTela(cliente));
    await atual.save();
    auditar("cliente alterado", `cliente ${atual._id}`);
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: "Dados do cliente alterados com sucesso",
      buttons: ["OK"],
    });
    if (result.response === 0) event.reply("reset-form");
  } catch (error) {
    avisoErroCliente(event, error);
  }
});

// ======== DELETE =========
// ======== LGPD =========

// PDF com tudo o que a gráfica guarda sobre o cliente (pedido do titular)
ipcComPermissao("client-data-pdf", "clientes", async (event, id) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const relatorio = await lgpd.relatorioTitular(id);
    if (!relatorio) return;
    const salvo = await gerarPDF(htmlRelatorio(relatorio), `Dados-do-cliente-${new Date().toISOString().slice(0, 10)}.pdf`, janela);
    if (salvo) auditar("dados do cliente exportados (LGPD)", `cliente ${id}`);
  } catch (error) {
    console.error("Erro ao gerar os dados do cliente:", error.message);
  }
});

// Apaga os dados pessoais do cadastro a pedido do titular
ipcComPermissao("anonymize-client", "excluir", async (event, id) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const cliente = await clienteModel.findById(id);
    if (!cliente || cliente.anonimizado) return;
    const result = await dialog.showMessageBox(janela, {
      type: "warning",
      title: "Anonimizar cliente (LGPD)",
      message: `Apagar os dados pessoais de "${cliente.nome}"?`,
      detail:
        "Nome, CPF/CNPJ, contatos e endereço serão apagados do cadastro e não poderão ser recuperados. " +
        "Gere antes o PDF com os dados do cliente, se ele pediu uma cópia.\n\n" +
        `As OS e orçamentos continuam guardados por ${lgpd.PRAZO_ANOS} anos (obrigação legal) e depois são limpos pela Limpeza LGPD.`,
      buttons: ["Cancelar", "Anonimizar"],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return;
    await lgpd.anonimizar(id);
    auditar("cliente anonimizado (LGPD)", `cliente ${id}`);
    await dialog.showMessageBox(janela, { type: "info", title: "Aviso", message: "Dados pessoais do cliente apagados.", buttons: ["OK"] });
    event.reply("reset-form");
  } catch (error) {
    console.error("Erro ao anonimizar cliente:", error.message);
  }
});

// Ferramentas > Limpeza LGPD: dados além do prazo de guarda
async function limpezaLgpd() {
  if (!pode("configuracao")) return;
  const janela = BrowserWindow.getFocusedWindow() || win;
  try {
    const previa = await lgpd.previaLimpeza();
    const total = previa.clientes + previa.ordens + previa.orcamentos + previa.auditoria;
    if (total === 0) {
      await dialog.showMessageBox(janela, {
        type: "info",
        title: "Limpeza LGPD",
        message: `Nada a limpar: não há dados pessoais com mais de ${lgpd.PRAZO_ANOS} anos sem movimento.`,
        buttons: ["OK"],
      });
      return;
    }
    const result = await dialog.showMessageBox(janela, {
      type: "warning",
      title: "Limpeza LGPD",
      message: `Apagar dados pessoais anteriores a ${previa.limite.toLocaleDateString("pt-BR")}?`,
      detail:
        `• ${previa.clientes} cliente(s) sem OS nem orçamento há mais de ${lgpd.PRAZO_ANOS} anos serão anonimizados\n` +
        `• ${previa.ordens} OS e ${previa.orcamentos} orçamento(s) antigos perdem o nome e o CPF/CNPJ do cliente\n` +
        `• ${previa.auditoria} registro(s) de auditoria antigos são apagados\n\n` +
        "Valores, itens e datas continuam para os relatórios. Não dá para desfazer.",
      buttons: ["Cancelar", "Limpar"],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return;
    const feito = await lgpd.executarLimpeza();
    auditar("limpeza LGPD", "", `${feito.clientes} cliente(s), ${feito.ordens} OS, ${feito.orcamentos} orçamento(s), ${feito.auditoria} registro(s) de auditoria`);
    await dialog.showMessageBox(janela, {
      type: "info",
      title: "Limpeza LGPD",
      message: "Limpeza concluída.",
      detail: `${feito.clientes} cliente(s) anonimizado(s); ${feito.ordens} OS e ${feito.orcamentos} orçamento(s) limpos.`,
      buttons: ["OK"],
    });
    avisarDashboard();
  } catch (error) {
    console.error("Erro na limpeza LGPD:", error.message);
  }
}

// Cliente com OS ou orçamento não é excluído (o histórico fica): só desativado.
// Excluir de vez só quem nunca teve OS nem orçamento (ex.: cadastro por engano).
ipcComPermissao("delete-client", "excluir", async (event, id) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const cliente = await clienteModel.findById(id);
    if (!cliente) return;
    const [qtdOS, qtdOrcamentos] = await Promise.all([
      serviceOrderModel.countDocuments({ cliente: cliente._id }),
      quoteModel.countDocuments({ cliente: cliente._id }),
    ]);

    if (qtdOS + qtdOrcamentos > 0) {
      const partes = [qtdOS && `${qtdOS} OS`, qtdOrcamentos && `${qtdOrcamentos} orçamento${qtdOrcamentos > 1 ? "s" : ""}`].filter(Boolean);
      if (!cliente.ativo) {
        await dialog.showMessageBox(janela, {
          type: "info",
          title: "Cliente com histórico",
          message: `Este cliente tem ${partes.join(" e ")} e já está inativo.`,
          detail: "Para manter o histórico, clientes com OS ou orçamentos não são excluídos.",
          buttons: ["OK"],
        });
        return;
      }
      const result = await dialog.showMessageBox(janela, {
        type: "warning",
        title: "Cliente com histórico",
        message: `Este cliente tem ${partes.join(" e ")}.\nPara manter o histórico ele não pode ser excluído.`,
        detail: "Desativado, ele continua nas buscas e no histórico, mas não pode receber novas OS nem orçamentos.",
        buttons: ["Cancelar", "Desativar cliente"],
        defaultId: 1,
      });
      if (result.response === 1) {
        cliente.ativo = false;
        await cliente.save();
        auditar("cliente desativado", `cliente ${cliente._id}`);
        event.reply("reset-form");
      }
      return;
    }

    const result = await dialog.showMessageBox(janela, {
      type: "warning",
      title: "Atenção!",
      message: "Tem certeza que deseja excluir este Cliente?\nEsta ação não poderá ser desfeita.",
      buttons: ["Cancelar", "Excluir"],
    });
    if (result.response === 1) {
      await clienteModel.findByIdAndDelete(id);
      auditar("cliente excluído", `cliente ${id}`);
      event.reply("reset-form");
    }
  } catch (error) {
    console.log(error.message);
  }
});


// =============================
// ========= PRODUTOS ==========

// Escapa caracteres especiais para usar o texto digitado dentro de uma RegExp
// (sem isso, buscar por "(" ou "+" gera erro)
function escapeRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// Converte os dados vindos da tela para o formato do schema
function dadosProduto(produto) {
  return {
    nome: produto.nome,
    categoria: produto.categoria,
    descricao: produto.descricao,
    material: produto.material,
    tamanho: produto.tamanho,
    cores: produto.cores,
    acabamento: produto.acabamento,
    unidade: produto.unidade,
    valorUnitario: Number(produto.valorUnitario),
    ativo: produto.ativo,
  };
}

// Mostra os erros de validação do mongoose de forma legível
function avisoErroValidacao(error) {
  const mensagens = error.errors
    ? Object.values(error.errors).map((e) => `• ${e.path}: ${e.message}`)
    : [error.message];
  return dialog.showMessageBox({
    type: "error",
    title: "Atenção!",
    message: "Não foi possível salvar. Verifique os campos:",
    detail: mensagens.join("\n"),
    buttons: ["OK"],
  });
}

// ======== CREATE =========
ipcComPermissao("create-product", "produtos", async (event, produto) => {
  try {
    await productModel.create(dadosProduto(produto));
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Aviso",
      message: "Produto adicionado com sucesso",
      buttons: ["OK"],
    });
    if (result.response === 0) {
      event.reply("reset-form");
    }
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// ======== READ =========
// Busca por nome ou categoria. Devolve um vetor (pode ter vários resultados)
ipcOn("search-product", async (event, termo) => {
  try {
    const regex = new RegExp(escapeRegex(termo), "i");
    const produtos = await productModel
      .find({ $or: [{ nome: regex }, { categoria: regex }] })
      .sort({ nome: 1 });

    if (produtos.length === 0) {
      const result = await dialog.showMessageBox({
        type: "warning",
        title: "Aviso",
        message: "Produto não cadastrado.\nDeseja cadastrar este produto?",
        defaultId: 0,
        buttons: ["SIM", "NÃO"],
      });
      if (result.response === 0) {
        event.reply("set-product-name");
      } else {
        event.reply("reset-form");
      }
    } else {
      event.reply("render-product", JSON.stringify(produtos));
    }
  } catch (error) {
    console.log(error);
  }
});

// ======== UPDATE =========
ipcComPermissao("update-product", "produtos", async (event, produto) => {
  try {
    await productModel.findByIdAndUpdate(produto._id, dadosProduto(produto), {
      new: true,
      runValidators: true,
    });
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Aviso",
      message: "Dados do produto alterados com sucesso",
      buttons: ["OK"],
    });
    if (result.response === 0) {
      event.reply("reset-form");
    }
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// ======== DELETE =========
ipcComPermissao("delete-product", "excluir", async (event, id) => {
  try {
    // Produto que já foi usado em alguma OS não pode ser apagado,
    // senão a OS perde a referência. Nesse caso, sugerir desativar.
    const usadoEmOS = await serviceOrderModel.exists({ "produtos.produto": id });
    if (usadoEmOS) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
        type: "warning",
        title: "Atenção!",
        message: "Este produto já foi usado em Ordens de Serviço e não pode ser excluído.",
        detail: "Desmarque a opção \"Ativo\" e salve para tirá-lo de linha.",
        buttons: ["OK"],
      });
      return;
    }

    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "warning",
      title: "Atenção!",
      message: "Tem certeza que deseja excluir este produto?\nEsta ação não poderá ser desfeita.",
      buttons: ["Cancelar", "Excluir"],
    });
    if (result.response === 1) {
      await productModel.findByIdAndDelete(id);
      event.reply("reset-form");
    }
  } catch (error) {
    console.log(error);
  }
});


// =============================
// ====== SERVICE ORDER ========

// Aviso genérico pedido pela tela (ex.: validação do formulário de OS)
ipcOn("show-warning", (event, mensagem) => {
  dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: "warning",
    title: "Atenção",
    message: mensagem,
    buttons: ["OK"],
  });
});

// Produtos ativos, para o campo de seleção de itens da OS
ipcOn("list-products", async (event) => {
  try {
    const produtos = await productModel.find({ ativo: { $ne: false } }).sort({ nome: 1 });
    event.reply("products-list", JSON.stringify(produtos));
  } catch (error) {
    console.log(error);
  }
});

// Converte "AAAA-MM-DD" (valor do input date) para meio-dia no horário local.
// new Date("2026-11-10") seria meia-noite UTC, que no Brasil ainda é dia 9.
function dataLocal(texto) {
  if (!texto) return undefined;
  return new Date(`${texto}T12:00:00`);
}

// Monta os dados da OS a partir do que veio da tela.
// Subtotal e total NÃO são lidos da tela: o modelo recalcula ao salvar.
// A arte usa caminhos com ponto ("arte.origem") para alterar só esses campos
// e não apagar a data de aprovação que o modelo preenche sozinho.
// Valor pago e "quitada" são calculados pelo modelo a partir dos pagamentos.
// Itens vindos da tela (OS ou orçamento), no formato do schema
async function itensDaTela(lista) {
  const itens = Array.isArray(lista) ? lista : [];
  const produtos = await productModel.find({ _id: { $in: itens.map((i) => i.produto) } });
  const nomes = new Map(produtos.map((p) => [String(p._id), p.nome]));
  return itens.map((i) => ({
    produto: i.produto,
    // Item que já estava no documento mantém a descrição original
    descricao: i.descricao || nomes.get(String(i.produto)),
    quantidade: Number(i.quantidade),
    valorUnitario: Number(i.valorUnitario),
  }));
}

async function dadosOS(order) {
  return {
    cliente: order.cliente || undefined,
    produtos: await itensDaTela(order.produtos),
    prazoFinal: dataLocal(order.prazoFinal),
    status: order.status,
    observacoes: order.observacoes,
    "arte.origem": order.arte?.origem,
    "arte.aprovada": !!order.arte?.aprovada,
    pagamentos: (Array.isArray(order.pagamentos) ? order.pagamentos : []).map((p) => ({
      valor: Number(p.valor),
      forma: p.forma,
      data: dataLocal(p.data) || new Date(),
    })),
  };
}

// ======= CREATE =======
ipcComPermissao("create-order", "os", async (event, order) => {
  try {
    const os = await serviceOrderModel.create(await dadosOS(order));
    auditar("OS criada", `OS ${os.numero}`);
    avisarDashboard();
    const janela = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showMessageBox(janela, {
      type: "info",
      title: "Aviso",
      message: `Ordem de Serviço nº ${os.numero} criada com sucesso.`,
      buttons: ["OK", "Imprimir OS"],
    });
    if (result.response === 1) {
      await imprimirOS(os._id, janela);
    }
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// Documento (OS/orçamento) com o cliente populado -> objeto para a tela,
// com o cliente resumido (documento mascarado, sem os campos cifrados)
function paraTelaComCliente(doc, extras = {}) {
  const obj = { ...doc.toObject(), ...extras };
  obj.cliente = doc.cliente && doc.cliente._id ? servicoClientes.clienteParaTela(doc.cliente) : null;
  // Cópia do cliente na época (para quando o cadastro foi removido)
  obj.clienteHistorico = doc.clienteCopia && doc.clienteCopia.nome ? servicoClientes.clienteParaTela({ _id: "", ...doc.clienteCopia.toObject() }) : null;
  delete obj.clienteCopia;
  return obj;
}

// Filtro das buscas de OS e orçamentos:
//  { numero }     -> um documento
//  { clienteId }  -> os do cliente (pelo cadastro e pela cópia com o mesmo CPF/CNPJ)
//  { documento }  -> por CPF/CNPJ exato, mesmo se o cliente foi excluído ou anonimizado
async function consultaHistorico(filtro) {
  if (filtro.numero != null) return { modo: "numero", consulta: { numero: Number(filtro.numero) } };
  let cliente = null;
  let indice = null;
  if (filtro.documento != null) {
    const digitos = cripto.soDigitos(filtro.documento);
    if (![11, 14].includes(digitos.length)) return { modo: "documento", consulta: null };
    indice = cripto.indiceBusca(digitos);
    cliente = await clienteModel.findOne({ documentoBusca: indice });
  } else {
    cliente = await clienteModel.findById(filtro.clienteId);
    indice = cliente && cliente.documentoBusca;
    if (!cliente) return { modo: "cliente", consulta: { cliente: filtro.clienteId } };
  }
  const ou = [];
  if (cliente) ou.push({ cliente: cliente._id });
  if (indice) ou.push({ "clienteCopia.documentoBusca": indice });
  return {
    modo: filtro.documento != null ? "documento" : "cliente",
    consulta: ou.length ? { $or: ou } : null,
    cliente: cliente ? servicoClientes.clienteParaTela(cliente) : null,
  };
}

// ======= READ =======
ipcOn("search-order", async (event, filtro) => {
  try {
    const { modo, consulta, cliente } = await consultaHistorico(filtro);
    const porNumero = modo === "numero";
    const ordens = consulta ? await serviceOrderModel.find(consulta).populate("cliente").sort({ numero: -1 }) : [];

    if (modo === "documento" && ordens.length === 0 && !cliente) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
        type: "info",
        title: "Aviso",
        message: "Nenhum cliente ou OS com este CPF/CNPJ.",
        buttons: ["OK"],
      });
      return;
    }
    if (porNumero && ordens.length === 0) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
        type: "info",
        title: "Aviso",
        message: `OS nº ${filtro.numero} não encontrada.`,
        buttons: ["OK"],
      });
      return;
    }
    event.reply("order-result", JSON.stringify({ modo, cliente, ordens: ordens.map((o) => paraTelaComCliente(o)) }));
  } catch (error) {
    console.error("Erro na busca da OS:", error);
  }
});

// ======= UPDATE =======
ipcComPermissao("update-order", "os", async (event, order) => {
  try {
    const os = await serviceOrderModel.findById(order._id);
    if (!os) return;
    os.set(await dadosOS(order));
    // save() (e não findByIdAndUpdate) para as regras do modelo rodarem
    await os.save();
    auditar("OS alterada", `OS ${os.numero}`, `status: ${os.status}`);
    avisarDashboard();
    await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: `Ordem de Serviço nº ${os.numero} atualizada com sucesso.`,
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// ======= DASHBOARD =======
// Status que contam como "em andamento" (ainda precisam ser entregues)
const emAndamento = { status: { $nin: ["entregue", "cancelada"] } };

ipcOn("dashboard-data", async (event) => {
  try {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    // "Próximas do prazo" = vencem hoje ou nos próximos 3 dias
    const limiteProximas = new Date(inicioHoje);
    limiteProximas.setDate(limiteProximas.getDate() + 4);

    const inicioMes = new Date(inicioHoje.getFullYear(), inicioHoje.getMonth(), 1);

    const [atrasadas, pendentes, entregues, lista, recebido, faturado, aReceber, orcamentosPendentes, estoqueBaixo, etapas, entreguesMes] = await Promise.all([
      serviceOrderModel.countDocuments({ ...emAndamento, prazoFinal: { $lt: inicioHoje } }),
      serviceOrderModel.countDocuments({ ...emAndamento, prazoFinal: { $gte: inicioHoje } }),
      serviceOrderModel.countDocuments({ status: "entregue" }),
      serviceOrderModel
        .find({ ...emAndamento, prazoFinal: { $lt: limiteProximas } })
        .select("-clienteCopia.documentoCifrado -clienteCopia.documentoBusca")
        .populate("cliente", "nome")
        .sort({ prazoFinal: 1 })
        .limit(30),
      // Recebido no mês: soma dos pagamentos lançados desde o dia 1º
      serviceOrderModel.aggregate([
        { $unwind: "$pagamentos" },
        { $match: { "pagamentos.data": { $gte: inicioMes } } },
        { $group: { _id: null, total: { $sum: "$pagamentos.valor" } } },
      ]),
      // Faturado no mês: valor das OS entregues desde o dia 1º
      serviceOrderModel.aggregate([
        { $match: { status: "entregue", dataEntregaReal: { $gte: inicioMes } } },
        { $group: { _id: null, total: { $sum: "$valorTotal" } } },
      ]),
      // A receber: saldo de todas as OS não canceladas e não quitadas
      serviceOrderModel.aggregate([
        { $match: { status: { $ne: "cancelada" }, pago: { $ne: true } } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$valorTotal", { $ifNull: ["$valorPago", 0] }] } } } },
      ]),
      // Orçamentos esperando resposta e ainda dentro da validade
      quoteModel.countDocuments({ status: "pendente", validade: { $gte: inicioHoje } }),
      // Insumos ativos abaixo do estoque mínimo
      insumoModel
        .find({ ativo: true, estoqueMinimo: { $gt: 0 }, $expr: { $lt: ["$quantidade", "$estoqueMinimo"] } })
        .select("nome quantidade unidade estoqueMinimo")
        .sort({ nome: 1 }),
      // OS em andamento por etapa da produção
      serviceOrderModel.aggregate([
        { $match: emAndamento },
        { $group: { _id: "$status", total: { $sum: 1 } } },
      ]),
      serviceOrderModel.countDocuments({ status: "entregue", dataEntregaReal: { $gte: inicioMes } }),
    ]);

    // Na ordem do fluxo da gráfica (etapas sem OS aparecem com 0)
    const porEtapa = ["aberta", "aguardando arte", "em produção", "pronta"].map((etapa) => ({
      etapa,
      total: (etapas.find((e) => e._id === etapa) || {}).total || 0,
    }));

    const soma = (resultado) => Math.round(((resultado[0] && resultado[0].total) || 0) * 100) / 100;
    event.reply("dashboard-data", JSON.stringify({
      atrasadas,
      pendentes,
      entregues,
      lista,
      porEtapa,
      entreguesMes,
      // Só quem tem permissão "financeiro" recebe os valores
      financeiro: !pode("financeiro") ? null : {
        recebidoMes: soma(recebido),
        faturadoMes: soma(faturado),
        aReceber: soma(aReceber),
        orcamentosPendentes,
      },
      // Só quem cuida do estoque recebe o alerta
      estoqueBaixo: pode("estoque") ? estoqueBaixo : null,
    }));
  } catch (error) {
    console.error("Erro ao carregar o dashboard:", error);
  }
});

// Avisa a janela principal que as OS mudaram, para o dashboard recarregar
function avisarDashboard() {
  if (win && !win.isDestroyed()) {
    win.webContents.send("dashboard-changed");
  }
}

// ======= IMPRESSÃO (PDF) =======
async function imprimirOS(id, janela) {
  try {
    const os = await serviceOrderModel.findById(id).populate("cliente");
    if (!os) return;
    const nome = `OS-${String(os.numero).padStart(4, "0")}.pdf`;
    await gerarPDF(htmlOS(os), nome, janela);
  } catch (error) {
    console.error("Erro ao gerar PDF da OS:", error);
    dialog.showMessageBox(janela, {
      type: "error",
      title: "Erro",
      message: "Não foi possível gerar o PDF da OS.",
      detail: error.message,
      buttons: ["OK"],
    });
  }
}

ipcOn("print-order", (event, id) => {
  imprimirOS(id, BrowserWindow.fromWebContents(event.sender));
});



// =============================
// ======= FORNECEDORES ========

function dadosFornecedor(f) {
  return {
    nome: f.nome,
    documento: f.documento,
    contato: f.contato,
    telefone: f.telefone,
    email: f.email,
    fornece: f.fornece,
    observacoes: f.observacoes,
    ativo: f.ativo !== false,
  };
}

ipcComPermissao("create-supplier", "estoque", async (event, f) => {
  try {
    await fornecedorModel.create(dadosFornecedor(f));
    await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: "Fornecedor adicionado com sucesso",
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// Busca por nome, documento ou pelo que fornece; termo vazio lista todos
ipcComPermissao("search-supplier", "estoque", async (event, termo) => {
  try {
    const regex = new RegExp(escapeRegex(termo || ""), "i");
    const lista = await fornecedorModel
      .find({ $or: [{ nome: regex }, { documento: regex }, { fornece: regex }] })
      .sort({ nome: 1 });
    event.reply("supplier-result", JSON.stringify(lista));
  } catch (error) {
    console.log(error);
  }
});

ipcComPermissao("update-supplier", "estoque", async (event, f) => {
  try {
    await fornecedorModel.findByIdAndUpdate(f._id, dadosFornecedor(f), { runValidators: true });
    await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: "Dados do fornecedor alterados com sucesso",
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

ipcComPermissao("delete-supplier", "excluir", async (event, id) => {
  try {
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "warning",
      title: "Atenção!",
      message: "Tem certeza que deseja excluir este fornecedor?\nEsta ação não poderá ser desfeita.",
      buttons: ["Cancelar", "Excluir"],
    });
    if (result.response === 1) {
      await fornecedorModel.findByIdAndDelete(id);
      event.reply("reset-form");
    }
  } catch (error) {
    console.log(error);
  }
});

// =============================
// ========= INSUMOS ===========

// Campos editáveis pela tela (a quantidade só muda por movimentação)
function dadosInsumo(i) {
  return {
    nome: i.nome,
    categoria: i.categoria,
    unidade: i.unidade,
    estoqueMinimo: Number(i.estoqueMinimo || 0),
    custoUnitario: Number(i.custoUnitario || 0),
    fornecedor: i.fornecedor || undefined,
    ativo: i.ativo !== false,
  };
}

// Busca por nome ou categoria (termo vazio lista todos), com o nome do fornecedor
ipcComPermissao("search-supply", "estoque", async (event, termo) => {
  try {
    const regex = new RegExp(escapeRegex(termo || ""), "i");
    const lista = await insumoModel
      .find({ $or: [{ nome: regex }, { categoria: regex }] })
      .populate("fornecedor", "nome")
      .sort({ nome: 1 });
    event.reply("supply-result", JSON.stringify(lista));
  } catch (error) {
    console.log(error);
  }
});

ipcComPermissao("create-supply", "estoque", async (event, i) => {
  try {
    const insumo = new insumoModel(dadosInsumo(i));
    // O estoque inicial entra como a primeira movimentação (fica no histórico)
    if (Number(i.estoqueInicial) > 0) {
      insumo.movimentar("entrada", i.estoqueInicial, "Estoque inicial", usuarioLogado.nome);
    }
    await insumo.save();
    avisarDashboard();
    await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: "Insumo adicionado com sucesso",
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

ipcComPermissao("update-supply", "estoque", async (event, i) => {
  try {
    const insumo = await insumoModel.findById(i._id);
    if (!insumo) return;
    insumo.set(dadosInsumo(i));
    await insumo.save();
    avisarDashboard();
    await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "info",
      title: "Aviso",
      message: "Dados do insumo alterados com sucesso",
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// Entrada, saída ou ajuste de estoque.
// Responde com o insumo atualizado, sem recarregar a tela.
ipcComPermissao("move-supply", "estoque", async (event, mov) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const insumo = await insumoModel.findById(mov._id);
    if (!insumo) return;
    insumo.movimentar(mov.tipo, mov.quantidade, mov.motivo, usuarioLogado.nome);
    await insumo.save();
    avisarDashboard();
    await insumo.populate("fornecedor", "nome");
    event.reply("supply-moved", JSON.stringify(insumo));
  } catch (error) {
    console.log(error);
    dialog.showMessageBox(janela, {
      type: "warning",
      title: "Atenção",
      message: "Movimentação não registrada.",
      detail: error.message,
      buttons: ["OK"],
    });
  }
});

ipcComPermissao("delete-supply", "excluir", async (event, id) => {
  try {
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "warning",
      title: "Atenção!",
      message: "Tem certeza que deseja excluir este insumo e todo o histórico de movimentações?",
      detail: "Para tirar de uso sem perder o histórico, desmarque \"Ativo\" e salve.",
      buttons: ["Cancelar", "Excluir"],
    });
    if (result.response === 1) {
      await insumoModel.findByIdAndDelete(id);
      avisarDashboard();
      event.reply("reset-form");
    }
  } catch (error) {
    console.log(error);
  }
});

// =============================
// ========= USUÁRIOS ==========

function enviarUsuarios(event) {
  return usuarioModel
    .find()
    .sort({ nome: 1 })
    .then((lista) => event.reply("users-list", JSON.stringify(lista.map((u) => u.publico()))));
}

ipcComPermissao("list-users", "usuarios", async (event) => {
  try {
    await enviarUsuarios(event);
  } catch (error) {
    console.log(error);
  }
});

// Mensagem de erro legível (validação, login repetido ou senha curta)
function avisoErroUsuario(janela, error) {
  let detalhe;
  if (error.code === 11000) detalhe = "Já existe um usuário com esse login.";
  else if (error.errors) detalhe = Object.values(error.errors).map((e) => `• ${e.message}`).join("\n");
  else detalhe = error.message;
  return dialog.showMessageBox(janela, {
    type: "error",
    title: "Atenção!",
    message: "Não foi possível salvar o usuário.",
    detail: detalhe,
    buttons: ["OK"],
  });
}

ipcComPermissao("create-user", "usuarios", async (event, dados) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const usuario = new usuarioModel({
      nome: dados.nome,
      login: dados.login,
      perfil: dados.perfil,
      ativo: dados.ativo !== false,
    });
    await usuario.definirSenha(dados.senha);
    await usuario.save();
    auditar("usuário criado", `usuário ${usuario.login}`, `perfil: ${usuario.perfil}`);
    await dialog.showMessageBox(janela, {
      type: "info",
      title: "Aviso",
      message: `Usuário "${usuario.login}" criado com sucesso.`,
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroUsuario(janela, error);
  }
});

ipcComPermissao("update-user", "usuarios", async (event, dados) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const usuario = await usuarioModel.findById(dados._id);
    if (!usuario) return;
    const proprio = String(usuario._id) === usuarioLogado._id;

    // Regras para não ficar sem acesso ao sistema
    if (proprio && (dados.ativo === false || dados.perfil !== "administrador")) {
      throw new Error("Você não pode desativar o seu próprio usuário nem tirar o seu perfil de administrador.");
    }
    const deixaDeSerAdminAtivo =
      usuario.perfil === "administrador" && usuario.ativo && (dados.perfil !== "administrador" || dados.ativo === false);
    if (deixaDeSerAdminAtivo) {
      const outrosAdmins = await usuarioModel.countDocuments({ perfil: "administrador", ativo: true, _id: { $ne: usuario._id } });
      if (outrosAdmins === 0) throw new Error("O sistema precisa ter pelo menos um administrador ativo.");
    }

    usuario.set({ nome: dados.nome, login: dados.login, perfil: dados.perfil, ativo: dados.ativo !== false });
    // Senha em branco = mantém a atual
    if (dados.senha) await usuario.definirSenha(dados.senha);
    // Salvar o usuário pelo administrador também libera um login bloqueado
    usuario.liberarAcesso();
    await usuario.save();
    if (proprio) usuarioLogado = usuario.publico();
    auditar("usuário alterado", `usuário ${usuario.login}`, [`perfil: ${usuario.perfil}`, usuario.ativo ? "" : "inativo", dados.senha ? "senha trocada" : ""].filter(Boolean).join(", "));

    await dialog.showMessageBox(janela, {
      type: "info",
      title: "Aviso",
      message: `Usuário "${usuario.login}" atualizado com sucesso.`,
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroUsuario(janela, error);
  }
});

// =============================
// ======== ORÇAMENTOS =========

async function dadosOrcamento(q) {
  return {
    cliente: q.cliente || undefined,
    produtos: await itensDaTela(q.produtos),
    validade: dataLocal(q.validade),
    prazoProducaoDias: Number(q.prazoProducaoDias),
    observacoes: q.observacoes,
  };
}

// Orçamento aprovado ou recusado não pode mais ser alterado
async function avisoOrcamentoFechado(janela, q) {
  await dialog.showMessageBox(janela, {
    type: "warning",
    title: "Atenção",
    message: `O orçamento nº ${q.numero} já foi ${q.status} e não pode mais ser alterado.`,
    buttons: ["OK"],
  });
}

// ======= CREATE =======
ipcComPermissao("create-quote", "orcamentos", async (event, q) => {
  try {
    const orcamento = await quoteModel.create(await dadosOrcamento(q));
    auditar("orçamento criado", `orçamento ${orcamento.numero}`);
    avisarDashboard();
    const janela = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showMessageBox(janela, {
      type: "info",
      title: "Aviso",
      message: `Orçamento nº ${orcamento.numero} criado com sucesso.`,
      buttons: ["OK", "Imprimir orçamento"],
    });
    if (result.response === 1) {
      await imprimirOrcamento(orcamento._id, janela);
    }
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// ======= READ =======
// filtro: ver consultaHistorico() (número, cliente ou CPF/CNPJ)
ipcOn("search-quote", async (event, filtro) => {
  try {
    const { modo, consulta, cliente } = await consultaHistorico(filtro);
    const porNumero = modo === "numero";
    const lista = consulta
      ? await quoteModel.find(consulta).populate("cliente").populate("osGerada", "numero").sort({ numero: -1 })
      : [];

    if (modo === "documento" && lista.length === 0 && !cliente) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
        type: "info",
        title: "Aviso",
        message: "Nenhum cliente ou orçamento com este CPF/CNPJ.",
        buttons: ["OK"],
      });
      return;
    }
    if (porNumero && lista.length === 0) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
        type: "info",
        title: "Aviso",
        message: `Orçamento nº ${filtro.numero} não encontrado.`,
        buttons: ["OK"],
      });
      return;
    }
    // "vencido" é calculado na hora
    const orcamentos = lista.map((q) => paraTelaComCliente(q, { vencido: quoteModel.estaVencido(q) }));
    event.reply("quote-result", JSON.stringify({ modo, cliente, orcamentos }));
  } catch (error) {
    console.error("Erro na busca do orçamento:", error);
  }
});

// ======= UPDATE =======
ipcComPermissao("update-quote", "orcamentos", async (event, q) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const orcamento = await quoteModel.findById(q._id);
    if (!orcamento) return;
    if (orcamento.status !== "pendente") return avisoOrcamentoFechado(janela, orcamento);
    orcamento.set(await dadosOrcamento(q));
    await orcamento.save();
    avisarDashboard();
    await dialog.showMessageBox(janela, {
      type: "info",
      title: "Aviso",
      message: `Orçamento nº ${orcamento.numero} atualizado com sucesso.`,
      buttons: ["OK"],
    });
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// ======= IMPRESSÃO (PDF) =======
async function imprimirOrcamento(id, janela) {
  try {
    const orcamento = await quoteModel.findById(id).populate("cliente");
    if (!orcamento) return;
    const nome = `Orcamento-${String(orcamento.numero).padStart(4, "0")}.pdf`;
    await gerarPDF(htmlOrcamento(orcamento, quoteModel.estaVencido(orcamento)), nome, janela);
  } catch (error) {
    console.error("Erro ao gerar PDF do orçamento:", error);
    dialog.showMessageBox(janela, {
      type: "error",
      title: "Erro",
      message: "Não foi possível gerar o PDF do orçamento.",
      detail: error.message,
      buttons: ["OK"],
    });
  }
}

ipcOn("print-quote", (event, id) => {
  imprimirOrcamento(id, BrowserWindow.fromWebContents(event.sender));
});

// ======= APROVAR (CONVERTER EM OS) =======
ipcComPermissao("convert-quote", "orcamentos", async (event, id) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const orcamento = await quoteModel.findById(id);
    if (!orcamento) return;
    if (orcamento.status !== "pendente") return avisoOrcamentoFechado(janela, orcamento);

    // Prazo da OS = hoje + prazo de produção do orçamento
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + orcamento.prazoProducaoDias);
    prazo.setHours(12, 0, 0, 0);

    const aviso = quoteModel.estaVencido(orcamento)
      ? `Atenção: a validade venceu em ${orcamento.validade.toLocaleDateString("pt-BR")}. Confira se os preços ainda valem.\n\n`
      : "";
    const confirmacao = await dialog.showMessageBox(janela, {
      type: "question",
      title: "Aprovar orçamento",
      message: `Aprovar o orçamento nº ${orcamento.numero} e gerar a Ordem de Serviço?`,
      detail: `${aviso}Prazo de entrega da OS: ${prazo.toLocaleDateString("pt-BR")} (${orcamento.prazoProducaoDias} dias).`,
      buttons: ["Cancelar", "Aprovar e gerar OS"],
    });
    if (confirmacao.response !== 1) return;

    const os = await serviceOrderModel.create({
      cliente: orcamento.cliente,
      // Se o cadastro do cliente não existir mais, a OS herda a cópia do orçamento
      clienteCopia: orcamento.clienteCopia ? orcamento.clienteCopia.toObject() : undefined,
      produtos: orcamento.produtos.map((i) => ({
        produto: i.produto,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
      })),
      prazoFinal: prazo,
      status: "aberta",
      observacoes: [`Gerada a partir do orçamento nº ${orcamento.numero}.`, orcamento.observacoes]
        .filter(Boolean)
        .join("\n"),
    });
    orcamento.status = "aprovado";
    auditar("orçamento convertido em OS", `orçamento ${orcamento.numero}`, `OS ${os.numero}`);
    orcamento.osGerada = os._id;
    await orcamento.save();
    avisarDashboard();

    const result = await dialog.showMessageBox(janela, {
      type: "info",
      title: "Aviso",
      message: `Orçamento nº ${orcamento.numero} aprovado: OS nº ${os.numero} criada.`,
      buttons: ["OK", "Imprimir OS"],
    });
    if (result.response === 1) {
      await imprimirOS(os._id, janela);
    }
    event.reply("reset-form");
  } catch (error) {
    console.log(error);
    avisoErroValidacao(error);
  }
});

// ======= RECUSAR =======
ipcComPermissao("refuse-quote", "orcamentos", async (event, id) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  try {
    const orcamento = await quoteModel.findById(id);
    if (!orcamento) return;
    if (orcamento.status !== "pendente") return avisoOrcamentoFechado(janela, orcamento);
    const result = await dialog.showMessageBox(janela, {
      type: "question",
      title: "Recusar orçamento",
      message: `Marcar o orçamento nº ${orcamento.numero} como recusado pelo cliente?`,
      buttons: ["Cancelar", "Recusar"],
    });
    if (result.response === 1) {
      orcamento.status = "recusado";
      await orcamento.save();
      auditar("orçamento recusado", `orçamento ${orcamento.numero}`);
      avisarDashboard();
      event.reply("reset-form");
    }
  } catch (error) {
    console.error("Erro ao recusar orçamento:", error);
  }
});


// =============================
// ======== RELATÓRIOS =========

// Tipos de relatório: função que monta os dados, se usa período e a
// permissão extra exigida (além de "relatorios"), quando houver
const tiposRelatorio = {
  clientes: { montar: () => relatorios.clientes(), periodo: false },
  andamento: { montar: () => relatorios.osEmAndamento(), periodo: false },
  entregues: { montar: (ini, fim) => relatorios.osEntregues(ini, fim), periodo: true },
  todas: { montar: (ini, fim) => relatorios.todasOS(ini, fim), periodo: true },
  faturamento: { montar: (ini, fim) => relatorios.faturamento(ini, fim), periodo: true, permissao: "financeiro" },
  produtos: { montar: (ini, fim) => relatorios.produtosMaisVendidos(ini, fim), periodo: true },
  receber: { montar: () => relatorios.contasAReceber(), periodo: false, permissao: "financeiro" },
  recebimentos: { montar: (ini, fim) => relatorios.recebimentos(ini, fim), periodo: true, permissao: "financeiro" },
  estoque: { montar: () => relatorios.estoque(), periodo: false, permissao: "estoque" },
  auditoria: { montar: (ini, fim) => auditoria.relatorio(ini, fim), periodo: true, permissao: "usuarios" },
};

// pedido = { tipo, inicio: "AAAA-MM-DD", fim: "AAAA-MM-DD" }
ipcComPermissao("generate-report", "relatorios", async (event, pedido) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  const tipo = tiposRelatorio[pedido.tipo];
  if (!tipo) return;
  if (tipo.permissao && !pode(tipo.permissao)) return avisoSemPermissao(event);

  try {
    // Período no horário local: do começo do dia inicial ao fim do dia final
    const inicio = new Date(`${pedido.inicio}T00:00:00`);
    const fim = new Date(`${pedido.fim}T23:59:59.999`);
    if (tipo.periodo && (isNaN(inicio) || isNaN(fim) || inicio > fim)) {
      await dialog.showMessageBox(janela, {
        type: "warning",
        title: "Atenção",
        message: "Informe um período válido (a data inicial não pode ser depois da final).",
        buttons: ["OK"],
      });
      return;
    }

    const relatorio = await tipo.montar(inicio, fim);
    if (tipo.periodo) {
      relatorio.periodo = `${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`;
    }
    const hoje = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no horário local
    await gerarPDF(htmlRelatorio(relatorio), `Relatorio-${pedido.tipo}-${hoje}.pdf`, janela);
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    dialog.showMessageBox(janela, {
      type: "error",
      title: "Erro",
      message: "Não foi possível gerar o relatório.",
      detail: error.message,
      buttons: ["OK"],
    });
  }
});

//
app.commandLine.appendSwitch("log-level", "3");

// Itens com "permissao" só aparecem para os perfis que têm essa permissão
// (ver PERMISSOES e montarMenu()).
const template = [
  {
    label: "Cadastro",
    submenu: [
      {
        label: "Cliente",
        permissao: "clientes",
        click: () => costumerRegistrationWindow(),
      },
      {
        label: "Orçamento",
        permissao: "orcamentos",
        click: () => quoteRegistrationWindow(),
      },
      {
        label: "OS",
        permissao: "os",
        click: () => serviceOrderRegistrationWindow(),
      },
      {
        label: "Produto",
        permissao: "produtos",
        click: () => productRegistrationWindow(),
      },
      {
        label: "Insumos (estoque)",
        permissao: "estoque",
        click: () => stockWindow(),
      },
      {
        label: "Fornecedor",
        permissao: "estoque",
        click: () => supplierRegistrationWindow(),
      },
      {
        label: "Usuários",
        permissao: "usuarios",
        click: () => userRegistrationWindow(),
      },
      {
        type: "separator"
      },
      {
        label: "Trocar usuário",
        click: () => trocarUsuario()
      },
      {
        label: "Sair",
        accelerator: "Alt+F4",
        click: () => app.quit()
      }
    ]
  },
  {
    label: "Relatórios",
    permissao: "relatorios",
    submenu: [
      {
        label: "Clientes",
        click: () => reportsWindow("clientes"),
      },
      {
        label: "OS em andamento",
        click: () => reportsWindow("andamento"),
      },
      {
        label: "OS entregues",
        click: () => reportsWindow("entregues"),
      },
      {
        label: "Todas as OS",
        click: () => reportsWindow("todas"),
      },
      {
        type: "separator"
      },
      {
        label: "Faturamento",
        permissao: "financeiro",
        click: () => reportsWindow("faturamento"),
      },
      {
        label: "Produtos mais vendidos",
        click: () => reportsWindow("produtos"),
      },
      {
        type: "separator"
      },
      {
        label: "Contas a receber",
        permissao: "financeiro",
        click: () => reportsWindow("receber"),
      },
      {
        label: "Recebimentos",
        permissao: "financeiro",
        click: () => reportsWindow("recebimentos"),
      },
      {
        type: "separator"
      },
      {
        label: "Estoque de insumos",
        permissao: "estoque",
        click: () => reportsWindow("estoque"),
      },
    ]
  },
  {
    label: "Ferramentas",
    submenu: [
      {
        label: "Configurar banco de dados",
        permissao: "configuracao",
        click: () => dbConfigWindow(),
      },
      {
        label: "Limpeza LGPD (dados antigos)",
        permissao: "configuracao",
        click: () => limpezaLgpd(),
      },
      {
        id: "tema",
        label: "Tema escuro",
        type: "checkbox",
        accelerator: "CTRL+T",
        click: () => aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro"),
      },
      {
        type: "separator"
      },
      {
        label: "Zoom+",
        role: "zoomIn",
      },
      {
        label: "Zoom-",
        role: "zoomOut",
      },
      {
        label: "Restaurar zoom",
        role: "resetZoom",
      },
      {
        type: "separator"
      },
      {
        label: "Recarregar",
        role: "reload",
        accelerator: "CTRL+R",
        somenteDesenvolvimento: true,
      },
      {
        label: "DevTools",
        role: "ToggleDevTools",
        somenteDesenvolvimento: true,
      }
    ],
  },
  {
    label: "Ajuda",
    submenu: [
      {
        label: "Repositório",
        click: () => shell.openExternal(packageInfo.homepage)
      },
      {
        label: "Sobre",
        click: () => aboutWindow()
      }
    ]
  }
]

// Monta o menu do usuário logado: remove o que o perfil não pode usar e
// os separadores que sobrarem no começo, no fim ou repetidos
function montarMenu(itens = template) {
  const visiveis = itens
    .filter((item) => !item.permissao || pode(item.permissao))
    .filter((item) => !item.somenteDesenvolvimento || modoDesenvolvimento)
    .map(({ permissao, somenteDesenvolvimento, ...item }) => (item.submenu ? { ...item, submenu: montarMenu(item.submenu) } : item))
    .map((item) => (item.id === "tema" ? { ...item, checked: temaAtual() === "escuro" } : item))
    .filter((item) => !item.submenu || item.submenu.length > 0);
  return visiveis.filter((item, i) =>
    item.type !== "separator" ||
    (i > 0 && i < visiveis.length - 1 && visiveis[i - 1].type !== "separator")
  );
}

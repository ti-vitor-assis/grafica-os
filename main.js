/**
 * Main
 * @author Vitor de Assis Passos
 */

console.log("Executando Processo Principal")

const { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog, shell } = require("electron/main")

const path = require("node:path")

const packageInfo = require("./package.json")

const { conectar, desconectar } = require('./database.js')

const clienteModel = require("./src/model/Clientes.js");
const serviceOrderModel = require('./src/model/ServiceOrder.js')
const productModel = require('./src/model/Products.js')

const { gerarPDF } = require('./src/print/pdf.js')
const { htmlOS } = require('./src/print/osTemplate.js')
const { htmlRelatorio } = require('./src/print/reportTemplate.js')
const relatorios = require('./src/reports/relatorios.js')

let win

// INICIO - Janelas
const createWindow = () => {
  nativeTheme.themeSource = "dark"
  win = new BrowserWindow({
    width: 1010,
    height: 720,
    // Preload
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  win.loadFile("./src/views/index.html")
}

// Cria uma janela modal (filha da janela principal) com o arquivo HTML informado.
// As telas de cadastro usam o tamanho padrão; "opcoes" permite mudar o
// tamanho e passar parâmetros na URL (query), lidos pela tela em location.search
function modalWindow(arquivoHtml, opcoes = {}) {
  if (!win) return null;
  const janela = new BrowserWindow({
    width: opcoes.width || 1010,
    height: opcoes.height || 720,
    autoHideMenuBar: true,
    resizable: false,
    minimizable: false,
    parent: win,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
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

// Relatórios (tipo = relatório já selecionado ao abrir, ex.: "entregues")
function reportsWindow(tipo) {
  return modalWindow("./src/views/reports.html", {
    width: 560,
    height: 560,
    query: tipo ? { tipo } : {},
  });
}

// Botões da tela inicial pedem para abrir uma janela pelo nome.
// Só os nomes desta lista são aceitos.
const janelasPorNome = {
  clientes: costumerRegistrationWindow,
  os: serviceOrderRegistrationWindow,
  produtos: productRegistrationWindow,
  relatorios: () => reportsWindow(),
};
ipcMain.on("open-window", (event, nome) => {
  const abrir = janelasPorNome[nome];
  if (abrir) abrir();
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

// FIM - Janelas
app.whenReady().then(() => {

  createWindow();

  // Cada janela pede a conexão ao carregar (preload.js) e recebe o status
  // para atualizar o ícone do rodapé
  ipcMain.on("db-connect", async (event) => {
    const ok = await conectar();
    setTimeout(() => {
      event.reply("db-status", ok ? "conectado" : "desconectado")
    }, 500)
  })
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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



// ===============================================
// ================ CRUD CREATE ==================

ipcMain.on("create-cliente", async (event, cliente) => {
  console.log(cliente);

  try {
    const novoCliente = clienteModel({
      nome: cliente.nomeCli,
      rg: cliente.rgCli,
      cpf: cliente.cpfCli,
      sexo: cliente.sexoCli,
      dataNascimento: cliente.dataNascCli,
      telefone: cliente.telefoneCli,
      telefone2: cliente.telefone2Cli,
      email: cliente.emailCli,
      cep: cliente.cepCli,
      endereco: cliente.enderecoCli,
      numero: cliente.numCli,
      complemento: cliente.complementoCli,
      bairro: cliente.bairroCli,
      cidade: cliente.cidadeCli,
      estado: cliente.estadoCli,
    });
    await novoCliente.save();

    // Confirmação de cliente adicionado ao banco (dialog)
    dialog
      .showMessageBox({
        type: "info",
        title: "Aviso",
        message: "Cliente adicionado com sucesso",
        buttons: ["OK"],
      })
      .then((result) => {
        // se o botão OK for pressionado
        if (result.response === 0) {
          // enviar para o renderizador limpar os campos (preload.js)
          event.reply("reset-form");
        }
      });
  } catch (error) {
    if (error.code === 11000) {
      dialog
        .showMessageBox({
          type: "error",
          title: "Atenção!",
          message: "CPF já cadastrado.\nVerifique o número digitado.",
          buttons: ["OK"],
        })
        .then((result) => {
          // Se o botão OK for pressionado
          if (result.response === 0) {
            // Limpar campo CPF, foco e borda em vermelho
            event.reply("cpf-duplicate");
          }
        });
    } else {
      console.log(error);
    }
  }
});



// ===============================================
// ================= CRUD READ ===================

// validação da busca
ipcMain.on("validate-search", () => {
  dialog.showMessageBox({
    type: "warning",
    title: "Atenção",
    message: "Preencha o campo de busca",
    buttons: ["OK"],
  });
});

ipcMain.on("search-name", async (event, cliName) => {
  // Teste recebimento nome do cliente (passo 2)
  console.log(cliName);
  try {
    // Passos 3 e 4 (Busca dos dados do cliente pelo nome)
    const client = await clienteModel.find({
      // RegExp (Expressão Regular 'i' -> insensitive(ignorar letras maiúsculas e minúsculas))
      nome: new RegExp(cliName, "i"),
    });
    // Teste da busca do cliente pelo nome (Passos 3 e 4)
    console.log(client);

    // Melhoria da experiencia do usuário (se não existir um cliente cadastrado enviar uma mensagem ao usuário questionando se ele deseja cadastrar este novo cliente)
    // Se o vetor estiver vazio
    if (client.length === 0) {
      // Questionar o usuário
      dialog
        .showMessageBox({
          type: "warning",
          title: "Aviso",
          message: "Cliente não cadastrado.\nDeseja cadastrar este cliente?",
          defaultId: 0,
          buttons: ["SIM", "NÃO"], // [0, 1] defaultId: 0 = Sim
        })
        .then((result) => {
          if (result.response === 0) {
            // Enviar ao rendererCadCli um pedido para copiar o nome do cliente do campo de busca para o campo nome (evitar que o usuário digite o nome novamente)
            event.reply("set-name");
          } else {
            // enviar ao rendererCliente um pedido para limpar os campos (reutilizar a api do preload 'reset-form')
            event.reply("reset-form");
          }
        });
    } else {
      // Passo 5: Enviar ao renderizador (rendererCadCli) os dados do cliente
      // Não esquecer de converter para string
      event.reply("render-client", JSON.stringify(client));
    }
  } catch (error) {
    console.log(error);
  }
});

ipcMain.on("search-cpf", async (event, cpfCli) => {
  // Teste recebimento nome do cliente (passo 2)
  console.log(cpfCli);
  try {
    // Passos 3 e 4 (Busca dos dados do cliente pelo nome)
    const client = await clienteModel.find({
      // RegExp (Expressão Regular 'i' -> insensitive(ignorar letras maiúsculas e minúsculas))
      cpf: new RegExp(cpfCli, "i"),
    });
    // Teste da busca do cliente pelo nome (Passos 3 e 4)
    console.log(client);

    // Melhoria da experiencia do usuário (se não existir um cliente cadastrado enviar uma mensagem ao usuário questionando se ele deseja cadastrar este novo cliente)
    // Se o vetor estiver vazio
    if (client.length === 0) {
      // Questionar o usuário
      dialog
        .showMessageBox({
          type: "warning",
          title: "Aviso",
          message: "Cliente não cadastrado.\nDeseja cadastrar este cliente?",
          defaultId: 0,
          buttons: ["SIM", "NÃO"], // [0, 1] defaultId: 0 = Sim
        })
        .then((result) => {
          if (result.response === 0) {
            // Enviar ao rendererCadCli um pedido para copiar o nome do cliente do campo de busca para o campo nome (evitar que o usuário digite o nome novamente)
            event.reply("set-cpf");
          } else {
            // enviar ao rendererCliente um pedido para limpar os campos (reutilizar a api do preload 'reset-form')
            event.reply("reset-form");
          }
        });
    } else {
      // Passo 5: Enviar ao renderizador (rendererCadCli) os dados do cliente
      // Não esquecer de converter para string
      event.reply("render-client", JSON.stringify(client));
    }
  } catch (error) {
    console.log(error);
  }
});

// ======== CRUD UPDATE =========

ipcMain.on("update-client", async (event, client) => {
  try {
    const updateCliente = await clienteModel.findByIdAndUpdate(
      client.idCli,
      {
        nome: client.nomeCli,
        rg: client.rgCli,
        cpf: client.cpfCli,
        sexo: client.sexoCli,
        dataNascimento: client.dataNascCli,
        telefone: client.telefoneCli,
        telefone2: client.telefone2Cli,
        email: client.emailCli,
        cep: client.cepCli,
        endereco: client.enderecoCli,
        numero: client.numCli,
        complemento: client.complementoCli,
        bairro: client.bairroCli,
        cidade: client.cidadeCli,
        estado: client.estadoCli,
      },
      {
        new: true,
      }
    );
    // Confirmação de cliente adicionado ao banco (dialog)
    dialog
      .showMessageBox({
        type: "info",
        title: "Aviso",
        message: "Dados do cliente alterados com sucesso",
        buttons: ["OK"],
      })
      .then((result) => {
        // se o botão OK for pressionado
        if (result.response === 0) {
          // enviar para o renderizador limpar os campos (preload.js)
          event.reply("reset-form");
        }
      });
  } catch (error) {
    if (error.code === 11000) {
      dialog
        .showMessageBox({
          type: "error",
          title: "Atenção!",
          message: "CPF já cadastrado.\nVerifique o número digitado.",
          buttons: ["OK"],
        })
        .then((result) => {
          // Se o botão OK for pressionado
          if (result.response === 0) {
            // Limpar campo CPF, foco e borda em vermelho
            event.reply("cpf-duplicate");
          }
        });
    } else {
      console.log(error);
    }
  }
});


// ==============================
// ======== CRUD DELETE =========

ipcMain.on("delete-client", async (event, id) => {
  //console.log(id);
  // Excuir o registro do banco (passo 3) IMPORTANTE! (confirmar antes da exclusão)
  // win = Janela Principal
  const result = await dialog.showMessageBox(win, {
    type: "warning",
    title: "Atenção!",
    message:
      "Tem certeza que deseja excluir este Cliente?\nEsta ação não podera ser desfeita.",
    buttons: ["Cancelar", "Excluir"], // É um Vetor indices: [0, 1]
  });
  console.log(result);
  if (result.response === 1) {
    try {
      const delClient = await clienteModel.findByIdAndDelete(id);
      console.log(`deletado ${id}`);
      event.reply("reset-form");
    } catch (error) {
      console.log(error);
    }
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
ipcMain.on("create-product", async (event, produto) => {
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
ipcMain.on("search-product", async (event, termo) => {
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
ipcMain.on("update-product", async (event, produto) => {
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
ipcMain.on("delete-product", async (event, id) => {
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
ipcMain.on("show-warning", (event, mensagem) => {
  dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: "warning",
    title: "Atenção",
    message: mensagem,
    buttons: ["OK"],
  });
});

// Produtos ativos, para o campo de seleção de itens da OS
ipcMain.on("list-products", async (event) => {
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
// Arte e pagamento usam caminhos com ponto ("arte.origem") para alterar só
// esses campos e não apagar as datas que o modelo preenche sozinho.
async function dadosOS(order) {
  const itens = Array.isArray(order.produtos) ? order.produtos : [];
  const produtos = await productModel.find({ _id: { $in: itens.map((i) => i.produto) } });
  const nomes = new Map(produtos.map((p) => [String(p._id), p.nome]));

  return {
    cliente: order.cliente || undefined,
    produtos: itens.map((i) => ({
      produto: i.produto,
      // Item que já estava na OS mantém a descrição original
      descricao: i.descricao || nomes.get(String(i.produto)),
      quantidade: Number(i.quantidade),
      valorUnitario: Number(i.valorUnitario),
    })),
    prazoFinal: dataLocal(order.prazoFinal),
    status: order.status,
    observacoes: order.observacoes,
    "arte.origem": order.arte?.origem,
    "arte.aprovada": !!order.arte?.aprovada,
    "pagamento.sinal": Number(order.pagamento?.sinal || 0),
    "pagamento.formaPagamento": order.pagamento?.formaPagamento || "",
    "pagamento.pago": !!order.pagamento?.pago,
  };
}

// ======= CREATE =======
ipcMain.on("create-order", async (event, order) => {
  try {
    const os = await serviceOrderModel.create(await dadosOS(order));
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

// ======= READ =======
// filtro: { numero } para abrir uma OS, ou { clienteId } para listar as OS do cliente
ipcMain.on("search-order", async (event, filtro) => {
  try {
    const porNumero = filtro.numero != null;
    const ordens = await serviceOrderModel
      .find(porNumero ? { numero: Number(filtro.numero) } : { cliente: filtro.clienteId })
      .populate("cliente")
      .sort({ numero: -1 });

    if (porNumero && ordens.length === 0) {
      await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
        type: "info",
        title: "Aviso",
        message: `OS nº ${filtro.numero} não encontrada.`,
        buttons: ["OK"],
      });
      return;
    }
    event.reply("order-result", JSON.stringify({ modo: porNumero ? "numero" : "cliente", ordens }));
  } catch (error) {
    console.error("Erro na busca da OS:", error);
  }
});

// ======= UPDATE =======
ipcMain.on("update-order", async (event, order) => {
  try {
    const os = await serviceOrderModel.findById(order._id);
    if (!os) return;
    os.set(await dadosOS(order));
    // save() (e não findByIdAndUpdate) para as regras do modelo rodarem
    await os.save();
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

ipcMain.on("dashboard-data", async (event) => {
  try {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    // "Próximas do prazo" = vencem hoje ou nos próximos 3 dias
    const limiteProximas = new Date(inicioHoje);
    limiteProximas.setDate(limiteProximas.getDate() + 4);

    const [atrasadas, pendentes, entregues, lista] = await Promise.all([
      serviceOrderModel.countDocuments({ ...emAndamento, prazoFinal: { $lt: inicioHoje } }),
      serviceOrderModel.countDocuments({ ...emAndamento, prazoFinal: { $gte: inicioHoje } }),
      serviceOrderModel.countDocuments({ status: "entregue" }),
      serviceOrderModel
        .find({ ...emAndamento, prazoFinal: { $lt: limiteProximas } })
        .populate("cliente", "nome")
        .sort({ prazoFinal: 1 })
        .limit(30),
    ]);

    event.reply("dashboard-data", JSON.stringify({ atrasadas, pendentes, entregues, lista }));
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

ipcMain.on("print-order", (event, id) => {
  imprimirOS(id, BrowserWindow.fromWebContents(event.sender));
});

// ======= DELETE =======
ipcMain.on("delete-order", async (event, id) => {
  try {
    const os = await serviceOrderModel.findById(id);
    if (!os) return;
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: "warning",
      title: "Atenção!",
      message: `Tem certeza que deseja excluir a OS nº ${os.numero}?\nEsta ação não poderá ser desfeita.`,
      detail: "Se o serviço não vai mais ser feito, prefira mudar o status para \"cancelada\" e manter o histórico.",
      buttons: ["Cancelar", "Excluir"],
    });
    if (result.response === 1) {
      await serviceOrderModel.findByIdAndDelete(id);
      avisarDashboard();
      event.reply("reset-form");
    }
  } catch (error) {
    console.error("Erro ao excluir OS:", error);
  }
});


// =============================
// ======== RELATÓRIOS =========

// Tipos de relatório: função que monta os dados e se usa período
const tiposRelatorio = {
  clientes: { montar: () => relatorios.clientes(), periodo: false },
  andamento: { montar: () => relatorios.osEmAndamento(), periodo: false },
  entregues: { montar: (ini, fim) => relatorios.osEntregues(ini, fim), periodo: true },
  todas: { montar: (ini, fim) => relatorios.todasOS(ini, fim), periodo: true },
};

// pedido = { tipo, inicio: "AAAA-MM-DD", fim: "AAAA-MM-DD" }
ipcMain.on("generate-report", async (event, pedido) => {
  const janela = BrowserWindow.fromWebContents(event.sender);
  const tipo = tiposRelatorio[pedido.tipo];
  if (!tipo) return;

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

const template = [
  {
    label: "Cadastro",
    submenu: [
      {
        label: "Cliente",
        click: () => costumerRegistrationWindow(),
      },
      {
        label: "OS",
        click: () => serviceOrderRegistrationWindow(),
      },
      {
        label: "Produto",
        click: () => productRegistrationWindow(),
      },
      {
        type: "separator"
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
    ]
  },
  {
    label: "Ferramentas",
    submenu: [
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
      },
      {
        label: "DevTools",
        role: "ToggleDevTools",
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
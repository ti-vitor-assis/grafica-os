/**
 * Main
 * @author Vitor de Assis Passos
 */

console.log("Executando Processo Principal")

const { app, BrowserWindow, nativeTheme, Menu, ipcMain, dialog } = require("electron/main")

const path = require("node:path")

const { conectar, desconectar } = require('./database.js')

const clienteModel = require("./src/model/Clientes.js");
const serviceOrderModel = require('./src/model/ServiceOrder.js')

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

// Clientes
let costumerRegistration
function costumerRegistrationWindow() {
  const mainWindow = BrowserWindow.getFocusedWindow();

  if (mainWindow) {
    costumerRegistration = new BrowserWindow({
      width: 1010,
      height: 720,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });
  }
  costumerRegistration.loadFile("./src/views/costumerRegistration.html");
}

// Ordem de Serviços
let serviceOrderRegistration
function serviceOrderRegistrationWindow() {
  const mainWindow = BrowserWindow.getFocusedWindow();

  if (mainWindow) {
    costumerRegistration = new BrowserWindow({
      width: 1010,
      height: 720,
      autoHideMenuBar: true,
      resizable: false,
      minimizable: false,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });
  }
  costumerRegistration.loadFile("./src/views/serviceOrderRegistration.html");
}


// FIM - Janelas
app.whenReady().then(() => {

  let errorCode = null
  createWindow();
  ipcMain.on("db-connect", async (event) => {

    try {
      await conectar();
    } catch (error) {
      errorCode = error.code
    }
    //console.log(errorCode)
    if (errorCode === null) {
      setTimeout(() => {
        event.reply("db-status", "conectado")
      }, 500)
    }


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
      senha: cliente.senhaCli,
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
        senha: client.senhaCli,
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
// ====== SERVICE ORDER ========

ipcMain.on("buscar-ordem", async (event, clienteOuCPF) => {
  try {
    const resultado = await serviceOrderModel.find({
      clientName: new RegExp(clienteOuCPF, "i")
    });
    if (resultado.length === 0) {
      await dialog.showMessageBox({
        type: "info",
        title: "Aviso",
        message: "Nenhuma Ordem de Serviço encontrada.",
        buttons: ["OK"]
      });
    } else {
      event.reply("resultado-ordem", JSON.stringify(resultado));
    }
  } catch (error) {
    console.error("Erro na busca da OS:", error);
  }
});

// ======= CREATE SERVICE ORDER =======
ipcMain.on("create-order", async (event, order) => {
  console.log("Received new order:", order);

  try {
    const newOrder = new serviceOrderModel({
      clientName: order.clientName,
      products: order.products,
      deliveryDate: order.deliveryDate,
      totalValue: order.totalValue,
      createdAt: new Date()
    });

    await newOrder.save();

    const result = await dialog.showMessageBox({
      type: "info",
      title: "Aviso",
      message: "Ordem de serviço criada com sucesso.",
      buttons: ["OK"]
    });

    if (result.response === 0) {
      event.reply("reset-form");
    }
  } catch (error) {
    console.error("Error saving order:", error);
    await dialog.showMessageBox({
      type: "error",
      title: "Erro",
      message: "Falha ao criar ordem de serviço.",
      buttons: ["OK"]
    });
  }
});

// ======= DELETE SERVICE ORDER =======
ipcMain.on("delete-order", async (event, id) => {
  if (!win) {
    console.error("Janela principal (win) não está definida.");
    return;
  }

  const result = await dialog.showMessageBox(win, {
    type: "warning",
    title: "Atenção!",
    message: "Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.",
    buttons: ["Cancelar", "Excluir"]
  });

  if (result.response === 1) {
    try {
      await serviceOrderModel.findByIdAndDelete(id);
      console.log(`Order ${id} deleted`);
      event.reply("reset-form");
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  }
});

// ======= UPDATE SERVICE ORDER =======
ipcMain.on("update-order", async (event, order) => {
  try {
    await serviceOrderModel.findByIdAndUpdate(order._id, order);
    await dialog.showMessageBox({
      type: "info",
      title: "Aviso",
      message: "Ordem de serviço atualizada com sucesso.",
      buttons: ["OK"]
    });
    event.reply("reset-form");
  } catch (error) {
    console.error("Error updating order:", error);
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
        label: "Sair",
        click: () => console.log("close()")
      }
    ]
  },
  {
    label: "Relatórios",
    submenu: [
      {
        label: "Clientes",
        click: () => showClientReports()
      },
      {
        label: "OS's Abertas",
        click: () => showOpenOSReports()
      },
      {
        label: "OS's Fechadas",
        click: () => showClosedOSReports()
      },
      {
        label: "Todas OS",
        click: () => showAllOSReports()
      }
    ]
  }, {
    label: "Ferramentas",
    submenu: [
      {
        label: "Zoom+",
        click: () => showClientReports()
      },
      {
        label: "Zoom-",
        click: () => showOpenOSReports()
      },
      {
        label: "OS's Fechadas",
        click: () => showClosedOSReports()
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
        click: () => console.log("incluir o redirecionador https://github.com/vitorapassos/grafica-os.git")
      },
      {
        label: "Sobre",
        click: () => aboutWindow()
      }
    ]
  }
]
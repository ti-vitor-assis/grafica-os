/**
 * Main
 * @author Vitor de Assis Passos
 */

console.log("Executando Processo Principal")

const { app, BrowserWindow, nativeTheme, Menu, ipcMain } = require("electron/main")

const path = require("node:path")

const { conectar, desconectar } = require('./database.js')

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
        console.log(errorCode)
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
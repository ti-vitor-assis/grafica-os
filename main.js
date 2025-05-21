/**
 * Main
 * @author Vitor de Assis Passos
 */

console.log("Executando Processo Principal")

const { app, BrowserWindow, nativeTheme, Menu, ipcMain } = require("electron/main")

let win

const createWindow = () => {
    nativeTheme.themeSource = "dark"
    win = new BrowserWindow({
        width: 1010,
        height: 720,

    })
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
    win.loadFile("./src/views/index.html")
}

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            console.log("Passou pelo if browser")
        }
    })
});

const template = [
    {
        label: "Cadastro",
        submenu: [
            {
                label: "Cadastrar",
                click: () => cadastroWindow(),
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
    },
    {
        label:"Ajuda",
        submenu:[
            {
                label:"Repositório",
                click: () => console.log("incluir o redirecionador https://github.com/vitorapassos/grafica-os.git")
            },
            {
                label: "Sobre",
                click: () => aboutWindow()
            }
        ]
    }
]
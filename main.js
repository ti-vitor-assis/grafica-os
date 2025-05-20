/**
 * Main
 * @author Vitor de Assis Passos
 */

console.log("Executando Processo Principal")

const { app, BrowserWindow, nativeTheme, Menu } = require("electron/main")

let win

const createWindow = () => {
    nativeTheme.themeSource = "dark"
    win = new BrowserWindow({
        width: 1010,
        height: 720,

    })
    win.loadFile("./src/views/index.html")

}

app.whenReady().then(() => {
createWindow();
    

});

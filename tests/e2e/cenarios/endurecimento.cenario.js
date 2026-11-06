// Endurecimento do Electron: janelas, navegação, origem do IPC e permissões
const path = require("node:path");

module.exports = {
    async executar(ctx) {
        const { BrowserWindow } = require("electron");
        const inicio = ctx.janela("Bem vindo");
        const total = () => BrowserWindow.getAllWindows().length;

        const antes = total();
        await ctx.js(inicio, "window.open('https://example.com'); window.open('file:///C:/Windows/win.ini')");
        await ctx.espera(1000);
        ctx.igual(total(), antes, "window.open não abre janela nova");

        await ctx.js(inicio, "location.href = 'https://example.com'");
        await ctx.espera(1500);
        ctx.ok(inicio.webContents.getURL().startsWith("file://"), "a tela não navega para um site de fora");

        ctx.igual(await ctx.js(inicio, "Notification.requestPermission()"), "denied", "permissões do navegador negadas");

        // Uma página que não é do app (aqui, uma data: URL) com o mesmo preload
        // não consegue usar o IPC
        const intrusa = new BrowserWindow({
            show: false,
            webPreferences: { preload: path.join(process.env.APP_DIR, "preload.js"), sandbox: true },
        });
        await intrusa.loadURL("data:text/html,<p>intrusa</p>");
        await ctx.espera(500);
        const Cli = ctx.modelo("Clientes");
        await ctx.js(intrusa, "api.openWindow('clientes'); api.createCliente({ nome: 'Invasor', documento: '11144477735' })");
        await ctx.espera(2000);
        ctx.ok(!ctx.janela("Clientes"), "IPC de origem desconhecida é recusado (não abre janela)");
        ctx.igual(await Cli.countDocuments(), 0, "IPC de origem desconhecida é recusado (não grava)");
        intrusa.destroy();

        // As telas do app continuam funcionando normalmente
        await ctx.abrir("clientes", "Clientes");
        ctx.ok(!!ctx.janela("Clientes"), "telas do app continuam usando o IPC");
    },
};

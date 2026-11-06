// Comportamento do app instalado: sem DevTools e sem "Recarregar"
module.exports = {
    env: { GRAFICA_SIMULAR_INSTALADO: "1" },
    async executar(ctx) {
        const { Menu } = require("electron");
        const ferramentas = Menu.getApplicationMenu().items.find((i) => i.label === "Ferramentas").submenu.items
            .map((i) => i.label).filter(Boolean);
        ctx.ok(!ferramentas.includes("DevTools"), "menu sem DevTools");
        ctx.ok(!ferramentas.includes("Recarregar"), "menu sem Recarregar");

        const inicio = ctx.janela("Bem vindo");
        inicio.webContents.openDevTools();
        await ctx.espera(1000);
        ctx.ok(!inicio.webContents.isDevToolsOpened(), "DevTools não abre nem por código/atalho");

        const os = await ctx.abrir("os", "Ordem de Serviço");
        os.webContents.openDevTools();
        await ctx.espera(1000);
        ctx.ok(!os.webContents.isDevToolsOpened(), "DevTools também bloqueado nas outras telas");
    },
};

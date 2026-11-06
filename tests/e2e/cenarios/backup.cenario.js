// Backup e restauração pelo menu, lembrete no painel, exportação completa
// para Excel e relatório em Excel
const fs = require("node:fs");
const path = require("node:path");
const { Menu, dialog, app } = require("electron");

const menu = (rotulo) =>
    Menu.getApplicationMenu().items.find((i) => i.label === "Ferramentas").submenu.items.find((i) => i.label === rotulo);

module.exports = {
    async executar(ctx) {
        const ExcelJS = require(path.join(process.env.APP_DIR, "node_modules", "exceljs"));
        const Cli = ctx.modelo("Clientes");
        await ctx.criarCliente("Maria Souza", "52998224725", { telefone: "11988887777" });
        await ctx.modelo("ServiceOrder").create({
            cliente: (await Cli.findOne())._id, prazoFinal: new Date(Date.now() + 864e5),
            produtos: [{ produto: (await Cli.findOne())._id, descricao: "Banner", quantidade: 2, valorUnitario: 45 }],
        });

        // ---- Lembrete no painel (nunca fez backup)
        const inicio = ctx.janela("Bem vindo");
        await ctx.js(inicio, "api.requestDashboard()");
        await ctx.aguardar(() => ctx.js(inicio, "!alertaBackup.hidden"));
        ctx.ok((await ctx.js(inicio, "textoAlertaBackup.textContent")).includes("Nenhum backup"), "painel lembra de fazer backup");

        // ---- Fazer backup
        menu("Fazer backup...").click();
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("Backup salvo")));
        const arquivoBackup = ctx.pdfs[ctx.pdfs.length - 1];
        const conteudo = fs.readFileSync(arquivoBackup, "utf8");
        ctx.ok(conteudo.includes("grafica-os-backup-completo") && !conteudo.includes("Maria"), "backup salvo e cifrado");

        // ---- Perde dados e restaura
        await Cli.deleteMany({});
        await ctx.modelo("ServiceOrder").deleteMany({});
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [arquivoBackup] });
        ctx.respostas.push(1); // confirmar restauração
        menu("Restaurar backup...").click();
        let login;
        await ctx.aguardar(() => (login = ctx.janela("Gráfica OS · Login")) && !login.webContents.isLoading());
        ctx.igual(await Cli.countDocuments(), 1, "clientes de volta");
        ctx.igual(await ctx.modelo("ServiceOrder").countDocuments(), 1, "OS de volta");
        await ctx.aguardar(() => ctx.js(login, "!avisoSessao.hidden"));
        ctx.ok((await ctx.js(login, "textoAvisoSessao.textContent")).includes("backup foi restaurado"), "pede para entrar de novo");
        const pastaBackups = path.join(app.getPath("userData"), "backups");
        ctx.ok(fs.readdirSync(pastaBackups).some((f) => f.startsWith("antes-de-restaurar")), "guardou o estado anterior antes de restaurar");
        fs.rmSync(pastaBackups, { recursive: true, force: true });
        await ctx.login();

        // ---- Painel sem o lembrete (backup recente)
        await ctx.aguardar(() => ctx.js(ctx.janela("Bem vindo"), "alertaBackup.hidden"));
        ctx.ok(true, "lembrete some depois do backup");

        // ---- Exportar todos os dados para Excel
        const antes = ctx.pdfs.length;
        ctx.respostas.push(1); // confirmar exportação
        menu("Exportar todos os dados para Excel...").click();
        await ctx.aguardar(() => ctx.pdfs.length > antes && fs.existsSync(ctx.pdfs[ctx.pdfs.length - 1]));
        await ctx.espera(500);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(ctx.pdfs[ctx.pdfs.length - 1]);
        ctx.ok(JSON.stringify(wb.getWorksheet("Clientes").getSheetValues()).includes("529.982.247-25"), "planilha completa com o CPF legível");
        ctx.ok(ctx.dialogos.some((d) => d.includes("SEM proteção")), "avisa antes de exportar com CPF legível");

        // ---- Relatório em Excel (documento mascarado)
        const rel = await ctx.abrir("relatorios", "Relatórios");
        const antesRel = ctx.pdfs.length;
        await ctx.js(rel, "document.querySelector('input[value=clientes]').click(); btnExcel.click()");
        await ctx.aguardar(() => ctx.pdfs.length > antesRel && fs.existsSync(ctx.pdfs[ctx.pdfs.length - 1]));
        await ctx.espera(500);
        const wbRel = new ExcelJS.Workbook();
        await wbRel.xlsx.readFile(ctx.pdfs[ctx.pdfs.length - 1]);
        const textoRel = JSON.stringify(wbRel.worksheets[1].getSheetValues());
        ctx.ok(textoRel.includes("***.982.247-**") && !textoRel.includes("529.982.247-25"), "relatório em Excel com CPF mascarado");

        const acoes = (await ctx.modelo("Auditoria").find().lean()).map((a) => a.acao);
        ctx.ok(["backup feito", "backup restaurado", "todos os dados exportados para Excel"].every((a) => acoes.includes(a)), "auditoria registra backup, restauração e exportação");
    },
};

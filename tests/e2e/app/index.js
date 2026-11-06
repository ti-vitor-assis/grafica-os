/**
 * Abre o Gráfica OS de verdade (o main.js do projeto) para um cenário de teste.
 * As caixas de diálogo são respondidas automaticamente e o "Salvar como" dos
 * PDFs grava numa pasta temporária. O resultado sai numa linha "[e2e] {...}".
 *
 * Usado por tests/e2e/executar.js; não rode direto.
 */

const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { app, BrowserWindow, dialog, shell, Menu } = require("electron");

const RAIZ = process.env.APP_DIR;
if (app.setAppPath) app.setAppPath(RAIZ);

const cenario = require(process.env.E2E_CENARIO);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== Contexto entregue ao cenário =====
const ctx = {
    falhas: [],
    verificacoes: 0,
    respostas: [], // botões que os próximos diálogos vão "clicar" (padrão: 0)
    dialogos: [], // mensagens dos diálogos mostrados
    pdfs: [], // arquivos gerados pelo "Salvar como"
    errosConsole: [],
    espera,
    log: (...a) => console.log("[cenario]", ...a),

    ok(condicao, descricao) {
        ctx.verificacoes++;
        if (!condicao) ctx.falhas.push(descricao);
    },
    igual(atual, esperado, descricao) {
        ctx.verificacoes++;
        if (JSON.stringify(atual) !== JSON.stringify(esperado)) {
            ctx.falhas.push(`${descricao}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(atual)}`);
        }
    },
    async aguardar(condicao, ms = 15000) {
        const inicio = Date.now();
        while (Date.now() - inicio < ms) {
            try {
                if (await condicao()) return true;
            } catch (e) {
                // a tela ainda está carregando
            }
            await espera(150);
        }
        throw new Error("tempo esgotado esperando uma condição");
    },
    janela: (titulo) => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.getTitle() === titulo),
    js: (janela, codigo) => janela.webContents.executeJavaScript(codigo),
    modelo: (nome) => require(path.join(RAIZ, "src", "model", nome + ".js")),
    ultimoDialogo: () => ctx.dialogos[ctx.dialogos.length - 1],

    // Abre uma tela pela tela inicial e espera ela carregar
    async abrir(nome, titulo) {
        const inicio = ctx.janela("Bem vindo");
        await ctx.js(inicio, `api.openWindow(${JSON.stringify(nome)})`);
        let janela;
        await ctx.aguardar(() => (janela = ctx.janela(titulo)) && !janela.webContents.isLoading());
        await espera(900);
        return janela;
    },

    // Faz login (ou o primeiro acesso, se o banco não tiver usuários)
    async login(usuario = "teste", senha = "teste123", nome = "Usuário Teste") {
        let tela;
        await ctx.aguardar(() => (tela = BrowserWindow.getAllWindows().find((w) => /Login/.test(w.getTitle()))));
        await ctx.aguardar(() => ctx.js(tela, "!frmLogin.hidden || !frmPrimeiroAcesso.hidden"));
        if (await ctx.js(tela, "!frmPrimeiroAcesso.hidden")) {
            await ctx.js(tela, `inputAdminNome.value=${JSON.stringify(nome)}; inputAdminLogin.value=${JSON.stringify(usuario)};
                inputAdminSenha.value=${JSON.stringify(senha)}; inputAdminConfirma.value=${JSON.stringify(senha)}; frmPrimeiroAcesso.requestSubmit()`);
        } else {
            await ctx.js(tela, `inputLogin.value=${JSON.stringify(usuario)}; inputSenha.value=${JSON.stringify(senha)}; frmLogin.requestSubmit()`);
        }
        await ctx.aguardar(() => ctx.janela("Bem vindo") && !ctx.janela("Bem vindo").webContents.isLoading());
        await espera(1200);
    },

    async trocarUsuario(usuario, senha) {
        Menu.getApplicationMenu().items.find((i) => i.label === "Cadastro").submenu.items
            .find((i) => i.label === "Trocar usuário").click();
        await espera(1500);
        await ctx.login(usuario, senha);
    },
};

// ===== Diálogos automáticos =====
dialog.showMessageBox = async (...args) => {
    const opcoes = args.find((a) => a && typeof a === "object" && a.message) || {};
    ctx.dialogos.push(opcoes.message + (opcoes.detail ? ` | ${opcoes.detail}` : ""));
    return { response: ctx.respostas.length ? ctx.respostas.shift() : 0 };
};
dialog.showSaveDialog = async () => {
    const arquivo = path.join(os.tmpdir(), `grafica-e2e-${process.pid}-${ctx.pdfs.length}.pdf`);
    ctx.pdfs.push(arquivo);
    return { canceled: false, filePath: arquivo };
};
shell.openPath = async () => "";
shell.openExternal = async () => {};

// Erros nas telas fazem o cenário falhar
app.on("web-contents-created", (_, wc) => {
    wc.on("console-message", (evento) => {
        if (evento.level === "error") ctx.errosConsole.push(String(evento.message).slice(0, 200));
    });
    wc.on("preload-error", (e, p, erro) => ctx.errosConsole.push("preload: " + erro.message));
});

require(path.join(RAIZ, "main.js"));

app.whenReady().then(async () => {
    let erro = null;
    try {
        if (!cenario.semLogin) await ctx.login();
        await cenario.executar(ctx);
    } catch (e) {
        erro = e.stack || String(e);
    }
    ctx.pdfs.forEach((p) => fs.rmSync(p, { force: true }));
    const resultado = {
        ok: !erro && ctx.falhas.length === 0 && ctx.errosConsole.length === 0,
        verificacoes: ctx.verificacoes,
        falhas: ctx.falhas,
        errosConsole: ctx.errosConsole,
        erro,
    };
    console.log("[e2e] " + JSON.stringify(resultado));
    app.exit(0);
});

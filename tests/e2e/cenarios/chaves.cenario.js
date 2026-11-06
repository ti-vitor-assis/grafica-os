// Segundo computador chegando a um banco que já tem dados de outro:
// sem a chave, não entra; importando o arquivo de chave, passa a funcionar.
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const SENHA_ARQUIVO = "chave-da-grafica-1";

module.exports = {
    semLogin: true,

    // Roda antes de o app abrir: simula o banco criado por "outro computador"
    async prepararBanco() {
        const raiz = path.resolve(__dirname, "..", "..", "..");
        const cripto = require(path.join(raiz, "src/seguranca/cripto.js"));
        const arquivoChave = require(path.join(raiz, "src/seguranca/arquivoChave.js"));
        const Configuracao = require(path.join(raiz, "src/model/Configuracao.js"));
        const Usuario = require(path.join(raiz, "src/model/Usuario.js"));

        const chaves = cripto.gerarChaves();
        cripto.definirChaves(chaves);
        await Configuracao.create({ _id: "impressaoChaves", valor: cripto.impressaoChaves() });
        const admin = new Usuario({ nome: "Admin", login: "admin", perfil: "administrador" });
        await admin.definirSenha("admin1234");
        await admin.save();

        const arquivo = path.join(os.tmpdir(), `grafica-e2e-chave-${process.pid}.json`);
        fs.writeFileSync(arquivo, arquivoChave.criarArquivo(chaves, cripto.impressaoChaves(), SENHA_ARQUIVO));
        return { E2E_ARQUIVO_CHAVE: arquivo };
    },

    async executar(ctx) {
        const arquivoChave = require(path.join(process.env.APP_DIR, "src/seguranca/arquivoChave.js"));
        const conteudo = fs.readFileSync(process.env.E2E_ARQUIVO_CHAVE, "utf8");
        fs.rmSync(process.env.E2E_ARQUIVO_CHAVE, { force: true });

        let tela;
        await ctx.aguardar(() => (tela = ctx.janela("Gráfica OS · Login")));
        await ctx.aguardar(() => ctx.js(tela, "!btnConfigBanco.hidden"));
        ctx.ok((await ctx.js(tela, "subtitulo.textContent")).includes("chave de segurança"), "login avisa que falta a chave");
        ctx.ok(await ctx.js(tela, "frmLogin.hidden"), "formulário de login não aparece sem a chave");

        await ctx.js(tela, "btnConfigBanco.click()");
        let config;
        await ctx.aguardar(() => (config = ctx.janela("Configurar banco de dados")) && !config.webContents.isLoading());
        await ctx.aguardar(() => ctx.js(config, "!frmImportar.hidden"));
        ctx.ok(await ctx.js(config, "frmExportar.hidden"), "sem login, só dá para importar (não exportar)");

        // Senha errada e arquivo de outro banco
        await ctx.js(config, `api.importKey({ conteudo: ${JSON.stringify(conteudo)}, senha: 'errada123' })`);
        await ctx.aguardar(() => ctx.js(config, "resultadoChave.textContent !== ''"));
        ctx.igual(await ctx.js(config, "resultadoChave.textContent"), "Senha do arquivo de chave incorreta.", "senha errada recusada");

        const cripto = require(path.join(process.env.APP_DIR, "src/seguranca/cripto.js"));
        const outro = arquivoChave.criarArquivo(cripto.gerarChaves(), "x", "outra-senha-1");
        await ctx.js(config, `resultadoChave.textContent=''; api.importKey({ conteudo: ${JSON.stringify(outro)}, senha: 'outra-senha-1' })`);
        await ctx.aguardar(() => ctx.js(config, "resultadoChave.textContent !== ''"));
        ctx.igual(await ctx.js(config, "resultadoChave.textContent"), "Este arquivo de chave é de outro banco de dados.", "chave de outro banco recusada");

        // Arquivo certo
        await ctx.js(config, `resultadoChave.textContent=''; api.importKey({ conteudo: ${JSON.stringify(conteudo)}, senha: '${SENHA_ARQUIVO}' })`);
        await ctx.aguardar(() => ctx.js(config, "resultadoChave.textContent !== ''"));
        ctx.ok((await ctx.js(config, "resultadoChave.textContent")).startsWith("Chave importada"), "chave certa importada");
        config.close();

        await ctx.espera(1500);
        await ctx.login("admin", "admin1234");
        ctx.ok(!!ctx.janela("Bem vindo"), "depois de importar, o login funciona");

        // O administrador exporta a chave para o próximo computador
        await ctx.js(ctx.janela("Bem vindo"), "api.openDbConfig()");
        await ctx.aguardar(() => (config = ctx.janela("Configurar banco de dados")) && !config.webContents.isLoading());
        await ctx.aguardar(() => ctx.js(config, "!frmExportar.hidden"));
        await ctx.js(config, "inputSenhaExportar.value='nova-senha-9'; inputSenhaExportar2.value='nova-senha-9'; frmExportar.requestSubmit()");
        await ctx.aguardar(() => ctx.pdfs.length === 1 && fs.existsSync(ctx.pdfs[0]));
        const exportado = arquivoChave.lerArquivo(fs.readFileSync(ctx.pdfs[0], "utf8"), "nova-senha-9");
        ctx.igual(exportado.impressao, JSON.parse(conteudo).impressao, "arquivo exportado tem a mesma chave do banco");
        ctx.ok(!fs.readFileSync(ctx.pdfs[0], "utf8").includes(exportado.chaves.cifra), "arquivo exportado não tem a chave em texto puro");
    },
};

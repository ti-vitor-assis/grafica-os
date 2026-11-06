/**
 * Testes de ponta a ponta: abre o app de verdade para cada cenário de
 * tests/e2e/cenarios, contra um MongoDB temporário em memória.
 *
 *   npm run test:e2e              (todos)
 *   npm run test:e2e -- estoque   (só os cenários com "estoque" no nome)
 *
 * Uma janela do app aparece rapidamente durante cada cenário.
 */

const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { MongoMemoryServer } = require("mongodb-memory-server");
const electron = require("electron"); // fora do Electron, devolve o caminho do executável

const RAIZ = path.resolve(__dirname, "..", "..");
const PASTA_CENARIOS = path.join(__dirname, "cenarios");
const TEMPO_LIMITE = 180000;

async function rodarCenario(arquivo, uriBanco) {
    // Um cenário pode preparar o banco antes de o app abrir
    // (module.exports.prepararBanco) e pedir variáveis de ambiente (module.exports.env)
    const cenario = require(arquivo);
    let envPreparo = {};
    if (cenario.prepararBanco) {
        const mongoose = require("mongoose");
        await mongoose.connect(uriBanco);
        envPreparo = (await cenario.prepararBanco()) || {};
        await mongoose.disconnect();
    }
    return new Promise((resolve) => {
        const env = { ...process.env, ...(cenario.env || {}), ...envPreparo, APP_DIR: RAIZ, MONGO_URL: uriBanco, E2E_CENARIO: arquivo };
        // O VS Code e alguns terminais definem esta variável, que faria o
        // Electron rodar como Node puro
        delete env.ELECTRON_RUN_AS_NODE;

        const processo = spawn(electron, [path.join(__dirname, "app")], { env });
        let saida = "";
        processo.stdout.on("data", (d) => (saida += d));
        processo.stderr.on("data", (d) => (saida += d));
        const timer = setTimeout(() => processo.kill(), TEMPO_LIMITE);

        processo.on("close", () => {
            clearTimeout(timer);
            const linhas = saida.split(/\r?\n/);
            const linha = linhas.find((l) => l.startsWith("[e2e] "));
            const logs = linhas.filter((l) => l.startsWith("[cenario] "));
            if (!linha) return resolve({ ok: false, logs, erro: "o app não terminou o cenário:\n" + saida.slice(-1500) });
            resolve({ ...JSON.parse(linha.slice(6)), logs });
        });
    });
}

(async () => {
    const filtro = process.argv[2];
    const cenarios = fs.readdirSync(PASTA_CENARIOS)
        .filter((f) => f.endsWith(".cenario.js") && (!filtro || f.includes(filtro)))
        .sort();

    const servidor = await MongoMemoryServer.create();
    let falhou = false;

    for (const [i, nome] of cenarios.entries()) {
        const inicio = Date.now();
        const r = await rodarCenario(path.join(PASTA_CENARIOS, nome), servidor.getUri(`e2e_${i}`));
        const tempo = ((Date.now() - inicio) / 1000).toFixed(1);
        console.log(`${r.ok ? "✔" : "✖"} ${nome.replace(".cenario.js", "")} (${r.verificacoes || 0} verificações, ${tempo}s)`);
        // Mensagens de ctx.log(): sempre em caso de falha, ou com E2E_VERBOSE=1
        if (!r.ok || process.env.E2E_VERBOSE) (r.logs || []).forEach((l) => console.log("    " + l));
        if (!r.ok) {
            falhou = true;
            (r.falhas || []).forEach((f) => console.log("    falha:", f));
            (r.errosConsole || []).forEach((f) => console.log("    erro na tela:", f));
            if (r.erro) console.log("    erro:", r.erro);
        }
    }

    await servidor.stop();
    console.log(falhou ? "\nAlgum cenário falhou." : `\nTodos os ${cenarios.length} cenários passaram.`);
    process.exit(falhou ? 1 : 0);
})();

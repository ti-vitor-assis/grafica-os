/**
 * LGPD: dados do titular, anonimização e limpeza por prazo (rodam com: npm test)
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { iniciarBanco, limparBanco, pararBanco } = require("../apoio/banco.js");
const cripto = require("../../src/seguranca/cripto.js");
const { camposDocumento } = require("../../src/servicos/clientes.js");
const lgpd = require("../../src/servicos/lgpd.js");
const Cli = require("../../src/model/Clientes.js");
const OS = require("../../src/model/ServiceOrder.js");
const Quote = require("../../src/model/Quote.js");

const anosAtras = (n) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    return d;
};
const itens = () => [{ produto: new mongoose.Types.ObjectId(), descricao: "Banner", quantidade: 1, valorUnitario: 50 }];
const novoCliente = (nome, cpf, extras = {}) =>
    Cli.create({ nome, ...camposDocumento("PF", cpf), telefone: "11988887777", email: "a@b.com", endereco: "Rua A", cidade: "Osasco", estado: "SP", ...extras });

// OS com data de criação no passado (o prazo final só é validado em OS nova)
async function osAntiga(cliente, anos) {
    const os = await OS.create({ cliente: cliente._id, prazoFinal: new Date(Date.now() + 864e5), produtos: itens() });
    await OS.updateOne({ _id: os._id }, { $set: { dataCriacao: anosAtras(anos) } });
    return os;
}

before(async () => {
    cripto.definirChaves(cripto.gerarChaves());
    await iniciarBanco();
    await Promise.all([Cli.init(), OS.init(), Quote.init()]);
});
beforeEach(limparBanco);
after(pararBanco);

describe("Dados do titular", () => {
    it("lista os dados cadastrais (com o CPF completo), as OS e os orçamentos", async () => {
        const c = await novoCliente("Maria Souza", "52998224725");
        await OS.create({ cliente: c._id, prazoFinal: new Date(Date.now() + 864e5), produtos: itens() });
        await Quote.create({ cliente: c._id, validade: new Date(Date.now() + 864e5), produtos: itens() });
        const r = await lgpd.relatorioTitular(c._id);
        const texto = JSON.stringify(r);
        assert.ok(texto.includes("529.982.247-25"));
        assert.ok(texto.includes("a@b.com"));
        assert.equal(r.secoes[1].linhas.length, 1);
        assert.equal(r.secoes[2].linhas.length, 1);
        assert.equal(await lgpd.relatorioTitular(new mongoose.Types.ObjectId()), null);
    });
});

describe("Anonimização", () => {
    it("apaga os dados pessoais, mantém OS e cidade, e libera o CPF", async () => {
        const c = await novoCliente("Maria Souza", "52998224725");
        const os = await OS.create({ cliente: c._id, prazoFinal: new Date(Date.now() + 864e5), produtos: itens() });
        assert.equal(await lgpd.anonimizar(c._id), true);
        assert.equal(await lgpd.anonimizar(c._id), false, "não anonimiza duas vezes");

        const bruto = await Cli.collection.findOne({ _id: c._id });
        assert.equal(bruto.nome, lgpd.NOME_ANONIMO);
        for (const campo of ["documentoCifrado", "documentoBusca", "telefone", "email", "endereco"]) {
            assert.equal(bruto[campo], undefined, campo);
        }
        assert.equal(bruto.cidade, "Osasco");
        assert.equal(bruto.ativo, false);
        assert.ok(bruto.anonimizado && bruto.dataAnonimizacao);

        assert.equal(await OS.countDocuments({ _id: os._id }), 1, "OS continua");
        // O mesmo CPF pode voltar a ser cadastrado (o índice único foi liberado)
        await novoCliente("Maria de novo", "52998224725");
    });
});

describe("Limpeza por prazo", () => {
    it("anonimiza só clientes sem movimento no prazo e limpa a cópia das OS antigas", async () => {
        const antigo = await novoCliente("Antigo", "52998224725", { dataCadastro: anosAtras(7) });
        const ativo = await novoCliente("Ativo", "39053344705", { dataCadastro: anosAtras(7) });
        const recente = await novoCliente("Recente", "11144477735");
        const osVelha = await osAntiga(antigo, 6);
        await osAntiga(ativo, 6);
        await OS.create({ cliente: ativo._id, prazoFinal: new Date(Date.now() + 864e5), produtos: itens() });

        const previa = await lgpd.previaLimpeza();
        assert.deepEqual([previa.clientes, previa.ordens, previa.orcamentos], [1, 2, 0]);

        const feito = await lgpd.executarLimpeza();
        assert.deepEqual([feito.clientes, feito.ordens, feito.orcamentos], [1, 2, 0]);
        assert.equal((await Cli.findById(antigo._id)).anonimizado, true);
        assert.equal((await Cli.findById(ativo._id)).anonimizado, false, "teve OS recente");
        assert.equal((await Cli.findById(recente._id)).anonimizado, false, "cadastro recente");

        const copia = (await OS.collection.findOne({ _id: osVelha._id })).clienteCopia;
        assert.equal(copia.nome, lgpd.NOME_ANONIMO);
        assert.equal(copia.documentoBusca, undefined);
        assert.equal(copia.documentoCifrado, undefined);

        const denovo = await lgpd.previaLimpeza();
        assert.deepEqual([denovo.clientes, denovo.ordens, denovo.orcamentos], [0, 0, 0], "segunda limpeza não tem o que fazer");
    });
});

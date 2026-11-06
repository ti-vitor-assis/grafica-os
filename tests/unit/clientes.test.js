/**
 * Cliente PF/PJ: documento cifrado e o que vai para cada tela (rodam com: npm test)
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { iniciarBanco, pararBanco } = require("../apoio/banco.js");
const cripto = require("../../src/seguranca/cripto.js");
const servico = require("../../src/servicos/clientes.js");
const Cli = require("../../src/model/Clientes.js");

before(async () => {
    cripto.definirChaves(cripto.gerarChaves());
    await iniciarBanco();
    await Cli.init();
});
after(pararBanco);

const tela = (extras) => ({ nome: "Maria Souza", documento: "529.982.247-25", telefone: "11988887777", ...extras });

describe("Cliente: dados da tela", () => {
    it("PF: cifra o CPF e descarta campos de PJ", () => {
        const d = servico.dadosClienteDaTela(tela({ nomeFantasia: "x", inscricaoEstadual: "1", dataNascimento: "1990-05-10" }));
        assert.equal(d.tipoPessoa, "PF");
        assert.equal(d.nomeFantasia, "");
        assert.equal(d.inscricaoEstadual, "");
        assert.ok(d.documentoCifrado.startsWith("v1:"));
        assert.equal(d.documentoBusca, cripto.indiceBusca("52998224725"));
        assert.equal(d.dataNascimento.toISOString(), "1990-05-10T00:00:00.000Z");
        assert.ok(!JSON.stringify(d).includes("52998224725"));
    });

    it("PJ: exige CNPJ válido e não guarda nascimento", () => {
        assert.throws(() => servico.dadosClienteDaTela(tela({ tipoPessoa: "PJ", documento: "11222333000180" })), /CNPJ inválido/);
        assert.throws(() => servico.dadosClienteDaTela(tela({ documento: "11222333000181" })), /CPF inválido/);
        const d = servico.dadosClienteDaTela(tela({ tipoPessoa: "PJ", documento: "11.222.333/0001-81", nomeFantasia: "Pão", dataNascimento: "2000-01-01" }));
        assert.equal(d.nomeFantasia, "Pão");
        assert.equal(d.dataNascimento, null);
    });

    it("tipo desconhecido vira PF", () => {
        assert.equal(servico.dadosClienteDaTela(tela({ tipoPessoa: "XX" })).tipoPessoa, "PF");
    });
});

describe("Cliente: o que vai para a tela", () => {
    it("listas recebem só o documento mascarado; a ficha recebe o completo", async () => {
        const c = await Cli.create(servico.dadosClienteDaTela(tela()));
        const resumo = servico.clienteParaTela(c);
        assert.equal(resumo.documentoMascarado, "***.982.247-**");
        assert.equal(resumo.rotuloDocumento, "CPF");
        assert.equal(resumo.documento, undefined);
        assert.equal(resumo.telefone, undefined);
        assert.ok(!("documentoCifrado" in resumo) && !("documentoBusca" in resumo));

        const ficha = servico.clienteParaTela(c, { completo: true });
        assert.equal(ficha.documento, "529.982.247-25");
        assert.equal(ficha.telefone, "11988887777");
        assert.ok(!("documentoCifrado" in ficha) && !("documentoBusca" in ficha));
    });

    it("busca exata pelo índice e documento único", async () => {
        const achados = await Cli.find({ documentoBusca: cripto.indiceBusca(cripto.soDigitos("529.982.247-25")) });
        assert.equal(achados.length, 1);
        await assert.rejects(Cli.create(servico.dadosClienteDaTela(tela({ nome: "Outra" }))), (e) => e.code === 11000);
    });

    it("clientes sem documento (anonimizados) não colidem no índice único", async () => {
        await Cli.create({ nome: "Anônimo 1", anonimizado: true });
        await Cli.create({ nome: "Anônimo 2", anonimizado: true });
        assert.equal(await Cli.countDocuments({ anonimizado: true }), 2);
    });

    it("sem a chave, o documento some (não quebra a tela)", async () => {
        const c = await Cli.findOne({ documentoBusca: { $exists: true } });
        const chaves = cripto.gerarChaves();
        cripto.definirChaves(chaves); // chave errada
        assert.equal(servico.clienteParaTela(c).documentoMascarado, "");
    });
});

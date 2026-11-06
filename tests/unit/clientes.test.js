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

describe("Cópia do cliente na OS e no orçamento", () => {
    const OS = require("../../src/model/ServiceOrder.js");
    const Quote = require("../../src/model/Quote.js");
    const amanha = () => new Date(Date.now() + 864e5);
    const itens = () => [{ produto: new (require("mongoose").Types.ObjectId)(), quantidade: 1, valorUnitario: 10 }];

    it("grava nome e documento cifrado do cliente na época, e não muda depois", async () => {
        cripto.definirChaves(cripto.gerarChaves());
        const c = await Cli.create({ nome: "Gráfica Cliente", ...servico.camposDocumento("PF", "39053344705") });
        const os = await OS.create({ cliente: c._id, prazoFinal: amanha(), produtos: itens() });
        const q = await Quote.create({ cliente: c._id, validade: amanha(), produtos: itens() });
        for (const doc of [os, q]) {
            assert.equal(doc.clienteCopia.nome, "Gráfica Cliente");
            assert.equal(doc.clienteCopia.documentoBusca, cripto.indiceBusca("39053344705"));
            assert.equal(servico.documentoDe(doc.clienteCopia), "39053344705");
        }

        c.nome = "Nome Novo";
        await c.save();
        os.observacoes = "editada";
        await os.save();
        assert.equal((await OS.findById(os._id)).clienteCopia.nome, "Gráfica Cliente", "edição da OS não troca a cópia");

        // Cliente apagado: a OS continua achável pelo CPF
        await Cli.deleteOne({ _id: c._id });
        const achadas = await OS.find({ "clienteCopia.documentoBusca": cripto.indiceBusca("39053344705") });
        assert.equal(achadas.length, 1);
    });

    it("trocar o cliente da OS atualiza a cópia", async () => {
        const a = await Cli.create({ nome: "A", ...servico.camposDocumento("PJ", "11222333000181"), tipoPessoa: "PJ" });
        const b = await Cli.create({ nome: "B" });
        const os = await OS.create({ cliente: a._id, prazoFinal: amanha(), produtos: itens() });
        assert.equal(os.clienteCopia.tipoPessoa, "PJ");
        os.cliente = b._id;
        await os.save();
        assert.equal(os.clienteCopia.nome, "B");
        assert.equal(os.clienteCopia.documentoBusca, undefined);
    });
});

describe("Cliente inativo", () => {
    const OS = require("../../src/model/ServiceOrder.js");
    const Quote = require("../../src/model/Quote.js");
    const amanha = () => new Date(Date.now() + 864e5);
    const itens = () => [{ produto: new (require("mongoose").Types.ObjectId)(), quantidade: 1, valorUnitario: 10 }];

    it("não recebe OS nem orçamento novo, mas as antigas continuam editáveis", async () => {
        const c = await Cli.create({ nome: "Vai sair" });
        const os = await OS.create({ cliente: c._id, prazoFinal: amanha(), produtos: itens() });
        c.ativo = false;
        await c.save();

        await assert.rejects(OS.create({ cliente: c._id, prazoFinal: amanha(), produtos: itens() }), /Cliente inativo/);
        await assert.rejects(Quote.create({ cliente: c._id, validade: amanha(), produtos: itens() }), /Cliente inativo/);

        // A tela manda o id do cliente como texto ao salvar a OS: não conta como troca
        os.set({ cliente: String(c._id), observacoes: "ajuste" });
        await os.save();
        assert.equal((await OS.findById(os._id)).observacoes, "ajuste");
    });

    it("anonimizado também não recebe documento novo", async () => {
        const c = await Cli.create({ nome: "Cliente anonimizado", anonimizado: true });
        await assert.rejects(OS.create({ cliente: c._id, prazoFinal: amanha(), produtos: itens() }), /Cliente inativo/);
    });
});

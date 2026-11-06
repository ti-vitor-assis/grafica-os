/**
 * Regras de negócio dos modelos (rodam com: npm test)
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { iniciarBanco, limparBanco, pararBanco, dia } = require("../apoio/banco.js");

const OS = require("../../src/model/ServiceOrder.js");
const Quote = require("../../src/model/Quote.js");
const Usuario = require("../../src/model/Usuario.js");
const Insumo = require("../../src/model/Insumo.js");
const Produto = require("../../src/model/Products.js");

const id = () => new mongoose.Types.ObjectId();
const mensagens = (erro) => Object.values(erro.errors || {}).map((e) => e.message);

before(async () => {
    await iniciarBanco();
    await Promise.all([OS.init(), Quote.init(), Usuario.init()]);
});
beforeEach(limparBanco);
after(pararBanco);

describe("Ordem de Serviço", () => {
    const base = () => ({ cliente: id(), prazoFinal: dia(1), produtos: [{ produto: id(), quantidade: 3, valorUnitario: 0.1 }] });

    it("recalcula subtotais e total em centavos, ignorando o valor enviado", async () => {
        const os = await OS.create({ ...base(), valorTotal: 99999, produtos: [{ produto: id(), quantidade: 3, valorUnitario: 0.1 }, { produto: id(), quantidade: 2, valorUnitario: 10.15 }] });
        assert.deepEqual(os.produtos.map((i) => i.subtotal), [0.3, 20.3]);
        assert.equal(os.valorTotal, 20.6);
    });

    it("numera em sequência, sem repetir mesmo criando em paralelo", async () => {
        const criadas = await Promise.all(Array.from({ length: 10 }, () => OS.create(base())));
        assert.deepEqual(criadas.map((o) => o.numero).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("não consome número quando a OS é recusada pela validação", async () => {
        await OS.create(base());
        await assert.rejects(OS.create({ ...base(), produtos: [] }));
        assert.equal((await OS.create(base())).numero, 2);
    });

    it("recusa OS sem itens, com prazo no passado ou quantidade zero", async () => {
        await assert.rejects(OS.create({ ...base(), produtos: [] }), (e) => mensagens(e).includes("Adicione pelo menos 1 item"));
        await assert.rejects(OS.create({ ...base(), prazoFinal: dia(-2) }), (e) => mensagens(e).includes("O prazo de entrega não pode estar no passado"));
        await assert.rejects(OS.create({ ...base(), produtos: [{ produto: id(), quantidade: 0, valorUnitario: 1 }] }));
    });

    it("permite editar uma OS antiga com prazo vencido", async () => {
        const os = await OS.create(base());
        os.prazoFinal = dia(-30);
        await os.save();
    });

    it("calcula o valor pago, marca quitada e recusa pagar mais que o total", async () => {
        const os = await OS.create({ ...base(), produtos: [{ produto: id(), quantidade: 1, valorUnitario: 20.6 }] });
        os.pagamentos.push({ valor: 10, forma: "pix" });
        await os.save();
        assert.equal(os.valorPago, 10);
        assert.equal(os.pago, false);
        os.pagamentos.push({ valor: 10.6, forma: "dinheiro" });
        await os.save();
        assert.equal(os.pago, true);
        os.pagamentos.push({ valor: 1, forma: "pix" });
        await assert.rejects(os.save(), (e) => mensagens(e).includes("O total pago não pode ser maior que o valor da OS"));
    });

    it("preenche e limpa sozinho as datas de entrega e de aprovação da arte", async () => {
        const os = await OS.create(base());
        os.status = "entregue";
        os.arte.aprovada = true;
        await os.save();
        assert.ok(os.dataEntregaReal);
        assert.ok(os.arte.dataAprovacao);
        os.status = "em produção";
        os.arte.aprovada = false;
        await os.save();
        assert.equal(os.dataEntregaReal, undefined);
        assert.equal(os.arte.dataAprovacao, undefined);
    });
});

describe("Orçamento", () => {
    it("tem numeração própria e calcula o total", async () => {
        const q = await Quote.create({ cliente: id(), validade: dia(10), produtos: [{ produto: id(), quantidade: 2, valorUnitario: 10.05 }] });
        await OS.create({ cliente: id(), prazoFinal: dia(1), produtos: [{ produto: id(), quantidade: 1, valorUnitario: 1 }] });
        assert.equal(q.numero, 1);
        assert.equal(q.valorTotal, 20.1);
    });

    it("considera vencido só o pendente com validade passada", () => {
        assert.equal(Quote.estaVencido({ status: "pendente", validade: dia(0) }), false);
        assert.equal(Quote.estaVencido({ status: "pendente", validade: dia(-1) }), true);
        assert.equal(Quote.estaVencido({ status: "aprovado", validade: dia(-1) }), false);
    });
});

describe("Usuário", () => {
    it("guarda só o hash da senha e normaliza o login", async () => {
        const u = new Usuario({ nome: "Vitor", login: " Vitor.Assis ", perfil: "administrador" });
        await u.definirSenha("segredo123");
        await u.save();
        assert.equal(u.login, "vitor.assis");
        assert.ok(u.senhaHash.startsWith("$2"));
        assert.ok(!JSON.stringify(u).includes("segredo123"));
        assert.equal(await u.conferirSenha("segredo123"), true);
        assert.equal(await u.conferirSenha("errada"), false);
        assert.equal(u.publico().senhaHash, undefined);
    });

    it("recusa senha curta, login inválido e login repetido", async () => {
        const u = new Usuario({ nome: "A", login: "ana" });
        await assert.rejects(u.definirSenha("123"));
        const ruim = new Usuario({ nome: "B", login: "a b" });
        await ruim.definirSenha("abcdef12");
        await assert.rejects(ruim.save());
        await u.definirSenha("abcdef12");
        await u.save();
        const repetido = new Usuario({ nome: "C", login: "ANA" });
        await repetido.definirSenha("abcdef12");
        await assert.rejects(repetido.save(), (e) => e.code === 11000);
    });
});

describe("Estoque", () => {
    it("movimenta entrada, saída e ajuste e recusa saída maior que o estoque", async () => {
        const i = new Insumo({ nome: "Papel", unidade: "folha", estoqueMinimo: 500 });
        i.movimentar("entrada", 1000, "NF 1", "Vitor");
        i.movimentar("saída", 350.5, "OS 1", "Pedro");
        assert.equal(i.quantidade, 649.5);
        assert.throws(() => i.movimentar("saída", 5000), /Estoque insuficiente/);
        assert.throws(() => i.movimentar("entrada", 0), /maior que zero/);
        i.movimentar("ajuste", 600, "Contagem", "Vitor");
        assert.equal(i.quantidade, 600);
        assert.equal(i.movimentos.length, 3);
        await i.save();
    });
});

describe("Produto", () => {
    it("recusa valor negativo e unidade inválida", () => {
        const erro = new Produto({ nome: "X", categoria: "Y", valorUnitario: -1, unidade: "kg" }).validateSync();
        assert.deepEqual(Object.keys(erro.errors).sort(), ["unidade", "valorUnitario"]);
    });
});

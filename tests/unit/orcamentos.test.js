/**
 * Orçamento -> OS: modo da conversão e escolha de preços (rodam com: npm test)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const orc = require("../../src/servicos/orcamentos.js");
const { moeda } = require("../../src/print/formatar.js");

const itens = [
    { produto: "a", descricao: "Cartão", quantidade: 2, valorUnitario: 90 },
    { produto: "b", descricao: "Banner", quantidade: 1, valorUnitario: 45 },
    { produto: "c", descricao: "Adesivo", quantidade: 3, valorUnitario: 10 },
];

describe("Conversão de orçamento", () => {
    it("escolhe o modo pela situação", () => {
        assert.equal(orc.modoConversao({ status: "pendente" }, false), "aprovar");
        assert.equal(orc.modoConversao({ status: "pendente" }, true), "aprovar-vencido");
        assert.equal(orc.modoConversao({ status: "recusado" }, true), "reabrir");
        assert.equal(orc.modoConversao({ status: "aprovado" }, false), "repetir");
        assert.equal(orc.perguntaPrecos("aprovar"), false, "orçamento válido garante o preço");
        assert.ok(["aprovar-vencido", "reabrir", "repetir"].every(orc.perguntaPrecos));
    });

    it("compara os preços: mudou, igual e produto inativo/excluído", () => {
        const c = orc.compararPrecos(itens, [
            { _id: "a", valorUnitario: 95, ativo: true },
            { _id: "b", valorUnitario: 45, ativo: true },
            // "c" foi excluído
        ]);
        assert.deepEqual(c.linhas.map((l) => l.situacao), ["mudou", "igual", "inativo"]);
        assert.equal(c.mudou, true);
        assert.equal(c.inativos, 1);
        assert.equal(c.totalOrcamento, 255);
        assert.equal(c.totalAtual, 265, "inativo mantém o preço do orçamento");

        assert.deepEqual(orc.itensDaOS(c, false).map((i) => i.valorUnitario), [90, 45, 10]);
        assert.deepEqual(orc.itensDaOS(c, true).map((i) => i.valorUnitario), [95, 45, 10]);

        const texto = orc.resumoPrecos(c, moeda).replace(/\u00a0/g, " ");
        assert.ok(texto.includes("Cartão: R$ 90,00 → R$ 95,00"));
        assert.ok(texto.includes("Adesivo: produto inativo, mantém R$ 10,00"));
        assert.ok(!texto.includes("Banner"), "item sem mudança não aparece");
    });

    it("produto desativado também mantém o preço; centavos não contam como mudança", () => {
        const c = orc.compararPrecos([{ produto: "a", descricao: "x", quantidade: 1, valorUnitario: 0.1 + 0.2 }], [{ _id: "a", valorUnitario: 0.3, ativo: true }]);
        assert.equal(c.mudou, false);
        const d = orc.compararPrecos(itens.slice(0, 1), [{ _id: "a", valorUnitario: 99, ativo: false }]);
        assert.equal(d.linhas[0].situacao, "inativo");
        assert.equal(d.mudou, false);
    });
});

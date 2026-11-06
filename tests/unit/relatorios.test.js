/**
 * Números dos relatórios conferidos com dados de exemplo (rodam com: npm test)
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { iniciarBanco, pararBanco } = require("../apoio/banco.js");
const { popular } = require("../apoio/dados.js");
const relatorios = require("../../src/reports/relatorios.js");
const { htmlRelatorio } = require("../../src/print/reportTemplate.js");

// Últimos 30 dias, do começo do primeiro dia ao fim de hoje
const inicio = new Date();
inicio.setDate(inicio.getDate() - 30);
inicio.setHours(0, 0, 0, 0);
const fim = new Date();
fim.setHours(23, 59, 59, 999);

// A moeda vem com espaço não separável entre "R$" e o número: troca por espaço comum
const resumo = (rel) => Object.fromEntries(rel.resumo.map(([k, v]) => [k, v.replace(/\u00a0/g, " ")]));

before(async () => {
    await iniciarBanco();
    await popular();
});
after(pararBanco);

describe("Relatórios", () => {
    it("OS em andamento: atrasadas, total e a receber", async () => {
        const r = resumo(await relatorios.osEmAndamento());
        assert.equal(r["OS em andamento"], "3");
        assert.equal(r["Atrasadas"], "1");
        assert.equal(r["A receber"], "R$ 1.390,00");
    });

    it("OS entregues no período e % no prazo", async () => {
        const rel = await relatorios.osEntregues(inicio, fim);
        assert.equal(resumo(rel)["OS entregues"], "3");
        assert.equal(resumo(rel)["Entregues no prazo"], "33%");
    });

    it("Todas as OS do período, sem contar canceladas no valor", async () => {
        const r = resumo(await relatorios.todasOS(inicio, fim));
        assert.equal(r["OS no período"], "7");
        assert.equal(r["Valor (sem canceladas)"], "R$ 2.740,00");
    });

    it("Contas a receber e recebimentos", async () => {
        assert.equal(resumo(await relatorios.contasAReceber())["Total a receber"], "R$ 1.590,00");
        const rec = await relatorios.recebimentos(inicio, fim);
        assert.equal(resumo(rec)["Total recebido"], "R$ 1.150,00");
        assert.equal(resumo(rec)["Lançamentos"], "5");
    });

    it("Produtos mais vendidos, do maior para o menor valor", async () => {
        const rel = await relatorios.produtosMaisVendidos(inicio, fim);
        assert.deepEqual(rel.secoes[0].linhas.map((l) => l[1]), ["Panfleto A5", "Banner lona", "Cartão de visita"]);
    });

    it("gera HTML com o texto escapado", async () => {
        const rel = await relatorios.clientes();
        rel.secoes[0].linhas.push(["<script>alert(1)</script>", "", "", "", "", "0"]);
        const html = htmlRelatorio(rel);
        assert.ok(!html.includes("<script>alert(1)</script>"));
        assert.ok(html.includes("&lt;script&gt;"));
    });
});

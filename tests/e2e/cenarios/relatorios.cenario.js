// Painel inicial e relatórios em PDF com dados de exemplo
const path = require("node:path");
const fs = require("node:fs");

module.exports = {
    async executar(ctx) {
        await require(path.join(process.env.APP_DIR, "tests", "apoio", "dados.js")).popular();

        const inicio = ctx.janela("Bem vindo");
        await ctx.js(inicio, "carregarDashboard()");
        await ctx.aguardar(() => ctx.js(inicio, "totalAndamento.textContent === '3'"));
        ctx.igual(await ctx.js(inicio, "totalAtrasadas.textContent"), "1", "painel mostra as atrasadas");
        ctx.igual(await ctx.js(inicio, "kpiReceber.textContent.replace(/\\s/g, ' ')"), "R$ 1.590,00", "painel mostra o valor a receber");

        const w = await ctx.abrir("relatorios", "Relatórios");
        for (const tipo of ["andamento", "entregues", "faturamento", "recebimentos", "receber"]) {
            await ctx.js(w, `document.querySelector('input[value="${tipo}"]').click(); frmRelatorio.requestSubmit()`);
            const antes = ctx.pdfs.length;
            await ctx.aguardar(() => ctx.pdfs.length === antes + 1 || ctx.pdfs.length > antes);
            await ctx.aguardar(() => fs.existsSync(ctx.pdfs[ctx.pdfs.length - 1]) && fs.statSync(ctx.pdfs[ctx.pdfs.length - 1]).size > 1000);
            ctx.ok(true, `relatório ${tipo} gerado`);
        }
        ctx.ok(!ctx.dialogos.some((d) => d.includes("Não foi possível")), "nenhum relatório deu erro");
    },
};

// Estoque: cadastrar insumo com estoque inicial, entrada, saída recusada e ajuste
module.exports = {
    async executar(ctx) {
        const Insumo = ctx.modelo("Insumo");
        const w = await ctx.abrir("estoque", "Estoque de insumos");
        const js = (c) => ctx.js(w, c);

        ctx.ok(await js("!movVazio.hidden && movConteudo.hidden"), "sem insumo selecionado, o cartão explica o que fazer");

        await js(`inputNome.value='Lona 440g'; inputUnidade.value='m²'; inputMinimo.value='20'; inputInicial.value='5'; frmSupply.requestSubmit()`);
        await ctx.aguardar(async () => (await Insumo.countDocuments()) === 1);
        await ctx.espera(1500);
        await ctx.aguardar(() => js("listaResultados.children.length === 1"));
        ctx.ok((await js("listaResultados.innerText")).includes("Estoque baixo"), "insumo abaixo do mínimo tem etiqueta");

        await js("listaResultados.children[0].click()");
        ctx.ok(await js("campoInicial.hidden"), "estoque inicial some depois de cadastrado");
        ctx.igual(await js("btnRegistrar.innerText.trim()"), "Registrar entrada", "botão segue o tipo escolhido");

        await js(`inputQtdMov.value='30'; inputMotivo.value='NF 777'; frmMovimento.requestSubmit()`);
        await ctx.aguardar(() => js("estoqueAtual.textContent.startsWith('35')"));
        ctx.ok(true, "entrada soma ao estoque");

        await js(`document.querySelector('input[value="saída"]').click(); inputQtdMov.value='999'; frmMovimento.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("Estoque insuficiente")));
        ctx.ok(true, "saída maior que o estoque é recusada");

        await js(`document.querySelector('input[value="ajuste"]').click(); inputQtdMov.value='12'; inputMotivo.value='Contagem'; frmMovimento.requestSubmit()`);
        await ctx.aguardar(async () => (await Insumo.findOne()).quantidade === 12);
        ctx.igual((await Insumo.findOne()).movimentos.length, 3, "histórico com 3 movimentações");
    },
};

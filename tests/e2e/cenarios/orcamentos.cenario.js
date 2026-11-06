// Orçamentos: criar, abrir, aprovar gerando OS e regras de orçamento vencido
module.exports = {
    async executar(ctx) {
        const Cli = ctx.modelo("Clientes");
        const Prod = ctx.modelo("Products");
        const Q = ctx.modelo("Quote");
        const OS = ctx.modelo("ServiceOrder");
        const cliente = await Cli.create({ nome: "Escola Futuro", cpf: "39053344705" });
        const produto = await Prod.create({ nome: "Panfleto A5", categoria: "Impressos", unidade: "milheiro", valorUnitario: 180 });

        const w = await ctx.abrir("orcamentos", "Orçamentos");
        const js = (c) => ctx.js(w, c);

        await js(`searchClientsInput.value='escola'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdClient.value !== ''"));
        await js(`selectProduto.selectedIndex = 1; selectProduto.dispatchEvent(new Event('change')); inputQtd.value='5'; btnAddItem.click();
            inputPrazoProducao.value='4'; inputObs.value='50% na aprovação'; frmQuote.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("Orçamento nº 1 criado")));
        ctx.igual((await Q.findOne({ numero: 1 })).valorTotal, 900, "orçamento gravado com o total");
        await ctx.espera(1500);

        await js(`searchQuoteInput.value='1'; frmSearchQuote.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdQuote.value !== ''"));
        ctx.igual(await js("etiquetaStatus.textContent"), "pendente", "situação pendente");

        ctx.respostas.push(1, 0); // aprovar e gerar OS, depois OK
        await js("btnConvert.click()");
        await ctx.aguardar(async () => (await OS.countDocuments()) === 1);
        const os = await OS.findOne();
        ctx.igual([os.valorTotal, os.status], [900, "aberta"], "OS gerada com os itens do orçamento");
        ctx.ok(os.observacoes.includes("orçamento nº 1"), "OS registra o orçamento de origem");
        ctx.igual((await Q.findOne({ numero: 1 })).status, "aprovado", "orçamento fica aprovado");
        await ctx.espera(1500);

        // Orçamento vencido: avisa sobre os preços antes de aprovar
        await Q.create({ cliente: cliente._id, validade: new Date(Date.now() - 3 * 864e5),
            produtos: [{ produto: produto._id, descricao: "Panfleto A5", quantidade: 1, valorUnitario: 180 }] });
        await js(`searchQuoteInput.value='2'; frmSearchQuote.requestSubmit()`);
        await ctx.aguardar(() => js("etiquetaStatus.textContent === 'vencido'"));
        ctx.ok(true, "orçamento com validade passada aparece como vencido");
        ctx.respostas.push(0); // cancelar
        await js("btnConvert.click()");
        await ctx.aguardar(() => ctx.ultimoDialogo().includes("validade venceu"));
        ctx.ok(true, "aprovar orçamento vencido avisa para conferir os preços");
    },
};

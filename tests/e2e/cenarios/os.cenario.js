// Ordem de serviço: itens, pagamentos, prazo, abrir pelo número, entregar, imprimir e excluir
module.exports = {
    async executar(ctx) {
        const Cli = ctx.modelo("Clientes");
        const Prod = ctx.modelo("Products");
        const OS = ctx.modelo("ServiceOrder");
        await Cli.create({ nome: "Maria Souza", cpf: "52998224725" });
        await Prod.create({ nome: "Banner lona", categoria: "CV", unidade: "m²", valorUnitario: 45 });
        await Prod.create({ nome: "Cartão de visita", categoria: "Impressos", unidade: "milheiro", valorUnitario: 89.9 });

        const w = await ctx.abrir("os", "Ordem de Serviço");
        const js = (c) => ctx.js(w, c);
        const amanha = new Date(Date.now() + 864e5);
        const ymd = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, "0")}-${String(amanha.getDate()).padStart(2, "0")}`;

        await js(`searchClientsInput.value='maria'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdClient.value !== ''"));

        await js(`inputPrazo.value='${ymd}'; frmOS.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("pelo menos 1 item")));
        ctx.ok(true, "OS sem itens é recusada na tela");

        await js(`selectProduto.selectedIndex = 1; selectProduto.dispatchEvent(new Event('change'))`);
        ctx.igual(await js("inputValorUn.value"), "45", "valor de tabela sugerido");
        await js(`inputQtd.value='3'; btnAddItem.click();
            selectProduto.selectedIndex = 2; selectProduto.dispatchEvent(new Event('change')); inputQtd.value='2'; inputValorUn.value='40'; btnAddItem.click()`);
        ctx.igual(await js("valorTotal.textContent.replace(/\\s/g, ' ')"), "R$ 215,00", "total calculado na tela");

        await js(`inputValorPagamento.value='300'; inputFormaPagamento.value='pix'; btnAddPagamento.click()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("passa do saldo")));
        ctx.ok(true, "pagamento maior que o saldo é recusado");
        await js(`inputValorPagamento.value='100'; btnAddPagamento.click(); inputPrazo.value='${ymd}'; frmOS.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("criada com sucesso")));
        const criada = await OS.findOne({ numero: 1 });
        ctx.igual([criada.valorTotal, criada.valorPago, criada.pago], [215, 100, false], "OS gravada com total e pagamento");
        ctx.igual(new Date(criada.prazoFinal).getHours(), 12, "prazo gravado ao meio-dia (não muda de dia)");
        await ctx.espera(1500);

        // Tentativa de NoSQL injection pela tela: pedir as OS de "qualquer cliente"
        await js(`api.searchOrder({ clienteId: { "$ne": null } })`);
        await ctx.espera(1500);
        ctx.igual(await js("listaResultados.children.length"), 0, "injeção { $ne: null } não devolve as OS de todos");

        await js(`searchOrderInput.value='1'; frmSearchOrder.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdOS.value !== ''"));
        ctx.igual(await js("tabelaItens.rows.length"), 2, "OS aberta pelo número com os itens");
        await js(`inputStatus.value='entregue'; inputArteAprovada.checked=true; frmOS.requestSubmit()`);
        await ctx.aguardar(async () => (await OS.findOne({ numero: 1 })).status === "entregue");
        const entregue = await OS.findOne({ numero: 1 });
        ctx.ok(entregue.dataEntregaReal && entregue.arte.dataAprovacao, "datas de entrega e aprovação preenchidas");
        await ctx.espera(1500);

        await js(`searchOrderInput.value='1'; frmSearchOrder.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdOS.value !== ''"));
        await js("btnPrint.click()");
        await ctx.aguardar(() => ctx.pdfs.length === 1 && require("fs").existsSync(ctx.pdfs[0]));
        ctx.ok(true, "PDF da OS gerado");

        ctx.respostas.push(1);
        await js("btnDelete.click()");
        await ctx.aguardar(async () => (await OS.countDocuments()) === 0);
        ctx.ok(true, "OS excluída após confirmação");
    },
};

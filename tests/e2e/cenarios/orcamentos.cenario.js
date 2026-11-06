// Orçamentos: criar, aprovar gerando OS, pedido repetido com preço novo,
// vencido, recusado que volta, abrir a OS gerada e duplicar
module.exports = {
    async executar(ctx) {
        const Prod = ctx.modelo("Products");
        const Q = ctx.modelo("Quote");
        const OS = ctx.modelo("ServiceOrder");
        const cliente = await ctx.criarCliente("Escola Futuro", "39053344705");
        const produto = await Prod.create({ nome: "Panfleto A5", categoria: "Impressos", unidade: "milheiro", valorUnitario: 180 });

        const w = await ctx.abrir("orcamentos", "Orçamentos");
        const js = (c) => ctx.js(w, c);
        const abrirOrcamento = async (n) => {
            await ctx.espera(1500);
            await js(`searchQuoteInput.value='${n}'; frmSearchQuote.requestSubmit()`);
            await ctx.aguardar(() => js(`numeroQuote.textContent === 'nº ${n}'`));
        };
        const converter = async (respostas, totalOS) => {
            ctx.respostas.push(...respostas);
            await js("btnConvert.click()");
            await ctx.aguardar(async () => (await OS.countDocuments()) === totalOS);
            return OS.findOne({ numero: totalOS });
        };

        // ---- Criar e aprovar (preço garantido: não pergunta preço)
        await js(`searchClientsInput.value='escola'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdClient.value !== ''"));
        await js(`selectProduto.selectedIndex = 1; selectProduto.dispatchEvent(new Event('change')); inputQtd.value='5'; btnAddItem.click();
            inputPrazoProducao.value='4'; inputObs.value='50% na aprovação'; frmQuote.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("Orçamento nº 1 criado")));
        ctx.igual((await Q.findOne({ numero: 1 })).valorTotal, 900, "orçamento gravado com o total");

        await abrirOrcamento(1);
        ctx.igual(await js("etiquetaStatus.textContent"), "pendente", "situação pendente");
        const os1 = await converter([1, 0], 1);
        ctx.igual([os1.valorTotal, os1.status], [900, "aberta"], "OS gerada com os itens do orçamento");
        ctx.ok(os1.observacoes.includes("orçamento nº 1"), "OS registra o orçamento de origem");
        const q1 = await Q.findOne({ numero: 1 });
        ctx.ok(q1.status === "aprovado" && q1.osGeradas.length === 1 && String(os1.orcamentoOrigem) === String(q1._id), "orçamento aprovado e ligado à OS");

        // ---- OS gerada aparece no orçamento e abre a tela da OS
        await abrirOrcamento(1);
        ctx.igual(await js("rotuloConvert.textContent"), "Gerar nova OS (pedido repetido)", "aprovado oferece pedido repetido");
        ctx.igual(await js("osGeradas.innerText.trim()"), "OS nº 1 · aberta", "lista a OS gerada");
        await js("osGeradas.querySelector('button').click()");
        let telaOS;
        await ctx.aguardar(() => (telaOS = ctx.janela("Ordem de Serviço")) && ctx.js(telaOS, "inputIdOS.value !== ''"));
        ctx.igual(await ctx.js(telaOS, "numeroOS.textContent"), "nº 1", "clicar na OS abre a OS certa");
        telaOS.close();

        // ---- Pedido repetido com preço novo: usa o preço de hoje
        await Prod.updateOne({ _id: produto._id }, { valorUnitario: 200 });
        const antes = ctx.dialogos.length;
        const os2 = await converter([2, 0], 2);
        const pergunta = ctx.dialogos.slice(antes).join("\n").replace(/ /g, " ");
        ctx.ok(pergunta.includes("R$ 180,00 → R$ 200,00") && pergunta.includes("pedido repetido"), "mostra a diferença de preço");
        ctx.igual(os2.valorTotal, 1000, "nova OS com os preços de hoje");
        ctx.ok(os2.observacoes.includes("Pedido repetido") && os2.observacoes.includes("preços atualizados"), "OS diz que é pedido repetido");
        ctx.igual((await Q.findOne({ numero: 1 })).osGeradas.length, 2, "orçamento guarda as duas OS");

        // ---- Orçamento vencido: mantém o preço do orçamento
        await Q.create({ cliente: cliente._id, validade: new Date(Date.now() - 30 * 864e5),
            produtos: [{ produto: produto._id, descricao: "Panfleto A5", quantidade: 1, valorUnitario: 180 }] });
        await abrirOrcamento(2);
        ctx.igual(await js("etiquetaStatus.textContent"), "vencido", "orçamento com validade passada aparece como vencido");
        const os3 = await converter([1, 0], 3);
        ctx.ok(ctx.dialogos.some((d) => d.includes("validade venceu")), "avisa que a validade venceu");
        ctx.igual(os3.valorTotal, 180, "vencido aprovado mantendo o preço do orçamento");

        // ---- Recusado que volta: reabre e gera a OS
        await Q.create({ cliente: cliente._id, status: "recusado", validade: new Date(Date.now() - 60 * 864e5),
            produtos: [{ produto: produto._id, descricao: "Panfleto A5", quantidade: 2, valorUnitario: 180 }] });
        await abrirOrcamento(3);
        ctx.igual(await js("rotuloConvert.textContent"), "Cliente aceitou: gerar OS", "recusado oferece gerar a OS");
        const os4 = await converter([2, 0], 4);
        ctx.igual(os4.valorTotal, 400, "recusado vira OS com o preço de hoje");
        ctx.igual((await Q.findOne({ numero: 3 })).status, "aprovado", "recusado reaberto como aprovado");

        // ---- Duplicar: novo orçamento com os preços de hoje
        await abrirOrcamento(2);
        await js("btnDuplicate.click()");
        ctx.igual(await js("numeroQuote.textContent"), "(novo)", "cópia ainda não salva");
        ctx.ok((await js("textoSituacao.textContent")).includes("1 preço(s) atualizado(s)"), "avisa os preços atualizados");
        await js("frmQuote.requestSubmit()");
        await ctx.aguardar(async () => (await Q.countDocuments()) === 4);
        const copia = await Q.findOne({ numero: 4 });
        ctx.ok(copia.status === "pendente" && copia.valorTotal === 200 && String(copia.cliente) === String(cliente._id), "orçamento duplicado com cliente e preço de hoje");

        const acoes = (await ctx.modelo("Auditoria").find({ referencia: "orçamento 1" }).lean()).map((a) => a.acao);
        ctx.ok(acoes.includes("pedido repetido de orçamento"), "auditoria registra o pedido repetido");
    },
};

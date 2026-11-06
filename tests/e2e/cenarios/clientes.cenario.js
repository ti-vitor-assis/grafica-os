// Cadastro PF/PJ, CPF/CNPJ cifrado no banco, busca exata pelo documento,
// edição, documento duplicado e exclusão de clientes
module.exports = {
    async executar(ctx) {
        const Cli = ctx.modelo("Clientes");
        const w = await ctx.abrir("clientes", "Clientes");
        const js = (c) => ctx.js(w, c);
        const botoesVisiveis = () => js(`[...document.querySelectorAll('.card-acoes .btn')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.innerText.trim())`);
        const buscar = async (termo) => {
            await js(`inputIdClient.value=''; searchClientsInput.value=${JSON.stringify(termo)}; frmSearchClient.requestSubmit()`);
            await ctx.aguardar(() => js("inputIdClient.value !== ''"));
        };

        ctx.igual(await botoesVisiveis(), ["Novo cliente", "Cadastrar cliente"], "modo novo mostra só Novo e Cadastrar");
        ctx.ok(await js("[...document.querySelectorAll('.so-pj')].every(e => e.hidden)"), "PF não mostra nome fantasia nem IE");

        await js(`inputDocumento.value='123'; inputDocumento.dispatchEvent(new Event('blur'))`);
        ctx.ok((await js("inputDocumento.className")).includes("invalido"), "CPF inválido fica marcado");

        // ---- Pessoa física (sem e-mail e sem endereço: não são obrigatórios)
        await js(`inputNome.value='Maria Souza'; inputDocumento.value='52998224725'; inputDocumento.dispatchEvent(new Event('blur'));
            inputDataNasc.value='1990-05-10'; inputTelefone.value='11988887777'; frmCli.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("Cliente adicionado")));
        ctx.igual(await Cli.countDocuments(), 1, "cliente gravado");

        const bruto = await Cli.collection.findOne({});
        ctx.ok(!JSON.stringify(bruto).includes("52998224725") && !JSON.stringify(bruto).includes("529.982"), "CPF não fica em texto puro no banco");
        ctx.ok(bruto.documentoCifrado.startsWith("v1:") && bruto.documentoBusca && bruto.cpf === undefined && bruto.sexo === undefined, "banco tem só o CPF cifrado e o índice de busca");
        await ctx.espera(1500);

        await buscar("529.982.247-25");
        ctx.igual(await js("inputNome.value"), "Maria Souza", "busca exata por CPF com pontuação");
        ctx.igual(await js("inputDocumento.value"), "529.982.247-25", "a ficha mostra o CPF completo");
        ctx.igual(await js("inputDataNasc.value"), "1990-05-10", "data de nascimento não volta um dia");
        ctx.ok((await js("listaResultados.innerText")).includes("CPF ***.982.247-**"), "a lista mostra o CPF mascarado");
        ctx.igual(await botoesVisiveis(), ["Excluir", "Anonimizar", "Dados do cliente", "Novo cliente", "Salvar alterações"], "modo edição mostra Excluir, LGPD e Salvar");

        await js(`inputTelefone2.value='(11) 3000-0000'; frmCli.requestSubmit()`);
        await ctx.aguardar(async () => (await Cli.findOne()).telefone2 === "(11) 3000-0000");
        ctx.ok(true, "edição gravada");
        await ctx.espera(1500);

        // Parte do CPF não acha (busca exata): responde que não encontrou
        let antes = ctx.dialogos.length;
        await js(`searchClientsInput.value='529.982'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.length > antes);
        ctx.ok(ctx.ultimoDialogo().includes("Cliente não cadastrado"), "busca por pedaço do CPF não lista clientes");
        await ctx.espera(1500);

        antes = ctx.dialogos.length;
        await js(`searchClientsInput.value='(maria+'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.length > antes);
        ctx.ok(ctx.ultimoDialogo().includes("Cliente não cadastrado"), "busca com '(' e '+' não quebra (responde que não achou)");
        await ctx.espera(1500);

        await js(`inputIdClient.value=''; inputNome.value='Outra'; inputDocumento.value='529.982.247-25';
            inputTelefone.value='1'; frmCli.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("CPF/CNPJ já cadastrado")));
        ctx.igual(await Cli.countDocuments(), 1, "CPF duplicado é recusado");
        await ctx.espera(1500);

        // ---- Pessoa jurídica
        await js("location.reload()");
        await ctx.aguardar(() => !w.webContents.isLoading() && js("typeof aplicarTipoPessoa === 'function'"));
        await js(`document.querySelector('input[name=tipoPessoa][value=PJ]').click()`);
        ctx.igual(await js("rotuloDocumento.textContent"), "CNPJ", "PJ troca o rótulo para CNPJ");
        ctx.ok(await js("[...document.querySelectorAll('.so-pj')].every(e => !e.hidden)"), "PJ mostra nome fantasia e IE");

        await js(`inputNome.value='Padaria Pão Quente Ltda'; inputNomeFantasia.value='Pão Quente'; inputDocumento.value='11222333000180';
            inputTelefone.value='1133334444'; frmCli.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("CNPJ inválido")));
        ctx.igual(await Cli.countDocuments(), 1, "CNPJ inválido é recusado pelo main");
        await ctx.espera(1500);

        await js(`inputDocumento.value='11.222.333/0001-81'; frmCli.requestSubmit()`);
        await ctx.aguardar(async () => (await Cli.countDocuments()) === 2);
        const pj = await Cli.findOne({ tipoPessoa: "PJ" });
        ctx.igual(pj.nomeFantasia, "Pão Quente", "PJ gravada com nome fantasia");
        await ctx.espera(1500);

        await buscar("11222333000181");
        ctx.igual(await js("inputNome.value"), "Padaria Pão Quente Ltda", "busca exata por CNPJ sem pontuação");
        ctx.ok(await js("document.querySelector('input[name=tipoPessoa][value=PJ]').checked"), "ficha abre como PJ");

        await buscar("pão quente");
        ctx.igual(await js("inputNome.value"), "Padaria Pão Quente Ltda", "busca pelo nome fantasia");

        // ---- Exclusão: só sem histórico; com OS, o cliente é desativado
        await ctx.modelo("ServiceOrder").create({
            cliente: pj._id, prazoFinal: new Date(Date.now() + 864e5),
            produtos: [{ produto: pj._id, descricao: "Banner", quantidade: 1, valorUnitario: 50 }],
        });
        await buscar("Padaria");
        ctx.respostas.push(1);
        await js("btnDelete.click()");
        await ctx.aguardar(async () => (await Cli.findById(pj._id)).ativo === false);
        ctx.ok(ctx.ultimoDialogo().includes("1 OS") && ctx.ultimoDialogo().includes("não pode ser excluído"), "cliente com OS não é excluído: é desativado");
        ctx.igual(await Cli.countDocuments(), 2, "cliente com histórico continua no banco");
        await ctx.espera(1500);

        // ---- LGPD: PDF com os dados do titular e anonimização
        await buscar("Padaria");
        await js("btnDadosCliente.click()");
        await ctx.aguardar(() => ctx.pdfs.length === 1 && require("fs").existsSync(ctx.pdfs[0]));
        ctx.ok(true, "PDF com os dados do cliente gerado");

        ctx.respostas.push(1);
        await js("btnAnonimizar.click()");
        await ctx.aguardar(async () => (await Cli.findById(pj._id)).anonimizado === true);
        const anon = await Cli.collection.findOne({ _id: pj._id });
        ctx.ok(anon.nome === "Cliente anonimizado" && !anon.documentoBusca && !anon.telefone && !anon.nomeFantasia, "anonimizar apaga nome, CNPJ e contatos");
        ctx.igual(await ctx.modelo("ServiceOrder").countDocuments({ cliente: pj._id }), 1, "a OS do cliente anonimizado continua");
        await ctx.espera(1500);

        await buscar("Maria");
        ctx.respostas.push(1);
        await js("btnDelete.click()");
        await ctx.aguardar(async () => (await Cli.countDocuments()) === 1);
        ctx.ok(true, "cliente sem histórico é excluído após confirmação");
    },
};

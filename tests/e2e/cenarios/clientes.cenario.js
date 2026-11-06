// Cadastro, busca, edição, CPF duplicado e exclusão de clientes
module.exports = {
    async executar(ctx) {
        const Cli = ctx.modelo("Clientes");
        const w = await ctx.abrir("clientes", "Clientes");
        const js = (c) => ctx.js(w, c);
        const botoesVisiveis = () => js(`[...document.querySelectorAll('.card-acoes .btn')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.innerText.trim())`);

        ctx.igual(await botoesVisiveis(), ["Novo cliente", "Cadastrar cliente"], "modo novo mostra só Novo e Cadastrar");

        await js(`inputCPF.value='123'; inputCPF.dispatchEvent(new Event('blur'))`);
        ctx.ok((await js("inputCPF.className")).includes("invalido"), "CPF inválido fica marcado");

        await js(`inputNome.value='Maria Souza'; inputCPF.value='52998224725'; inputCPF.dispatchEvent(new Event('blur'));
            inputSexo.value='fem'; inputDataNasc.value='1990-05-10'; inputTelefone.value='11988887777'; inputEmail.value='maria@x.com';
            inputCep.value='01001-000'; inputEndereco.value='Praça da Sé'; inputNum.value='100'; inputBairro.value='Sé';
            inputCidade.value='São Paulo'; inputEstado.value='SP'; frmCli.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("Cliente adicionado")));
        ctx.igual(await Cli.countDocuments(), 1, "cliente gravado");
        await ctx.espera(1500);

        await js(`searchClientsInput.value='52998224725'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdClient.value !== ''"));
        ctx.igual(await js("inputNome.value"), "Maria Souza", "busca por CPF carrega o cliente");
        ctx.igual(await js("inputDataNasc.value"), "1990-05-10", "data de nascimento não volta um dia");
        ctx.igual(await botoesVisiveis(), ["Excluir", "Novo cliente", "Salvar alterações"], "modo edição mostra Excluir e Salvar");

        await js(`inputTelefone2.value='(11) 3000-0000'; frmCli.requestSubmit()`);
        await ctx.aguardar(async () => (await Cli.findOne()).telefone2 === "(11) 3000-0000");
        ctx.ok(true, "edição gravada");
        await ctx.espera(1500);

        await js(`inputNome.value='Outra'; inputCPF.value='52998224725'; inputSexo.value='fem'; inputDataNasc.value='2000-01-01';
            inputTelefone.value='1'; inputEmail.value='o@x.com'; inputCep.value='1'; inputEndereco.value='a'; inputNum.value='1';
            inputBairro.value='b'; inputCidade.value='c'; inputEstado.value='SP'; inputIdClient.value=''; frmCli.requestSubmit()`);
        await ctx.aguardar(() => ctx.dialogos.some((d) => d.includes("CPF já cadastrado")));
        ctx.igual(await Cli.countDocuments(), 1, "CPF duplicado é recusado");
        await ctx.espera(1500);

        await js(`searchClientsInput.value='Maria'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => js("inputIdClient.value !== ''"));
        ctx.respostas.push(1);
        await js("btnDelete.click()");
        await ctx.aguardar(async () => (await Cli.countDocuments()) === 0);
        ctx.ok(true, "cliente excluído após confirmação");
    },
};

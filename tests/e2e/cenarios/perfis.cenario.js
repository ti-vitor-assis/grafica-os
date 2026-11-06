// Permissões: o que atendente e produção veem e o que o main bloqueia
module.exports = {
    async executar(ctx) {
        const Usuario = ctx.modelo("Usuario");
        const Cli = ctx.modelo("Clientes");
        const cliente = await Cli.create({ nome: "Maria", cpf: "52998224725" });
        for (const [nome, login, perfil] of [["Ana", "ana", "atendente"], ["Pedro", "pedro", "produção"]]) {
            const u = new Usuario({ nome, login, perfil });
            await u.definirSenha("senha123");
            await u.save();
        }

        const navegacao = () => ctx.js(ctx.janela("Bem vindo"),
            `[...document.querySelectorAll('.lateral-item')].filter(b => b.style.display !== 'none').map(b => b.innerText.trim())`);
        ctx.igual((await navegacao()).length, 9, "administrador vê toda a navegação");

        await ctx.trocarUsuario("ana", "senha123");
        ctx.igual(await navegacao(), ["Visão geral", "Clientes", "Orçamentos", "Ordens de serviço", "Relatórios"], "navegação do atendente");
        const inicio = ctx.janela("Bem vindo");
        const negados = ctx.dialogos.length;
        await ctx.js(inicio, `api.openWindow('produtos')`);
        await ctx.js(inicio, `api.deleteClient('${cliente._id}')`);
        await ctx.js(inicio, `api.generateReport({ tipo: 'faturamento', inicio: '2026-01-01', fim: '2026-12-31' })`);
        await ctx.aguardar(() => ctx.dialogos.length >= negados + 3);
        ctx.ok(ctx.dialogos.slice(negados).every((d) => d.includes("não tem permissão")), "main bloqueia produtos, exclusão e financeiro");
        ctx.igual(await Cli.countDocuments(), 1, "cliente não foi excluído");

        await ctx.trocarUsuario("pedro", "senha123");
        ctx.igual(await navegacao(), ["Visão geral", "Ordens de serviço", "Estoque de insumos", "Fornecedores"], "navegação da produção");
        ctx.ok(await ctx.js(ctx.janela("Bem vindo"), `document.querySelector('.kpis').style.display === 'none'`), "produção não vê o financeiro");
    },
};

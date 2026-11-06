// Sessão encerrada por falta de uso (aqui com limite de 4 segundos em vez de 15 minutos)
module.exports = {
    env: { GRAFICA_INATIVIDADE_SEGUNDOS: "4" },
    async executar(ctx) {
        ctx.ok(!!ctx.janela("Bem vindo"), "entrou no sistema");
        // Uso do app adia o fim da sessão
        await ctx.espera(2500);
        await ctx.js(ctx.janela("Bem vindo"), "api.atividade()");
        await ctx.espera(2500);
        ctx.ok(!!ctx.janela("Bem vindo"), "atividade recente mantém a sessão");

        let tela;
        await ctx.aguardar(() => (tela = ctx.janela("Gráfica OS · Login")), 15000);
        ctx.ok(!ctx.janela("Bem vindo"), "sem uso, a janela principal fecha");
        await ctx.aguardar(() => ctx.js(tela, "!avisoSessao.hidden"));
        ctx.ok((await ctx.js(tela, "textoAvisoSessao.textContent")).includes("sem uso"), "login explica por que a sessão terminou");
    },
};

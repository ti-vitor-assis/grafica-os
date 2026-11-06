// Primeiro acesso, erros de login, usuário inativo e troca de usuário
module.exports = {
    semLogin: true,
    async executar(ctx) {
        const Usuario = ctx.modelo("Usuario");
        let tela;
        await ctx.aguardar(() => (tela = ctx.janela("Gráfica OS · Login")));
        await ctx.aguardar(() => ctx.js(tela, "!frmPrimeiroAcesso.hidden"));
        ctx.ok(true, "banco vazio mostra o cadastro do administrador");

        await ctx.js(tela, `inputAdminNome.value='Vitor'; inputAdminLogin.value='vitor'; inputAdminSenha.value='abc12345';
            inputAdminConfirma.value='outra123'; frmPrimeiroAcesso.requestSubmit()`);
        ctx.igual(await ctx.js(tela, "erroLogin.textContent"), "As senhas não conferem.", "senhas diferentes");

        await ctx.js(tela, `inputAdminConfirma.value='abc12345'; inputAdminLogin.value='x y'; frmPrimeiroAcesso.requestSubmit()`);
        await ctx.aguardar(() => ctx.js(tela, "erroLogin.textContent.includes('login')"));
        ctx.ok(true, "login inválido é recusado");

        await ctx.js(tela, `inputAdminLogin.value='vitor'; frmPrimeiroAcesso.requestSubmit()`);
        await ctx.aguardar(() => ctx.janela("Bem vindo"));
        ctx.ok(!ctx.janela("Gráfica OS · Login"), "a tela de login fecha depois de entrar");
        await ctx.espera(1500);
        ctx.ok((await ctx.js(ctx.janela("Bem vindo"), "footerUsuario.textContent")).includes("Vitor"), "rodapé mostra o usuário");

        const ana = new Usuario({ nome: "Ana", login: "ana", perfil: "atendente" });
        await ana.definirSenha("ana12345");
        await ana.save();
        const ex = new Usuario({ nome: "Ex", login: "exfunc", perfil: "atendente", ativo: false });
        await ex.definirSenha("ex123456");
        await ex.save();

        const { Menu } = require("electron");
        Menu.getApplicationMenu().items.find((i) => i.label === "Cadastro").submenu.items
            .find((i) => i.label === "Trocar usuário").click();
        await ctx.aguardar(() => (tela = ctx.janela("Gráfica OS · Login")));
        ctx.ok(!ctx.janela("Bem vindo"), "trocar usuário fecha a janela principal");
        await ctx.aguardar(() => ctx.js(tela, "!frmLogin.hidden"));

        for (const [login, senha, caso] of [["ana", "errada", "senha errada"], ["exfunc", "ex123456", "usuário inativo"], ["ninguem", "qualquer1", "usuário inexistente"]]) {
            await ctx.js(tela, `inputLogin.value='${login}'; inputSenha.value='${senha}'; frmLogin.requestSubmit()`);
            await ctx.aguardar(() => ctx.js(tela, "erroLogin.textContent !== ''"));
            ctx.igual(await ctx.js(tela, "erroLogin.textContent"), "Login ou senha incorretos.", caso);
            await ctx.js(tela, "erroLogin.textContent = ''");
        }

        await ctx.js(tela, `inputLogin.value=' ANA '; inputSenha.value='ana12345'; frmLogin.requestSubmit()`);
        await ctx.aguardar(() => ctx.janela("Bem vindo"));
        ctx.ok(true, "login aceita maiúsculas e espaços");
    },
};

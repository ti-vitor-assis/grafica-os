/**
 * Tela de login
 * @Author Vitor de Assis Passos
 */

const subtitulo = document.getElementById("subtitulo");
const frmLogin = document.getElementById("frmLogin");
const frmPrimeiroAcesso = document.getElementById("frmPrimeiroAcesso");
const erroLogin = document.getElementById("erroLogin");

const valor = (id) => document.getElementById(id).value;

// Quando o banco conectar, pergunta ao main se é o primeiro acesso
api.dbStatus((event, status) => {
    if (status === "conectado") {
        api.loginInfo();
    } else {
        subtitulo.textContent = "Sem conexão com o banco de dados.";
        erroLogin.textContent = "Verifique a internet ou a configuração do banco.";
        document.getElementById("btnConfigBanco").hidden = false;
    }
});

api.receiveLoginInfo((event, info) => {
    erroLogin.textContent = "";
    if (info.primeiroAcesso) {
        subtitulo.textContent = "Bem-vindo! Vamos configurar o sistema.";
        frmPrimeiroAcesso.hidden = false;
        document.getElementById("inputAdminNome").focus();
    } else {
        subtitulo.textContent = "Entre com seu login e senha.";
        frmLogin.hidden = false;
        document.getElementById("inputLogin").focus();
    }
});

// Mensagens de erro do main (senha errada, banco fora do ar...)
api.loginError((event, mensagem) => {
    erroLogin.textContent = mensagem;
    const senha = document.getElementById("inputSenha");
    senha.value = "";
    if (!frmLogin.hidden) senha.focus();
});

frmLogin.addEventListener("submit", (event) => {
    event.preventDefault();
    erroLogin.textContent = "";
    api.login({ login: valor("inputLogin"), senha: valor("inputSenha") });
});

frmPrimeiroAcesso.addEventListener("submit", (event) => {
    event.preventDefault();
    if (valor("inputAdminSenha") !== valor("inputAdminConfirma")) {
        erroLogin.textContent = "As senhas não conferem.";
        return;
    }
    erroLogin.textContent = "";
    api.createFirstAdmin({
        nome: valor("inputAdminNome"),
        login: valor("inputAdminLogin"),
        senha: valor("inputAdminSenha"),
    });
});

document.getElementById("btnConfigBanco").addEventListener("click", () => api.openDbConfig());

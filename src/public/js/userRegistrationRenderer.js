/**
 * Tela de Usuários (só administrador)
 * Usuário não é excluído: é desativado, para manter o histórico.
 * @Author Vitor de Assis Passos
 */

const frmUsuario = document.getElementById("frmUsuario");
const tituloModo = document.getElementById("tituloModo");
const inputIdUsuario = document.getElementById("inputIdUsuario");
const inputNome = document.getElementById("inputNome");
const inputLogin = document.getElementById("inputLogin");
const inputPerfil = document.getElementById("inputPerfil");
const inputSenha = document.getElementById("inputSenha");
const inputConfirma = document.getElementById("inputConfirma");
const inputAtivo = document.getElementById("inputAtivo");
const btnSalvar = document.getElementById("btnSalvar");
const btnLimpar = document.getElementById("btnLimpar");
const listaUsuarios = document.getElementById("listaUsuarios");

api.listUsers();

api.receiveUsers((event, dados) => {
    listaUsuarios.innerHTML = "";
    JSON.parse(dados).forEach((u) => {
        const li = document.createElement("li");
        li.className = "lista-item";
        li.dataset.id = u._id;

        const nome = document.createElement("div");
        nome.className = "lista-item-titulo";
        const texto = document.createElement("span");
        texto.textContent = u.nome;
        const perfil = document.createElement("span");
        perfil.className = u.ativo ? (u.perfil === "administrador" ? "badge badge-pronta" : "badge badge-info") : "badge";
        perfil.textContent = u.ativo ? u.perfil : "inativo";
        nome.append(texto, perfil);

        const detalhe = document.createElement("div");
        detalhe.className = "lista-item-detalhe";
        detalhe.textContent = `login: ${u.login}`;

        li.append(nome, detalhe);
        li.addEventListener("click", () => editar(u));
        listaUsuarios.appendChild(li);
    });
});

// Carrega um usuário no formulário para edição (senha em branco = mantém)
function editar(u) {
    inputIdUsuario.value = u._id;
    listaUsuarios.querySelectorAll(".lista-item").forEach((li) => li.classList.toggle("ativo", li.dataset.id === u._id));
    inputNome.value = u.nome;
    inputLogin.value = u.login;
    inputPerfil.value = u.perfil;
    inputAtivo.checked = u.ativo;
    inputSenha.value = "";
    inputConfirma.value = "";
    inputSenha.placeholder = "deixe em branco para manter a atual";
    document.getElementById("rotuloSenha").textContent = "Nova senha";
    tituloModo.textContent = `Editar usuário · ${u.login}`;
    document.getElementById("textoSalvar").textContent = "Salvar alterações";
}

frmUsuario.addEventListener("submit", (event) => {
    event.preventDefault();
    const novo = inputIdUsuario.value === "";

    if (novo && !inputSenha.value) return api.warn("Informe a senha do novo usuário.");
    if (inputSenha.value !== inputConfirma.value) return api.warn("As senhas não conferem.");

    const dados = {
        nome: inputNome.value.trim(),
        login: inputLogin.value.trim(),
        perfil: inputPerfil.value,
        ativo: inputAtivo.checked,
        senha: inputSenha.value,
    };
    if (novo) {
        api.createUser(dados);
    } else {
        dados._id = inputIdUsuario.value;
        api.updateUser(dados);
    }
});

btnLimpar.addEventListener("click", () => location.reload());
api.resetForm(() => location.reload());

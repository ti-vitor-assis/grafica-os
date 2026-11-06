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
        li.className =
            "cursor-pointer rounded-[10px] border-b border-[var(--color-primary)] px-3 py-2 hover:bg-[var(--color-panel)]";

        const nome = document.createElement("p");
        nome.className = "font-semibold";
        nome.textContent = u.nome + (u.ativo ? "" : " (inativo)");

        const detalhe = document.createElement("p");
        detalhe.className = "text-sm text-[var(--color-text-secondary)]";
        detalhe.textContent = `${u.login} · ${u.perfil}`;

        li.append(nome, detalhe);
        li.addEventListener("click", () => editar(u));
        listaUsuarios.appendChild(li);
    });
});

// Carrega um usuário no formulário para edição (senha em branco = mantém)
function editar(u) {
    inputIdUsuario.value = u._id;
    inputNome.value = u.nome;
    inputLogin.value = u.login;
    inputPerfil.value = u.perfil;
    inputAtivo.checked = u.ativo;
    inputSenha.value = "";
    inputConfirma.value = "";
    inputSenha.placeholder = "  Nova senha (deixe em branco para manter)";
    tituloModo.textContent = `(${u.login})`;
    btnSalvar.textContent = "Salvar alterações";
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

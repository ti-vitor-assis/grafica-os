/**
 * Tela de cadastro de Fornecedores
 * @Author Vitor de Assis Passos
 */

const frmSearchSupplier = document.getElementById("frmSearchSupplier");
const searchSupplier = document.getElementById("searchSupplierInput");
const frmSupplier = document.getElementById("frmSupplier");
const inputIdSupplier = document.getElementById("inputIdSupplier");
const listaResultados = document.getElementById("listaResultados");
const semResultados = document.getElementById("semResultados");
const btnCreate = document.getElementById("btnCreate");
const btnUpdate = document.getElementById("btnUpdate");
const btnDelete = document.getElementById("btnDelete");

// Campos do formulário: id do elemento -> nome do campo no banco
const campos = {
    inputNome: "nome",
    inputDocumento: "documento",
    inputContato: "contato",
    inputTelefone: "telefone",
    inputEmail: "email",
    inputFornece: "fornece",
    inputObs: "observacoes",
};

btnUpdate.disabled = true;
btnDelete.disabled = true;
// Já abre com a lista de todos os fornecedores
api.searchSupplier("");

frmSearchSupplier.addEventListener("submit", (event) => {
    event.preventDefault();
    api.searchSupplier(searchSupplier.value.trim());
});

api.receiveSuppliers((event, dados) => {
    const lista = JSON.parse(dados);
    listaResultados.innerHTML = "";
    semResultados.hidden = lista.length > 0;
    lista.forEach((f) => {
        const li = document.createElement("li");
        li.className =
            "cursor-pointer rounded-[10px] border-b border-[var(--color-primary)] px-3 py-2 hover:bg-[var(--color-panel)]";
        const nome = document.createElement("p");
        nome.className = "font-semibold";
        nome.textContent = f.nome + (f.ativo === false ? " (inativo)" : "");
        const detalhe = document.createElement("p");
        detalhe.className = "text-sm text-[var(--color-text-secondary)]";
        detalhe.textContent = [f.fornece, f.telefone].filter(Boolean).join(" · ") || "—";
        li.append(nome, detalhe);
        li.addEventListener("click", () => preencher(f));
        listaResultados.appendChild(li);
    });
});

function preencher(f) {
    inputIdSupplier.value = f._id;
    for (const [id, campo] of Object.entries(campos)) {
        document.getElementById(id).value = f[campo] || "";
    }
    document.getElementById("inputAtivo").checked = f.ativo !== false;
    btnCreate.disabled = true;
    btnUpdate.disabled = false;
    btnDelete.disabled = false;
}

frmSupplier.addEventListener("submit", (event) => {
    event.preventDefault();
    const fornecedor = { ativo: document.getElementById("inputAtivo").checked };
    for (const [id, campo] of Object.entries(campos)) {
        fornecedor[campo] = document.getElementById(id).value.trim();
    }
    if (inputIdSupplier.value === "") {
        api.createSupplier(fornecedor);
    } else {
        fornecedor._id = inputIdSupplier.value;
        api.updateSupplier(fornecedor);
    }
});

btnDelete.addEventListener("click", () => api.deleteSupplier(inputIdSupplier.value));
document.getElementById("btnReset").addEventListener("click", () => location.reload());
api.resetForm(() => location.reload());

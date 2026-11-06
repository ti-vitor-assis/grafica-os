/**
 * Tela de cadastro de Produtos e Serviços
 * @Author Vitor de Assis Passos
 */

// Referências dos elementos
const frmSearchProduct = document.getElementById("frmSearchProduct");
const searchProduct = document.getElementById("searchProductsInput");
const frmProduct = document.getElementById("frmProduct");
const inputIdProduct = document.getElementById("inputIdProduct");
const inputNome = document.getElementById("inputNome");
const inputCategoria = document.getElementById("inputCategoria");
const inputUnidade = document.getElementById("inputUnidade");
const inputMaterial = document.getElementById("inputMaterial");
const inputTamanho = document.getElementById("inputTamanho");
const inputCores = document.getElementById("inputCores");
const inputAcabamento = document.getElementById("inputAcabamento");
const inputDescricao = document.getElementById("inputDescricao");
const inputValor = document.getElementById("inputValor");
const inputAtivo = document.getElementById("inputAtivo");
const listaResultados = document.getElementById("listaResultados");
const semResultados = document.getElementById("semResultados");

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

document.addEventListener("DOMContentLoaded", () => {
    // Desativar botões editar e excluir
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    // Ativar botão adicionar
    btnCreate.disabled = false;

    searchProduct.focus();
});

// ======== CREATE / UPDATE =========
// O mesmo submit cadastra (sem id) ou edita (com id)
frmProduct.addEventListener("submit", (event) => {
    event.preventDefault();

    const produto = {
        nome: inputNome.value.trim(),
        categoria: inputCategoria.value.trim(),
        unidade: inputUnidade.value,
        material: inputMaterial.value.trim(),
        tamanho: inputTamanho.value.trim(),
        cores: inputCores.value.trim(),
        acabamento: inputAcabamento.value.trim(),
        descricao: inputDescricao.value.trim(),
        valorUnitario: inputValor.value,
        ativo: inputAtivo.checked,
    };

    if (inputIdProduct.value === "") {
        api.createProduct(produto);
    } else {
        produto._id = inputIdProduct.value;
        api.updateProduct(produto);
    }
});

// ======== READ =========
frmSearchProduct.addEventListener("submit", (event) => {
    event.preventDefault();
    const termo = searchProduct.value.trim();
    if (termo === "") {
        api.validateSearch();
    } else {
        api.searchProduct(termo);
    }
});

// Preenche o formulário com um produto
function preencherFormulario(p) {
    inputIdProduct.value = p._id;
    inputNome.value = p.nome;
    inputCategoria.value = p.categoria;
    inputUnidade.value = p.unidade || "un";
    inputMaterial.value = p.material || "";
    inputTamanho.value = p.tamanho || "";
    inputCores.value = p.cores || "";
    inputAcabamento.value = p.acabamento || "";
    inputDescricao.value = p.descricao || "";
    inputValor.value = p.valorUnitario;
    inputAtivo.checked = p.ativo !== false;

    // Desativar o botão adicionar e ativar editar e excluir
    btnCreate.disabled = true;
    btnUpdate.disabled = false;
    btnDelete.disabled = false;
}

// Mostra os resultados na lista da direita (clicar em um item carrega no formulário)
function renderizarLista(produtos) {
    listaResultados.innerHTML = "";
    semResultados.hidden = true;

    produtos.forEach((p) => {
        const item = document.createElement("li");
        item.className =
            "cursor-pointer rounded-[10px] border-b border-[var(--color-primary)] px-3 py-2 " +
            "text-[var(--color-text-primary)] hover:bg-[var(--color-panel)]";

        const nome = document.createElement("p");
        nome.className = "font-semibold";
        nome.textContent = p.nome + (p.ativo === false ? " (inativo)" : "");

        const detalhe = document.createElement("p");
        detalhe.className = "text-sm text-[var(--color-text-secondary)]";
        detalhe.textContent = `${p.categoria} · ${formatoMoeda.format(p.valorUnitario)} / ${p.unidade || "un"}`;

        item.append(nome, detalhe);
        item.addEventListener("click", () => preencherFormulario(p));
        listaResultados.appendChild(item);
    });
}

// Resposta da busca (listener registrado uma vez só)
api.renderProduct((event, dados) => {
    const produtos = JSON.parse(dados);
    renderizarLista(produtos);
    // Se só veio um produto, já carrega direto no formulário
    if (produtos.length === 1) {
        preencherFormulario(produtos[0]);
    }
});

// Produto não encontrado e o usuário quis cadastrar: copia o texto da busca para o nome
api.setProductName(() => {
    inputNome.value = searchProduct.value.trim();
    searchProduct.value = "";
    inputCategoria.focus();
});

// ======== DELETE =========
function removeProduct() {
    api.deleteProduct(inputIdProduct.value);
}

// ======== RESETAR FORMULÁRIO =========
function resetForm() {
    location.reload();
}

api.resetForm(() => {
    resetForm();
});

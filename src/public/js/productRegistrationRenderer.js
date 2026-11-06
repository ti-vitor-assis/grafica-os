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
    document.getElementById("tituloForm").textContent = "Editar produto";
    listaResultados.querySelectorAll(".lista-item").forEach((li) => li.classList.toggle("ativo", li.dataset.id === p._id));
}

// Mostra os resultados na lista da direita (clicar em um item carrega no formulário)
function renderizarLista(produtos) {
    listaResultados.innerHTML = "";
    semResultados.hidden = true;

    document.getElementById("contagemResultados").textContent =
        `${produtos.length} encontrado${produtos.length === 1 ? "" : "s"}`;

    produtos.forEach((p) => {
        const item = document.createElement("li");
        item.className = "lista-item";
        item.dataset.id = p._id;

        const nome = document.createElement("div");
        nome.className = "lista-item-titulo";
        const texto = document.createElement("span");
        texto.textContent = p.nome;
        nome.appendChild(texto);
        if (p.ativo === false) {
            const badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = "Inativo";
            nome.appendChild(badge);
        }

        const detalhe = document.createElement("div");
        detalhe.className = "lista-item-detalhe";
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

// Eventos dos botões (antes eram onclick no HTML)
btnDelete.addEventListener("click", removeProduct);
btnReset.addEventListener("click", resetForm);

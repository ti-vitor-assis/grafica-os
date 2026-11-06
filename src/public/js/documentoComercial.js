/**
 * Funções comuns às telas de Ordem de Serviço e de Orçamento:
 * formatação, busca de cliente, lista lateral e editor de itens.
 *
 * Carregar ANTES do renderer da tela. A página precisa ter os elementos:
 * #frmSearchClient, #searchClientsInput, #inputIdClient, #inputNome,
 * #selectProduto, #inputQtd, #inputValorUn, #btnAddItem, #tabelaItens,
 * #semItens, #valorTotal, #tituloLista, #semResultados, #listaResultados
 * @Author Vitor de Assis Passos
 */

// ============================
// ======= FORMATAÇÃO =========

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor) => formatoMoeda.format(valor || 0);
const centavos = (valor) => Math.round(valor * 100) / 100;

// Data para exibir: 10/11/2026
function formatarData(data) {
    return data ? new Date(data).toLocaleDateString("pt-BR") : "";
}

// Data para o input type="date": 2026-11-10 (no horário local)
function dataParaInput(data) {
    if (!data) return "";
    const d = new Date(data);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
}

// Etiqueta de status: "em produção" -> classe "badge badge-em-producao" (cores no app.css)
function classeStatus(status) {
    const slug = String(status || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // tira os acentos
        .toLowerCase()
        .replace(/\s+/g, "-");
    return `badge badge-${slug}`;
}

// ============================
// ====== RESET DA TELA =======

// O main manda "reset-form" depois de salvar/excluir, mas também quando o
// usuário responde NÃO na busca de cliente. Só recarregamos a tela no
// primeiro caso, para não perder os itens já digitados.
let aguardandoReset = false;

function resetForm() {
    location.reload();
}

api.resetForm(() => {
    if (aguardandoReset) resetForm();
});

// ============================
// ====== LISTA LATERAL =======

const tituloLista = document.getElementById("tituloLista");
const semResultados = document.getElementById("semResultados");
const listaResultados = document.getElementById("listaResultados");

// Mostra uma lista ao lado do formulário.
// itens = [{ titulo, detalhe, etiqueta?, aoClicar }]
function mostrarLista(titulo, itens, textoVazio) {
    tituloLista.textContent = titulo;
    listaResultados.innerHTML = "";
    semResultados.hidden = itens.length > 0;
    if (textoVazio) semResultados.textContent = textoVazio;

    itens.forEach(({ titulo, detalhe, etiqueta, aoClicar }) => {
        const li = document.createElement("li");
        li.className = "lista-item";

        const linhaTitulo = document.createElement("div");
        linhaTitulo.className = "lista-item-titulo";
        const p = document.createElement("span");
        p.textContent = titulo;
        linhaTitulo.appendChild(p);
        if (etiqueta) {
            const span = document.createElement("span");
            span.className = classeStatus(etiqueta);
            span.textContent = etiqueta;
            linhaTitulo.appendChild(span);
        }

        const pDetalhe = document.createElement("div");
        pDetalhe.className = "lista-item-detalhe";
        pDetalhe.textContent = detalhe;

        li.append(linhaTitulo, pDetalhe);
        li.addEventListener("click", () => {
            listaResultados.querySelectorAll(".lista-item").forEach((x) => x.classList.toggle("ativo", x === li));
            aoClicar();
        });
        listaResultados.appendChild(li);
    });
}

// ============================
// ===== BUSCA DE CLIENTE =====

const frmSearchClient = document.getElementById("frmSearchClient");
const searchClient = document.getElementById("searchClientsInput");
const inputIdClient = document.getElementById("inputIdClient");
const inputNome = document.getElementById("inputNome");

// "Nome — CPF ***.982.247-**" (OS e orçamentos só recebem o documento mascarado)
const rotuloCliente = (c) => (c.documentoMascarado ? `${c.nome} — ${c.rotuloDocumento} ${c.documentoMascarado}` : c.nome);

// A tela informa o que fazer quando um cliente é escolhido
let aoSelecionarCliente = () => {};

function selecionarCliente(c) {
    inputIdClient.value = c._id;
    inputNome.value = rotuloCliente(c);
    searchClient.value = "";
    aoSelecionarCliente(c);
}

// Mostra o cliente de um documento carregado (o cliente pode ter sido excluído)
function mostrarCliente(c) {
    inputIdClient.value = c ? c._id : "";
    inputNome.value = c ? rotuloCliente(c) : "(cliente excluído)";
}

frmSearchClient.addEventListener("submit", (event) => {
    event.preventDefault();
    aguardandoReset = false;
    const termo = searchClient.value.trim();
    if (termo === "") {
        api.validateSearch();
    } else if (/^[\d.\-/\s]+$/.test(termo)) {
        api.searchCpf(termo);
    } else {
        api.searchName(termo);
    }
});

// Resposta da busca de cliente (listener registrado uma vez só)
api.renderClient((event, dados) => {
    const clientes = JSON.parse(dados);
    if (clientes.length === 1) {
        selecionarCliente(clientes[0]);
    } else {
        mostrarLista(
            "Clientes encontrados",
            clientes.map((c) => ({ titulo: c.nome, detalhe: [`${c.rotuloDocumento} ${c.documentoMascarado}`, c.cidade, c.ativo === false ? "Inativo" : ""].filter(Boolean).join(" · "), aoClicar: () => selecionarCliente(c) }))
        );
    }
});

// Cliente não encontrado e o usuário quis cadastrar: abre a tela de clientes
api.setName(() => api.openWindow("clientes"));
api.setCpf(() => api.openWindow("clientes"));

// ============================
// ===== EDITOR DE ITENS ======

const selectProduto = document.getElementById("selectProduto");
const inputQtd = document.getElementById("inputQtd");
const inputValorUn = document.getElementById("inputValorUn");
const btnAddItem = document.getElementById("btnAddItem");
const tabelaItens = document.getElementById("tabelaItens");
const semItens = document.getElementById("semItens");
const valorTotal = document.getElementById("valorTotal");

const editorItens = {
    itens: [], // { produto, descricao, unidade, quantidade, valorUnitario }
    produtos: [], // produtos ativos, para o select
    aoMudar: () => {}, // a tela pode reagir (ex.: OS recalcula o saldo)

    total() {
        return centavos(this.itens.reduce((soma, i) => soma + centavos(i.quantidade * i.valorUnitario), 0));
    },

    // Carrega os itens de um documento salvo
    definir(itensSalvos) {
        this.itens = itensSalvos.map((i) => ({
            produto: i.produto,
            descricao: i.descricao,
            unidade: (this.produtos.find((p) => p._id === i.produto) || {}).unidade,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
        }));
        this.render();
    },

    // Formato enviado ao main (subtotal/total são recalculados lá)
    paraEnvio() {
        return this.itens.map(({ produto, descricao, quantidade, valorUnitario }) => ({
            produto,
            descricao,
            quantidade,
            valorUnitario,
        }));
    },

    render() {
        tabelaItens.innerHTML = "";
        this.itens.forEach((item, indice) => {
            const linha = document.createElement("tr");

            const celulas = [
                [item.descricao, ""],
                [`${item.quantidade} ${item.unidade || ""}`, "num"],
                [moeda(item.valorUnitario), "num"],
                [moeda(centavos(item.quantidade * item.valorUnitario)), "num font-semibold"],
            ];
            celulas.forEach(([texto, classe]) => {
                const td = document.createElement("td");
                td.className = classe;
                td.textContent = texto;
                linha.appendChild(td);
            });

            const tdRemover = document.createElement("td");
            tdRemover.className = "w-[44px]";
            const btnRemover = document.createElement("button");
            btnRemover.type = "button";
            btnRemover.title = "Remover item";
            btnRemover.innerHTML = icone("lixeira", 16);
            btnRemover.className = "btn btn-fantasma btn-icone";
            btnRemover.addEventListener("click", () => {
                this.itens.splice(indice, 1);
                this.render();
            });
            tdRemover.appendChild(btnRemover);
            linha.appendChild(tdRemover);

            tabelaItens.appendChild(linha);
        });
        semItens.hidden = this.itens.length > 0;
        valorTotal.textContent = moeda(this.total());
        this.aoMudar();
    },
};

// Produtos ativos chegam do main e preenchem o select
api.receiveProducts((event, dados) => {
    editorItens.produtos = JSON.parse(dados);
    editorItens.produtos.forEach((p) => {
        const opcao = document.createElement("option");
        opcao.value = p._id;
        opcao.textContent = `${p.nome} — ${moeda(p.valorUnitario)} / ${p.unidade || "un"}`;
        selectProduto.appendChild(opcao);
    });
});
api.listProducts();

// Ao escolher o produto, sugere o valor de tabela (pode ser alterado)
selectProduto.addEventListener("change", () => {
    const p = editorItens.produtos.find((x) => x._id === selectProduto.value);
    if (!p) return;
    inputValorUn.value = p.valorUnitario;
    if (!inputQtd.value) inputQtd.value = 1;
    inputQtd.focus();
    inputQtd.select();
});

btnAddItem.addEventListener("click", () => {
    const p = editorItens.produtos.find((x) => x._id === selectProduto.value);
    const quantidade = Number(inputQtd.value);
    const valorUnitario = Number(inputValorUn.value);

    if (!p) return api.warn("Selecione um produto.");
    if (!Number.isInteger(quantidade) || quantidade < 1) return api.warn("A quantidade deve ser um número inteiro maior que zero.");
    if (inputValorUn.value === "" || valorUnitario < 0) return api.warn("Informe um valor unitário válido.");

    editorItens.itens.push({ produto: p._id, descricao: p.nome, unidade: p.unidade, quantidade, valorUnitario });
    selectProduto.value = "";
    inputQtd.value = "";
    inputValorUn.value = "";
    editorItens.render();
    selectProduto.focus();
});

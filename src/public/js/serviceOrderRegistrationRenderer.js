/**
 * Tela de Ordem de Serviço
 * @Author Vitor de Assis Passos
 */

// Referências dos elementos
const frmSearchClient = document.getElementById("frmSearchClient");
const searchClient = document.getElementById("searchClientsInput");
const frmSearchOrder = document.getElementById("frmSearchOrder");
const searchOrder = document.getElementById("searchOrderInput");
const frmOS = document.getElementById("frmOS");
const numeroOS = document.getElementById("numeroOS");
const inputIdOS = document.getElementById("inputIdOS");
const inputIdClient = document.getElementById("inputIdClient");
const inputNome = document.getElementById("inputNome");
const inputStatus = document.getElementById("inputStatus");
const selectProduto = document.getElementById("selectProduto");
const inputQtd = document.getElementById("inputQtd");
const inputValorUn = document.getElementById("inputValorUn");
const btnAddItem = document.getElementById("btnAddItem");
const tabelaItens = document.getElementById("tabelaItens");
const semItens = document.getElementById("semItens");
const valorTotal = document.getElementById("valorTotal");
const textoSaldo = document.getElementById("textoSaldo");
const inputPrazo = document.getElementById("inputPrazo");
const inputArteOrigem = document.getElementById("inputArteOrigem");
const inputArteAprovada = document.getElementById("inputArteAprovada");
const inputSinal = document.getElementById("inputSinal");
const inputFormaPagamento = document.getElementById("inputFormaPagamento");
const inputPago = document.getElementById("inputPago");
const inputObs = document.getElementById("inputObs");
const tituloLista = document.getElementById("tituloLista");
const semResultados = document.getElementById("semResultados");
const listaResultados = document.getElementById("listaResultados");

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor) => formatoMoeda.format(valor || 0);
const centavos = (valor) => Math.round(valor * 100) / 100;

// Cores do status (lista e etiquetas)
const corStatus = {
    "aberta": "bg-slate-500",
    "aguardando arte": "bg-yellow-600",
    "em produção": "bg-blue-600",
    "pronta": "bg-purple-600",
    "entregue": "bg-green-600",
    "cancelada": "bg-red-600",
};

// Estado da tela
let itens = []; // { produto, descricao, unidade, quantidade, valorUnitario }
let produtosDisponiveis = [];
// O main manda "reset-form" depois de salvar/excluir, mas também quando o
// usuário responde NÃO na busca de cliente. Só recarregamos a tela no
// primeiro caso, para não perder os itens já digitados.
let aguardandoReset = false;

document.addEventListener("DOMContentLoaded", () => {
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    btnCreate.disabled = false;
    api.listProducts();
    searchClient.focus();
});

// ============================
// ======== PRODUTOS ==========

api.receiveProducts((event, dados) => {
    produtosDisponiveis = JSON.parse(dados);
    produtosDisponiveis.forEach((p) => {
        const opcao = document.createElement("option");
        opcao.value = p._id;
        opcao.textContent = `${p.nome} — ${moeda(p.valorUnitario)} / ${p.unidade || "un"}`;
        selectProduto.appendChild(opcao);
    });
});

// Ao escolher o produto, sugere o valor de tabela (pode ser alterado)
selectProduto.addEventListener("change", () => {
    const p = produtosDisponiveis.find((x) => x._id === selectProduto.value);
    if (!p) return;
    inputValorUn.value = p.valorUnitario;
    if (!inputQtd.value) inputQtd.value = 1;
    inputQtd.focus();
    inputQtd.select();
});

// ============================
// ========== ITENS ===========

btnAddItem.addEventListener("click", () => {
    const p = produtosDisponiveis.find((x) => x._id === selectProduto.value);
    const quantidade = Number(inputQtd.value);
    const valorUnitario = Number(inputValorUn.value);

    if (!p) return api.warn("Selecione um produto.");
    if (!Number.isInteger(quantidade) || quantidade < 1) return api.warn("A quantidade deve ser um número inteiro maior que zero.");
    if (inputValorUn.value === "" || valorUnitario < 0) return api.warn("Informe um valor unitário válido.");

    itens.push({ produto: p._id, descricao: p.nome, unidade: p.unidade, quantidade, valorUnitario });
    selectProduto.value = "";
    inputQtd.value = "";
    inputValorUn.value = "";
    renderItens();
    selectProduto.focus();
});

function renderItens() {
    tabelaItens.innerHTML = "";
    itens.forEach((item, indice) => {
        const linha = document.createElement("tr");
        linha.className = "border-t border-[var(--color-panel)]";

        const celulas = [
            [item.descricao, "text-left px-3"],
            [`${item.quantidade} ${item.unidade || ""}`, "text-right px-2"],
            [moeda(item.valorUnitario), "text-right px-2"],
            [moeda(centavos(item.quantidade * item.valorUnitario)), "text-right px-2"],
        ];
        celulas.forEach(([texto, classe]) => {
            const td = document.createElement("td");
            td.className = classe + " py-1";
            td.textContent = texto;
            linha.appendChild(td);
        });

        const tdRemover = document.createElement("td");
        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.title = "Remover item";
        btnRemover.textContent = "✕";
        btnRemover.className = "text-[var(--color-error)] hover:brightness-125 px-2";
        btnRemover.addEventListener("click", () => {
            itens.splice(indice, 1);
            renderItens();
        });
        tdRemover.appendChild(btnRemover);
        linha.appendChild(tdRemover);

        tabelaItens.appendChild(linha);
    });
    semItens.hidden = itens.length > 0;
    atualizarTotais();
}

// Total, sinal e saldo (o main recalcula ao salvar; aqui é só para exibir)
function atualizarTotais() {
    const total = centavos(itens.reduce((soma, i) => soma + centavos(i.quantidade * i.valorUnitario), 0));
    const sinal = Number(inputSinal.value) || 0;
    const saldo = inputPago.checked ? 0 : Math.max(centavos(total - sinal), 0);
    valorTotal.textContent = moeda(total);
    textoSaldo.textContent = `Sinal ${moeda(sinal)} · Saldo a receber ${moeda(saldo)}`;
}
inputSinal.addEventListener("input", atualizarTotais);
inputPago.addEventListener("change", atualizarTotais);

// ============================
// ========= CLIENTE ==========

frmSearchClient.addEventListener("submit", (event) => {
    event.preventDefault();
    aguardandoReset = false;
    const termo = searchClient.value.trim();
    if (termo === "") {
        api.validateSearch();
    } else if (/^[\d.\-\s]+$/.test(termo)) {
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
        listarClientes(clientes);
    }
});

// Cliente não encontrado e o usuário quis cadastrar: abre a tela de clientes
api.setName(() => api.openWindow("clientes"));
api.setCpf(() => api.openWindow("clientes"));

function selecionarCliente(c) {
    inputIdClient.value = c._id;
    inputNome.value = `${c.nome} — CPF ${c.cpf}`;
    searchClient.value = "";
    api.searchOrder({ clienteId: c._id });
}

// ============================
// ====== LISTA LATERAL =======

function itemDaLista(titulo, detalhe, aoClicar, etiqueta) {
    const li = document.createElement("li");
    li.className =
        "cursor-pointer rounded-[10px] border-b border-[var(--color-primary)] px-3 py-2 hover:bg-[var(--color-panel)]";

    const linhaTitulo = document.createElement("div");
    linhaTitulo.className = "flex items-center justify-between gap-2";
    const p = document.createElement("p");
    p.className = "font-semibold";
    p.textContent = titulo;
    linhaTitulo.appendChild(p);
    if (etiqueta) {
        const span = document.createElement("span");
        span.className = `${corStatus[etiqueta] || "bg-slate-500"} text-white text-xs rounded-full px-2 py-[2px]`;
        span.textContent = etiqueta;
        linhaTitulo.appendChild(span);
    }

    const pDetalhe = document.createElement("p");
    pDetalhe.className = "text-sm text-[var(--color-text-secondary)]";
    pDetalhe.textContent = detalhe;

    li.append(linhaTitulo, pDetalhe);
    li.addEventListener("click", aoClicar);
    listaResultados.appendChild(li);
}

function listarClientes(clientes) {
    tituloLista.textContent = "Clientes encontrados";
    listaResultados.innerHTML = "";
    semResultados.hidden = true;
    clientes.forEach((c) => itemDaLista(c.nome, `CPF ${c.cpf}`, () => selecionarCliente(c)));
}

function listarOrdens(ordens) {
    tituloLista.textContent = "OS do cliente";
    listaResultados.innerHTML = "";
    semResultados.hidden = ordens.length > 0;
    semResultados.textContent = "Nenhuma OS para este cliente. Preencha o formulário para criar a primeira.";
    ordens.forEach((o) =>
        itemDaLista(
            `OS nº ${o.numero}`,
            `Prazo ${formatarData(o.prazoFinal)} · ${moeda(o.valorTotal)}`,
            () => carregarOS(o),
            o.status
        )
    );
}

// ============================
// ======= BUSCA DE OS ========

frmSearchOrder.addEventListener("submit", (event) => {
    event.preventDefault();
    aguardandoReset = false;
    const numero = Number(searchOrder.value);
    if (!Number.isInteger(numero) || numero < 1) {
        return api.warn("Digite o número da OS.");
    }
    api.searchOrder({ numero });
});

api.receiveOrder((event, dados) => {
    const { modo, ordens } = JSON.parse(dados);
    if (modo === "numero") {
        carregarOS(ordens[0]);
        searchOrder.value = "";
    } else {
        listarOrdens(ordens);
    }
});

// Preenche o formulário com uma OS existente
function carregarOS(o) {
    inputIdOS.value = o._id;
    numeroOS.textContent = `nº ${o.numero}`;

    if (o.cliente) {
        inputIdClient.value = o.cliente._id;
        inputNome.value = `${o.cliente.nome} — CPF ${o.cliente.cpf}`;
    } else {
        inputIdClient.value = "";
        inputNome.value = "(cliente excluído)";
    }

    itens = o.produtos.map((i) => ({
        produto: i.produto,
        descricao: i.descricao,
        unidade: (produtosDisponiveis.find((p) => p._id === i.produto) || {}).unidade,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
    }));

    inputStatus.value = o.status;
    inputPrazo.value = dataParaInput(o.prazoFinal);
    inputArteOrigem.value = (o.arte && o.arte.origem) || "cliente";
    inputArteAprovada.checked = !!(o.arte && o.arte.aprovada);
    inputSinal.value = (o.pagamento && o.pagamento.sinal) || "";
    inputFormaPagamento.value = (o.pagamento && o.pagamento.formaPagamento) || "";
    inputPago.checked = !!(o.pagamento && o.pagamento.pago);
    inputObs.value = o.observacoes || "";

    renderItens();

    btnCreate.disabled = true;
    btnUpdate.disabled = false;
    btnDelete.disabled = false;
}

// ============================
// ===== CREATE / UPDATE ======

frmOS.addEventListener("submit", (event) => {
    event.preventDefault();

    if (inputIdClient.value === "") {
        return api.warn("Selecione o cliente usando a busca acima.");
    }
    if (itens.length === 0) {
        return api.warn("Adicione pelo menos 1 item à OS.");
    }

    const order = {
        cliente: inputIdClient.value,
        produtos: itens.map(({ produto, descricao, quantidade, valorUnitario }) => ({
            produto,
            descricao,
            quantidade,
            valorUnitario,
        })),
        prazoFinal: inputPrazo.value,
        status: inputStatus.value,
        observacoes: inputObs.value.trim(),
        arte: {
            origem: inputArteOrigem.value,
            aprovada: inputArteAprovada.checked,
        },
        pagamento: {
            sinal: inputSinal.value,
            formaPagamento: inputFormaPagamento.value,
            pago: inputPago.checked,
        },
    };

    aguardandoReset = true;
    if (inputIdOS.value === "") {
        api.createOrder(order);
    } else {
        order._id = inputIdOS.value;
        api.updateOrder(order);
    }
});

// ============================
// ========== DELETE ==========

function removeOrder() {
    aguardandoReset = true;
    api.deleteOrder(inputIdOS.value);
}

// ============================
// ==== RESETAR FORMULÁRIO ====

function resetForm() {
    location.reload();
}

api.resetForm(() => {
    if (aguardandoReset) resetForm();
});

// ============================
// ========== DATAS ===========

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

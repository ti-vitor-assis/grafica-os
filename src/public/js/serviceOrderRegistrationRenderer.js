/**
 * Tela de Ordem de Serviço
 * Busca de cliente, lista lateral e itens ficam em documentoComercial.js
 * @Author Vitor de Assis Passos
 */

// Referências dos elementos
const frmSearchOrder = document.getElementById("frmSearchOrder");
const searchOrder = document.getElementById("searchOrderInput");
const frmOS = document.getElementById("frmOS");
const numeroOS = document.getElementById("numeroOS");
const inputIdOS = document.getElementById("inputIdOS");
const inputStatus = document.getElementById("inputStatus");
const textoSaldo = document.getElementById("textoSaldo");
const inputPrazo = document.getElementById("inputPrazo");
const inputArteOrigem = document.getElementById("inputArteOrigem");
const inputArteAprovada = document.getElementById("inputArteAprovada");
const inputValorPagamento = document.getElementById("inputValorPagamento");
const inputFormaPagamento = document.getElementById("inputFormaPagamento");
const inputDataPagamento = document.getElementById("inputDataPagamento");
const btnAddPagamento = document.getElementById("btnAddPagamento");
const tabelaPagamentos = document.getElementById("tabelaPagamentos");
const semPagamentos = document.getElementById("semPagamentos");
const inputObs = document.getElementById("inputObs");

document.addEventListener("DOMContentLoaded", () => {
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    btnPrint.disabled = true;
    btnCreate.disabled = false;
    inputDataPagamento.value = dataParaInput(new Date());
    searchClient.focus();
});

// ============================
// ========= TOTAIS ===========

// Pagamentos lançados nesta OS: { valor, forma, data: "AAAA-MM-DD" }
let pagamentos = [];

const totalPago = () => centavos(pagamentos.reduce((soma, p) => soma + p.valor, 0));
const saldoAReceber = () => Math.max(centavos(editorItens.total() - totalPago()), 0);

// Pago e saldo a receber (o main recalcula ao salvar; aqui é só para exibir)
function atualizarSaldo() {
    const quitada = editorItens.total() > 0 && saldoAReceber() === 0;
    document.getElementById("resumoPago").textContent = moeda(totalPago());
    document.getElementById("resumoSaldo").textContent = moeda(saldoAReceber());
    document.getElementById("valorTotalPagamentos").textContent = moeda(editorItens.total());
    textoSaldo.className = quitada ? "badge badge-sucesso" : totalPago() > 0 ? "badge badge-aviso" : "badge";
    textoSaldo.textContent = quitada ? "Quitada" : totalPago() > 0 ? "Pagamento parcial" : "Sem pagamento";
}
editorItens.aoMudar = atualizarSaldo;

// ============================
// ======= PAGAMENTOS =========

function renderPagamentos() {
    tabelaPagamentos.innerHTML = "";
    pagamentos.forEach((p, indice) => {
        const linha = document.createElement("tr");
        [
            [formatarData(`${p.data}T12:00:00`), "numero"],
            [p.forma.charAt(0).toUpperCase() + p.forma.slice(1), ""],
            [moeda(p.valor), "num font-semibold"],
        ].forEach(([texto, classe]) => {
            const td = document.createElement("td");
            td.className = classe;
            td.textContent = texto;
            linha.appendChild(td);
        });
        const td = document.createElement("td");
        td.className = "w-[44px]";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Remover pagamento";
        btn.innerHTML = icone("lixeira", 16);
        btn.className = "btn btn-fantasma btn-icone";
        btn.addEventListener("click", () => {
            pagamentos.splice(indice, 1);
            renderPagamentos();
        });
        td.appendChild(btn);
        linha.appendChild(td);
        tabelaPagamentos.appendChild(linha);
    });
    semPagamentos.hidden = pagamentos.length > 0;
    atualizarSaldo();
}

// Ao escolher a forma de pagamento com o valor vazio, sugere o saldo
inputFormaPagamento.addEventListener("change", () => {
    if (!inputValorPagamento.value && saldoAReceber() > 0) {
        inputValorPagamento.value = saldoAReceber();
    }
});

btnAddPagamento.addEventListener("click", () => {
    const valor = centavos(Number(inputValorPagamento.value));
    if (!(valor > 0)) return api.warn("Informe o valor recebido.");
    if (!inputFormaPagamento.value) return api.warn("Selecione a forma de pagamento.");
    if (!inputDataPagamento.value) return api.warn("Informe a data do pagamento.");
    if (valor > saldoAReceber()) {
        return api.warn(`O valor passa do saldo a receber (${moeda(saldoAReceber())}).`);
    }
    pagamentos.push({ valor, forma: inputFormaPagamento.value, data: inputDataPagamento.value });
    inputValorPagamento.value = "";
    inputFormaPagamento.value = "";
    renderPagamentos();
});

renderPagamentos();

// ============================
// ========= CLIENTE ==========

// Ao escolher o cliente, lista as OS dele
aoSelecionarCliente = (c) => api.searchOrder({ clienteId: c._id });

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
        mostrarLista(
            "OS do cliente",
            ordens.map((o) => ({
                titulo: `OS nº ${o.numero}`,
                detalhe: `Prazo ${formatarData(o.prazoFinal)} · ${moeda(o.valorTotal)}`,
                etiqueta: o.status,
                aoClicar: () => carregarOS(o),
            })),
            "Nenhuma OS para este cliente. Preencha o formulário para criar a primeira."
        );
    }
});

// Preenche o formulário com uma OS existente
function carregarOS(o) {
    inputIdOS.value = o._id;
    numeroOS.textContent = `nº ${o.numero}`;
    mostrarCliente(o.cliente);

    inputStatus.value = o.status;
    inputPrazo.value = dataParaInput(o.prazoFinal);
    inputArteOrigem.value = (o.arte && o.arte.origem) || "cliente";
    inputArteAprovada.checked = !!(o.arte && o.arte.aprovada);
    inputObs.value = o.observacoes || "";

    editorItens.definir(o.produtos);
    pagamentos = (o.pagamentos || []).map((p) => ({ valor: p.valor, forma: p.forma, data: dataParaInput(p.data) }));
    renderPagamentos();

    btnCreate.disabled = true;
    btnUpdate.disabled = false;
    btnDelete.disabled = false;
    btnPrint.disabled = false;
}

// ============================
// ===== CREATE / UPDATE ======

frmOS.addEventListener("submit", (event) => {
    event.preventDefault();

    if (inputIdClient.value === "") {
        return api.warn("Selecione o cliente usando a busca acima.");
    }
    if (editorItens.itens.length === 0) {
        return api.warn("Adicione pelo menos 1 item à OS.");
    }

    const order = {
        cliente: inputIdClient.value,
        produtos: editorItens.paraEnvio(),
        prazoFinal: inputPrazo.value,
        status: inputStatus.value,
        observacoes: inputObs.value.trim(),
        arte: {
            origem: inputArteOrigem.value,
            aprovada: inputArteAprovada.checked,
        },
        pagamentos,
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
// ======== IMPRESSÃO =========

// Gera o PDF da OS como está salva no banco (alterações não salvas não entram)
function printOrder() {
    api.printOrder(inputIdOS.value);
}

// ============================
// ===== EVENTOS DA TELA ======
// (antes eram onclick no HTML)
btnDelete.addEventListener("click", removeOrder);
btnPrint.addEventListener("click", printOrder);
btnReset.addEventListener("click", resetForm);

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
const inputSinal = document.getElementById("inputSinal");
const inputFormaPagamento = document.getElementById("inputFormaPagamento");
const inputPago = document.getElementById("inputPago");
const inputObs = document.getElementById("inputObs");

document.addEventListener("DOMContentLoaded", () => {
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    btnPrint.disabled = true;
    btnCreate.disabled = false;
    searchClient.focus();
});

// ============================
// ========= TOTAIS ===========

// Sinal e saldo a receber (o main recalcula ao salvar; aqui é só para exibir)
function atualizarSaldo() {
    const sinal = Number(inputSinal.value) || 0;
    const saldo = inputPago.checked ? 0 : Math.max(centavos(editorItens.total() - sinal), 0);
    textoSaldo.textContent = `Sinal ${moeda(sinal)} · Saldo a receber ${moeda(saldo)}`;
}
editorItens.aoMudar = atualizarSaldo;
inputSinal.addEventListener("input", atualizarSaldo);
inputPago.addEventListener("change", atualizarSaldo);
atualizarSaldo();

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
    inputSinal.value = (o.pagamento && o.pagamento.sinal) || "";
    inputFormaPagamento.value = (o.pagamento && o.pagamento.formaPagamento) || "";
    inputPago.checked = !!(o.pagamento && o.pagamento.pago);
    inputObs.value = o.observacoes || "";

    editorItens.definir(o.produtos);

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
// ======== IMPRESSÃO =========

// Gera o PDF da OS como está salva no banco (alterações não salvas não entram)
function printOrder() {
    api.printOrder(inputIdOS.value);
}

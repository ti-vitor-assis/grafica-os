/**
 * Tela de Orçamentos
 * Busca de cliente, lista lateral e itens ficam em documentoComercial.js
 * @Author Vitor de Assis Passos
 */

// Referências dos elementos
const frmSearchQuote = document.getElementById("frmSearchQuote");
const searchQuote = document.getElementById("searchQuoteInput");
const frmQuote = document.getElementById("frmQuote");
const numeroQuote = document.getElementById("numeroQuote");
const etiquetaStatus = document.getElementById("etiquetaStatus");
const inputIdQuote = document.getElementById("inputIdQuote");
const textoSituacao = document.getElementById("textoSituacao");
const inputValidade = document.getElementById("inputValidade");
const inputPrazoProducao = document.getElementById("inputPrazoProducao");
const inputObs = document.getElementById("inputObs");

// Validade padrão de um orçamento novo
const DIAS_VALIDADE_PADRAO = 15;

document.addEventListener("DOMContentLoaded", () => {
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    btnRefuse.disabled = true;
    btnConvert.disabled = true;
    btnCreate.disabled = false;

    const validade = new Date();
    validade.setDate(validade.getDate() + DIAS_VALIDADE_PADRAO);
    inputValidade.value = dataParaInput(validade);
    textoSituacao.textContent = `Validade padrão: ${DIAS_VALIDADE_PADRAO} dias`;

    searchClient.focus();
});

// Situação mostrada na etiqueta ("vencido" é calculado pelo main)
const situacao = (q) => (q.vencido ? "vencido" : q.status);

// ============================
// ========= CLIENTE ==========

// Ao escolher o cliente, lista os orçamentos dele
aoSelecionarCliente = (c) => api.searchQuote({ clienteId: c._id });

// ============================
// ==== BUSCA DE ORÇAMENTO ====

frmSearchQuote.addEventListener("submit", (event) => {
    event.preventDefault();
    aguardandoReset = false;
    const numero = Number(searchQuote.value);
    if (!Number.isInteger(numero) || numero < 1) {
        return api.warn("Digite o número do orçamento.");
    }
    api.searchQuote({ numero });
});

api.receiveQuote((event, dados) => {
    const { modo, orcamentos } = JSON.parse(dados);
    if (modo === "numero") {
        carregarOrcamento(orcamentos[0]);
        searchQuote.value = "";
    } else {
        mostrarLista(
            "Orçamentos do cliente",
            orcamentos.map((q) => ({
                titulo: `Orçamento nº ${q.numero}`,
                detalhe: `Válido até ${formatarData(q.validade)} · ${moeda(q.valorTotal)}`,
                etiqueta: situacao(q),
                aoClicar: () => carregarOrcamento(q),
            })),
            "Nenhum orçamento para este cliente. Preencha o formulário para criar o primeiro."
        );
    }
});

// Preenche o formulário com um orçamento existente
function carregarOrcamento(q) {
    inputIdQuote.value = q._id;
    numeroQuote.textContent = `nº ${q.numero}`;
    mostrarCliente(q.cliente);
    inputValidade.value = dataParaInput(q.validade);
    inputPrazoProducao.value = q.prazoProducaoDias;
    inputObs.value = q.observacoes || "";
    editorItens.definir(q.produtos);

    const s = situacao(q);
    etiquetaStatus.hidden = false;
    etiquetaStatus.textContent = s;
    etiquetaStatus.className = `${corStatus[s]} text-white text-sm rounded-full px-3 py-1`;

    const textos = {
        pendente: `Aguardando resposta do cliente até ${formatarData(q.validade)}`,
        vencido: "Validade vencida: atualize a data e salve para reenviar",
        aprovado: q.osGerada ? `Aprovado: virou a OS nº ${q.osGerada.numero}` : "Aprovado",
        recusado: "Recusado pelo cliente",
    };
    textoSituacao.textContent = textos[s];

    // Só orçamento pendente (vencido ou não) pode ser editado, aprovado ou recusado
    const aberto = q.status === "pendente";
    btnCreate.disabled = true;
    btnUpdate.disabled = !aberto;
    btnConvert.disabled = !aberto;
    btnRefuse.disabled = !aberto;
    btnDelete.disabled = !!q.osGerada;
}

// ============================
// ===== CREATE / UPDATE ======

frmQuote.addEventListener("submit", (event) => {
    event.preventDefault();

    if (inputIdClient.value === "") {
        return api.warn("Selecione o cliente usando a busca acima.");
    }
    if (editorItens.itens.length === 0) {
        return api.warn("Adicione pelo menos 1 item ao orçamento.");
    }

    const orcamento = {
        cliente: inputIdClient.value,
        produtos: editorItens.paraEnvio(),
        validade: inputValidade.value,
        prazoProducaoDias: inputPrazoProducao.value,
        observacoes: inputObs.value.trim(),
    };

    aguardandoReset = true;
    if (inputIdQuote.value === "") {
        api.createQuote(orcamento);
    } else {
        orcamento._id = inputIdQuote.value;
        api.updateQuote(orcamento);
    }
});

// ============================
// == APROVAR / RECUSAR / EXCLUIR

// Aprovação usa o orçamento como está salvo: salve as alterações antes
function convertQuote() {
    aguardandoReset = true;
    api.convertQuote(inputIdQuote.value);
}

function refuseQuote() {
    aguardandoReset = true;
    api.refuseQuote(inputIdQuote.value);
}

function removeQuote() {
    aguardandoReset = true;
    api.deleteQuote(inputIdQuote.value);
}

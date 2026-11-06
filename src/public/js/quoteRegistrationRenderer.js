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
    btnRefuse.disabled = true;
    btnConvert.disabled = true;
    btnDuplicate.disabled = true;
    btnPrint.disabled = true;
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
// CPF/CNPJ: orçamentos do cliente atual e da cópia gravada em cada orçamento
buscarPorDocumento = (termo) => api.searchQuote({ documento: termo });

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
    const { modo, orcamentos, cliente } = JSON.parse(dados);
    if (modo === "numero") {
        carregarOrcamento(orcamentos[0]);
        searchQuote.value = "";
    } else {
        // Busca por CPF/CNPJ: já deixa o cliente escolhido (se ainda existir)
        if (modo === "documento") {
            searchClient.value = "";
            if (cliente) mostrarCliente(cliente);
        }
        mostrarLista(
            modo === "documento" ? "Orçamentos deste CPF/CNPJ" : "Orçamentos do cliente",
            orcamentos.map((q) => ({
                titulo: `Orçamento nº ${q.numero}`,
                detalhe: [`Válido até ${formatarData(q.validade)}`, moeda(q.valorTotal), nomeDaEpoca(q)].filter(Boolean).join(" · "),
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
    mostrarCliente(q.cliente, q.clienteHistorico);
    inputValidade.value = dataParaInput(q.validade);
    inputPrazoProducao.value = q.prazoProducaoDias;
    inputObs.value = q.observacoes || "";
    editorItens.definir(q.produtos);

    const s = situacao(q);
    etiquetaStatus.hidden = false;
    etiquetaStatus.textContent = s;
    etiquetaStatus.className = classeStatus(s);

    const geradas = (q.osGeradas || []).filter((o) => o && o.numero);
    const textos = {
        pendente: `Aguardando resposta do cliente até ${formatarData(q.validade)}`,
        vencido: "Validade vencida: dá para aprovar assim mesmo (o sistema compara os preços de hoje)",
        aprovado: geradas.length > 1 ? `Aprovado: gerou ${geradas.length} OS (pedido repetido)` : "Aprovado: gerou a OS abaixo",
        recusado: "Recusado pelo cliente. Se ele mudar de ideia, dá para gerar a OS mesmo assim",
    };
    textoSituacao.textContent = textos[s];
    mostrarOSGeradas(geradas);

    // Só o pendente pode ser editado ou recusado; qualquer um pode virar OS
    const aberto = q.status === "pendente";
    const rotulos = {
        aprovado: "Gerar nova OS (pedido repetido)",
        recusado: "Cliente aceitou: gerar OS",
    };
    rotuloConvert.textContent = rotulos[q.status] || "Aprovado: gerar OS";
    btnCreate.disabled = true;
    btnUpdate.disabled = !aberto;
    btnConvert.disabled = false;
    btnRefuse.disabled = !aberto;
    btnDuplicate.disabled = false;
    btnPrint.disabled = false;
}

// OS geradas pelo orçamento: cada uma abre a tela da OS
function mostrarOSGeradas(geradas) {
    const caixa = document.getElementById("osGeradas");
    caixa.innerHTML = "";
    caixa.hidden = geradas.length === 0;
    geradas.forEach((o) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = classeStatus(o.status) + " cursor-pointer";
        botao.title = "Abrir esta OS";
        botao.textContent = `OS nº ${o.numero} · ${o.status}`;
        botao.addEventListener("click", () => api.openOrder(o.numero));
        caixa.appendChild(botao);
    });
}

// ============================
// ======== DUPLICAR ==========
// Novo orçamento (ainda não salvo) com o mesmo cliente e itens, com os
// preços de hoje; produto inativo mantém o preço antigo.
function duplicarOrcamento() {
    const numeroOriginal = numeroQuote.textContent.replace("nº ", "");
    let inativos = 0;
    let mudaram = 0;
    editorItens.definir(editorItens.itens.map((i) => {
        const atual = editorItens.produtos.find((p) => p._id === i.produto);
        if (!atual) {
            inativos++;
            return i;
        }
        if (centavos(atual.valorUnitario) !== centavos(i.valorUnitario)) mudaram++;
        return { ...i, valorUnitario: Number(atual.valorUnitario) };
    }));

    inputIdQuote.value = "";
    numeroQuote.textContent = "(novo)";
    etiquetaStatus.hidden = true;
    mostrarOSGeradas([]);
    const validade = new Date();
    validade.setDate(validade.getDate() + DIAS_VALIDADE_PADRAO);
    inputValidade.value = dataParaInput(validade);
    textoSituacao.textContent = [
        `Cópia do orçamento nº ${numeroOriginal}, ainda não salva.`,
        mudaram ? `${mudaram} preço(s) atualizado(s) para os de hoje.` : "Preços iguais aos de hoje.",
        inativos ? `${inativos} item(ns) de produto inativo mantêm o preço antigo.` : "",
        "Confira e clique em Criar orçamento.",
    ].filter(Boolean).join(" ");

    btnCreate.disabled = false;
    btnUpdate.disabled = true;
    btnConvert.disabled = true;
    btnRefuse.disabled = true;
    btnDuplicate.disabled = true;
    btnPrint.disabled = true;
    listaResultados.querySelectorAll(".lista-item").forEach((x) => x.classList.remove("ativo"));
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
// == APROVAR / RECUSAR ======

// Gera o PDF do orçamento como está salvo no banco
function printQuote() {
    api.printQuote(inputIdQuote.value);
}

// Aprovação usa o orçamento como está salvo: salve as alterações antes
function convertQuote() {
    aguardandoReset = true;
    api.convertQuote(inputIdQuote.value);
}

function refuseQuote() {
    aguardandoReset = true;
    api.refuseQuote(inputIdQuote.value);
}

// ============================
// ===== EVENTOS DA TELA ======
// (antes eram onclick no HTML)
btnRefuse.addEventListener("click", refuseQuote);
btnConvert.addEventListener("click", convertQuote);
btnDuplicate.addEventListener("click", duplicarOrcamento);
btnPrint.addEventListener("click", printQuote);
btnReset.addEventListener("click", resetForm);

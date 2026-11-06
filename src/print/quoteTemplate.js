/**
 * Modelo de impressão do Orçamento (HTML que vira PDF), para enviar ao cliente
 */

const { escapeHtml, moeda, data, capitalizar } = require("./formatar.js");
const { cabecalho, blocoCliente, blocoItens, documento } = require("./blocos.js");

// q: orçamento com o cliente já populado; vencido: calculado pelo modelo
function htmlOrcamento(q, vencido) {
    const situacao = vencido ? "Vencido" : capitalizar(q.status);

    return documento(`Orçamento nº ${q.numero}`, `
    ${cabecalho("Orçamento", q.numero)}

    <div class="grade">
        <div class="campo"><span>Data</span><b>${data(q.dataCriacao)}</b></div>
        <div class="campo"><span>Válido até</span><b>${data(q.validade)}</b></div>
        <div class="campo"><span>Prazo de produção</span><b>${q.prazoProducaoDias} dias após aprovação</b></div>
        <div class="campo"><span>Situação</span><b>${escapeHtml(situacao)}</b></div>
    </div>

    ${blocoCliente(q.cliente)}

    ${blocoItens(q.produtos, [["Total", moeda(q.valorTotal), true]])}

    <h2>Observações</h2>
    <div class="obs">${escapeHtml(q.observacoes || "")}</div>

    <p class="nota">
        Preços válidos até ${data(q.validade)}. Para aprovar, responda este orçamento ou entre em
        contato. O prazo de produção começa a contar a partir da aprovação.
    </p>

    <div class="assinaturas">
        <div>De acordo (cliente)</div>
        <div>Responsável pela gráfica</div>
    </div>`);
}

module.exports = { htmlOrcamento };

/**
 * Modelo de impressão da Ordem de Serviço (HTML que vira PDF)
 */

const { escapeHtml, moeda, data, dataHora, capitalizar } = require("./formatar.js");
const { cabecalho, blocoCliente, blocoItens, documento } = require("./blocos.js");

// os: documento da OS com o cliente já populado (populate("cliente"))
function htmlOS(os) {
    const sinal = (os.pagamento && os.pagamento.sinal) || 0;
    const pago = !!(os.pagamento && os.pagamento.pago);
    const saldo = pago ? 0 : Math.max(os.valorTotal - sinal, 0);

    const arte = os.arte || {};
    const textoArte = `${arte.origem === "gráfica" ? "Criada pela gráfica" : "Enviada pelo cliente"} · ` +
        (arte.aprovada ? `Aprovada em ${dataHora(arte.dataAprovacao)}` : "Aguardando aprovação");

    return documento(`OS nº ${os.numero}`, `
    ${cabecalho("Ordem de Serviço", os.numero)}

    <div class="grade">
        <div class="campo"><span>Abertura</span><b>${data(os.dataCriacao)}</b></div>
        <div class="campo"><span>Prazo de entrega</span><b>${data(os.prazoFinal)}</b></div>
        <div class="campo"><span>Status</span><b>${escapeHtml(capitalizar(os.status))}</b></div>
        <div class="campo"><span>Entregue em</span><b>${data(os.dataEntregaReal)}</b></div>
    </div>

    ${blocoCliente(os.cliente)}

    ${blocoItens(os.produtos, [
        ["Sinal", moeda(sinal)],
        ["Saldo a receber", moeda(saldo)],
        ["Total", moeda(os.valorTotal), true],
    ])}

    <h2>Arte e pagamento</h2>
    <div class="grade">
        <div class="campo largo"><span>Arte</span><b>${escapeHtml(textoArte)}</b></div>
        <div class="campo"><span>Forma de pagamento</span><b>${escapeHtml(capitalizar(os.pagamento && os.pagamento.formaPagamento) || "—")}</b></div>
        <div class="campo"><span>Situação</span><b>${pago ? "Quitado" : "Em aberto"}</b></div>
    </div>

    <h2>Observações</h2>
    <div class="obs">${escapeHtml(os.observacoes || "")}</div>

    <div class="assinaturas">
        <div>Assinatura do cliente</div>
        <div>Responsável pela gráfica</div>
    </div>`);
}

module.exports = { htmlOS };

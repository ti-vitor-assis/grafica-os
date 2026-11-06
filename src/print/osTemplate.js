/**
 * Modelo de impressão da Ordem de Serviço (HTML que vira PDF)
 */

const { escapeHtml, moeda, data, dataHora, capitalizar } = require("./formatar.js");
const { cabecalho, blocoCliente, blocoItens, documento } = require("./blocos.js");

// os: documento da OS com o cliente já populado (populate("cliente"))
function htmlOS(os) {
    const valorPago = os.valorPago || 0;
    const saldo = Math.max(os.valorTotal - valorPago, 0);
    const pagamentos = os.pagamentos || [];
    const linhasPagamentos = pagamentos.length
        ? pagamentos.map((p) => `
            <tr><td>${data(p.data)}</td><td>${escapeHtml(capitalizar(p.forma))}</td><td class="num">${moeda(p.valor)}</td></tr>`).join("")
        : `<tr><td colspan="3" style="color:#9ca3af">Nenhum pagamento registrado.</td></tr>`;

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
        ["Pago", moeda(valorPago)],
        ["Saldo a receber", moeda(saldo)],
        ["Total", moeda(os.valorTotal), true],
    ])}

    <h2>Arte</h2>
    <div class="grade">
        <div class="campo inteiro"><b>${escapeHtml(textoArte)}</b></div>
    </div>

    <h2>Pagamentos · ${os.pago ? "Quitada" : "Em aberto"}</h2>
    <table>
        <thead><tr><th>Data</th><th>Forma</th><th class="num">Valor</th></tr></thead>
        <tbody>${linhasPagamentos}</tbody>
    </table>

    <h2>Observações</h2>
    <div class="obs">${escapeHtml(os.observacoes || "")}</div>

    <div class="assinaturas">
        <div>Assinatura do cliente</div>
        <div>Responsável pela gráfica</div>
    </div>`);
}

module.exports = { htmlOS };

/**
 * Modelo de impressão da Ordem de Serviço (HTML que vira PDF)
 */

const { escapeHtml, moeda, data, dataHora, capitalizar } = require("./formatar.js");

// os: documento da OS com o cliente já populado (populate("cliente"))
function htmlOS(os) {
    const c = os.cliente || {};
    const sinal = (os.pagamento && os.pagamento.sinal) || 0;
    const pago = !!(os.pagamento && os.pagamento.pago);
    const saldo = pago ? 0 : Math.max(os.valorTotal - sinal, 0);
    const numero = String(os.numero).padStart(4, "0");

    const endereco = [
        c.endereco && `${c.endereco}, ${c.numero || "s/n"}`,
        c.complemento,
        c.bairro,
        c.cidade && `${c.cidade}${c.estado ? "/" + c.estado : ""}`,
        c.cep && `CEP ${c.cep}`,
    ].filter(Boolean).join(" · ");

    const linhasItens = os.produtos.map((i) => `
        <tr>
            <td>${escapeHtml(i.descricao)}</td>
            <td class="num">${i.quantidade}</td>
            <td class="num">${moeda(i.valorUnitario)}</td>
            <td class="num">${moeda(i.subtotal)}</td>
        </tr>`).join("");

    const arte = os.arte || {};
    const textoArte = `${arte.origem === "gráfica" ? "Criada pela gráfica" : "Enviada pelo cliente"} · ` +
        (arte.aprovada ? `Aprovada em ${dataHora(arte.dataAprovacao)}` : "Aguardando aprovação");

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>OS nº ${numero}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 12px; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end;
             border-bottom: 3px solid #7C3AED; padding-bottom: 8px; margin-bottom: 14px; }
    header h1 { margin: 0; font-size: 20px; color: #7C3AED; }
    header .numero { font-size: 22px; font-weight: bold; }
    header .sub { color: #6b7280; }
    .grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; margin-bottom: 14px; }
    .campo span { display: block; font-size: 10px; text-transform: uppercase; color: #6b7280; }
    .campo b { font-size: 13px; }
    .largo { grid-column: span 2; }
    .inteiro { grid-column: span 4; }
    h2 { font-size: 13px; text-transform: uppercase; color: #7C3AED; margin: 16px 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #6b7280;
         border-bottom: 1px solid #d1d5db; padding: 4px 6px; }
    td { border-bottom: 1px solid #e5e7eb; padding: 6px; }
    .num { text-align: right; white-space: nowrap; }
    .totais { margin-left: auto; width: 260px; margin-top: 8px; }
    .totais div { display: flex; justify-content: space-between; padding: 3px 6px; }
    .totais .total { font-size: 15px; font-weight: bold; border-top: 2px solid #1f2937; }
    .obs { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; min-height: 50px; white-space: pre-wrap; }
    .assinaturas { display: flex; gap: 40px; margin-top: 60px; }
    .assinaturas div { flex: 1; border-top: 1px solid #1f2937; text-align: center; padding-top: 4px; color: #6b7280; }
    footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
    <header>
        <div>
            <h1>Ordem de Serviço</h1>
            <div class="sub">Emitida em ${dataHora(new Date())}</div>
        </div>
        <div class="numero">Nº ${numero}</div>
    </header>

    <div class="grade">
        <div class="campo"><span>Abertura</span><b>${data(os.dataCriacao)}</b></div>
        <div class="campo"><span>Prazo de entrega</span><b>${data(os.prazoFinal)}</b></div>
        <div class="campo"><span>Status</span><b>${escapeHtml(capitalizar(os.status))}</b></div>
        <div class="campo"><span>Entregue em</span><b>${data(os.dataEntregaReal)}</b></div>
    </div>

    <h2>Cliente</h2>
    <div class="grade">
        <div class="campo largo"><span>Nome</span><b>${escapeHtml(c.nome || "(cliente excluído)")}</b></div>
        <div class="campo"><span>CPF</span><b>${escapeHtml(c.cpf || "—")}</b></div>
        <div class="campo"><span>Celular</span><b>${escapeHtml(c.telefone || "—")}</b></div>
        <div class="campo largo"><span>E-mail</span><b>${escapeHtml(c.email || "—")}</b></div>
        <div class="campo largo"><span>Telefone</span><b>${escapeHtml(c.telefone2 || "—")}</b></div>
        <div class="campo inteiro"><span>Endereço</span><b>${escapeHtml(endereco || "—")}</b></div>
    </div>

    <h2>Itens</h2>
    <table>
        <thead><tr><th>Produto / serviço</th><th class="num">Qtd</th><th class="num">Valor un.</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${linhasItens}</tbody>
    </table>
    <div class="totais">
        <div><span>Sinal</span><span>${moeda(sinal)}</span></div>
        <div><span>Saldo a receber</span><span>${moeda(saldo)}</span></div>
        <div class="total"><span>Total</span><span>${moeda(os.valorTotal)}</span></div>
    </div>

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
    </div>

    <footer>Gráfica OS · documento gerado pelo sistema</footer>
</body>
</html>`;
}

module.exports = { htmlOS };

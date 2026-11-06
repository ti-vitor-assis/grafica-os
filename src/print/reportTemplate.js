/**
 * Modelo genérico de relatório em PDF (tabela + resumo)
 */

const { escapeHtml, dataHora } = require("./formatar.js");

// relatorio = {
//   titulo: "OS entregues",
//   periodo: "01/11/2026 a 30/11/2026" (opcional),
//   resumo: [["Quantidade", "12"], ["Total", "R$ 1.234,00"]],
//   secoes: [{
//     titulo: "Por forma de pagamento" (opcional),
//     colunas: [{ titulo: "Nº", num: true }, { titulo: "Cliente" }],
//     linhas: [["1", "Maria"], ...],   // textos já formatados
//   }]
// }
function htmlRelatorio(relatorio) {
    const resumo = (relatorio.resumo || [])
        .map(([rotulo, valor]) => `
            <div class="card"><span>${escapeHtml(rotulo)}</span><b>${escapeHtml(valor)}</b></div>`)
        .join("");

    const secoes = relatorio.secoes
        .map((secao) => {
            const cabecalho = secao.colunas
                .map((c) => `<th class="${c.num ? "num" : ""}">${escapeHtml(c.titulo)}</th>`)
                .join("");
            const corpo = secao.linhas.length
                ? secao.linhas
                      .map((linha) => `<tr>${linha
                          .map((valor, i) => `<td class="${secao.colunas[i].num ? "num" : ""}">${escapeHtml(valor)}</td>`)
                          .join("")}</tr>`)
                      .join("")
                : `<tr><td class="vazio" colspan="${secao.colunas.length}">Nenhum registro encontrado.</td></tr>`;
            return `
                ${secao.titulo ? `<h2>${escapeHtml(secao.titulo)}</h2>` : ""}
                <table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`;
        })
        .join("");

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(relatorio.titulo)}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 11px; margin: 0; }
    header { border-bottom: 3px solid #7C3AED; padding-bottom: 8px; margin-bottom: 14px;
             display: flex; justify-content: space-between; align-items: flex-end; }
    header h1 { margin: 0; font-size: 20px; color: #7C3AED; }
    header .sub { color: #6b7280; margin-top: 2px; }
    .resumo { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
    .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; min-width: 130px; }
    .card span { display: block; font-size: 9px; text-transform: uppercase; color: #6b7280; }
    .card b { font-size: 15px; }
    h2 { font-size: 12px; text-transform: uppercase; color: #7C3AED; margin: 16px 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; } /* repete o cabeçalho em cada página */
    tr { page-break-inside: avoid; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; color: #6b7280;
         border-bottom: 1px solid #d1d5db; padding: 4px 6px; }
    td { border-bottom: 1px solid #f0f0f0; padding: 5px 6px; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .num { text-align: right; white-space: nowrap; }
    .vazio { text-align: center; color: #9ca3af; padding: 16px; }
    footer { margin-top: 18px; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
    <header>
        <div>
            <h1>${escapeHtml(relatorio.titulo)}</h1>
            ${relatorio.periodo ? `<div class="sub">Período: ${escapeHtml(relatorio.periodo)}</div>` : ""}
        </div>
        <div class="sub">Emitido em ${dataHora(new Date())}</div>
    </header>
    ${resumo ? `<div class="resumo">${resumo}</div>` : ""}
    ${secoes}
    <footer>Gráfica OS · relatório gerado pelo sistema</footer>
</body>
</html>`;
}

module.exports = { htmlRelatorio };

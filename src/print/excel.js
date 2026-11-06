/**
 * Planilhas Excel (.xlsx): relatórios e a exportação completa dos dados.
 *
 * abas = [{ nome, colunas: [{ titulo, tipo, largura }], linhas: [[...]] }]
 *   tipo: "texto" (padrão) | "numero" | "moeda" | "data"
 */

const ExcelJS = require("exceljs");

const FORMATOS = {
    moeda: '"R$" #,##0.00',
    numero: "#,##0.##",
    data: "dd/mm/yyyy",
};

// Nome de aba: até 31 caracteres, sem : \ / ? * [ ] e sem repetir
function nomeDeAba(nome, usados) {
    let base = String(nome || "Dados").replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Dados";
    let final = base;
    for (let n = 2; usados.has(final.toLowerCase()); n++) final = `${base.slice(0, 27)} (${n})`;
    usados.add(final.toLowerCase());
    return final;
}

async function gerarPlanilha(abas, { titulo } = {}) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Gráfica OS";
    wb.created = new Date();
    if (titulo) wb.title = titulo;
    const usados = new Set();

    for (const aba of abas) {
        const ws = wb.addWorksheet(nomeDeAba(aba.nome, usados), { views: [{ state: "frozen", ySplit: 1 }] });
        ws.columns = aba.colunas.map((c) => ({
            header: c.titulo,
            width: c.largura || Math.min(45, Math.max(10, c.titulo.length + 4)),
            style: FORMATOS[c.tipo] ? { numFmt: FORMATOS[c.tipo] } : {},
        }));
        const cabecalho = ws.getRow(1);
        cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
        aba.linhas.forEach((linha) => ws.addRow(linha.map((v) => (v === undefined ? null : v))));
        if (aba.linhas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } };
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}

// "R$ 1.234,56" / "1.234,5" / "12" -> número; o que não for número fica texto
function paraNumero(texto) {
    if (typeof texto === "number") return texto;
    const limpo = String(texto).replace(/ /g, " ").replace(/^R\$\s*/, "").trim();
    if (!/^-?[\d.]+(,\d+)?$/.test(limpo)) return null;
    const n = Number(limpo.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

// Relatório (o mesmo objeto que vira PDF) -> planilha: uma aba de resumo e
// uma por seção. Colunas numéricas viram números de verdade no Excel.
function abasDoRelatorio(relatorio) {
    const abas = [];
    if (relatorio.resumo && relatorio.resumo.length) {
        abas.push({
            nome: "Resumo",
            colunas: [{ titulo: "Item", largura: 30 }, { titulo: "Valor", largura: 24 }],
            linhas: [
                ["Relatório", relatorio.titulo],
                ...(relatorio.periodo ? [["Período", relatorio.periodo]] : []),
                ...relatorio.resumo,
            ],
        });
    }
    relatorio.secoes.forEach((secao, i) => {
        const moedaNaColuna = secao.colunas.map((c, j) => c.num && secao.linhas.some((l) => /R\$/.test(String(l[j]))));
        abas.push({
            nome: secao.titulo || (relatorio.secoes.length > 1 ? `Parte ${i + 1}` : relatorio.titulo),
            colunas: secao.colunas.map((c, j) => ({
                titulo: c.titulo,
                tipo: moedaNaColuna[j] ? "moeda" : c.num ? "numero" : "texto",
                largura: c.num ? 16 : Math.min(45, Math.max(14, ...secao.linhas.map((l) => String(l[j] || "").length + 2))),
            })),
            linhas: secao.linhas.map((l) => l.map((v, j) => (secao.colunas[j].num ? paraNumero(v) ?? v : v))),
        });
    });
    return abas;
}

const planilhaDoRelatorio = (relatorio) => gerarPlanilha(abasDoRelatorio(relatorio), { titulo: relatorio.titulo });

module.exports = { gerarPlanilha, planilhaDoRelatorio, abasDoRelatorio, paraNumero };

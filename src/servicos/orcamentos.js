/**
 * Orçamento -> OS: o que perguntar e com que preços gerar a OS.
 *
 * Qualquer orçamento pode virar OS, mesmo antigo:
 *  - pendente (dentro da validade): aprova com os preços do orçamento
 *  - pendente vencido: aprova; se os preços mudaram, pergunta quais usar
 *  - recusado: o cliente mudou de ideia; reabre e aprova (pergunta os preços)
 *  - aprovado: pedido repetido; gera mais uma OS (pergunta os preços)
 */

const centavos = (valor) => Math.round(valor * 100) / 100;

// Modo da conversão conforme a situação do orçamento
function modoConversao(orcamento, vencido) {
    if (orcamento.status === "aprovado") return "repetir";
    if (orcamento.status === "recusado") return "reabrir";
    return vencido ? "aprovar-vencido" : "aprovar";
}

// Só o orçamento pendente e dentro da validade garante o preço combinado
const perguntaPrecos = (modo) => modo !== "aprovar";

// Compara os preços do orçamento com os de hoje.
// produtosAtuais: [{ _id, valorUnitario, ativo }]
function compararPrecos(itens, produtosAtuais) {
    const porId = new Map(produtosAtuais.map((p) => [String(p._id), p]));
    const linhas = itens.map((i) => {
        const p = porId.get(String(i.produto));
        const ativo = !!p && p.ativo !== false;
        const precoAtual = ativo ? Number(p.valorUnitario) : null;
        let situacao = "igual";
        if (!ativo) situacao = "inativo";
        else if (centavos(precoAtual) !== centavos(i.valorUnitario)) situacao = "mudou";
        return {
            produto: i.produto,
            descricao: i.descricao,
            quantidade: i.quantidade,
            precoOrcamento: i.valorUnitario,
            precoAtual,
            situacao,
        };
    });
    const total = (usarAtuais) =>
        centavos(linhas.reduce((soma, l) => soma + centavos(l.quantidade * precoEscolhido(l, usarAtuais)), 0));
    return {
        linhas,
        totalOrcamento: total(false),
        totalAtual: total(true),
        mudou: linhas.some((l) => l.situacao === "mudou"),
        inativos: linhas.filter((l) => l.situacao === "inativo").length,
    };
}

// Produto inativo ou excluído mantém o preço do orçamento
const precoEscolhido = (linha, usarAtuais) =>
    usarAtuais && linha.situacao === "mudou" ? linha.precoAtual : linha.precoOrcamento;

// Itens da nova OS
function itensDaOS(comparacao, usarAtuais) {
    return comparacao.linhas.map((l) => ({
        produto: l.produto,
        descricao: l.descricao,
        quantidade: l.quantidade,
        valorUnitario: precoEscolhido(l, usarAtuais),
    }));
}

// Texto do resumo das diferenças (para a caixa de confirmação)
function resumoPrecos(comparacao, moeda) {
    const linhas = comparacao.linhas
        .filter((l) => l.situacao !== "igual")
        .map((l) =>
            l.situacao === "inativo"
                ? `• ${l.descricao}: produto inativo, mantém ${moeda(l.precoOrcamento)}`
                : `• ${l.descricao}: ${moeda(l.precoOrcamento)} → ${moeda(l.precoAtual)}`
        );
    if (comparacao.mudou) {
        linhas.push("", `Total com os preços do orçamento: ${moeda(comparacao.totalOrcamento)}`);
        linhas.push(`Total com os preços de hoje: ${moeda(comparacao.totalAtual)}`);
    }
    return linhas.join("\n");
}

module.exports = { modoConversao, perguntaPrecos, compararPrecos, itensDaOS, resumoPrecos };

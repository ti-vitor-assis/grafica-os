/**
 * Limpeza de tudo que chega das telas pelo IPC, antes de virar consulta.
 *
 * As telas nunca enviam chaves começando com "$" nem "__proto__". Se alguém
 * alterar uma tela (ex.: pelo DevTools) para mandar { clienteId: { $ne: null } },
 * o operador é removido e a consulta não devolve dados de todos os clientes
 * (NoSQL injection). Chaves de prototype pollution também são removidas.
 */

const CHAVES_PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
const PROFUNDIDADE_MAXIMA = 10;
const TAMANHO_MAXIMO_TEXTO = 20000;

function limparEntrada(valor, profundidade = 0) {
    if (profundidade > PROFUNDIDADE_MAXIMA) return undefined;

    if (typeof valor === "string") {
        return valor.length > TAMANHO_MAXIMO_TEXTO ? valor.slice(0, TAMANHO_MAXIMO_TEXTO) : valor;
    }
    if (Array.isArray(valor)) {
        return valor.map((item) => limparEntrada(item, profundidade + 1));
    }
    if (valor && typeof valor === "object") {
        const limpo = {};
        for (const [chave, item] of Object.entries(valor)) {
            if (chave.startsWith("$") || CHAVES_PROIBIDAS.has(chave)) continue;
            limpo[chave] = limparEntrada(item, profundidade + 1);
        }
        return limpo;
    }
    return valor; // números, booleanos, null e undefined
}

module.exports = { limparEntrada };

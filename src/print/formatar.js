/**
 * Funções de formatação usadas nos documentos impressos (OS e relatórios)
 */

// Todo texto digitado pelo usuário passa por aqui antes de entrar no HTML,
// para que um "<" no nome do cliente não quebre (ou injete algo no) documento
function escapeHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor) => formatoMoeda.format(valor || 0);

// 10/11/2026
const data = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "—");

// 10/11/2026 14:35
const dataHora = (valor) =>
    valor
        ? new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
        : "—";

// Primeira letra maiúscula: "em produção" -> "Em produção"
const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

module.exports = { escapeHtml, moeda, data, dataHora, capitalizar };

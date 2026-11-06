/**
 * Grava ações importantes no registro de auditoria.
 * Nunca atrapalha a ação principal: se o registro falhar, só avisa no console.
 */

const Auditoria = require("../model/Auditoria.js");
const { dataHora } = require("../print/formatar.js");

const limitar = (texto, max = 300) => (texto == null ? "" : String(texto).slice(0, max));

async function registrar(usuario, acao, referencia = "", detalhe = "") {
    try {
        await Auditoria.create({
            usuario: limitar(usuario || "—", 60),
            acao: limitar(acao, 80),
            referencia: limitar(referencia, 80),
            detalhe: limitar(detalhe),
        });
    } catch (erro) {
        console.error("Não foi possível gravar a auditoria:", erro.message);
    }
}

// Relatório (modelo de relatório em PDF) das ações no período
async function relatorio(inicio, fim) {
    const lista = await Auditoria.find({ data: { $gte: inicio, $lte: fim } }).sort({ data: -1 }).limit(5000);
    const porUsuario = new Map();
    lista.forEach((a) => porUsuario.set(a.usuario, (porUsuario.get(a.usuario) || 0) + 1));
    return {
        titulo: "Registro de auditoria",
        resumo: [["Ações", String(lista.length)], ["Usuários", String(porUsuario.size)]],
        secoes: [{
            colunas: [{ titulo: "Data/hora" }, { titulo: "Usuário" }, { titulo: "Ação" }, { titulo: "Referência" }, { titulo: "Detalhe" }],
            linhas: lista.map((a) => [dataHora(a.data), a.usuario, a.acao, a.referencia || "", a.detalhe || ""]),
        }],
    };
}

module.exports = { registrar, relatorio };

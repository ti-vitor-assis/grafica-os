/**
 * Backup completo do banco e restauração (administrador).
 *
 * - O arquivo é cifrado com a chave de segurança do banco: só abre num
 *   computador que tem a mesma chave (guarde também o arquivo de chave!)
 * - A contagem de registros fica visível (só números), para conferir o
 *   backup antes de restaurar
 * - Restaurar substitui TUDO pelo conteúdo do backup; o main grava antes
 *   um backup do estado atual
 */

const mongoose = require("mongoose");
const cripto = require("../seguranca/cripto.js");
const Configuracao = require("../model/Configuracao.js");

const { EJSON } = mongoose.mongo.BSON;
const FORMATO = "grafica-os-backup-completo";
const VERSAO = 1;

// Coleções copiadas (as configurações do banco ficam: chave e migrações)
const COLECOES = [
    ["clientes", () => require("../model/Clientes.js")],
    ["ordens", () => require("../model/ServiceOrder.js")],
    ["orcamentos", () => require("../model/Quote.js")],
    ["produtos", () => require("../model/Products.js")],
    ["insumos", () => require("../model/Insumo.js")],
    ["fornecedores", () => require("../model/Fornecedor.js")],
    ["usuarios", () => require("../model/Usuario.js")],
    ["contadores", () => require("../model/Counter.js")],
    ["auditoria", () => require("../model/Auditoria.js")],
];

// Gera o conteúdo do arquivo de backup (texto JSON)
async function gerarBackup(agora = new Date()) {
    if (!cripto.temChaves()) throw new Error("O backup precisa da chave de segurança deste banco.");
    const dados = {};
    const contagem = {};
    for (const [nome, modelo] of COLECOES) {
        dados[nome] = await modelo().collection.find().toArray();
        contagem[nome] = dados[nome].length;
    }
    const arquivo = {
        formato: FORMATO,
        versao: VERSAO,
        criadoEm: agora.toISOString(),
        impressao: cripto.impressaoChaves(),
        contagem,
        // EJSON guarda os tipos (ObjectId, datas) para a restauração ficar igual
        cifrado: cripto.cifrar(EJSON.stringify(dados, { relaxed: false })),
    };
    await Configuracao.updateOne({ _id: "ultimoBackup" }, { $set: { valor: agora, atualizadoEm: agora } }, { upsert: true });
    return { conteudo: JSON.stringify(arquivo), contagem };
}

// Lê e confere um arquivo de backup. Lança erro com mensagem para o usuário.
function lerBackup(conteudo) {
    let arquivo;
    try {
        arquivo = JSON.parse(conteudo);
    } catch (erro) {
        arquivo = null;
    }
    if (!arquivo || arquivo.formato !== FORMATO) throw new Error("O arquivo escolhido não é um backup do Gráfica OS.");
    if (arquivo.versao > VERSAO) throw new Error("Este backup foi feito por uma versão mais nova do Gráfica OS. Atualize o sistema antes.");
    if (arquivo.impressao !== cripto.impressaoChaves()) {
        throw new Error("Este backup é de outro banco (outra chave de segurança). Importe a chave daquele banco antes de restaurar.");
    }
    let dados;
    try {
        dados = EJSON.parse(cripto.decifrar(arquivo.cifrado), { relaxed: false });
    } catch (erro) {
        throw new Error("O backup está corrompido ou não pôde ser aberto com a chave deste banco.");
    }
    const temAdmin = (dados.usuarios || []).some((u) => u.perfil === "administrador" && u.ativo !== false);
    if (!temAdmin) throw new Error("O backup não tem nenhum administrador ativo; restaurá-lo deixaria o sistema sem acesso.");
    return { criadoEm: new Date(arquivo.criadoEm), contagem: arquivo.contagem || {}, dados };
}

// Substitui o conteúdo das coleções pelo do backup (já lido por lerBackup).
// A auditoria não volta no tempo: os registros atuais ficam e os do backup
// que faltam são acrescentados.
async function restaurar(dados) {
    const resultado = {};
    for (const [nome, modelo] of COLECOES) {
        const colecao = modelo().collection;
        const documentos = dados[nome] || [];
        if (nome === "auditoria") {
            const existentes = new Set((await colecao.find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)));
            const faltando = documentos.filter((d) => !existentes.has(String(d._id)));
            if (faltando.length) await colecao.insertMany(faltando, { ordered: false });
            resultado[nome] = faltando.length;
            continue;
        }
        await colecao.deleteMany({});
        if (documentos.length) await colecao.insertMany(documentos, { ordered: false });
        resultado[nome] = documentos.length;
    }
    return resultado;
}

// Dias desde o último backup (null = nunca fez)
async function diasDesdeUltimoBackup(agora = new Date()) {
    const registro = await Configuracao.findById("ultimoBackup");
    if (!registro || !registro.valor) return null;
    return Math.floor((agora - new Date(registro.valor)) / 864e5);
}

// Nomes legíveis da contagem
const NOMES = {
    clientes: "clientes", ordens: "OS", orcamentos: "orçamentos", produtos: "produtos", insumos: "insumos",
    fornecedores: "fornecedores", usuarios: "usuários", contadores: "contadores", auditoria: "registros de auditoria",
};
const descreverContagem = (contagem) =>
    Object.entries(contagem).filter(([k]) => k !== "contadores").map(([k, v]) => `${v} ${NOMES[k] || k}`).join(", ");

module.exports = { gerarBackup, lerBackup, restaurar, diasDesdeUltimoBackup, descreverContagem };

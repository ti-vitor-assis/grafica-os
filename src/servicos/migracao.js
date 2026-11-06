/**
 * Migrações automáticas do banco (rodam uma vez, ao abrir o app, depois que
 * a chave de segurança está pronta).
 *
 * - Cada etapa tem um nome; as concluídas ficam em configuracoes/"migracoes"
 * - Uma trava em configuracoes/"migracao-trava" evita que dois computadores
 *   migrem ao mesmo tempo (trava de mais de 15 min é considerada abandonada)
 * - Antes de uma etapa que apaga dados, grava um backup do que vai mudar,
 *   cifrado com a chave do banco (o backup tem CPF/CNPJ em texto puro)
 */

const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const cripto = require("../seguranca/cripto.js");
const Configuracao = require("../model/Configuracao.js");
const Clientes = require("../model/Clientes.js");
const ServiceOrder = require("../model/ServiceOrder.js");
const Quote = require("../model/Quote.js");

const TRAVA = "migracao-trava";
const CONCLUIDAS = "migracoes";
const TRAVA_ABANDONADA_MS = 15 * 60 * 1000;

// ===== Etapas =====

// Clientes antigos: CPF em texto puro (campo "cpf"), RG e sexo
async function precisaCifrarClientes() {
    return (await Clientes.collection.countDocuments({ $or: [{ cpf: { $exists: true } }, { rg: { $exists: true } }, { sexo: { $exists: true } }] })) > 0;
}

async function cifrarClientes() {
    const colecao = Clientes.collection;
    // O índice único antigo do CPF impediria tirar o campo de vários clientes
    const indices = await colecao.indexes();
    for (const i of indices) if (i.key && i.key.cpf !== undefined) await colecao.dropIndex(i.name);
    await Clientes.syncIndexes();

    const resultado = { clientes: 0, semDocumento: 0, repetidos: 0 };
    const cursor = colecao.find({ $or: [{ cpf: { $exists: true } }, { rg: { $exists: true } }, { sexo: { $exists: true } }] });
    for await (const c of cursor) {
        const digitos = cripto.soDigitos(c.cpf);
        const $set = {};
        if (digitos) {
            $set.tipoPessoa = digitos.length === 14 ? "PJ" : "PF";
            $set.documentoCifrado = cripto.cifrar(digitos);
            $set.documentoBusca = cripto.indiceBusca(digitos);
        } else {
            resultado.semDocumento++;
        }
        if (c.ativo === undefined) $set.ativo = true;
        try {
            await colecao.updateOne({ _id: c._id }, { $set, $unset: { cpf: "", rg: "", sexo: "" } });
        } catch (erro) {
            if (erro.code !== 11000) throw erro;
            // Mesmo CPF em dois cadastros (ex.: com e sem pontuação): o segundo
            // fica com o documento cifrado, mas fora da busca, para revisão
            delete $set.documentoBusca;
            await colecao.updateOne({ _id: c._id }, { $set, $unset: { cpf: "", rg: "", sexo: "" } });
            resultado.repetidos++;
        }
        resultado.clientes++;
    }
    return resultado;
}

// OS e orçamentos antigos: grava a cópia do cliente (nome + documento cifrado)
async function precisaCopiaCliente() {
    const sem = { clienteCopia: { $exists: false }, cliente: { $exists: true } };
    const [os, orc] = await Promise.all([ServiceOrder.collection.countDocuments(sem), Quote.collection.countDocuments(sem)]);
    return os + orc > 0;
}

async function copiarClienteNosDocumentos() {
    const resultado = {};
    const cache = new Map();
    for (const [nome, modelo] of [["ordens", ServiceOrder], ["orcamentos", Quote]]) {
        let n = 0;
        const cursor = modelo.collection.find({ clienteCopia: { $exists: false }, cliente: { $exists: true } }).project({ cliente: 1 });
        for await (const doc of cursor) {
            const id = String(doc.cliente);
            if (!cache.has(id)) {
                cache.set(id, await Clientes.collection.findOne({ _id: doc.cliente }, { projection: { nome: 1, tipoPessoa: 1, documentoCifrado: 1, documentoBusca: 1 } }));
            }
            const c = cache.get(id);
            if (!c) continue; // cliente excluído antes da 1.1: não há o que copiar
            const copia = { nome: c.nome, tipoPessoa: c.tipoPessoa || "PF" };
            if (c.documentoCifrado) copia.documentoCifrado = c.documentoCifrado;
            if (c.documentoBusca) copia.documentoBusca = c.documentoBusca;
            await modelo.collection.updateOne({ _id: doc._id }, { $set: { clienteCopia: copia } });
            n++;
        }
        resultado[nome] = n;
    }
    return resultado;
}

// Orçamentos: "osGerada" (uma OS) vira "osGeradas" (lista), e a OS passa
// a apontar para o orçamento de origem
async function precisaListaOS() {
    return (await Quote.collection.countDocuments({ osGerada: { $exists: true } })) > 0;
}

async function listaDeOSNosOrcamentos() {
    let orcamentos = 0;
    for await (const q of Quote.collection.find({ osGerada: { $exists: true } })) {
        const $set = { osGeradas: q.osGerada ? [q.osGerada] : [] };
        await Quote.collection.updateOne({ _id: q._id }, { $set, $unset: { osGerada: "" } });
        if (q.osGerada) await ServiceOrder.collection.updateOne({ _id: q.osGerada }, { $set: { orcamentoOrigem: q._id } });
        orcamentos++;
    }
    return { orcamentos };
}

// Ordem importa: a cópia usa o documento já cifrado
const ETAPAS = [
    { nome: "clientes-documento-cifrado", precisa: precisaCifrarClientes, executar: cifrarClientes, apagaDados: true },
    { nome: "copia-cliente-nos-documentos", precisa: precisaCopiaCliente, executar: copiarClienteNosDocumentos },
    { nome: "orcamento-lista-de-os", precisa: precisaListaOS, executar: listaDeOSNosOrcamentos },
];

// ===== Backup =====

// Grava (cifrado) os clientes, OS e orçamentos como estão agora
async function gravarBackup(pasta, agora = new Date()) {
    const dados = {
        criadoEm: agora.toISOString(),
        clientes: await Clientes.collection.find().toArray(),
        ordens: await ServiceOrder.collection.find().toArray(),
        orcamentos: await Quote.collection.find().toArray(),
    };
    fs.mkdirSync(pasta, { recursive: true });
    const arquivo = path.join(pasta, `antes-da-migracao-${agora.toISOString().replace(/[:.]/g, "-")}.json`);
    const conteudo = { formato: "grafica-os-backup", cifrado: cripto.cifrar(JSON.stringify(dados)) };
    fs.writeFileSync(arquivo, JSON.stringify(conteudo));
    return arquivo;
}

// Lê um backup gravado por gravarBackup (precisa da mesma chave)
function lerBackup(arquivo) {
    const conteudo = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    if (conteudo.formato !== "grafica-os-backup") throw new Error("Arquivo não é um backup do Gráfica OS.");
    return JSON.parse(cripto.decifrar(conteudo.cifrado));
}

// ===== Trava =====

async function pegarTrava(agora = new Date()) {
    try {
        await Configuracao.create({ _id: TRAVA, valor: { desde: agora } });
        return true;
    } catch (erro) {
        if (erro.code !== 11000) throw erro;
        const abandonada = new Date(agora.getTime() - TRAVA_ABANDONADA_MS);
        const r = await Configuracao.updateOne({ _id: TRAVA, "valor.desde": { $lt: abandonada } }, { $set: { valor: { desde: agora } } });
        return r.modifiedCount === 1;
    }
}

const soltarTrava = () => Configuracao.deleteOne({ _id: TRAVA });

// ===== Execução =====

// pastaBackup: onde gravar o backup antes das etapas que apagam dados.
// Retorna { executadas: [{ nome, resultado }], backup } ou { ocupado: true }.
async function migrar({ pastaBackup }) {
    if (!cripto.temChaves()) throw new Error("A migração precisa da chave de segurança.");
    if (mongoose.connection.readyState !== 1) throw new Error("Banco de dados desconectado.");

    const registro = await Configuracao.findById(CONCLUIDAS);
    const concluidas = new Set((registro && registro.valor) || []);
    const pendentes = [];
    for (const etapa of ETAPAS) {
        if (concluidas.has(etapa.nome)) continue;
        if (await etapa.precisa()) pendentes.push(etapa);
        else concluidas.add(etapa.nome);
    }
    if (pendentes.length === 0) {
        if (!registro || registro.valor.length !== concluidas.size) await salvarConcluidas(concluidas);
        return { executadas: [] };
    }

    if (!(await pegarTrava())) return { ocupado: true, executadas: [] };
    try {
        let backup = null;
        if (pendentes.some((e) => e.apagaDados)) backup = await gravarBackup(pastaBackup);
        const executadas = [];
        for (const etapa of pendentes) {
            executadas.push({ nome: etapa.nome, resultado: await etapa.executar() });
            concluidas.add(etapa.nome);
            await salvarConcluidas(concluidas);
        }
        return { executadas, backup };
    } finally {
        await soltarTrava();
    }
}

function salvarConcluidas(concluidas) {
    return Configuracao.updateOne(
        { _id: CONCLUIDAS },
        { $set: { valor: [...concluidas], atualizadoEm: new Date() } },
        { upsert: true }
    );
}

module.exports = { migrar, lerBackup, gravarBackup, ETAPAS };

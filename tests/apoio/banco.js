/**
 * Banco MongoDB temporário (em memória) para os testes.
 * Nada aqui toca o banco real.
 */

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let servidor;

async function iniciarBanco() {
    servidor = await MongoMemoryServer.create();
    await mongoose.connect(servidor.getUri("graficaos-teste"));
}

// Apaga os documentos de todas as coleções (os índices continuam)
async function limparBanco() {
    for (const colecao of await mongoose.connection.db.collections()) {
        await colecao.deleteMany({});
    }
}

async function pararBanco() {
    await mongoose.disconnect();
    if (servidor) await servidor.stop();
}

// Data relativa a hoje, ao meio-dia (ex.: dia(-3) = três dias atrás)
function dia(deslocamento) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    d.setHours(12, 0, 0, 0);
    return d;
}

module.exports = { iniciarBanco, limparBanco, pararBanco, dia };

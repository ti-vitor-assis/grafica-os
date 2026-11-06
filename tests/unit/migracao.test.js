/**
 * Migração de bancos da versão 1.0 (rodam com: npm test)
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { iniciarBanco, limparBanco, pararBanco } = require("../apoio/banco.js");
const cripto = require("../../src/seguranca/cripto.js");
const migracao = require("../../src/servicos/migracao.js");
const Cli = require("../../src/model/Clientes.js");
const OS = require("../../src/model/ServiceOrder.js");
const Quote = require("../../src/model/Quote.js");
const Configuracao = require("../../src/model/Configuracao.js");

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "grafica-migracao-"));

before(async () => {
    cripto.definirChaves(cripto.gerarChaves());
    await iniciarBanco();
});
beforeEach(async () => {
    await limparBanco();
    // Como era na 1.0: índice único no CPF em texto puro
    await Cli.collection.dropIndexes().catch(() => {});
    await Cli.collection.createIndex({ cpf: 1 }, { unique: true });
});
after(async () => {
    await pararBanco();
    fs.rmSync(pasta, { recursive: true, force: true });
});

// Dados no formato da 1.0, gravados direto na coleção
async function bancoAntigo() {
    const [maria, padaria, semCpf, repetida] = [1, 2, 3, 4].map(() => new mongoose.Types.ObjectId());
    await Cli.collection.insertMany([
        { _id: maria, nome: "Maria", cpf: "529.982.247-25", rg: "12.345.678-9", sexo: "fem", dataNascimento: new Date("1990-05-10") },
        { _id: padaria, nome: "Padaria", cpf: "11222333000181", sexo: "out" },
        { _id: semCpf, nome: "Sem CPF", cpf: "" },
        { _id: repetida, nome: "Maria (duplicada)", cpf: "52998224725" },
    ]);
    const item = [{ produto: new mongoose.Types.ObjectId(), descricao: "Banner", quantidade: 1, valorUnitario: 10, subtotal: 10 }];
    await OS.collection.insertMany([
        { numero: 1, cliente: maria, produtos: item, valorTotal: 10, status: "entregue", prazoFinal: new Date("2025-01-10"), dataCriacao: new Date("2025-01-01") },
        { numero: 2, cliente: new mongoose.Types.ObjectId(), produtos: item, valorTotal: 10, status: "aberta", prazoFinal: new Date("2025-01-10") },
    ]);
    await Quote.collection.insertOne({ numero: 1, cliente: padaria, produtos: item, valorTotal: 10, status: "pendente", validade: new Date("2025-02-01") });
    return { maria, padaria, semCpf, repetida };
}

describe("Migração 1.0 -> 1.1", () => {
    it("cifra o CPF/CNPJ, tira RG e sexo, troca o índice e copia o cliente nas OS e orçamentos", async () => {
        const ids = await bancoAntigo();
        const r = await migracao.migrar({ pastaBackup: pasta });
        assert.deepEqual(r.executadas.map((e) => e.nome), ["clientes-documento-cifrado", "copia-cliente-nos-documentos"]);
        assert.deepEqual(r.executadas[0].resultado, { clientes: 4, semDocumento: 1, repetidos: 1 });
        assert.deepEqual(r.executadas[1].resultado, { ordens: 1, orcamentos: 1 });

        const maria = await Cli.collection.findOne({ _id: ids.maria });
        assert.equal(maria.cpf, undefined);
        assert.equal(maria.rg, undefined);
        assert.equal(maria.sexo, undefined);
        assert.equal(maria.tipoPessoa, "PF");
        assert.equal(cripto.decifrar(maria.documentoCifrado), "52998224725");
        assert.equal(maria.documentoBusca, cripto.indiceBusca("52998224725"));
        assert.equal((await Cli.collection.findOne({ _id: ids.padaria })).tipoPessoa, "PJ");

        // Duplicado: documento guardado, mas fora da busca (para revisão)
        const repetida = await Cli.collection.findOne({ _id: ids.repetida });
        assert.ok(repetida.documentoCifrado && !repetida.documentoBusca);

        const indices = (await Cli.collection.indexes()).map((i) => Object.keys(i.key).join(","));
        assert.ok(!indices.includes("cpf") && indices.includes("documentoBusca"));
        assert.ok(!JSON.stringify(await Cli.collection.find().toArray()).includes("529.982"), "nenhum CPF em texto puro");

        const os1 = await OS.collection.findOne({ numero: 1 });
        assert.equal(os1.clienteCopia.nome, "Maria");
        assert.equal(os1.clienteCopia.documentoBusca, cripto.indiceBusca("52998224725"));
        assert.equal((await OS.collection.findOne({ numero: 2 })).clienteCopia, undefined, "cliente já excluído: sem cópia");
        assert.equal((await Quote.collection.findOne({ numero: 1 })).clienteCopia.tipoPessoa, "PJ");

        // Depois da migração, um cliente novo é gravado normalmente
        await Cli.create({ nome: "Nova", ...require("../../src/servicos/clientes.js").camposDocumento("PF", "39053344705") });
        await Cli.create({ nome: "Sem documento 2" });
    });

    it("grava o backup cifrado antes e não repete a migração", async () => {
        await bancoAntigo();
        const r = await migracao.migrar({ pastaBackup: pasta });
        const bruto = fs.readFileSync(r.backup, "utf8");
        assert.ok(!bruto.includes("529.982.247-25") && !bruto.includes("Maria"), "backup não tem dados em texto puro");
        const backup = migracao.lerBackup(r.backup);
        assert.equal(backup.clientes.find((c) => c.nome === "Maria").cpf, "529.982.247-25", "backup guarda como era antes");
        assert.equal(backup.ordens.length, 2);

        const denovo = await migracao.migrar({ pastaBackup: pasta });
        assert.deepEqual(denovo.executadas, []);
        assert.equal(denovo.backup, undefined);
        assert.equal(await Configuracao.countDocuments({ _id: "migracao-trava" }), 0, "trava liberada");
    });

    it("banco novo: marca as etapas como feitas sem backup", async () => {
        const r = await migracao.migrar({ pastaBackup: pasta });
        assert.deepEqual(r.executadas, []);
        assert.equal((await Configuracao.findById("migracoes")).valor.length, migracao.ETAPAS.length);
    });

    it("outro computador migrando: espera; trava abandonada é retomada", async () => {
        await bancoAntigo();
        await Configuracao.create({ _id: "migracao-trava", valor: { desde: new Date() } });
        assert.equal((await migracao.migrar({ pastaBackup: pasta })).ocupado, true);
        assert.ok((await Cli.collection.findOne({ nome: "Maria" })).cpf, "não mexeu em nada");

        await Configuracao.updateOne({ _id: "migracao-trava" }, { $set: { valor: { desde: new Date(Date.now() - 3600e3) } } });
        const r = await migracao.migrar({ pastaBackup: pasta });
        assert.equal(r.executadas.length, 2);
    });
});

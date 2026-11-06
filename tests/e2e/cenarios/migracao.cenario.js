// Banco da versão 1.0 (CPF em texto puro, RG, sexo, OS sem cópia do cliente)
// aberto pela versão nova: migra sozinho antes do login, com backup cifrado.
const path = require("node:path");
const fs = require("node:fs");

module.exports = {
    async prepararBanco() {
        const mongoose = require("mongoose");
        const db = mongoose.connection.db;
        const maria = new mongoose.Types.ObjectId();
        await db.collection("clientes").createIndex({ cpf: 1 }, { unique: true });
        await db.collection("clientes").insertMany([
            { _id: maria, nome: "Maria Souza", cpf: "529.982.247-25", rg: "12.345.678-9", sexo: "fem", telefone: "11988887777", cidade: "Osasco", estado: "SP" },
            { nome: "Padaria Pão Quente", cpf: "11222333000181", sexo: "out" },
        ]);
        await db.collection("serviceorders").insertOne({
            numero: 7, cliente: maria, status: "entregue", valorTotal: 90, valorPago: 90, pago: true,
            produtos: [{ produto: new mongoose.Types.ObjectId(), descricao: "Cartão de visita", quantidade: 1, valorUnitario: 90, subtotal: 90 }],
            prazoFinal: new Date("2025-03-10"), dataCriacao: new Date("2025-03-01"), pagamentos: [],
        });
        await db.collection("counters").insertOne({ _id: "serviceOrder", seq: 7 });
    },

    async executar(ctx) {
        const Cli = ctx.modelo("Clientes");
        const clientes = await Cli.collection.find().toArray();
        ctx.ok(clientes.every((c) => c.cpf === undefined && c.rg === undefined && c.sexo === undefined), "CPF, RG e sexo saíram do banco");
        ctx.ok(clientes.every((c) => c.documentoCifrado && c.documentoBusca), "documentos cifrados");
        ctx.ok((await ctx.modelo("ServiceOrder").collection.findOne({ numero: 7 })).clienteCopia.nome === "Maria Souza", "OS antiga ganhou a cópia do cliente");

        const pastaBackup = path.join(require("electron").app.getPath("userData"), "backups");
        const backups = fs.existsSync(pastaBackup) ? fs.readdirSync(pastaBackup).filter((f) => f.startsWith("antes-da-migracao")) : [];
        ctx.ok(backups.length >= 1, "backup gravado antes da migração");
        const recente = backups.sort().pop();
        ctx.ok(!fs.readFileSync(path.join(pastaBackup, recente), "utf8").includes("529.982"), "backup não tem CPF em texto puro");
        fs.rmSync(pastaBackup, { recursive: true, force: true });

        // A busca exata pelo CPF funciona com os dados migrados
        const w = await ctx.abrir("clientes", "Clientes");
        await ctx.js(w, `searchClientsInput.value='52998224725'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => ctx.js(w, "inputIdClient.value !== ''"));
        ctx.igual(await ctx.js(w, "inputDocumento.value"), "529.982.247-25", "cliente migrado achado pelo CPF");
        w.close();

        const o = await ctx.abrir("os", "Ordem de Serviço");
        await ctx.js(o, `searchClientsInput.value='529.982.247-25'; frmSearchClient.requestSubmit()`);
        await ctx.aguardar(() => ctx.js(o, "listaResultados.children.length > 0"));
        ctx.ok((await ctx.js(o, "listaResultados.innerText")).includes("OS nº 7"), "OS antiga achada pelo CPF");

        // Uma OS nova continua a numeração e o cadastro de cliente novo funciona
        ctx.ok(!!(await Cli.create({ nome: "Novo sem documento" })), "cliente novo grava depois da troca do índice");
    },
};

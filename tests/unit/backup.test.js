/**
 * Backup/restauração e planilhas Excel (rodam com: npm test)
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { iniciarBanco, limparBanco, pararBanco } = require("../apoio/banco.js");
const { popular } = require("../apoio/dados.js");
const cripto = require("../../src/seguranca/cripto.js");
const servicoBackup = require("../../src/servicos/backup.js");
const exportacao = require("../../src/servicos/exportacao.js");
const relatorios = require("../../src/reports/relatorios.js");
const { planilhaDoRelatorio, paraNumero } = require("../../src/print/excel.js");
const Cli = require("../../src/model/Clientes.js");
const OS = require("../../src/model/ServiceOrder.js");
const Usuario = require("../../src/model/Usuario.js");

const CHAVES = cripto.gerarChaves();

before(async () => {
    cripto.definirChaves(CHAVES);
    await iniciarBanco();
});
beforeEach(async () => {
    cripto.definirChaves(CHAVES);
    await limparBanco();
    await popular();
    const admin = new Usuario({ nome: "Admin", login: "admin", perfil: "administrador" });
    await admin.definirSenha("admin1234");
    await admin.save();
});
after(pararBanco);

async function lerPlanilha(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb;
}

describe("Backup", () => {
    it("ida e volta: restaura exatamente o que havia (ids, datas e CPF cifrado)", async () => {
        const antes = await OS.collection.find().sort({ numero: 1 }).toArray();
        const { conteudo, contagem } = await servicoBackup.gerarBackup();
        assert.ok(!conteudo.includes("Maria") && !conteudo.includes("52998224725"), "backup não tem dados em texto puro");
        assert.equal(contagem.clientes, 3);

        // Muda tudo depois do backup
        await Cli.deleteMany({});
        await OS.updateMany({}, { $set: { status: "cancelada" } });

        const lido = servicoBackup.lerBackup(conteudo);
        assert.equal(lido.contagem.clientes, 3);
        await servicoBackup.restaurar(lido.dados);
        assert.equal(await Cli.countDocuments(), 3);
        const depois = await OS.collection.find().sort({ numero: 1 }).toArray();
        assert.deepEqual(depois, antes, "OS iguais, com os mesmos tipos");
        const maria = await Cli.findOne({ nome: "Maria Souza" });
        assert.equal(cripto.decifrar(maria.documentoCifrado), "52998224725");
        assert.equal(await Cli.countDocuments({ documentoBusca: cripto.indiceBusca("52998224725") }), 1, "busca por CPF funciona depois");
    });

    it("recusa arquivo estranho, backup de outra chave e backup sem administrador", async () => {
        const { conteudo } = await servicoBackup.gerarBackup();
        assert.throws(() => servicoBackup.lerBackup("{}"), /não é um backup/);
        assert.throws(() => servicoBackup.lerBackup("lixo"), /não é um backup/);

        cripto.definirChaves(cripto.gerarChaves());
        assert.throws(() => servicoBackup.lerBackup(conteudo), /outro banco/);
        cripto.definirChaves(CHAVES);

        await Usuario.updateMany({}, { $set: { ativo: false } });
        const semAdmin = (await servicoBackup.gerarBackup()).conteudo;
        assert.throws(() => servicoBackup.lerBackup(semAdmin), /administrador ativo/);
    });

    it("registra a data do último backup", async () => {
        assert.equal(await servicoBackup.diasDesdeUltimoBackup(), null);
        await servicoBackup.gerarBackup();
        assert.equal(await servicoBackup.diasDesdeUltimoBackup(), 0);
        assert.equal(await servicoBackup.diasDesdeUltimoBackup(new Date(Date.now() + 8 * 864e5)), 8);
    });
});

describe("Excel", () => {
    it("converte valores do relatório em números", () => {
        assert.equal(paraNumero("R$ 1.234,56"), 1234.56);
        assert.equal(paraNumero("12"), 12);
        assert.equal(paraNumero("3,5"), 3.5);
        assert.equal(paraNumero("Maria"), null);
    });

    it("relatório vira planilha com números de verdade e documento mascarado", async () => {
        const wb = await lerPlanilha(await planilhaDoRelatorio(await relatorios.clientes()));
        assert.deepEqual(wb.worksheets.map((w) => w.name), ["Resumo", "Clientes cadastrados"]);
        const aba = wb.getWorksheet("Clientes cadastrados");
        const linhas = aba.getSheetValues().slice(2).map((l) => l.slice(1));
        assert.ok(linhas.some((l) => l[1] === "CPF ***.982.247-**"), "documento mascarado");
        assert.ok(linhas.every((l) => typeof l[5] === "number"), "coluna de OS é número");

        const fat = await lerPlanilha(await planilhaDoRelatorio(await relatorios.contasAReceber()));
        const valores = fat.worksheets[1].getColumn(fat.worksheets[1].columnCount).values.slice(2);
        assert.ok(valores.length > 0 && valores.every((v) => typeof v === "number"), "valores em R$ viram números");
        assert.equal(fat.worksheets[1].getColumn(fat.worksheets[1].columnCount).numFmt, '"R$" #,##0.00');
    });

    it("exportação completa: CPF/CNPJ legível, uma aba por assunto e sem senha", async () => {
        const { buffer, contagem } = await exportacao.planilhaCompleta();
        assert.equal(contagem.Clientes, 3);
        const wb = await lerPlanilha(buffer);
        assert.deepEqual(wb.worksheets.map((w) => w.name), ["Clientes", "OS", "Itens das OS", "Pagamentos", "Orçamentos",
            "Itens dos orçamentos", "Produtos", "Insumos", "Movimentos de estoque", "Fornecedores", "Usuários"]);
        const textoClientes = JSON.stringify(wb.getWorksheet("Clientes").getSheetValues());
        assert.ok(textoClientes.includes("529.982.247-25") && textoClientes.includes("11.222.333/0001-81"), "documentos legíveis");
        const textoOS = JSON.stringify(wb.getWorksheet("OS").getSheetValues());
        assert.ok(textoOS.includes("529.982.247-25"), "OS trazem o documento do cliente");
        const textoUsuarios = JSON.stringify(wb.getWorksheet("Usuários").getSheetValues());
        assert.ok(textoUsuarios.includes("admin") && !textoUsuarios.includes("$2"), "usuários sem hash de senha");
        assert.ok(wb.getWorksheet("Itens das OS").rowCount > 1 && wb.getWorksheet("Pagamentos").rowCount > 1);
    });
});

describe("Backup e auditoria", () => {
    it("restaurar não apaga a auditoria feita depois do backup", async () => {
        const Auditoria = require("../../src/model/Auditoria.js");
        await Auditoria.create({ usuario: "admin", acao: "antes do backup" });
        const { conteudo } = await servicoBackup.gerarBackup();
        await Auditoria.create({ usuario: "admin", acao: "depois do backup" });
        await Auditoria.deleteMany({ acao: "antes do backup" });
        await servicoBackup.restaurar(servicoBackup.lerBackup(conteudo).dados);
        const acoes = (await Auditoria.find()).map((a) => a.acao).sort();
        assert.deepEqual(acoes, ["antes do backup", "depois do backup"]);
    });
});

/**
 * Dados de exemplo (clientes, produtos, OS) com datas relativas a hoje,
 * usados pelos testes de relatórios.
 */

const { dia } = require("./banco.js");

async function popular() {
    const Cli = require("../../src/model/Clientes.js");
    const Prod = require("../../src/model/Products.js");
    const OS = require("../../src/model/ServiceOrder.js");
    const Counter = require("../../src/model/Counter.js");

    const clientes = await Cli.insertMany([
        { nome: "Maria Souza", cpf: "52998224725", telefone: "(11) 98888-7777", cidade: "São Paulo", estado: "SP" },
        { nome: "Padaria Pão Quente", cpf: "11144477735", cidade: "Osasco", estado: "SP" },
        { nome: "Escola Futuro", cpf: "39053344705", cidade: "Barueri", estado: "SP" },
    ]);
    const produtos = await Prod.insertMany([
        { nome: "Cartão de visita", categoria: "Impressos", unidade: "milheiro", valorUnitario: 90 },
        { nome: "Banner lona", categoria: "Comunicação Visual", unidade: "m²", valorUnitario: 45 },
        { nome: "Panfleto A5", categoria: "Impressos", unidade: "milheiro", valorUnitario: 180 },
    ]);

    const item = (p, q, v) => {
        const valor = v ?? produtos[p].valorUnitario;
        return { produto: produtos[p]._id, descricao: produtos[p].nome, quantidade: q, valorUnitario: valor, subtotal: q * valor };
    };
    // pags = [[valor | "tudo", forma, dia]]
    const os = (numero, c, criada, prazo, status, itens, pags = [], entregue) => {
        const valorTotal = itens.reduce((s, i) => s + i.subtotal, 0);
        const pagamentos = pags.map(([valor, forma, d]) => ({ valor: valor === "tudo" ? valorTotal : valor, forma, data: dia(d) }));
        const valorPago = pagamentos.reduce((s, p) => s + p.valor, 0);
        return {
            numero, cliente: clientes[c]._id, dataCriacao: dia(criada), prazoFinal: dia(prazo), status,
            produtos: itens, valorTotal, pagamentos, valorPago, pago: valorPago >= valorTotal,
            arte: { origem: "cliente", aprovada: true },
            dataEntregaReal: entregue == null ? undefined : dia(entregue),
        };
    };

    await OS.collection.insertMany([
        os(1, 0, -20, -12, "entregue", [item(0, 2)], [["tudo", "pix", -13]], -13),
        os(2, 1, -15, -8, "entregue", [item(2, 3), item(1, 4)], [[100, "dinheiro", -15], [620, "dinheiro", -6]], -6),
        os(3, 2, -10, -2, "entregue", [item(1, 10, 40)], [[200, "boleto", -10]], -1),
        os(4, 0, -6, -1, "em produção", [item(0, 1)], [[50, "pix", -6]]),
        os(5, 1, -3, 2, "aguardando arte", [item(2, 5)]),
        os(6, 2, -2, 5, "aberta", [item(0, 3), item(2, 1)]),
        os(7, 0, -4, 3, "cancelada", [item(1, 2)]),
        os(8, 1, -60, -50, "entregue", [item(0, 1)], [["tudo", "pix", -50]], -50),
    ]);
    await Counter.create({ _id: "serviceOrder", seq: 8 });
    return { clientes, produtos };
}

module.exports = { popular };

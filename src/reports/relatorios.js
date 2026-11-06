/**
 * Consultas dos relatórios.
 * Cada função devolve os dados no formato de src/print/reportTemplate.js
 */

const clienteModel = require("../model/Clientes.js");
const serviceOrderModel = require("../model/ServiceOrder.js");
const { moeda, data, capitalizar } = require("../print/formatar.js");

// OS que ainda precisam ser entregues
const EM_ANDAMENTO = { status: { $nin: ["entregue", "cancelada"] } };

const centavos = (valor) => Math.round(valor * 100) / 100;
const somar = (lista, campo) => centavos(lista.reduce((soma, item) => soma + (campo(item) || 0), 0));

// Quanto falta receber de uma OS
function saldo(os) {
    if (os.pagamento && os.pagamento.pago) return 0;
    return Math.max(centavos(os.valorTotal - ((os.pagamento && os.pagamento.sinal) || 0)), 0);
}

const nomeCliente = (os) => (os.cliente ? os.cliente.nome : "(cliente excluído)");

function inicioDoDia(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

// ===== Clientes cadastrados =====
async function clientes() {
    const [lista, contagem] = await Promise.all([
        clienteModel.find().sort({ nome: 1 }),
        serviceOrderModel.aggregate([{ $group: { _id: "$cliente", total: { $sum: 1 } } }]),
    ]);
    const osPorCliente = new Map(contagem.map((c) => [String(c._id), c.total]));

    return {
        titulo: "Clientes cadastrados",
        resumo: [["Clientes", String(lista.length)]],
        secoes: [{
            colunas: [
                { titulo: "Nome" }, { titulo: "CPF" }, { titulo: "Celular" },
                { titulo: "E-mail" }, { titulo: "Cidade/UF" }, { titulo: "OS", num: true },
            ],
            linhas: lista.map((c) => [
                c.nome,
                c.cpf || "",
                c.telefone || "",
                c.email || "",
                [c.cidade, c.estado].filter(Boolean).join("/"),
                String(osPorCliente.get(String(c._id)) || 0),
            ]),
        }],
    };
}

// ===== OS em andamento (não entregues e não canceladas) =====
async function osEmAndamento() {
    const lista = await serviceOrderModel.find(EM_ANDAMENTO).populate("cliente", "nome").sort({ prazoFinal: 1 });
    const hoje = inicioDoDia();
    const atrasadas = lista.filter((os) => os.prazoFinal < hoje);

    return {
        titulo: "OS em andamento",
        resumo: [
            ["OS em andamento", String(lista.length)],
            ["Atrasadas", String(atrasadas.length)],
            ["Valor total", moeda(somar(lista, (os) => os.valorTotal))],
            ["A receber", moeda(somar(lista, saldo))],
        ],
        secoes: [{
            colunas: [
                { titulo: "Nº", num: true }, { titulo: "Cliente" }, { titulo: "Abertura" },
                { titulo: "Prazo" }, { titulo: "Status" }, { titulo: "Total", num: true }, { titulo: "Saldo", num: true },
            ],
            linhas: lista.map((os) => [
                String(os.numero),
                nomeCliente(os),
                data(os.dataCriacao),
                data(os.prazoFinal) + (os.prazoFinal < hoje ? " (atrasada)" : ""),
                capitalizar(os.status),
                moeda(os.valorTotal),
                moeda(saldo(os)),
            ]),
        }],
    };
}

// ===== OS entregues no período =====
async function osEntregues(inicio, fim) {
    const lista = await serviceOrderModel
        .find({ status: "entregue", dataEntregaReal: { $gte: inicio, $lte: fim } })
        .populate("cliente", "nome")
        .sort({ dataEntregaReal: 1 });
    // Entregue no prazo = entregue até o fim do dia do prazo
    const noPrazo = (os) => inicioDoDia(os.dataEntregaReal) <= inicioDoDia(os.prazoFinal);
    const quantasNoPrazo = lista.filter(noPrazo).length;

    return {
        titulo: "OS entregues",
        resumo: [
            ["OS entregues", String(lista.length)],
            ["Entregues no prazo", lista.length ? `${Math.round((quantasNoPrazo / lista.length) * 100)}%` : "—"],
            ["Valor total", moeda(somar(lista, (os) => os.valorTotal))],
        ],
        secoes: [{
            colunas: [
                { titulo: "Nº", num: true }, { titulo: "Cliente" }, { titulo: "Prazo" },
                { titulo: "Entregue em" }, { titulo: "No prazo?" }, { titulo: "Total", num: true },
            ],
            linhas: lista.map((os) => [
                String(os.numero),
                nomeCliente(os),
                data(os.prazoFinal),
                data(os.dataEntregaReal),
                noPrazo(os) ? "Sim" : "Não",
                moeda(os.valorTotal),
            ]),
        }],
    };
}

// ===== Todas as OS abertas no período =====
async function todasOS(inicio, fim) {
    const lista = await serviceOrderModel
        .find({ dataCriacao: { $gte: inicio, $lte: fim } })
        .populate("cliente", "nome")
        .sort({ numero: 1 });
    const validas = lista.filter((os) => os.status !== "cancelada");
    const porStatus = serviceOrderModel.STATUS
        .map((s) => [capitalizar(s), String(lista.filter((os) => os.status === s).length)])
        .filter(([, qtd]) => qtd !== "0");

    return {
        titulo: "Todas as OS",
        resumo: [
            ["OS no período", String(lista.length)],
            ...porStatus,
            ["Valor (sem canceladas)", moeda(somar(validas, (os) => os.valorTotal))],
        ],
        secoes: [{
            colunas: [
                { titulo: "Nº", num: true }, { titulo: "Cliente" }, { titulo: "Abertura" },
                { titulo: "Prazo" }, { titulo: "Status" }, { titulo: "Total", num: true },
            ],
            linhas: lista.map((os) => [
                String(os.numero),
                nomeCliente(os),
                data(os.dataCriacao),
                data(os.prazoFinal),
                capitalizar(os.status),
                moeda(os.valorTotal),
            ]),
        }],
    };
}

module.exports = { clientes, osEmAndamento, osEntregues, todasOS, saldo, somar, centavos };

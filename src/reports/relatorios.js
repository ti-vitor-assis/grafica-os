/**
 * Consultas dos relatórios.
 * Cada função devolve os dados no formato de src/print/reportTemplate.js
 */

const clienteModel = require("../model/Clientes.js");
const { documentoDe, rotuloDocumento } = require("../servicos/clientes.js");
const { mascararDocumento } = require("../seguranca/cripto.js");
const serviceOrderModel = require("../model/ServiceOrder.js");
const insumoModel = require("../model/Insumo.js");
const { moeda, data, capitalizar } = require("../print/formatar.js");

// OS que ainda precisam ser entregues
const EM_ANDAMENTO = { status: { $nin: ["entregue", "cancelada"] } };

const centavos = (valor) => Math.round(valor * 100) / 100;
const somar = (lista, campo) => centavos(lista.reduce((soma, item) => soma + (campo(item) || 0), 0));

// Quanto falta receber de uma OS
function saldo(os) {
    return Math.max(centavos(os.valorTotal - (os.valorPago || 0)), 0);
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
                { titulo: "Nome" }, { titulo: "CPF/CNPJ" }, { titulo: "Celular" },
                { titulo: "E-mail" }, { titulo: "Cidade/UF" }, { titulo: "OS", num: true },
            ],
            linhas: lista.map((c) => [
                c.nome,
                documentoDe(c) ? `${rotuloDocumento(c)} ${mascararDocumento(documentoDe(c))}` : "",
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

// ===== Faturamento: OS entregues no período =====
// Considera faturado o serviço entregue (não o que só foi aberto)
async function faturamento(inicio, fim) {
    const lista = await serviceOrderModel
        .find({ status: "entregue", dataEntregaReal: { $gte: inicio, $lte: fim } })
        .populate("cliente", "nome");
    const total = somar(lista, (os) => os.valorTotal);

    // Agrupa somando quantidade de OS e valor
    function agrupar(chave) {
        const grupos = new Map();
        for (const os of lista) {
            const k = chave(os);
            const g = grupos.get(k) || { os: 0, valor: 0 };
            g.os += 1;
            g.valor = centavos(g.valor + os.valorTotal);
            grupos.set(k, g);
        }
        return [...grupos.entries()].sort((a, b) => b[1].valor - a[1].valor);
    }
    const porCliente = agrupar(nomeCliente);
    const percentual = (valor) => (total ? `${((valor / total) * 100).toFixed(1).replace(".", ",")}%` : "—");

    return {
        titulo: "Faturamento",
        resumo: [
            ["Faturado (OS entregues)", moeda(total)],
            ["OS entregues", String(lista.length)],
            ["Ticket médio", lista.length ? moeda(centavos(total / lista.length)) : "—"],
            ["Ainda a receber destas OS", moeda(somar(lista, saldo))],
        ],
        secoes: [
            {
                titulo: "Por cliente",
                colunas: [{ titulo: "Cliente" }, { titulo: "OS", num: true }, { titulo: "Valor", num: true }, { titulo: "%", num: true }],
                linhas: porCliente.map(([cliente, g]) => [cliente, String(g.os), moeda(g.valor), percentual(g.valor)]),
            },
        ],
    };
}

// ===== Produtos mais vendidos (OS abertas no período, sem as canceladas) =====
async function produtosMaisVendidos(inicio, fim) {
    const grupos = await serviceOrderModel.aggregate([
        { $match: { dataCriacao: { $gte: inicio, $lte: fim }, status: { $ne: "cancelada" } } },
        { $unwind: "$produtos" },
        {
            $group: {
                _id: "$produtos.produto",
                descricao: { $last: "$produtos.descricao" },
                quantidade: { $sum: "$produtos.quantidade" },
                os: { $addToSet: "$_id" },
                valor: { $sum: "$produtos.subtotal" },
            },
        },
        { $sort: { valor: -1 } },
    ]);
    const total = centavos(grupos.reduce((soma, g) => soma + g.valor, 0));

    return {
        titulo: "Produtos mais vendidos",
        resumo: [
            ["Produtos diferentes", String(grupos.length)],
            ["Valor vendido", moeda(total)],
        ],
        secoes: [{
            colunas: [
                { titulo: "#", num: true }, { titulo: "Produto" }, { titulo: "Qtd vendida", num: true },
                { titulo: "Nº de OS", num: true }, { titulo: "Valor", num: true }, { titulo: "%", num: true },
            ],
            linhas: grupos.map((g, i) => [
                String(i + 1),
                g.descricao || "(sem descrição)",
                String(g.quantidade),
                String(g.os.length),
                moeda(g.valor),
                total ? `${((g.valor / total) * 100).toFixed(1).replace(".", ",")}%` : "—",
            ]),
        }],
    };
}

// ===== Contas a receber: OS não canceladas com saldo em aberto =====
async function contasAReceber() {
    const lista = await serviceOrderModel
        .find({ status: { $ne: "cancelada" }, pago: { $ne: true } })
        .populate("cliente", "nome")
        .sort({ prazoFinal: 1 });
    const comSaldo = lista.filter((os) => saldo(os) > 0);
    const entregues = comSaldo.filter((os) => os.status === "entregue");

    return {
        titulo: "Contas a receber",
        resumo: [
            ["OS com saldo", String(comSaldo.length)],
            ["Total a receber", moeda(somar(comSaldo, saldo))],
            // Serviço já entregue e não pago: é o que mais precisa de cobrança
            ["De OS já entregues", moeda(somar(entregues, saldo))],
        ],
        secoes: [{
            colunas: [
                { titulo: "Nº", num: true }, { titulo: "Cliente" }, { titulo: "Status" }, { titulo: "Prazo" },
                { titulo: "Total", num: true }, { titulo: "Pago", num: true }, { titulo: "Saldo", num: true },
            ],
            linhas: comSaldo.map((os) => [
                String(os.numero),
                nomeCliente(os),
                capitalizar(os.status),
                data(os.prazoFinal),
                moeda(os.valorTotal),
                moeda(os.valorPago),
                moeda(saldo(os)),
            ]),
        }],
    };
}

// ===== Recebimentos: pagamentos lançados no período (o que entrou no caixa) =====
async function recebimentos(inicio, fim) {
    const ordens = await serviceOrderModel
        .find({ "pagamentos.data": { $gte: inicio, $lte: fim } })
        .populate("cliente", "nome");

    const lancamentos = [];
    for (const os of ordens) {
        for (const p of os.pagamentos) {
            if (p.data >= inicio && p.data <= fim) {
                lancamentos.push({ os, ...p.toObject() });
            }
        }
    }
    lancamentos.sort((a, b) => a.data - b.data || a.os.numero - b.os.numero);

    const total = somar(lancamentos, (l) => l.valor);
    const porForma = new Map();
    for (const l of lancamentos) {
        const g = porForma.get(l.forma) || { qtd: 0, valor: 0 };
        g.qtd += 1;
        g.valor = centavos(g.valor + l.valor);
        porForma.set(l.forma, g);
    }
    const formas = [...porForma.entries()].sort((a, b) => b[1].valor - a[1].valor);

    return {
        titulo: "Recebimentos",
        resumo: [
            ["Total recebido", moeda(total)],
            ["Lançamentos", String(lancamentos.length)],
        ],
        secoes: [
            {
                titulo: "Por forma de pagamento",
                colunas: [{ titulo: "Forma" }, { titulo: "Lançamentos", num: true }, { titulo: "Valor", num: true }, { titulo: "%", num: true }],
                linhas: formas.map(([forma, g]) => [
                    capitalizar(forma),
                    String(g.qtd),
                    moeda(g.valor),
                    total ? `${((g.valor / total) * 100).toFixed(1).replace(".", ",")}%` : "—",
                ]),
            },
            {
                titulo: "Lançamentos",
                colunas: [{ titulo: "Data" }, { titulo: "OS", num: true }, { titulo: "Cliente" }, { titulo: "Forma" }, { titulo: "Valor", num: true }],
                linhas: lancamentos.map((l) => [
                    data(l.data),
                    String(l.os.numero),
                    nomeCliente(l.os),
                    capitalizar(l.forma),
                    moeda(l.valor),
                ]),
            },
        ],
    };
}

// ===== Estoque de insumos (situação atual) =====
async function estoque() {
    const lista = await insumoModel.find({ ativo: true }).populate("fornecedor", "nome").sort({ nome: 1 });
    const baixo = (i) => i.estoqueMinimo > 0 && i.quantidade < i.estoqueMinimo;
    const numero = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    const valor = (i) => centavos(i.quantidade * (i.custoUnitario || 0));

    // Os que precisam de compra aparecem primeiro
    const ordenada = [...lista].sort((a, b) => baixo(b) - baixo(a));

    return {
        titulo: "Estoque de insumos",
        resumo: [
            ["Insumos ativos", String(lista.length)],
            ["Abaixo do mínimo", String(lista.filter(baixo).length)],
            ["Valor em estoque", moeda(somar(lista, valor))],
        ],
        secoes: [{
            colunas: [
                { titulo: "Insumo" }, { titulo: "Categoria" }, { titulo: "Fornecedor" },
                { titulo: "Estoque", num: true }, { titulo: "Mínimo", num: true },
                { titulo: "Situação" }, { titulo: "Valor", num: true },
            ],
            linhas: ordenada.map((i) => [
                i.nome,
                i.categoria || "",
                i.fornecedor ? i.fornecedor.nome : "",
                `${numero(i.quantidade)} ${i.unidade}`,
                i.estoqueMinimo ? numero(i.estoqueMinimo) : "—",
                baixo(i) ? "COMPRAR" : "ok",
                moeda(valor(i)),
            ]),
        }],
    };
}

module.exports = {
    clientes, osEmAndamento, osEntregues, todasOS, faturamento, produtosMaisVendidos,
    contasAReceber, recebimentos, estoque,
    saldo, somar, centavos,
};

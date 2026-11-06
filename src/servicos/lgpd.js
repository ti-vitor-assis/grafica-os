/**
 * Direitos do titular e prazo de guarda (LGPD)
 *
 * - relatorioTitular: tudo o que a gráfica guarda sobre o cliente (art. 18, II)
 * - anonimizar: apaga os dados pessoais do cadastro a pedido (art. 18, IV/VI).
 *   As OS e orçamentos continuam (são documentos comerciais que a gráfica
 *   precisa guardar: art. 16, I) com a cópia do cliente da época
 * - limpeza: depois do prazo de guarda (PRAZO_ANOS), apaga também essa cópia
 *   e anonimiza clientes sem movimento no período
 */

const clienteModel = require("../model/Clientes.js");
const serviceOrderModel = require("../model/ServiceOrder.js");
const quoteModel = require("../model/Quote.js");
const { documentoDe, rotuloDocumento } = require("./clientes.js");
const { formatarDocumento } = require("../seguranca/cripto.js");
const { moeda, data, capitalizar } = require("../print/formatar.js");

const PRAZO_ANOS = 5;
const NOME_ANONIMO = "Cliente anonimizado";

// Campos pessoais apagados na anonimização (cidade/UF ficam, para estatística)
const CAMPOS_PESSOAIS = [
    "nomeFantasia", "inscricaoEstadual", "documentoCifrado", "documentoBusca", "dataNascimento",
    "telefone", "telefone2", "email", "cep", "endereco", "numero", "complemento", "bairro",
];

function limiteGuarda(agora = new Date()) {
    const limite = new Date(agora);
    limite.setFullYear(limite.getFullYear() - PRAZO_ANOS);
    return limite;
}

// ===== Relatório do titular (vira PDF com o modelo de relatório) =====
async function relatorioTitular(id) {
    const c = await clienteModel.findById(id);
    if (!c) return null;
    const [ordens, orcamentos] = await Promise.all([
        serviceOrderModel.find({ cliente: c._id }).sort({ numero: 1 }),
        quoteModel.find({ cliente: c._id }).sort({ numero: 1 }),
    ]);
    const documento = documentoDe(c);
    const pj = c.tipoPessoa === "PJ";
    const campos = [
        ["Tipo", pj ? "Pessoa jurídica" : "Pessoa física"],
        [pj ? "Razão social" : "Nome", c.nome],
        [rotuloDocumento(c), documento ? formatarDocumento(documento) : ""],
        ...(pj ? [["Nome fantasia", c.nomeFantasia], ["Inscrição estadual", c.inscricaoEstadual]] : [["Nascimento", c.dataNascimento ? data(c.dataNascimento) : ""]]),
        ["Celular", c.telefone], ["Telefone", c.telefone2], ["E-mail", c.email],
        ["CEP", c.cep], ["Endereço", [c.endereco, c.numero, c.complemento].filter(Boolean).join(", ")],
        ["Bairro", c.bairro], ["Cidade/UF", [c.cidade, c.estado].filter(Boolean).join("/")],
        ["Situação", c.anonimizado ? `Anonimizado em ${data(c.dataAnonimizacao)}` : c.ativo === false ? "Inativo" : "Ativo"],
        ["Cadastrado em", data(c.dataCadastro)],
    ].map(([campo, valor]) => [campo, valor || "—"]);

    return {
        titulo: "Dados pessoais do cliente (LGPD)",
        resumo: [["Cliente", c.nome], ["OS", String(ordens.length)], ["Orçamentos", String(orcamentos.length)]],
        secoes: [
            { titulo: "Dados cadastrais", colunas: [{ titulo: "Campo" }, { titulo: "Valor" }], linhas: campos },
            {
                titulo: "Ordens de serviço",
                colunas: [{ titulo: "Nº", num: true }, { titulo: "Abertura" }, { titulo: "Status" }, { titulo: "Total", num: true }],
                linhas: ordens.map((o) => [String(o.numero), data(o.dataCriacao), capitalizar(o.status), moeda(o.valorTotal)]),
            },
            {
                titulo: "Orçamentos",
                colunas: [{ titulo: "Nº", num: true }, { titulo: "Data" }, { titulo: "Status" }, { titulo: "Total", num: true }],
                linhas: orcamentos.map((q) => [String(q.numero), data(q.dataCriacao), capitalizar(q.status), moeda(q.valorTotal)]),
            },
            {
                titulo: "Como a gráfica usa estes dados",
                colunas: [{ titulo: "Para quê" }, { titulo: "Por quanto tempo" }],
                linhas: [
                    ["Identificar o cliente, emitir orçamentos, OS e nota fiscal (execução de contrato)", `Enquanto for cliente e até ${PRAZO_ANOS} anos depois do último serviço`],
                    ["Entrar em contato sobre pedidos e entregas", "Enquanto houver pedido em andamento"],
                    ["Guardar o histórico de OS e orçamentos (obrigação legal e defesa em processos)", `${PRAZO_ANOS} anos`],
                ],
            },
        ],
    };
}

// ===== Anonimização de um cliente =====
async function anonimizar(id, agora = new Date()) {
    const $unset = Object.fromEntries(CAMPOS_PESSOAIS.map((campo) => [campo, ""]));
    const r = await clienteModel.updateOne(
        { _id: id, anonimizado: { $ne: true } },
        { $set: { nome: NOME_ANONIMO, ativo: false, anonimizado: true, dataAnonimizacao: agora }, $unset }
    );
    return r.modifiedCount === 1;
}

// ===== Limpeza depois do prazo de guarda =====

// Clientes cadastrados antes do limite e sem OS/orçamento depois dele
async function clientesVencidos(limite) {
    const [osRecentes, orcRecentes] = await Promise.all([
        serviceOrderModel.distinct("cliente", { dataCriacao: { $gte: limite } }),
        quoteModel.distinct("cliente", { dataCriacao: { $gte: limite } }),
    ]);
    return clienteModel
        .find({ anonimizado: { $ne: true }, dataCadastro: { $lt: limite }, _id: { $nin: [...osRecentes, ...orcRecentes] } })
        .select("_id");
}

const copiaVencida = (limite) => ({ dataCriacao: { $lt: limite }, "clienteCopia.nome": { $exists: true, $ne: NOME_ANONIMO } });

// O que a limpeza vai fazer (para mostrar antes de confirmar)
async function previaLimpeza(agora = new Date()) {
    const limite = limiteGuarda(agora);
    const [clientes, ordens, orcamentos] = await Promise.all([
        clientesVencidos(limite),
        serviceOrderModel.countDocuments(copiaVencida(limite)),
        quoteModel.countDocuments(copiaVencida(limite)),
    ]);
    return { limite, clientes: clientes.length, ordens, orcamentos };
}

async function executarLimpeza(agora = new Date()) {
    const limite = limiteGuarda(agora);
    const clientes = await clientesVencidos(limite);
    let anonimizados = 0;
    for (const c of clientes) if (await anonimizar(c._id, agora)) anonimizados++;

    const apagarCopia = {
        $set: { "clienteCopia.nome": NOME_ANONIMO },
        $unset: { "clienteCopia.documentoCifrado": "", "clienteCopia.documentoBusca": "" },
    };
    const [ordens, orcamentos] = await Promise.all([
        serviceOrderModel.updateMany(copiaVencida(limite), apagarCopia),
        quoteModel.updateMany(copiaVencida(limite), apagarCopia),
    ]);
    return { limite, clientes: anonimizados, ordens: ordens.modifiedCount, orcamentos: orcamentos.modifiedCount };
}

module.exports = { PRAZO_ANOS, NOME_ANONIMO, relatorioTitular, anonimizar, previaLimpeza, executarLimpeza, limiteGuarda };

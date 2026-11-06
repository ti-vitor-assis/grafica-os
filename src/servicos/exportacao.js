/**
 * Exportação completa dos dados para Excel (administrador), para levar a
 * outro sistema ou ao contador.
 *
 * Atenção: aqui o CPF/CNPJ sai legível (o administrador pediu os dados
 * completos). O main avisa antes e registra na auditoria.
 * Senhas nunca saem (nem o hash).
 */

const Clientes = require("../model/Clientes.js");
const ServiceOrder = require("../model/ServiceOrder.js");
const Quote = require("../model/Quote.js");
const Products = require("../model/Products.js");
const Insumo = require("../model/Insumo.js");
const Fornecedor = require("../model/Fornecedor.js");
const Usuario = require("../model/Usuario.js");
const { documentoDe, rotuloDocumento } = require("./clientes.js");
const { formatarDocumento } = require("../seguranca/cripto.js");
const { gerarPlanilha } = require("../print/excel.js");

const simNao = (v) => (v === false ? "Não" : "Sim");
const doc = (c) => {
    const d = documentoDe(c);
    return d ? formatarDocumento(d) : "";
};

// Nome e documento do cliente de uma OS/orçamento: cadastro atual ou a cópia da época
function clienteDoDocumento(d) {
    const c = d.cliente && d.cliente._id ? d.cliente : d.clienteCopia || {};
    return [c.nome || "(cliente excluído)", doc(c)];
}

async function abasDaExportacao() {
    const [clientes, ordens, orcamentos, produtos, insumos, fornecedores, usuarios] = await Promise.all([
        Clientes.find().sort({ nome: 1 }),
        ServiceOrder.find().populate("cliente").sort({ numero: 1 }),
        Quote.find().populate("cliente").populate("osGeradas", "numero").sort({ numero: 1 }),
        Products.find().sort({ nome: 1 }),
        Insumo.find().populate("fornecedor", "nome").sort({ nome: 1 }),
        Fornecedor.find().sort({ nome: 1 }),
        Usuario.find().sort({ nome: 1 }),
    ]);
    const T = (titulo, largura) => ({ titulo, largura });
    const M = (titulo) => ({ titulo, tipo: "moeda", largura: 14 });
    const N = (titulo) => ({ titulo, tipo: "numero", largura: 10 });
    const D = (titulo) => ({ titulo, tipo: "data", largura: 12 });

    return [
        {
            nome: "Clientes",
            colunas: [T("Tipo", 8), T("Nome / razão social", 34), T("Nome fantasia", 22), T("Documento", 8), T("CPF/CNPJ", 20),
                T("Inscrição estadual", 16), D("Nascimento"), T("Celular", 16), T("Telefone", 16), T("E-mail", 28), T("CEP", 11),
                T("Endereço", 30), T("Número", 8), T("Complemento", 16), T("Bairro", 18), T("Cidade", 18), T("UF", 5),
                T("Ativo", 7), T("Anonimizado", 12), D("Cadastro")],
            linhas: clientes.map((c) => [c.tipoPessoa || "PF", c.nome, c.nomeFantasia, rotuloDocumento(c), doc(c), c.inscricaoEstadual,
                c.dataNascimento, c.telefone, c.telefone2, c.email, c.cep, c.endereco, c.numero, c.complemento, c.bairro, c.cidade,
                c.estado, simNao(c.ativo), c.anonimizado ? "Sim" : "Não", c.dataCadastro]),
        },
        {
            nome: "OS",
            colunas: [N("Nº"), T("Cliente", 30), T("CPF/CNPJ", 20), D("Abertura"), D("Prazo"), D("Entregue em"), T("Status", 14),
                M("Total"), M("Pago"), M("Saldo"), T("Arte", 10), T("Arte aprovada", 12), T("Observações", 40)],
            linhas: ordens.map((o) => [o.numero, ...clienteDoDocumento(o), o.dataCriacao, o.prazoFinal, o.dataEntregaReal, o.status,
                o.valorTotal, o.valorPago || 0, Math.max((o.valorTotal || 0) - (o.valorPago || 0), 0),
                o.arte && o.arte.origem, o.arte && o.arte.aprovada ? "Sim" : "Não", o.observacoes]),
        },
        {
            nome: "Itens das OS",
            colunas: [N("OS nº"), T("Produto / serviço", 34), N("Quantidade"), M("Valor unitário"), M("Subtotal")],
            linhas: ordens.flatMap((o) => o.produtos.map((i) => [o.numero, i.descricao, i.quantidade, i.valorUnitario, i.subtotal])),
        },
        {
            nome: "Pagamentos",
            colunas: [N("OS nº"), D("Data"), T("Forma", 18), M("Valor")],
            linhas: ordens.flatMap((o) => (o.pagamentos || []).map((p) => [o.numero, p.data, p.forma, p.valor])),
        },
        {
            nome: "Orçamentos",
            colunas: [N("Nº"), T("Cliente", 30), T("CPF/CNPJ", 20), D("Data"), D("Validade"), N("Prazo (dias)"), T("Status", 12),
                M("Total"), T("OS geradas", 14), T("Observações", 40)],
            linhas: orcamentos.map((q) => [q.numero, ...clienteDoDocumento(q), q.dataCriacao, q.validade, q.prazoProducaoDias, q.status,
                q.valorTotal, (q.osGeradas || []).map((o) => o && o.numero).filter(Boolean).join(", "), q.observacoes]),
        },
        {
            nome: "Itens dos orçamentos",
            colunas: [N("Orçamento nº"), T("Produto / serviço", 34), N("Quantidade"), M("Valor unitário"), M("Subtotal")],
            linhas: orcamentos.flatMap((q) => q.produtos.map((i) => [q.numero, i.descricao, i.quantidade, i.valorUnitario, i.subtotal])),
        },
        {
            nome: "Produtos",
            colunas: [T("Nome", 30), T("Categoria", 18), T("Descrição", 30), T("Material", 18), T("Tamanho", 12), T("Cores", 8),
                T("Acabamento", 18), T("Unidade", 10), M("Valor"), T("Ativo", 7)],
            linhas: produtos.map((p) => [p.nome, p.categoria, p.descricao, p.material, p.tamanho, p.cores, p.acabamento, p.unidade,
                p.valorUnitario, simNao(p.ativo)]),
        },
        {
            nome: "Insumos",
            colunas: [T("Nome", 30), T("Categoria", 16), T("Unidade", 10), N("Quantidade"), N("Estoque mínimo"), M("Custo unitário"),
                T("Fornecedor", 24), T("Ativo", 7)],
            linhas: insumos.map((i) => [i.nome, i.categoria, i.unidade, i.quantidade, i.estoqueMinimo, i.custoUnitario,
                i.fornecedor && i.fornecedor.nome, simNao(i.ativo)]),
        },
        {
            nome: "Movimentos de estoque",
            colunas: [T("Insumo", 30), D("Data"), T("Tipo", 10), N("Quantidade"), N("Saldo"), T("Motivo", 30), T("Usuário", 18)],
            linhas: insumos.flatMap((i) => (i.movimentos || []).map((m) => [i.nome, m.data, m.tipo, m.quantidade, m.saldo, m.motivo, m.usuario])),
        },
        {
            nome: "Fornecedores",
            colunas: [T("Nome", 30), T("CNPJ/CPF", 20), T("Contato", 20), T("Telefone", 16), T("E-mail", 28), T("Fornece", 24),
                T("Observações", 30), T("Ativo", 7)],
            linhas: fornecedores.map((f) => [f.nome, f.documento, f.contato, f.telefone, f.email, f.fornece, f.observacoes, simNao(f.ativo)]),
        },
        {
            nome: "Usuários",
            colunas: [T("Nome", 28), T("Login", 16), T("Perfil", 14), T("Ativo", 7), D("Cadastro")],
            linhas: usuarios.map((u) => [u.nome, u.login, u.perfil, simNao(u.ativo), u.dataCadastro]),
        },
    ];
}

async function planilhaCompleta() {
    const abas = await abasDaExportacao();
    const buffer = await gerarPlanilha(abas, { titulo: "Gráfica OS: todos os dados" });
    return { buffer, contagem: Object.fromEntries(abas.map((a) => [a.nome, a.linhas.length])) };
}

module.exports = { planilhaCompleta, abasDaExportacao };

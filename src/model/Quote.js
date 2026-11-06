/**
 * Modelo de dados dos Orçamentos
 * O cliente pede, a gráfica orça e, se aprovado, o orçamento vira uma OS.
 */

const { model, Schema, Types } = require('mongoose');
const { proximoNumero } = require('./Counter.js');
const { campoItens, calcularTotais } = require('./itens.js');
const clienteNoDocumento = require('./clienteNoDocumento.js');

// "vencido" não é gravado: é um orçamento pendente com a validade passada
const STATUS = ['pendente', 'aprovado', 'recusado'];

const quoteSchema = new Schema({
    numero: {
        type: Number,
        unique: true,
        index: true
    },
    cliente: {
        type: Types.ObjectId,
        ref: 'Clientes',
        required: [true, 'Selecione o cliente']
    },
    produtos: campoItens,
    // Calculado automaticamente a partir dos itens
    valorTotal: {
        type: Number
    },
    dataCriacao: {
        type: Date,
        default: Date.now
    },
    // Até quando o preço vale
    validade: {
        type: Date,
        required: [true, 'Informe a validade do orçamento']
    },
    // Dias para produzir depois da aprovação (vira o prazo da OS)
    prazoProducaoDias: {
        type: Number,
        default: 5,
        min: [1, 'O prazo de produção deve ser de pelo menos 1 dia']
    },
    status: {
        type: String,
        enum: { values: STATUS, message: 'Status inválido: {VALUE}' },
        default: 'pendente'
    },
    observacoes: {
        type: String
    },
    // OS criada quando o orçamento foi aprovado
    osGerada: {
        type: Types.ObjectId,
        ref: 'ServiceOrder'
    }
}, { versionKey: false });

quoteSchema.pre('validate', function () {
    calcularTotais(this);
});

// Número sequencial próprio dos orçamentos (separado do das OS)
quoteSchema.pre('save', async function () {
    if (this.isNew && this.numero == null) {
        this.numero = await proximoNumero('quote');
    }
});

// Pendente e com a validade já passada (a validade vale até o fim do dia)
function estaVencido(orcamento) {
    if (orcamento.status !== 'pendente') return false;
    const fimDoDia = new Date(orcamento.validade);
    fimDoDia.setHours(23, 59, 59, 999);
    return fimDoDia < new Date();
}

quoteSchema.plugin(clienteNoDocumento);

module.exports = model('Quote', quoteSchema);
module.exports.STATUS = STATUS;
module.exports.estaVencido = estaVencido;

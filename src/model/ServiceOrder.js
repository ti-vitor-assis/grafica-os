/**
 * Modelo de dados das Ordens de Serviço
 * Criação da coleção (MongoDB)
 */

const { model, Schema, Types } = require('mongoose');
const { proximoNumero } = require('./Counter.js');
const { campoItens, calcularTotais, centavos } = require('./itens.js');

// Etapas de uma OS de gráfica, na ordem em que normalmente acontecem
const STATUS = ['aberta', 'aguardando arte', 'em produção', 'pronta', 'entregue', 'cancelada'];
const ORIGEM_ARTE = ['cliente', 'gráfica'];
const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartão de débito', 'cartão de crédito', 'boleto'];

// Cada valor recebido do cliente (sinal, parcelas, quitação)
const pagamentoSchema = new Schema({
    valor: {
        type: Number,
        required: [true, 'Informe o valor do pagamento'],
        min: [0.01, 'O valor do pagamento deve ser maior que zero']
    },
    forma: {
        type: String,
        required: [true, 'Informe a forma de pagamento'],
        enum: { values: FORMAS_PAGAMENTO, message: 'Forma de pagamento inválida: {VALUE}' }
    },
    data: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const serviceOrderSchema = new Schema({
    // Número legível da OS (1, 2, 3...), mostrado ao cliente e usado na busca
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
    // Calculado automaticamente a partir dos itens (ver pre('validate') abaixo)
    valorTotal: {
        type: Number
    },
    prazoFinal: {
        type: Date,
        required: [true, 'Informe o prazo de entrega'],
        validate: {
            // Só na criação: uma OS antiga pode estar com o prazo vencido
            validator: function (prazo) {
                if (!this.isNew) return true;
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                return prazo >= hoje;
            },
            message: 'O prazo de entrega não pode estar no passado'
        }
    },
    dataCriacao: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: { values: STATUS, message: 'Status inválido: {VALUE}' },
        default: 'aberta'
    },
    observacoes: {
        type: String
    },
    // Preenchida automaticamente quando o status muda para "entregue"
    dataEntregaReal: {
        type: Date
    },
    arte: {
        origem: {
            type: String,
            enum: { values: ORIGEM_ARTE, message: 'Origem da arte inválida: {VALUE}' },
            default: 'cliente'
        },
        aprovada: {
            type: Boolean,
            default: false
        },
        // Preenchida automaticamente quando a arte é marcada como aprovada
        dataAprovacao: {
            type: Date
        }
    },
    pagamentos: {
        type: [pagamentoSchema],
        default: []
    },
    // Calculados a partir dos pagamentos (ver pre('validate') abaixo)
    valorPago: {
        type: Number,
        default: 0
    },
    pago: {
        type: Boolean,
        default: false
    }
}, { versionKey: false });

// Regras aplicadas sempre que a OS é salva (create ou save).
// Ficam no modelo para valerem não importa de onde a OS venha:
// o valor que chega da tela nunca é usado direto.
serviceOrderSchema.pre('validate', function () {
    // Subtotais e total recalculados
    calcularTotais(this);

    // Total pago e situação (quitada quando o pago cobre o total)
    this.valorPago = centavos(this.pagamentos.reduce((soma, p) => soma + (p.valor || 0), 0));
    this.pago = this.valorTotal > 0 && this.valorPago >= this.valorTotal;
    if (this.valorPago > this.valorTotal) {
        this.invalidate('pagamentos', 'O total pago não pode ser maior que o valor da OS');
    }

    // Data de entrega real: preenche ao marcar "entregue" e limpa se voltar atrás
    if (this.status === 'entregue') {
        if (!this.dataEntregaReal) this.dataEntregaReal = new Date();
    } else {
        this.dataEntregaReal = undefined;
    }

    // Data de aprovação da arte: mesma ideia
    if (this.arte && this.arte.aprovada) {
        if (!this.arte.dataAprovacao) this.arte.dataAprovacao = new Date();
    } else if (this.arte) {
        this.arte.dataAprovacao = undefined;
    }
});

// Ao criar uma OS nova, pega o próximo número da sequência.
// Fica no pre('save'), que roda DEPOIS da validação: assim uma OS recusada
// não consome um número e a numeração não fica com buracos.
serviceOrderSchema.pre('save', async function () {
    if (this.isNew && this.numero == null) {
        this.numero = await proximoNumero('serviceOrder');
    }
});

module.exports = model('ServiceOrder', serviceOrderSchema);
module.exports.STATUS = STATUS;
module.exports.ORIGEM_ARTE = ORIGEM_ARTE;
module.exports.FORMAS_PAGAMENTO = FORMAS_PAGAMENTO;

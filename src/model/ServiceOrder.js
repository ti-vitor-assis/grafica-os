/**
 * Modelo de dados das Ordens de Serviço
 * Criação da coleção (MongoDB)
 */

const { model, Schema, Types } = require('mongoose');
const { proximoNumero } = require('./Counter.js');

// Etapas de uma OS de gráfica, na ordem em que normalmente acontecem
const STATUS = ['aberta', 'aguardando arte', 'em produção', 'pronta', 'entregue', 'cancelada'];
const ORIGEM_ARTE = ['cliente', 'gráfica'];
const FORMAS_PAGAMENTO = ['', 'dinheiro', 'pix', 'cartão de débito', 'cartão de crédito', 'boleto'];

// Arredonda para centavos (evita 0.1 + 0.2 = 0.30000000000000004)
const centavos = (valor) => Math.round(valor * 100) / 100;

const itemSchema = new Schema({
    produto: {
        type: Types.ObjectId,
        ref: 'Product',
        required: true
    },
    // Cópia do nome do produto no momento da OS: se o produto for
    // renomeado depois, a OS continua mostrando o que foi vendido
    descricao: {
        type: String
    },
    quantidade: {
        type: Number,
        required: true,
        min: [1, 'A quantidade deve ser pelo menos 1']
    },
    valorUnitario: {
        type: Number,
        required: true,
        min: [0, 'O valor unitário não pode ser negativo']
    },
    subtotal: {
        type: Number
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
    produtos: {
        type: [itemSchema],
        validate: {
            validator: (itens) => itens.length > 0,
            message: 'A OS precisa ter pelo menos 1 item'
        }
    },
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
    pagamento: {
        sinal: {
            type: Number,
            default: 0,
            min: [0, 'O sinal não pode ser negativo']
        },
        formaPagamento: {
            type: String,
            enum: { values: FORMAS_PAGAMENTO, message: 'Forma de pagamento inválida: {VALUE}' },
            default: ''
        },
        pago: {
            type: Boolean,
            default: false
        }
    }
}, { versionKey: false });

// Regras aplicadas sempre que a OS é salva (create ou save).
// Ficam no modelo para valerem não importa de onde a OS venha:
// o valor que chega da tela nunca é usado direto.
serviceOrderSchema.pre('validate', function () {
    // Subtotais e total recalculados
    let total = 0;
    for (const item of this.produtos) {
        item.subtotal = centavos(item.quantidade * item.valorUnitario);
        total += item.subtotal;
    }
    this.valorTotal = centavos(total);

    if (this.pagamento && this.pagamento.sinal > this.valorTotal) {
        this.invalidate('pagamento.sinal', 'O sinal não pode ser maior que o valor total');
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

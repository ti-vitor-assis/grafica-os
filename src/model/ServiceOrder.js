const { model, Schema, Types } = require('mongoose');
const { proximoNumero } = require('./Counter.js');

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
        required: true
    },
    produtos: [{
        produto: {
            type: Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantidade: {
            type: Number,
            required: true
        },
        valorUnitario: {
            type: Number,
            required: true
        },
        subtotal: {
            type: Number,
            required: true
        }
    }],
    valorTotal: {
        type: Number,
        required: true
    },
    prazoFinal: {
        type: Date,
        required: true
    },
    dataCriacao: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['aberta', 'em produção', 'finalizada', 'cancelada'],
        default: 'aberta'
    },
    observacoes: {
        type: String
    },
    dataEntregaReal: {
        type: Date
    }
}, { versionKey: false });

// Ao criar uma OS nova, pega o próximo número da sequência
serviceOrderSchema.pre('validate', async function () {
    if (this.isNew && this.numero == null) {
        this.numero = await proximoNumero('serviceOrder');
    }
});

module.exports = model('ServiceOrder', serviceOrderSchema);
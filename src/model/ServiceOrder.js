const { model, Schema, Types } = require('mongoose');

const serviceOrderSchema = new Schema({
    cliente: {
        type: Types.ObjectId,
        ref: 'Clientes',
        required: true
    },
    produtos: [{
        produto: {
            type: Types.ObjectId,
            ref: 'Produto',
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

module.exports = model('ServiceOrder', serviceOrderSchema);
const { model, Schema } = require('mongoose');

const productSchema = new Schema({
    nome: {
        type: String,
        required: true
    },
    categoria: {
        type: String,
        required: true
    },
    descricao: {
        type: String 
    },
    material: {
        type: String 
    },
    tamanho: {
        type: String 
    },
    cores: {
        type: String 
    },
    acabamento: {
        type: String 
    },
    valorUnitario: {
        type: Number,
        required: true
    },
    estoque: {
        type: Number,
        default: 0
    },
    personalizavel: {
        type: Boolean,
        default: false
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    },
    imagens: [{
        type: String // URLs das imagens do produto
    }]
}, { versionKey: false });

module.exports = model('Product', productSchema);
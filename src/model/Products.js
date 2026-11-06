/**
 * Modelo de dados dos Produtos e Serviços da gráfica
 * Criação da coleção (MongoDB)
 */

const { model, Schema } = require('mongoose');

// Unidades de venda mais comuns em gráfica:
// cartão de visita por milheiro, panfleto por cento, banner por m², etc.
const UNIDADES = ['un', 'cento', 'milheiro', 'm²', 'pacote'];

const productSchema = new Schema({
    nome: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    categoria: {
        type: String,
        required: true,
        trim: true
    },
    descricao: {
        type: String
    },
    material: {
        type: String // ex.: Couché 300g, Lona 440g, Vinil adesivo
    },
    tamanho: {
        type: String // ex.: 9x5cm, A4, 1x1m
    },
    cores: {
        type: String // ex.: 4x0, 4x4, 1x0
    },
    acabamento: {
        type: String // ex.: Laminação fosca, Verniz localizado, Ilhós
    },
    unidade: {
        type: String,
        enum: UNIDADES,
        default: 'un'
    },
    valorUnitario: {
        type: Number,
        required: true,
        min: 0
    },
    ativo: {
        type: Boolean,
        default: true
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

module.exports = model('Product', productSchema);
module.exports.UNIDADES = UNIDADES;

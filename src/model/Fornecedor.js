/**
 * Modelo de dados dos Fornecedores (papel, tinta, lona, serviços terceirizados...)
 */

const { model, Schema } = require('mongoose');

const fornecedorSchema = new Schema({
    nome: {
        type: String,
        required: [true, 'Informe o nome do fornecedor'],
        trim: true,
        index: true
    },
    // CNPJ ou CPF
    documento: {
        type: String,
        trim: true
    },
    contato: {
        type: String // pessoa de contato
    },
    telefone: {
        type: String
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    // O que costuma ser comprado dele (ex.: "papéis couché, tintas")
    fornece: {
        type: String
    },
    observacoes: {
        type: String
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

module.exports = model('Fornecedor', fornecedorSchema);

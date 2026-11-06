/**
 * Configurações compartilhadas por todos os computadores que usam o mesmo
 * banco (ex.: a impressão das chaves de criptografia, migrações já feitas).
 * Cada documento: { _id: "nome", valor: ... }
 */

const { model, Schema } = require('mongoose');

const configuracaoSchema = new Schema({
    _id: {
        type: String
    },
    valor: {
        type: Schema.Types.Mixed
    },
    atualizadoEm: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

module.exports = model('Configuracao', configuracaoSchema, 'configuracoes');

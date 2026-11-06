/**
 * Registro de auditoria: quem fez o quê e quando.
 *
 * LGPD: guarda só o login do funcionário, a ação e a referência (id ou
 * número do documento). Nunca nome, CPF/CNPJ ou contato de cliente.
 */

const { model, Schema } = require('mongoose')

const auditoriaSchema = new Schema({
    data: { type: Date, default: Date.now, index: true },
    usuario: String,     // login de quem fez ("—" quando ninguém estava logado)
    acao: { type: String, required: true },
    referencia: String,  // ex.: "cliente 6650...", "OS 12"
    detalhe: String
}, { versionKey: false, collection: 'auditoria' })

module.exports = model('Auditoria', auditoriaSchema)

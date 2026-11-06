/**
 * Cópia do cliente gravada em cada OS e orçamento ("como era na época").
 *
 * - O histórico continua legível mesmo se o cliente for alterado,
 *   desativado ou anonimizado (LGPD)
 * - A busca por CPF/CNPJ acha as OS e orçamentos pela cópia (índice cifrado),
 *   além de pelo cadastro atual do cliente
 *
 * O documento fica cifrado aqui também (mesma chave dos clientes).
 */

const { Schema } = require('mongoose')
const Clientes = require('./Clientes.js')

const clienteCopiaSchema = new Schema({
    nome: String,
    tipoPessoa: { type: String, enum: ['PF', 'PJ'] },
    documentoCifrado: String,
    documentoBusca: String
}, { _id: false })

function clienteNoDocumento(schema) {
    schema.add({ clienteCopia: { type: clienteCopiaSchema, default: undefined } })
    schema.index({ 'clienteCopia.documentoBusca': 1 })

    // Ao criar o documento ou trocar o cliente, copia os dados atuais
    schema.pre('validate', async function () {
        if (!this.cliente) return
        if (!this.isNew && !this.isModified('cliente') && this.clienteCopia && this.clienteCopia.nome) return
        const id = this.cliente._id || this.cliente
        const c = await Clientes.findById(id).select('nome tipoPessoa documentoCifrado documentoBusca')
        if (!c) return
        this.clienteCopia = {
            nome: c.nome,
            tipoPessoa: c.tipoPessoa || 'PF',
            documentoCifrado: c.documentoCifrado,
            documentoBusca: c.documentoBusca
        }
    })
}

module.exports = clienteNoDocumento

/**
 * Modelo de dados dos Clientes
 * Criação da coleção (MongoDB)
 *
 * LGPD: só os dados que a gráfica precisa (identificação, contato e
 * endereço para entrega/nota). O CPF/CNPJ nunca é gravado em texto puro:
 * fica cifrado (documentoCifrado) e com um índice para busca exata
 * (documentoBusca). Ver src/seguranca/cripto.js.
 */

const { model, Schema } = require('mongoose')

const clientesSchema = new Schema({
    // PF = pessoa física (CPF) / PJ = pessoa jurídica (CNPJ)
    tipoPessoa: {
        type: String,
        enum: { values: ['PF', 'PJ'], message: 'Tipo de pessoa inválido: {VALUE}' },
        default: 'PF'
    },
    // Nome completo (PF) ou razão social (PJ)
    nome: {
        type: String,
        required: [true, 'Informe o nome'],
        trim: true
    },
    nomeFantasia: {
        type: String,
        trim: true
    },
    inscricaoEstadual: {
        type: String,
        trim: true
    },
    documentoCifrado: {
        type: String
    },
    documentoBusca: {
        type: String
    },
    // Opcional: só se a gráfica usar (ex.: mensagem de aniversário)
    dataNascimento: {
        type: Date
    },
    telefone: {
        type: String
    },
    telefone2: {
        type: String
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    cep: {
        type: String
    },
    endereco: {
        type: String
    },
    numero: {
        type: String
    },
    complemento: {
        type: String
    },
    bairro: {
        type: String
    },
    cidade: {
        type: String
    },
    estado: {
        type: String
    },
    // Cliente com histórico não é excluído: é desativado (ou anonimizado)
    ativo: {
        type: Boolean,
        default: true
    },
    // Dados pessoais apagados a pedido do titular (LGPD); as OS e
    // orçamentos continuam existindo
    anonimizado: {
        type: Boolean,
        default: false
    },
    dataAnonimizacao: {
        type: Date
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    }
    // As OS do cliente não ficam aqui: cada OS guarda o _id do cliente
    // (campo "cliente" em ServiceOrder.js). Para listar as OS de um cliente:
    // serviceOrderModel.find({ cliente: id })
}, { versionKey: false })

// Um CPF/CNPJ só pode estar em um cliente (clientes anonimizados ficam sem documento)
clientesSchema.index(
    { documentoBusca: 1 },
    { unique: true, partialFilterExpression: { documentoBusca: { $type: 'string' } } }
)

module.exports = model('Clientes', clientesSchema)

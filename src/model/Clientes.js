/**
 * Modelo de dados dos Clientes
 * Criação da coleção (MongoDB)
 */

const { model, Schema } = require('mongoose')

const clientesSchema = new Schema({
    nome: {
        type: String
    },
    rg: {
        type: String
    },
    cpf: {
        type: String,
        unique: true,
        index: true
    },
    sexo: {
        type: String
    },
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
        type: String
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
    }
    // As OS do cliente não ficam aqui: cada OS guarda o _id do cliente
    // (campo "cliente" em ServiceOrder.js). Para listar as OS de um cliente:
    // serviceOrderModel.find({ cliente: id })
}, { versionKey: false })


module.exports = model ('Clientes', clientesSchema)
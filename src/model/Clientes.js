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
    senha: {
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
    },
    serviceOrders:{
        type:Array
    }



}, { versionKey: false })


module.exports = model ('Clientes', clientesSchema)
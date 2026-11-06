/**
 *
 * @Author Vitor de Assis Passos
 */

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })

const mongoose = require('mongoose')

// A string de conexão fica no arquivo .env (que não vai para o Git).
// Veja o modelo em .env.example
const url = process.env.MONGO_URL

let conectado = false

// Retorna true se a conexão estiver ativa e false se falhar
const conectar = async () => {
    if (!conectado) {
        if (!url) {
            console.log("MONGO_URL não definida. Crie o arquivo .env (veja .env.example)")
            return false
        }
        try {
            await mongoose.connect(url, { serverSelectionTimeoutMS: 10000 })
            conectado = true
            console.log("MongoDB Conectado!")
        } catch (error) {
            console.log(error)
        }
    }
    return conectado
}

const desconectar = async () => {
    if (conectado) {
        try {
            await mongoose.disconnect()
            conectado = false
            console.log("MongoDB Desconectado!")
        } catch (error) {
            //console.log(error)
        }
    }
}

module.exports = { conectar, desconectar }

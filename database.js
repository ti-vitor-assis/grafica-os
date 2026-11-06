/**
 *
 * @Author Vitor de Assis Passos
 */

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const mongoose = require('mongoose')

// A string de conexão fica no arquivo .env (que não vai para o Git).
// Veja o modelo em .env.example
const url = process.env.MONGO_URL

let conectado = false

const conectar = async () => {
    if (!conectado) {
        try {
            await mongoose.connect(url)
            conectado = true
            console.log("MongoDB Conectado!")
        } catch (error) {
            console.log(error)
        }
    }
}

const desconectar = async () => {
    if (conectado) {
        try {
            await mongoose.disconnect(url)
            conectado = false
            console.log("MongoDB Desconectado!")
        } catch (error) {
            //console.log(error)
        }
    }
}

module.exports = { conectar, desconectar }

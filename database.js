/**
 * 
 * @Author Vitor de Assis Passos
 */

const mongoose = require('mongoose')

const url = 'mongodb+srv://USUARIO:SENHA@cluster0.fnijm.mongodb.net/serviceOrderPrintingPress'

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
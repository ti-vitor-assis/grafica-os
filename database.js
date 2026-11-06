/**
 *
 * @Author Vitor de Assis Passos
 */

const path = require('node:path')
const fs = require('node:fs')

// Onde fica o arquivo .env com a string de conexão (MONGO_URL):
// 1) na pasta do projeto, durante o desenvolvimento (npm start)
// 2) na pasta de dados do usuário, no app instalado, porque o .env não
//    vai dentro do instalador: %APPDATA%\grafica-os\.env no Windows
function pastaDadosUsuario() {
    try {
        const { app } = require('electron')
        return app && app.getPath ? app.getPath('userData') : null
    } catch (error) {
        return null // fora do Electron (ex.: scripts de teste)
    }
}
const arquivoEnvUsuario = pastaDadosUsuario() ? path.join(pastaDadosUsuario(), '.env') : null
const arquivoEnv = [path.join(__dirname, '.env'), arquivoEnvUsuario].find((p) => p && fs.existsSync(p))
if (arquivoEnv) {
    // Variáveis já definidas no sistema têm prioridade sobre o arquivo
    require('dotenv').config({ path: arquivoEnv, quiet: true })
}

const mongoose = require('mongoose')

// A string de conexão fica no arquivo .env (que não vai para o Git).
// Veja o modelo em .env.example
const url = process.env.MONGO_URL

let conectado = false
// Se várias janelas pedirem a conexão ao mesmo tempo, todas aguardam a
// mesma tentativa (em vez de chamar mongoose.connect() várias vezes)
let conexaoEmAndamento = null

// Retorna true se a conexão estiver ativa e false se falhar
const conectar = async () => {
    if (conectado) return true
    if (!url) {
        console.log("MONGO_URL não definida. Crie o arquivo .env (veja .env.example)")
        return false
    }
    if (!conexaoEmAndamento) {
        conexaoEmAndamento = mongoose
            .connect(url, { serverSelectionTimeoutMS: 10000 })
            .then(() => {
                conectado = true
                console.log("MongoDB Conectado!")
            })
            .catch((error) => console.log(error))
            .finally(() => {
                conexaoEmAndamento = null
            })
    }
    await conexaoEmAndamento
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

// configurado: se existe MONGO_URL; arquivoEnvUsuario: onde criar o .env no app instalado
module.exports = { conectar, desconectar, configurado: !!url, arquivoEnvUsuario }

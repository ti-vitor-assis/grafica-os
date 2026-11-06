/**
 * Conexão com o MongoDB
 * @Author Vitor de Assis Passos
 *
 * De onde vem a string de conexão, em ordem:
 * 1) variável MONGO_URL (ou o arquivo .env da pasta do projeto, no desenvolvimento)
 * 2) a configuração salva pela tela "Configurar banco de dados" (ver src/configuracao.js)
 */

const path = require('node:path')
const fs = require('node:fs')

const arquivoEnv = path.join(__dirname, '.env')
if (fs.existsSync(arquivoEnv)) {
    // Variáveis já definidas no sistema têm prioridade sobre o arquivo
    require('dotenv').config({ path: arquivoEnv, quiet: true })
}

const mongoose = require('mongoose')

// Campos que não existem no modelo são ignorados nos filtros de busca
// (uma consulta com campo inventado não vira "traga tudo")
mongoose.set('strictQuery', true)

// Se a URL veio do ambiente/.env, a tela de configuração não pode trocá-la
const urlDoAmbiente = !!process.env.MONGO_URL
let url = process.env.MONGO_URL || null

let conectado = false
// Se várias janelas pedirem a conexão ao mesmo tempo, todas aguardam a
// mesma tentativa (em vez de chamar mongoose.connect() várias vezes)
let conexaoEmAndamento = null

// Usada pelo main com a URL salva na configuração
function definirUrl(novaUrl) {
    url = novaUrl || null
}

const temUrl = () => !!url
const estaConectado = () => conectado

// Retorna true se a conexão estiver ativa e false se falhar
const conectar = async () => {
    if (conectado) return true
    if (!url) {
        console.log("Banco de dados não configurado")
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
    try {
        await mongoose.disconnect()
    } catch (error) {
        //console.log(error)
    }
    if (conectado) console.log("MongoDB Desconectado!")
    conectado = false
}

// Traduz os erros mais comuns de conexão para o usuário
function mensagemDeErro(error) {
    const texto = String((error && error.message) || error)
    if (/Invalid scheme|Invalid connection string|URI must include|mongodb\+srv URI|Invalid URL/i.test(texto)) {
        return 'String de conexão inválida. Ela deve começar com mongodb:// ou mongodb+srv://'
    }
    if (/bad auth|Authentication failed|auth/i.test(texto)) {
        return 'Usuário ou senha do banco incorretos.'
    }
    if (/ENOTFOUND|querySrv|getaddrinfo/i.test(texto)) {
        return 'Servidor não encontrado. Confira o endereço do cluster e a conexão com a internet.'
    }
    if (/ECONNREFUSED/i.test(texto)) {
        return 'Nenhum MongoDB respondeu nesse endereço. Se for o MongoDB local, confira se o serviço está rodando.'
    }
    if (/timed out|Server selection|ETIMEDOUT/i.test(texto)) {
        return 'Tempo esgotado. Confira a internet e, no Atlas, se o acesso deste IP está liberado (Network Access).'
    }
    return texto
}

// Testa uma string de conexão sem mexer na conexão atual do sistema
async function testarConexao(urlTeste) {
    let conexao
    try {
        conexao = mongoose.createConnection(urlTeste, { serverSelectionTimeoutMS: 8000 })
        await conexao.asPromise()
        await conexao.db.admin().ping()
        return { ok: true }
    } catch (error) {
        return { ok: false, erro: mensagemDeErro(error) }
    } finally {
        if (conexao) await conexao.close().catch(() => {})
    }
}

module.exports = {
    conectar, desconectar, definirUrl, temUrl, estaConectado, testarConexao, urlDoAmbiente,
}

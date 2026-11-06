/**
 * Arquivo de chave para levar as chaves de criptografia a outro computador
 * da gráfica. O conteúdo é cifrado com uma senha (scrypt + AES-256-GCM):
 * sem a senha, o arquivo não serve para nada.
 */

const crypto = require("node:crypto");

const FORMATO = "grafica-os-chave";
const TAMANHO_MINIMO_SENHA = 8;

function derivar(senha, sal) {
    return crypto.scryptSync(String(senha), sal, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

// chaves: { cifra, busca } em base64; impressao: para conferir na importação
function criarArquivo(chaves, impressao, senha) {
    if (typeof senha !== "string" || senha.length < TAMANHO_MINIMO_SENHA) {
        throw new Error(`A senha do arquivo deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`);
    }
    const sal = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv("aes-256-gcm", derivar(senha, sal), iv);
    const dados = Buffer.concat([cifrador.update(JSON.stringify(chaves), "utf8"), cifrador.final()]);
    return JSON.stringify({
        formato: FORMATO,
        versao: 1,
        impressao,
        criadoEm: new Date().toISOString(),
        sal: sal.toString("base64"),
        iv: iv.toString("base64"),
        tag: cifrador.getAuthTag().toString("base64"),
        dados: dados.toString("base64"),
    }, null, 2);
}

// Devolve { chaves, impressao } ou lança erro com mensagem para o usuário
function lerArquivo(conteudo, senha) {
    let arquivo;
    try {
        arquivo = JSON.parse(conteudo);
    } catch (erro) {
        throw new Error("O arquivo escolhido não é um arquivo de chave do Gráfica OS.");
    }
    if (!arquivo || arquivo.formato !== FORMATO) {
        throw new Error("O arquivo escolhido não é um arquivo de chave do Gráfica OS.");
    }
    try {
        const decifrador = crypto.createDecipheriv(
            "aes-256-gcm",
            derivar(senha, Buffer.from(arquivo.sal, "base64")),
            Buffer.from(arquivo.iv, "base64")
        );
        decifrador.setAuthTag(Buffer.from(arquivo.tag, "base64"));
        const texto = Buffer.concat([
            decifrador.update(Buffer.from(arquivo.dados, "base64")),
            decifrador.final(),
        ]).toString("utf8");
        return { chaves: JSON.parse(texto), impressao: arquivo.impressao };
    } catch (erro) {
        throw new Error("Senha do arquivo de chave incorreta.");
    }
}

module.exports = { criarArquivo, lerArquivo, TAMANHO_MINIMO_SENHA };

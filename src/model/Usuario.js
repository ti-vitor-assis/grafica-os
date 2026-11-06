/**
 * Modelo de dados dos Usuários (funcionários que usam o sistema)
 * A senha nunca é gravada: só o hash bcrypt dela.
 */

const { model, Schema } = require('mongoose');
const bcrypt = require('bcryptjs');

// O que cada perfil pode fazer fica no main.js (PERMISSOES)
const PERFIS = ['administrador', 'atendente', 'produção'];
const TAMANHO_MINIMO_SENHA = 8;
// Tentativas de login erradas seguidas até bloquear, e por quanto tempo
const LIMITE_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 5;

const usuarioSchema = new Schema({
    nome: {
        type: String,
        required: [true, 'Informe o nome'],
        trim: true
    },
    login: {
        type: String,
        required: [true, 'Informe o login'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-z0-9._-]{3,30}$/, 'O login deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou _']
    },
    senhaHash: {
        type: String,
        required: true
    },
    perfil: {
        type: String,
        enum: { values: PERFIS, message: 'Perfil inválido: {VALUE}' },
        default: 'atendente'
    },
    ativo: {
        type: Boolean,
        default: true
    },
    // Proteção contra tentativa de adivinhar a senha
    tentativasFalhas: {
        type: Number,
        default: 0
    },
    bloqueadoAte: {
        type: Date
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

// Regras de senha nova (as senhas antigas continuam valendo até serem trocadas)
function problemaNaSenha(senha) {
    if (typeof senha !== 'string' || senha.length < TAMANHO_MINIMO_SENHA) {
        return `A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`;
    }
    if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
        return 'A senha deve ter letras e números';
    }
    return null;
}

// Gera o hash da senha (lança erro se ela não seguir as regras)
usuarioSchema.methods.definirSenha = async function (senha) {
    const problema = problemaNaSenha(senha);
    if (problema) throw new Error(problema);
    this.senhaHash = await bcrypt.hash(senha, 10);
};

// Bloqueio por tentativas erradas
usuarioSchema.methods.estaBloqueado = function () {
    return !!this.bloqueadoAte && this.bloqueadoAte > new Date();
};

usuarioSchema.methods.registrarFalha = function () {
    this.tentativasFalhas = (this.tentativasFalhas || 0) + 1;
    if (this.tentativasFalhas >= LIMITE_TENTATIVAS) {
        this.bloqueadoAte = new Date(Date.now() + MINUTOS_BLOQUEIO * 60000);
        this.tentativasFalhas = 0;
    }
};

usuarioSchema.methods.liberarAcesso = function () {
    this.tentativasFalhas = 0;
    this.bloqueadoAte = undefined;
};

usuarioSchema.methods.conferirSenha = function (senha) {
    return bcrypt.compare(String(senha || ''), this.senhaHash);
};

// Dados que podem sair do main (nunca o hash)
usuarioSchema.methods.publico = function () {
    return {
        _id: String(this._id), nome: this.nome, login: this.login, perfil: this.perfil, ativo: this.ativo,
        bloqueado: this.estaBloqueado(),
    };
};

module.exports = model('Usuario', usuarioSchema);
module.exports.PERFIS = PERFIS;
module.exports.TAMANHO_MINIMO_SENHA = TAMANHO_MINIMO_SENHA;
module.exports.LIMITE_TENTATIVAS = LIMITE_TENTATIVAS;
module.exports.MINUTOS_BLOQUEIO = MINUTOS_BLOQUEIO;
module.exports.problemaNaSenha = problemaNaSenha;

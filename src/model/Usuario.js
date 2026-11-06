/**
 * Modelo de dados dos Usuários (funcionários que usam o sistema)
 * A senha nunca é gravada: só o hash bcrypt dela.
 */

const { model, Schema } = require('mongoose');
const bcrypt = require('bcryptjs');

// O que cada perfil pode fazer fica no main.js (PERMISSOES)
const PERFIS = ['administrador', 'atendente', 'produção'];
const TAMANHO_MINIMO_SENHA = 6;

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
    dataCadastro: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

// Gera o hash da senha (lança erro se for curta demais)
usuarioSchema.methods.definirSenha = async function (senha) {
    if (typeof senha !== 'string' || senha.length < TAMANHO_MINIMO_SENHA) {
        throw new Error(`A senha deve ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`);
    }
    this.senhaHash = await bcrypt.hash(senha, 10);
};

usuarioSchema.methods.conferirSenha = function (senha) {
    return bcrypt.compare(String(senha || ''), this.senhaHash);
};

// Dados que podem sair do main (nunca o hash)
usuarioSchema.methods.publico = function () {
    return { _id: String(this._id), nome: this.nome, login: this.login, perfil: this.perfil, ativo: this.ativo };
};

module.exports = model('Usuario', usuarioSchema);
module.exports.PERFIS = PERFIS;
module.exports.TAMANHO_MINIMO_SENHA = TAMANHO_MINIMO_SENHA;

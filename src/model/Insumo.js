/**
 * Modelo de dados dos Insumos (papel, tinta, lona, vinil...) e do estoque.
 * A quantidade em estoque só muda por movimentações (entrada, saída ou
 * ajuste), que ficam registradas com data, motivo e usuário.
 */

const { model, Schema, Types } = require('mongoose');

const UNIDADES = ['folha', 'resma', 'm²', 'metro', 'rolo', 'litro', 'kg', 'unidade', 'caixa'];
const TIPOS_MOVIMENTO = ['entrada', 'saída', 'ajuste'];

const movimentoSchema = new Schema({
    tipo: {
        type: String,
        enum: TIPOS_MOVIMENTO,
        required: true
    },
    // entrada/saída: quantidade movimentada; ajuste: novo saldo contado
    quantidade: {
        type: Number,
        required: true
    },
    saldo: {
        type: Number // estoque depois do movimento
    },
    motivo: {
        type: String
    },
    usuario: {
        type: String // nome de quem lançou
    },
    data: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const insumoSchema = new Schema({
    nome: {
        type: String,
        required: [true, 'Informe o nome do insumo'],
        trim: true,
        index: true
    },
    categoria: {
        type: String, // ex.: Papel, Tinta, Lona, Acabamento
        trim: true
    },
    unidade: {
        type: String,
        enum: { values: UNIDADES, message: 'Unidade inválida: {VALUE}' },
        default: 'unidade'
    },
    quantidade: {
        type: Number,
        default: 0,
        min: [0, 'O estoque não pode ficar negativo']
    },
    // Abaixo disso, o insumo aparece no alerta de estoque baixo
    estoqueMinimo: {
        type: Number,
        default: 0,
        min: [0, 'O estoque mínimo não pode ser negativo']
    },
    custoUnitario: {
        type: Number,
        default: 0,
        min: [0, 'O custo não pode ser negativo']
    },
    fornecedor: {
        type: Types.ObjectId,
        ref: 'Fornecedor'
    },
    ativo: {
        type: Boolean,
        default: true
    },
    movimentos: {
        type: [movimentoSchema],
        default: []
    }
}, { versionKey: false });

// Registra uma movimentação e atualiza a quantidade em estoque
insumoSchema.methods.movimentar = function (tipo, quantidade, motivo, usuario) {
    quantidade = Number(quantidade);
    if (!TIPOS_MOVIMENTO.includes(tipo)) throw new Error('Tipo de movimentação inválido');
    if (!(quantidade >= 0) || (tipo !== 'ajuste' && quantidade === 0)) {
        throw new Error('Informe uma quantidade maior que zero');
    }

    let saldo;
    if (tipo === 'entrada') saldo = this.quantidade + quantidade;
    else if (tipo === 'saída') saldo = this.quantidade - quantidade;
    else saldo = quantidade; // ajuste: contagem física

    if (saldo < 0) {
        throw new Error(`Estoque insuficiente: há ${this.quantidade} ${this.unidade} de ${this.nome}`);
    }
    // Evita resíduos como 0.30000000000000004
    this.quantidade = Math.round(saldo * 1000) / 1000;
    this.movimentos.push({ tipo, quantidade, saldo: this.quantidade, motivo, usuario });
};

module.exports = model('Insumo', insumoSchema);
module.exports.UNIDADES = UNIDADES;
module.exports.TIPOS_MOVIMENTO = TIPOS_MOVIMENTO;

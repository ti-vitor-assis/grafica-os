/**
 * Itens (produtos) usados pela Ordem de Serviço e pelo Orçamento,
 * e o cálculo de subtotais e total.
 */

const { Schema, Types } = require('mongoose');

// Arredonda para centavos (evita 0.1 + 0.2 = 0.30000000000000004)
const centavos = (valor) => Math.round(valor * 100) / 100;

const itemSchema = new Schema({
    produto: {
        type: Types.ObjectId,
        ref: 'Product',
        required: true
    },
    // Cópia do nome do produto no momento do documento: se o produto for
    // renomeado depois, a OS/orçamento continua mostrando o que foi vendido
    descricao: {
        type: String
    },
    quantidade: {
        type: Number,
        required: true,
        min: [1, 'A quantidade deve ser pelo menos 1']
    },
    valorUnitario: {
        type: Number,
        required: true,
        min: [0, 'O valor unitário não pode ser negativo']
    },
    subtotal: {
        type: Number
    }
}, { _id: false });

// Campo "produtos" com a regra de pelo menos 1 item
const campoItens = {
    type: [itemSchema],
    validate: {
        validator: (itens) => itens.length > 0,
        message: 'Adicione pelo menos 1 item'
    }
};

// Recalcula subtotais e total do documento (o valor vindo da tela é ignorado)
function calcularTotais(doc) {
    let total = 0;
    for (const item of doc.produtos) {
        item.subtotal = centavos(item.quantidade * item.valorUnitario);
        total += item.subtotal;
    }
    doc.valorTotal = centavos(total);
}

module.exports = { itemSchema, campoItens, calcularTotais, centavos };

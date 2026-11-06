/**
 * Contadores sequenciais (ex.: número da OS)
 * Cada documento guarda o último número usado de uma sequência:
 * { _id: 'serviceOrder', seq: 42 }
 */

const { model, Schema } = require('mongoose');

const counterSchema = new Schema({
    _id: {
        type: String
    },
    seq: {
        type: Number,
        default: 0
    }
}, { versionKey: false });

const Counter = model('Counter', counterSchema);

// Devolve o próximo número da sequência.
// O $inc é atômico no MongoDB, então duas OS criadas ao mesmo tempo
// nunca recebem o mesmo número.
async function proximoNumero(nomeSequencia) {
    const contador = await Counter.findByIdAndUpdate(
        nomeSequencia,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return contador.seq;
}

module.exports = Counter;
module.exports.proximoNumero = proximoNumero;

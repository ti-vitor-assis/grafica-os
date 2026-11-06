/**
 * Proteções de segurança (rodam com: npm test)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { limparEntrada } = require("../../src/seguranca/entrada.js");

describe("Limpeza da entrada do IPC", () => {
    it("remove operadores do MongoDB em qualquer nível", () => {
        assert.deepEqual(limparEntrada({ clienteId: { $ne: null } }), { clienteId: {} });
        assert.deepEqual(limparEntrada({ a: [{ $gt: "" }, { b: { $where: "1" } }] }), { a: [{}, { b: {} }] });
    });

    it("remove chaves de prototype pollution", () => {
        const limpo = limparEntrada(JSON.parse('{"__proto__": {"admin": true}, "constructor": 1, "nome": "x"}'));
        assert.deepEqual(Object.keys(limpo), ["nome"]);
        assert.equal({}.admin, undefined);
    });

    it("mantém os dados normais das telas", () => {
        const os = { cliente: "665f2a", produtos: [{ produto: "a1", quantidade: 2, valorUnitario: 10.5 }], pago: false, obs: null };
        assert.deepEqual(limparEntrada(os), os);
        assert.equal(limparEntrada("texto"), "texto");
        assert.equal(limparEntrada(42), 42);
    });

    it("corta textos enormes e estruturas profundas demais", () => {
        assert.equal(limparEntrada("x".repeat(50000)).length, 20000);
        let fundo = {};
        const raiz = fundo;
        for (let i = 0; i < 30; i++) fundo = fundo.f = {};
        assert.ok(JSON.stringify(limparEntrada(raiz)).length < 200);
    });
});

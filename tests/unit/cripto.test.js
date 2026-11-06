/**
 * Criptografia e validação de documentos (rodam com: npm test)
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const cripto = require("../../src/seguranca/cripto.js");

beforeEach(() => cripto.definirChaves(cripto.gerarChaves()));

describe("Criptografia do documento", () => {
    it("cifra e decifra, com resultado diferente a cada vez", () => {
        const a = cripto.cifrar("52998224725");
        const b = cripto.cifrar("52998224725");
        assert.notEqual(a, b);
        assert.ok(!a.includes("52998224725"));
        assert.equal(cripto.decifrar(a), "52998224725");
        assert.equal(cripto.decifrar(b), "52998224725");
    });

    it("índice de busca é sempre igual para o mesmo número, com ou sem pontuação", () => {
        assert.equal(cripto.indiceBusca("529.982.247-25"), cripto.indiceBusca("52998224725"));
        assert.notEqual(cripto.indiceBusca("52998224725"), cripto.indiceBusca("11144477735"));
        assert.match(cripto.indiceBusca("52998224725"), /^[0-9a-f]{64}$/);
    });

    it("outra chave não decifra nem gera o mesmo índice", () => {
        const cifrado = cripto.cifrar("52998224725");
        const indice = cripto.indiceBusca("52998224725");
        const impressao = cripto.impressaoChaves();
        cripto.definirChaves(cripto.gerarChaves());
        assert.throws(() => cripto.decifrar(cifrado));
        assert.notEqual(cripto.indiceBusca("52998224725"), indice);
        assert.notEqual(cripto.impressaoChaves(), impressao);
    });

    it("detecta dado cifrado adulterado", () => {
        const cifrado = cripto.cifrar("52998224725");
        const adulterado = cifrado.slice(0, -4) + (cifrado.endsWith("A") ? "BBBB" : "AAAA");
        assert.throws(() => cripto.decifrar(adulterado));
    });

    it("sem chaves configuradas, não cifra", () => {
        cripto.definirChaves(null);
        assert.equal(cripto.temChaves(), false);
        assert.throws(() => cripto.cifrar("1"), /chave de criptografia/);
    });
});

describe("CPF e CNPJ", () => {
    it("valida os dígitos verificadores", () => {
        assert.equal(cripto.cpfValido("529.982.247-25"), true);
        assert.equal(cripto.cpfValido("529.982.247-24"), false);
        assert.equal(cripto.cpfValido("111.111.111-11"), false);
        assert.equal(cripto.cnpjValido("11.222.333/0001-81"), true);
        assert.equal(cripto.cnpjValido("11.222.333/0001-80"), false);
        assert.equal(cripto.cnpjValido("00.000.000/0000-00"), false);
    });

    it("formata e mascara", () => {
        assert.equal(cripto.formatarDocumento("52998224725"), "529.982.247-25");
        assert.equal(cripto.formatarDocumento("11222333000181"), "11.222.333/0001-81");
        assert.equal(cripto.mascararDocumento("52998224725"), "***.982.247-**");
        assert.equal(cripto.mascararDocumento("11222333000181"), "**.222.333/0001-**");
    });
});

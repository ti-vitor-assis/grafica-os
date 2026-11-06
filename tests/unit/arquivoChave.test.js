/**
 * Arquivo de chave protegido por senha (rodam com: npm test)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const arquivoChave = require("../../src/seguranca/arquivoChave.js");
const cripto = require("../../src/seguranca/cripto.js");

describe("Arquivo de chave", () => {
    const chaves = cripto.gerarChaves();

    it("ida e volta com a senha certa", () => {
        const conteudo = arquivoChave.criarArquivo(chaves, "abc123", "senha-forte-1");
        assert.ok(!conteudo.includes(chaves.cifra) && !conteudo.includes(chaves.busca));
        const lido = arquivoChave.lerArquivo(conteudo, "senha-forte-1");
        assert.deepEqual(lido.chaves, chaves);
        assert.equal(lido.impressao, "abc123");
    });

    it("recusa senha errada, arquivo estranho e senha curta", () => {
        const conteudo = arquivoChave.criarArquivo(chaves, "x", "senha-forte-1");
        assert.throws(() => arquivoChave.lerArquivo(conteudo, "errada"), /Senha do arquivo/);
        assert.throws(() => arquivoChave.lerArquivo("{}", "x"), /não é um arquivo de chave/);
        assert.throws(() => arquivoChave.lerArquivo("não é json", "x"), /não é um arquivo de chave/);
        assert.throws(() => arquivoChave.criarArquivo(chaves, "x", "curta"), /pelo menos 8/);
    });
});

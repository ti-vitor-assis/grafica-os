/**
 * O app instalado roda com um package.json reduzido pelo electron-builder
 * (sem "build", "scripts", "devDependencies"). O main só pode usar os campos
 * que continuam lá. (rodam com: npm test)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
const main = fs.readFileSync(path.join(RAIZ, "main.js"), "utf8");
const pacote = require(path.join(RAIZ, "package.json"));

// Campos que o electron-builder mantém no package.json empacotado
const MANTIDOS = ["name", "version", "description", "main", "repository", "author", "license", "bugs", "homepage", "dependencies"];

describe("App empacotado", () => {
    it("o main só lê do package.json campos que existem no app instalado", () => {
        const usados = [...new Set([...main.matchAll(/packageInfo\.(\w+)/g)].map((m) => m[1]))];
        const proibidos = usados.filter((campo) => !MANTIDOS.includes(campo));
        assert.deepEqual(proibidos, [], `campos que somem no app instalado: ${proibidos.join(", ")}`);
    });

    it("o APP_ID do main é o mesmo appId do instalador", () => {
        const appId = (main.match(/const APP_ID = "([^"]+)"/) || [])[1];
        assert.equal(appId, pacote.build.appId);
    });
});

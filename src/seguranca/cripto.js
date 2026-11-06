/**
 * Criptografia dos documentos (CPF/CNPJ) guardados no banco.
 *
 * Cada documento é gravado em dois campos:
 * - cifrado (AES-256-GCM, com valor aleatório a cada vez): para mostrar o
 *   número quando necessário. Quem tem só o banco não consegue ler.
 * - índice de busca (HMAC-SHA256): sempre o mesmo resultado para o mesmo
 *   número, para buscar pelo documento exato e impedir duplicados. Sem a
 *   chave, não dá para descobrir o número nem testar números possíveis.
 *
 * As duas chaves são diferentes e ficam só nos computadores da gráfica
 * (src/configuracao.js), nunca no banco.
 */

const crypto = require("node:crypto");

const VERSAO = "v1";
let chaves = null; // { cifra: Buffer, busca: Buffer }

function gerarChaves() {
    return {
        cifra: crypto.randomBytes(32).toString("base64"),
        busca: crypto.randomBytes(32).toString("base64"),
    };
}

// Recebe as chaves em base64 (como ficam guardadas)
function definirChaves(novas) {
    if (!novas) {
        chaves = null;
        return;
    }
    const cifra = Buffer.from(novas.cifra, "base64");
    const busca = Buffer.from(novas.busca, "base64");
    if (cifra.length !== 32 || busca.length !== 32) throw new Error("Chave de criptografia inválida");
    chaves = { cifra, busca };
}

const temChaves = () => chaves !== null;

function exigirChaves() {
    if (!chaves) throw new Error("A chave de criptografia deste computador não foi configurada");
}

// "529.982.247-25" -> "52998224725"
const soDigitos = (texto) => String(texto ?? "").replace(/\D/g, "");

function cifrar(texto) {
    exigirChaves();
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv("aes-256-gcm", chaves.cifra, iv);
    const dados = Buffer.concat([cifrador.update(String(texto), "utf8"), cifrador.final()]);
    const tag = cifrador.getAuthTag();
    return `${VERSAO}:${Buffer.concat([iv, tag, dados]).toString("base64")}`;
}

function decifrar(valor) {
    exigirChaves();
    if (!valor) return "";
    const [versao, conteudo] = String(valor).split(":");
    if (versao !== VERSAO || !conteudo) throw new Error("Formato de dado cifrado desconhecido");
    const bruto = Buffer.from(conteudo, "base64");
    const decifrador = crypto.createDecipheriv("aes-256-gcm", chaves.cifra, bruto.subarray(0, 12));
    decifrador.setAuthTag(bruto.subarray(12, 28));
    return Buffer.concat([decifrador.update(bruto.subarray(28)), decifrador.final()]).toString("utf8");
}

// Índice cego: o mesmo documento sempre gera o mesmo valor (só com a chave)
function indiceBusca(documento) {
    exigirChaves();
    return crypto.createHmac("sha256", chaves.busca).update(soDigitos(documento)).digest("hex");
}

// Identifica as chaves sem revelá-las: guardada no banco para saber se um
// computador está usando as mesmas chaves que os outros
function impressaoChaves() {
    exigirChaves();
    return crypto.createHmac("sha256", chaves.busca).update("grafica-os:impressao-das-chaves").digest("hex").slice(0, 16);
}

// ===== Validação e formatação de CPF/CNPJ =====

function cpfValido(cpf) {
    const d = soDigitos(cpf);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const digito = (base) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
}

function cnpjValido(cnpj) {
    const d = soDigitos(cnpj);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const digito = (base) => {
        const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const soma = base.split("").reduce((s, n, i) => s + Number(n) * pesos[i], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    return digito(d.slice(0, 12)) === Number(d[12]) && digito(d.slice(0, 13)) === Number(d[13]);
}

function formatarDocumento(documento) {
    const d = soDigitos(documento);
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return d;
}

// Mostra só o miolo do documento: ***.982.247-** ou **.345.678/0001-**
function mascararDocumento(documento) {
    const d = soDigitos(documento);
    if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
    if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
    return d ? "***" : "";
}

module.exports = {
    gerarChaves, definirChaves, temChaves, cifrar, decifrar, indiceBusca, impressaoChaves,
    soDigitos, cpfValido, cnpjValido, formatarDocumento, mascararDocumento,
};

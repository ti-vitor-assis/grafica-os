/**
 * Regras de cliente usadas pelo main: validação e cifragem do documento
 * (CPF/CNPJ) e o que cada tela pode receber.
 *
 * - Ficha do cliente (tela de Clientes): recebe o documento completo
 * - Demais telas (OS, orçamentos, listas): só o documento mascarado
 */

const cripto = require("../seguranca/cripto.js");

const texto = (valor) => (valor == null ? "" : String(valor).trim());

// Valida e cifra o CPF/CNPJ. Lança erro com mensagem para o usuário.
function camposDocumento(tipoPessoa, documento) {
    const digitos = cripto.soDigitos(documento);
    if (tipoPessoa === "PJ") {
        if (!cripto.cnpjValido(digitos)) throw new Error("CNPJ inválido. Confira os números digitados.");
    } else if (!cripto.cpfValido(digitos)) {
        throw new Error("CPF inválido. Confira os números digitados.");
    }
    return { documentoCifrado: cripto.cifrar(digitos), documentoBusca: cripto.indiceBusca(digitos) };
}

// Dados vindos da tela de Clientes -> campos do modelo
function dadosClienteDaTela(c) {
    const tipoPessoa = c.tipoPessoa === "PJ" ? "PJ" : "PF";
    return {
        tipoPessoa,
        nome: texto(c.nome),
        nomeFantasia: tipoPessoa === "PJ" ? texto(c.nomeFantasia) : "",
        inscricaoEstadual: tipoPessoa === "PJ" ? texto(c.inscricaoEstadual) : "",
        // "AAAA-MM-DD" vira meia-noite UTC (a tela lê em UTC)
        dataNascimento: tipoPessoa === "PF" && c.dataNascimento ? new Date(c.dataNascimento) : null,
        telefone: texto(c.telefone),
        telefone2: texto(c.telefone2),
        email: texto(c.email),
        cep: texto(c.cep),
        endereco: texto(c.endereco),
        numero: texto(c.numero),
        complemento: texto(c.complemento),
        bairro: texto(c.bairro),
        cidade: texto(c.cidade),
        estado: texto(c.estado),
        ativo: c.ativo !== false,
        ...camposDocumento(tipoPessoa, c.documento),
    };
}

// Documento decifrado (só dígitos); vazio se não houver ou se a chave faltar
function documentoDe(c) {
    if (!c || !c.documentoCifrado || !cripto.temChaves()) return "";
    try {
        return cripto.decifrar(c.documentoCifrado);
    } catch (erro) {
        return "";
    }
}

const rotuloDocumento = (c) => (c && c.tipoPessoa === "PJ" ? "CNPJ" : "CPF");

// Cliente -> objeto enviado para as telas. Nunca envia os campos cifrados.
function clienteParaTela(c, { completo = false } = {}) {
    const documento = documentoDe(c);
    const resumo = {
        _id: String(c._id),
        tipoPessoa: c.tipoPessoa || "PF",
        nome: c.nome,
        nomeFantasia: c.nomeFantasia || "",
        rotuloDocumento: rotuloDocumento(c),
        documentoMascarado: cripto.mascararDocumento(documento),
        cidade: c.cidade || "",
        estado: c.estado || "",
        ativo: c.ativo !== false,
        anonimizado: !!c.anonimizado,
    };
    if (!completo) return resumo;
    return {
        ...resumo,
        documento: cripto.formatarDocumento(documento),
        inscricaoEstadual: c.inscricaoEstadual || "",
        dataNascimento: c.dataNascimento || null,
        telefone: c.telefone || "",
        telefone2: c.telefone2 || "",
        email: c.email || "",
        cep: c.cep || "",
        endereco: c.endereco || "",
        numero: c.numero || "",
        complemento: c.complemento || "",
        bairro: c.bairro || "",
    };
}

module.exports = { dadosClienteDaTela, clienteParaTela, documentoDe, rotuloDocumento, camposDocumento };

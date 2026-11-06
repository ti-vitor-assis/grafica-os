/**
 * Tela de Clientes: cadastro de pessoa física (CPF) ou jurídica (CNPJ)
 * @Author Vitor de Assis
 *
 * O CPF/CNPJ vai para o main, que valida de novo, cifra e grava
 * (ver src/servicos/clientes.js). Esta tela só recebe o documento completo
 * na ficha do cliente; nas listas ele aparece mascarado.
 */

const frmSearchClient = document.getElementById("frmSearchClient");
const frmCli = document.getElementById("frmCli");
const searchClient = document.getElementById("searchClientsInput");
const campo = (id) => document.getElementById(id);

let arrayClient = [];

// ============================
// ===== PESSOA FÍSICA/JURÍDICA

const tipoPessoa = () => document.querySelector('input[name="tipoPessoa"]:checked').value;

function aplicarTipoPessoa() {
    const pj = tipoPessoa() === "PJ";
    campo("rotuloNome").textContent = pj ? "Razão social" : "Nome completo";
    campo("rotuloDocumento").textContent = pj ? "CNPJ" : "CPF";
    campo("inputDocumento").placeholder = pj ? "00.000.000/0000-00" : "000.000.000-00";
    document.querySelectorAll(".so-pj").forEach((el) => (el.hidden = !pj));
    document.querySelectorAll(".so-pf").forEach((el) => (el.hidden = pj));
    if (campo("inputDocumento").value) checarDocumento();
}

function marcarTipoPessoa(tipo) {
    document.querySelector(`input[name="tipoPessoa"][value="${tipo === "PJ" ? "PJ" : "PF"}"]`).checked = true;
    aplicarTipoPessoa();
}

// ============================
// ===== VALIDAÇÃO DO DOCUMENTO
// (o main valida de novo; aqui é só para avisar na hora)

const soDigitos = (texto) => String(texto || "").replace(/\D/g, "");

function digitoVerificador(numeros, pesos) {
    const soma = pesos.reduce((total, peso, i) => total + Number(numeros[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(cpf) {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const d1 = digitoVerificador(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = digitoVerificador(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function cnpjValido(cnpj) {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    const d1 = digitoVerificador(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = digitoVerificador(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function formatarDocumento(digitos) {
    if (digitos.length === 11) return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (digitos.length === 14) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return digitos;
}

function checarDocumento() {
    const input = campo("inputDocumento");
    const digitos = soDigitos(input.value);
    const valido = tipoPessoa() === "PJ" ? cnpjValido(digitos) : cpfValido(digitos);
    input.classList.remove("valido", "invalido");
    input.classList.add(valido ? "valido" : "invalido");
    if (valido) input.value = formatarDocumento(digitos);
    return valido;
}

// O main avisa quando o documento já está cadastrado ou é inválido
api.cpfDuplicate(() => {
    const input = campo("inputDocumento");
    input.focus();
    input.select();
    input.classList.remove("valido");
    input.classList.add("invalido");
});

// ============================
// ======== CEP (ViaCEP) ======

function buscarEndereco() {
    const cep = soDigitos(campo("inputCep").value);
    if (cep.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then((response) => response.json())
        .then((dados) => {
            if (dados.erro) return;
            campo("inputEndereco").value = dados.logradouro || "";
            campo("inputBairro").value = dados.bairro || "";
            campo("inputCidade").value = dados.localidade || "";
            campo("inputEstado").value = dados.uf || "";
            campo("inputNum").focus();
        })
        .catch(() => console.error("Não foi possível buscar o CEP"));
}

// ============================
// ======== SALVAR ============

function dadosDoFormulario() {
    return {
        tipoPessoa: tipoPessoa(),
        nome: campo("inputNome").value,
        documento: campo("inputDocumento").value,
        nomeFantasia: campo("inputNomeFantasia").value,
        inscricaoEstadual: campo("inputIE").value,
        dataNascimento: campo("inputDataNasc").value,
        ativo: campo("inputAtivo").checked,
        telefone: campo("inputTelefone").value,
        telefone2: campo("inputTelefone2").value,
        email: campo("inputEmail").value,
        cep: campo("inputCep").value,
        endereco: campo("inputEndereco").value,
        numero: campo("inputNum").value,
        complemento: campo("inputComplemento").value,
        bairro: campo("inputBairro").value,
        cidade: campo("inputCidade").value,
        estado: campo("inputEstado").value,
    };
}

frmCli.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = campo("inputIdClient").value;
    if (id === "") {
        api.createCliente(dadosDoFormulario());
    } else {
        api.updateClient({ _id: id, ...dadosDoFormulario() });
    }
});

// ======== EXCLUIR =========
function removeClient() {
    api.deleteClient(campo("inputIdClient").value);
}

// A data de nascimento é gravada como meia-noite UTC ("2000-05-10" vira
// 2000-05-10T00:00Z). Lendo no horário local (UTC-3) ela voltava para o
// dia 9; por isso usamos os getters UTC.
function formatDate(date) {
    date = new Date(date);
    if (isNaN(date)) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// ============================
// ==== RESETAR FORMULÁRIO ====

function resetForm() {
    location.reload();
}

api.resetForm(() => resetForm());

// ============================
// ======== BUSCA =============

// Só números (com ou sem pontuação) = busca por CPF/CNPJ; senão, por nome
function searchClients() {
    const termo = searchClient.value.trim();
    if (termo === "") {
        api.validateSearch();
    } else if (/^[\d.\-/\s]+$/.test(termo)) {
        api.searchCpf({ termo, ficha: true });
    } else {
        api.searchName({ termo, ficha: true });
    }
}

frmSearchClient.addEventListener("submit", (event) => {
    event.preventDefault();
    searchClients();
});

// O listener é registrado UMA vez só (senão cada busca acumularia mais um)
api.renderClient((event, client) => {
    arrayClient = JSON.parse(client);
    mostrarResultados(arrayClient);
    if (arrayClient.length > 0) preencherCliente(arrayClient[0]);
});

// Preenche o formulário com um cliente
function preencherCliente(c) {
    campo("tituloForm").textContent = "Editar cliente";
    campo("inputIdClient").value = c._id;
    marcarTipoPessoa(c.tipoPessoa);
    campo("inputNome").value = c.nome || "";
    campo("inputDocumento").value = c.documento || "";
    campo("inputDocumento").classList.remove("valido", "invalido");
    campo("inputNomeFantasia").value = c.nomeFantasia || "";
    campo("inputIE").value = c.inscricaoEstadual || "";
    campo("inputDataNasc").value = c.dataNascimento ? formatDate(c.dataNascimento) : "";
    campo("inputAtivo").checked = c.ativo !== false;
    campo("inputTelefone").value = c.telefone || "";
    campo("inputTelefone2").value = c.telefone2 || "";
    campo("inputEmail").value = c.email || "";
    campo("inputCep").value = c.cep || "";
    campo("inputEndereco").value = c.endereco || "";
    campo("inputNum").value = c.numero || "";
    campo("inputComplemento").value = c.complemento || "";
    campo("inputBairro").value = c.bairro || "";
    campo("inputCidade").value = c.cidade || "";
    campo("inputEstado").value = c.estado || "";

    // Anonimizado (LGPD): só leitura
    campo("avisoAnonimizado").hidden = !c.anonimizado;
    btnCreate.disabled = true;
    btnUpdate.disabled = !!c.anonimizado;
    btnDelete.disabled = false;
    btnAnonimizar.disabled = !!c.anonimizado;
    btnDadosCliente.disabled = false;

    document.querySelectorAll("#listaResultados .lista-item").forEach((li) => {
        li.classList.toggle("ativo", li.dataset.id === c._id);
    });
}

// Lista de clientes encontrados (documento mascarado)
function mostrarResultados(clientes) {
    const lista = campo("listaResultados");
    lista.innerHTML = "";
    campo("contagemResultados").textContent = `${clientes.length} encontrado${clientes.length === 1 ? "" : "s"}`;
    clientes.forEach((c) => {
        const li = document.createElement("li");
        li.className = "lista-item";
        li.dataset.id = c._id;
        const titulo = document.createElement("div");
        titulo.className = "lista-item-titulo";
        titulo.textContent = c.nomeFantasia ? `${c.nome} (${c.nomeFantasia})` : c.nome;
        const detalhe = document.createElement("div");
        detalhe.className = "lista-item-detalhe";
        detalhe.textContent = [
            `${c.rotuloDocumento} ${c.documentoMascarado}`,
            c.cidade,
            c.ativo === false ? "Inativo" : "",
        ].filter(Boolean).join(" · ");
        li.append(titulo, detalhe);
        li.addEventListener("click", () => preencherCliente(c));
        lista.appendChild(li);
    });
    campo("semResultados").hidden = clientes.length > 0;
}

// Busca sem resultado + "cadastrar este cliente?": leva o texto para o formulário
api.setName(() => {
    campo("inputNome").value = searchClient.value.trim();
    searchClient.value = "";
    campo("inputDocumento").focus();
});

api.setCpf(() => {
    const digitos = soDigitos(searchClient.value);
    marcarTipoPessoa(digitos.length === 14 ? "PJ" : "PF");
    campo("inputDocumento").value = formatarDocumento(digitos);
    searchClient.value = "";
    campo("inputNome").focus();
});

// ============================
// ===== EVENTOS DA TELA ======

document.addEventListener("DOMContentLoaded", () => {
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    btnAnonimizar.disabled = true;
    btnDadosCliente.disabled = true;
    btnCreate.disabled = false;
    aplicarTipoPessoa();
    searchClient.focus();
});

document.querySelectorAll('input[name="tipoPessoa"]').forEach((r) => r.addEventListener("change", aplicarTipoPessoa));
campo("inputDocumento").addEventListener("blur", () => {
    if (campo("inputDocumento").value.trim()) checarDocumento();
});
campo("inputCep").addEventListener("blur", buscarEndereco);
btnDelete.addEventListener("click", removeClient);
btnAnonimizar.addEventListener("click", () => api.anonymizeClient(campo("inputIdClient").value));
btnDadosCliente.addEventListener("click", () => api.clientDataPdf(campo("inputIdClient").value));
btnReset.addEventListener("click", resetForm);

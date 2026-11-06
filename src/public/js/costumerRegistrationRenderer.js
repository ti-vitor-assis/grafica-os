/**
 * 
 * @Author Vitor de Assis
 */

let frmSearchClient = document.getElementById("frmSearchClient");
let frmCli = document.getElementById("frmCli");
let inputIdClient = document.getElementById("inputIdClient");
let inputNome = document.getElementById("inputNome");
let inputRG = document.getElementById("inputRG");
let inputCPF = document.getElementById("inputCPF");
let inputSexo = document.getElementById("inputSexo");
let inputDataNasc = document.getElementById("inputDataNasc");
let inputTelefone = document.getElementById("inputTelefone");
let inputTelefone2 = document.getElementById("inputTelefone2");
let inputEmail = document.getElementById("inputEmail");
let inputCep = document.getElementById("inputCep");
let inputEndereco = document.getElementById("inputEndereco");
let inputNum = document.getElementById("inputNum");
let inputComplemento = document.getElementById("inputComplemento");
let inputBairro = document.getElementById("inputBairro");
let inputCidade = document.getElementById("inputCidade");
let inputEstado = document.getElementById("inputEstado");
let searchClient = document.getElementById("searchClientsInput");

// Criar um vetor global para manipular os dados do cliente
let arrayClient = [];

document.addEventListener("DOMContentLoaded", () => {
    // Desativar botões editar e excluir
    btnUpdate.disabled = true;
    btnDelete.disabled = true;
    // Ativar botão adicionar
    btnCreate.disabled = false;
  
    searchClient.focus();
  });

// Validar CPF
function validaCPF(cpf) {
    cpf = cpf.replace(/\D/g, ""); // Remove caracteres não numéricos

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false; // Verifica se tem 11 dígitos e se não é uma sequência repetida (ex: 111.111.111-11)
    }

    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf[i]) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf[i]) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[10])) return false;

    return true;
}

function checarCPF() {
    const inputCPF = document.getElementById("inputCPF");

    // Remove classes anteriores
    inputCPF.classList.remove("valido", "invalido");

    if (!validaCPF(inputCPF.value)) {
        inputCPF.classList.add("invalido");
    } else {
        inputCPF.classList.add("valido");
    }
}

function cpfDuplicate() {
    const inputCPF = document.getElementById("inputCPF");
    inputCPF.value = "";
    inputCPF.focus();

    // Indica visualmente erro
    inputCPF.classList.remove("valido");
    inputCPF.classList.add("invalido");
}

// O main avisa quando o CPF já está cadastrado (erro 11000 do MongoDB)
api.cpfDuplicate(() => {
    cpfDuplicate();
});

// Buscas CEP
function buscarEndereco() {
    let cep = document.getElementById("inputCep").value;
    let urlAPI = `https://viacep.com.br/ws/${cep}/json/`;

    fetch(urlAPI)
        .then((response) => response.json())
        .then((dados) => {
            document.getElementById("inputEndereco").value = dados.logradouro;
            document.getElementById("inputBairro").value = dados.bairro;
            document.getElementById("inputCidade").value = dados.localidade;
            document.getElementById("inputEstado").value = dados.uf;

        })
        .catch((error) => console.error("Erro ao buscar o endereço:", error));
        inputNum.focus();
}

// ======================
// == Cadastro Cliente ==

frmCli.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Estratégia para usar o submit para cadastrar um novo cliente ou editar os dados de um cliente já existente
    // verificar se existe o id do cliente

    if (inputIdClient.value === "") {
        // Cadastrar um novo cliente
        const cliente = {
            nomeCli: inputNome.value,
            rgCli: inputRG.value,
            cpfCli: inputCPF.value,
            sexoCli: inputSexo.value,
            dataNascCli: inputDataNasc.value,
            telefoneCli: inputTelefone.value,
            telefone2Cli: inputTelefone2.value,
            emailCli: inputEmail.value,
            cepCli: inputCep.value,
            enderecoCli: inputEndereco.value,
            numCli: inputNum.value,
            complementoCli: inputComplemento.value,
            bairroCli: inputBairro.value,
            cidadeCli: inputCidade.value,
            estadoCli: inputEstado.value,
        };
        api.createCliente(cliente);
    } else {
        // Alterar os dados de um cliente existente
        // Teste de validação do ID
        //console.log(inputIdClient.value);
        // Cadastrar um novo cliente
        const cliente = {
            idCli: inputIdClient.value,
            nomeCli: inputNome.value,
            rgCli: inputRG.value,
            cpfCli: inputCPF.value,
            sexoCli: inputSexo.value,
            dataNascCli: inputDataNasc.value,
            telefoneCli: inputTelefone.value,
            telefone2Cli: inputTelefone2.value,
            emailCli: inputEmail.value,
            cepCli: inputCep.value,
            enderecoCli: inputEndereco.value,
            numCli: inputNum.value,
            complementoCli: inputComplemento.value,
            bairroCli: inputBairro.value,
            cidadeCli: inputCidade.value,
            estadoCli: inputEstado.value,
        };
        api.updateClient(cliente);

    }
});

// ======== CRUD DELETE =========
function removeClient() {
    //console.log(inputIdClient.value) // teste do passo 1
    // Passo 2: Envio do id para o main
    api.deleteClient(inputIdClient.value);
    
  }

//
function formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date); // Tenta converter
    }
  
    if (isNaN(date)) {
      console.error("Data inválida:", date);
      return "";
    }
  
    // A data de nascimento é gravada como meia-noite UTC ("2000-05-10" vira
    // 2000-05-10T00:00Z). Lendo no horário local (UTC-3) ela voltava para o
    // dia 9; por isso usamos os getters UTC.
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

// 
frmSearchClient.addEventListener("submit", (event) => {
    event.preventDefault();
    searchClients();
})

// ============================
// ==== RESETAR FORMULÁRIO ====

function resetForm() {
    // recarregar a pagina
    location.reload();
  }
  
  // Uso da api resetForm quando salvar, editar ou excluir um cliente
  api.resetForm((args) => {
    resetForm();
  });


// ============================
// ======== CRUD READ =========

// Se o texto buscado só tiver números (com ou sem pontuação de CPF), busca por CPF
function searchClients() {
    const termo = searchClient.value.trim();
    if (/^[\d.\-\s]+$/.test(termo)) {
        searchCpf();
    } else {
        searchName();
    }
}

function searchCpf() {
    // Passo 1: Capturar o CPF a ser pesquisado
    let cpfCli = searchClient.value.trim();
    // Validação de campo obrigatório
    if (cpfCli === "") {
        // Enviar ao main um pedido para alertar o usuário
        api.validateSearch();
    } else {
        // Passo 2: Enviar o CPF ao main (a resposta chega em api.renderClient, abaixo)
        api.searchCpf(cpfCli);
    }
}

function searchName() {
    // Passo 1: Capturar o nome a ser pesquisado
    let cliName = searchClient.value.trim();
    // Validação de campo obrigatório
    if (cliName === "") {
        // Enviar ao main um pedido para alertar o usuário
        api.validateSearch();
    } else {
        // Passo 2: Enviar o nome do cliente ao main (a resposta chega em api.renderClient, abaixo)
        api.searchName(cliName);
    }
}

// Passo 5: Receber os dados do cliente
// IMPORTANTE: o listener é registrado UMA vez só. Se fosse registrado dentro
// da função de busca, cada nova busca acumularia mais um listener.
api.renderClient((event, client) => {
    // Passo 6: Renderização dos dados do cliente - não esquecer de converter os dados de STRING para JSON
    arrayClient = JSON.parse(client);

    // Mostra todos os encontrados na lista ao lado; o primeiro já é carregado
    mostrarResultados(arrayClient);
    if (arrayClient.length > 0) preencherCliente(arrayClient[0]);
});

// Preenche o formulário com um cliente
function preencherCliente(c) {
    inputIdClient.value = c._id;
    inputNome.value = c.nome;
    inputRG.value = c.rg || "";
    inputCPF.value = c.cpf;
    inputSexo.value = c.sexo || "";
    inputDataNasc.value = c.dataNascimento ? formatDate(c.dataNascimento) : "";
    inputTelefone.value = c.telefone || "";
    inputTelefone2.value = c.telefone2 || "";
    inputEmail.value = c.email || "";
    inputCep.value = c.cep || "";
    inputEndereco.value = c.endereco || "";
    inputNum.value = c.numero || "";
    inputComplemento.value = c.complemento || "";
    inputBairro.value = c.bairro || "";
    inputCidade.value = c.cidade || "";
    inputEstado.value = c.estado || "";
    inputCPF.classList.remove("valido", "invalido");
    // restaurar tecla Enter
    restaurarEnter();
    // Desativar o botão adicionar
    btnCreate.disabled = true;
    // Ativar os botões editar e excluir
    btnUpdate.disabled = false;
    btnDelete.disabled = false;
    // Marca o cliente na lista
    document.querySelectorAll("#listaResultados .lista-item").forEach((li) => {
        li.classList.toggle("ativo", li.dataset.id === c._id);
    });
}

// Lista de clientes encontrados na busca
function mostrarResultados(clientes) {
    const lista = document.getElementById("listaResultados");
    lista.innerHTML = "";
    document.getElementById("contagemResultados").textContent =
        `${clientes.length} encontrado${clientes.length === 1 ? "" : "s"}`;
    clientes.forEach((c) => {
        const li = document.createElement("li");
        li.className = "lista-item";
        li.dataset.id = c._id;
        const titulo = document.createElement("div");
        titulo.className = "lista-item-titulo";
        titulo.textContent = c.nome;
        const detalhe = document.createElement("div");
        detalhe.className = "lista-item-detalhe";
        detalhe.textContent = [`CPF ${c.cpf}`, c.telefone, c.cidade].filter(Boolean).join(" · ");
        li.append(titulo, detalhe);
        li.addEventListener("click", () => preencherCliente(c));
        lista.appendChild(li);
    });
    document.getElementById("semResultados").hidden = clientes.length > 0;
}

// setar o nome do cliente o nome do cliente para fazer um novo cadastro se a busca retornar que o cliente
api.setName((args) => {
    //console.log("teste do IPC 'set-name'");
    let busca = document.getElementById("searchClientsInput").value;

    // foco no campo nome
    inputNome.focus();
    // Limpar o campo de busca
    searchClient.value = "";
    // Copiar o nome do cliente para o campo nome
    inputNome.value = busca;
    //limpa o ampo de busca (foco foi capturado de forma global)
    //busca.value = "";

    // Restaurar tecla Enter
    restaurarEnter();
});

// setar o cpf do cliente o nome do cliente para fazer um novo cadastro se a busca retornar que o cliente
api.setCpf((args) => {
    //console.log("teste do IPC 'set-name'");
    let busca = document.getElementById("searchClientsInput").value;

    // foco no campo nome
    inputNome.focus();
    // Limpar o campo de busca
    searchClient.value = "";
    // Copiar o nome do cliente para o campo nome
    inputCPF.value = busca;
    //limpa o ampo de busca (foco foi capturado de forma global)
    //busca.value = "";

    // Restaurar tecla Enter
    restaurarEnter();
});


function teclaEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // ignorar o comportamento padrão
        // executar o método de busca do cliente
        searchName();
    }
}
// função para restaurar o padrão (tecla Enter)
function restaurarEnter() {
    frmSearchClient.removeEventListener("keydown", teclaEnter);
  }
// ============================
// ===== EVENTOS DA TELA ======
// (antes eram onclick/onblur no HTML)
inputCPF.addEventListener("blur", checarCPF);
inputCep.addEventListener("blur", buscarEndereco);
btnDelete.addEventListener("click", removeClient);
btnReset.addEventListener("click", resetForm);

// Título do formulário: "Novo cliente" ou o nome de quem está sendo editado
api.renderClient(() => {
    document.getElementById("tituloForm").textContent = "Editar cliente";
});

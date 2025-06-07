/**
 * 
 * 
 */

// Referências dos elementos
let searchClientInput = document.getElementById('searchClientInput');
let btnSearchClient = document.getElementById('btnSearchClient');
let searchClient = document.getElementById('searchClientsInput');
let inputNome = document.getElementById("inputNome")
let inputIdClient = document.getElementById("inputIdClient")
let frmSearchClient = document.getElementById("frmSearchClient")


frmSearchClient.addEventListener("submit", async (event) => {
    event.preventDefault();
})

// ======== CRUD READ =========

function searchClients() {
    if (searchClient.value / searchClient.value === 1) {
        searchCpf()
    } else {
        searchName(searchClient)
    }
}

function searchCpf() {
    // console.log("Teste botão buscar")
    // Passo 1:  Capturar o nome a ser pesquisado
    let cpfCli = document.getElementById("searchClientsInput").value; // Teste do passo 1
    //console.log(cliName);
    // Validação de campo obrigatório
    if (cpfCli === "") {
        // Enviar ao main um pedido para alertar o usuário
        api.validateSearch();
    } else {
        // Passo 2: Enviar o nome do cliente ao main
        api.searchCpf(cpfCli);
        // Passo 5: Receber os dados do cliente
        api.renderClient((event, client) => {
            // Teste de recebimento dos dados do cliente
            //console.log(client);
            // Passo 6: Renderização  dos dados do cliente - não esquecer de converter os dados de STRING para JSON
            const clientData = JSON.parse(client);
            arrayClient = clientData;

            // Uso do ForEach para percorrer o vetor e extrair os dados
            arrayClient.forEach((c) => {
                inputIdClient.value = c._id;
                inputNome.value = c.nome;
                console.log(inputNome.value)
                // restaurar tecla Enter
                restaurarEnter();
                // desativar o botão adicionar
                // Desativar botões editar e excluir
                btnCreate.disabled = true;
                // Ativaros botões editar e excluir
                btnUpdate.disabled = false;
                btnDelete.disabled = false;
            });
        });
    }
}

function searchName() {
    // console.log("Teste botão buscar")
    // Passo 1:  Capturar o nome a ser pesquisado
    let cliName = document.getElementById("searchClientsInput").value; // Teste do passo 1
    //console.log(cliName);
    // Validação de campo obrigatório
    if (cliName === "") {
        // Enviar ao main um pedido para alertar o usuário
        api.validateSearch();
    } else {
        // Passo 2: Enviar o nome do cliente ao main
        api.searchName(cliName);
        // Passo 5: Receber os dados do cliente
        api.renderClient((event, client) => {
            // Teste de recebimento dos dados do cliente
            //console.log(client);
            // Passo 6: Renderização  dos dados do cliente - não esquecer de converter os dados de STRING para JSON
            const clientData = JSON.parse(client);
            arrayClient = clientData;

            // Uso do ForEach para percorrer o vetor e extrair os dados
            arrayClient.forEach((c) => {
                inputIdClient.value = c._id;
                inputNome.value = c.nome;
                // restaurar tecla Enter
                restaurarEnter();
                // desativar o botão adicionar
                // Desativar botões editar e excluir
                btnCreate.disabled = true;
                // Ativaros botões editar e excluir
                btnUpdate.disabled = false;
                btnDelete.disabled = false;
            });
        });
    }
}

function teclaEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // ignorar o comportamento padrão
        searchClients();
    }
}
// função para restaurar o padrão (tecla Enter)
function restaurarEnter() {
    frmSearchClient.removeEventListener("keydown", teclaEnter);
  }
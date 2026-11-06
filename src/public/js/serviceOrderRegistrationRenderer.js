/**
 *
 *
 */

// Referências dos elementos
let searchClient = document.getElementById('searchClientsInput');
let inputNome = document.getElementById("inputNome")
let inputIdClient = document.getElementById("inputIdClient")
let frmSearchClient = document.getElementById("frmSearchClient")


frmSearchClient.addEventListener("submit", async (event) => {
    event.preventDefault();
})

// ======== CRUD READ =========

// Se o texto buscado só tiver números (com ou sem pontuação de CPF), busca por CPF
function searchClients() {
    const termo = searchClient.value.trim()
    if (termo === "") {
        api.validateSearch()
    } else if (/^[\d.\-\s]+$/.test(termo)) {
        api.searchCpf(termo)
    } else {
        api.searchName(termo)
    }
}

// Receber os dados do cliente
// IMPORTANTE: o listener é registrado UMA vez só. Se fosse registrado dentro
// da função de busca, cada nova busca acumularia mais um listener.
api.renderClient((event, client) => {
    const arrayClient = JSON.parse(client);
    arrayClient.forEach((c) => {
        inputIdClient.value = c._id;
        inputNome.value = c.nome;
    });
});

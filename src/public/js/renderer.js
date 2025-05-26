/**
 * 
 * @Author Vitor de Assis Passos
 */


console.log("Processo de renderização")

function obterData() {
    const data = new Date();

    // Opções para formatar a data por extenso
    const optionsData = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    // Formata a data
    let dataFormatada = data.toLocaleDateString('pt-BR', optionsData);
    dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

    // Hora no formato HH:MM:SS
    const horaFormatada = data.toLocaleTimeString('pt-BR');

    return `${dataFormatada} - ${horaFormatada}`;
}

function iniciarAtualizacaoHora(idElemento) {
    function atualizarHora() {
        const elemento = document.getElementById(idElemento);
        if (elemento) {
            elemento.textContent = obterData();
        }
    }

    atualizarHora(); // executa imediatamente
    setInterval(atualizarHora, 1000); // atualiza a cada segundo
}

document.getElementById('dataAtual').innerHTML = obterData()
iniciarAtualizacaoHora('dataAtual')



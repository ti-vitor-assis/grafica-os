/**
 * Tela de Relatórios
 * @Author Vitor de Assis Passos
 */

const frmRelatorio = document.getElementById("frmRelatorio");
const campoPeriodo = document.getElementById("campoPeriodo");
const inputInicio = document.getElementById("inputInicio");
const inputFim = document.getElementById("inputFim");
const opcoes = [...document.querySelectorAll('input[name="tipo"]')];

// AAAA-MM-DD no horário local (formato do input type="date")
function paraInput(data) {
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${data.getFullYear()}-${mes}-${dia}`;
}

// Período padrão: do dia 1º do mês atual até hoje
const hoje = new Date();
inputInicio.value = paraInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
inputFim.value = paraInput(hoje);

// Se a janela foi aberta pelo menu (ex.: Relatórios > OS entregues), já marca o tipo
const tipoInicial = new URLSearchParams(location.search).get("tipo");
const opcaoInicial = opcoes.find((o) => o.value === tipoInicial);
if (opcaoInicial) opcaoInicial.checked = true;

const tipoSelecionado = () => opcoes.find((o) => o.checked);

// O período só vale para alguns relatórios; nos outros fica desabilitado
function atualizarPeriodo() {
    campoPeriodo.disabled = !tipoSelecionado().hasAttribute("data-periodo");
}
opcoes.forEach((o) => o.addEventListener("change", atualizarPeriodo));
atualizarPeriodo();

frmRelatorio.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!campoPeriodo.disabled && inputInicio.value > inputFim.value) {
        return api.warn("A data inicial não pode ser depois da data final.");
    }
    api.generateReport({
        tipo: tipoSelecionado().value,
        inicio: inputInicio.value,
        fim: inputFim.value,
    });
});

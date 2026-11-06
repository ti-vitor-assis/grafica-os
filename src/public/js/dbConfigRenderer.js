/**
 * Tela "Configurar banco de dados"
 * @Author Vitor de Assis Passos
 */

const el = (id) => document.getElementById(id);
const inputUrl = el("inputUrl");
const resultado = el("resultado");

const URL_LOCAL = "mongodb://127.0.0.1:27017/graficaos";

function mostrarResultado(texto, ok) {
    resultado.textContent = texto;
    resultado.className = `text-sm min-h-[20px] ${ok ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`;
}

function ocupado(sim, texto) {
    el("btnTestar").disabled = sim;
    el("btnSalvar").disabled = sim;
    if (sim) {
        resultado.className = "text-sm min-h-[20px] text-[var(--color-text-secondary)]";
        resultado.textContent = texto;
    }
}

api.dbConfigInfo();
api.receiveDbConfigInfo((event, info) => {
    if (info.origemAmbiente) {
        el("avisoAmbiente").hidden = false;
        [inputUrl, el("btnLocal"), el("btnTestar"), el("btnSalvar")].forEach((e) => (e.disabled = true));
        return;
    }
    if (info.urlAtual) {
        el("textoAtual").textContent =
            `Configuração atual: ${info.urlAtual} (${info.conectado ? "conectado" : "sem conexão"})`;
    } else {
        el("textoAtual").textContent = "Nenhum banco configurado ainda.";
    }
    inputUrl.focus();
});

el("btnMostrar").addEventListener("click", () => {
    const oculto = inputUrl.type === "password";
    inputUrl.type = oculto ? "text" : "password";
    el("btnMostrar").textContent = oculto ? "Ocultar" : "Mostrar";
});

el("btnLocal").addEventListener("click", () => {
    inputUrl.value = URL_LOCAL;
    inputUrl.type = "text";
    el("btnMostrar").textContent = "Ocultar";
});

el("btnTestar").addEventListener("click", () => {
    if (!inputUrl.value.trim()) return mostrarResultado("Informe a string de conexão.", false);
    ocupado(true, "Testando conexão...");
    api.testDbConfig(inputUrl.value);
});

el("frmBanco").addEventListener("submit", (event) => {
    event.preventDefault();
    ocupado(true, "Testando e salvando...");
    api.saveDbConfig(inputUrl.value);
});

// Resultado do teste (ou do salvar, quando a conexão falha;
// quando dá certo, o main fecha esta janela e abre o login)
api.dbConfigResult((event, r) => {
    ocupado(false);
    mostrarResultado(r.ok ? "Conexão funcionando! Clique em \"Salvar e conectar\"." : r.erro, r.ok);
});

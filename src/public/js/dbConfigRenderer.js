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
    resultado.className = `text-sm m-0 min-h-[20px] ${ok ? "texto-sucesso" : "texto-perigo"}`;
}

function ocupado(sim, texto) {
    el("btnTestar").disabled = sim;
    el("btnSalvar").disabled = sim;
    if (sim) {
        resultado.className = "text-sm m-0 min-h-[20px] texto-mutado";
        resultado.textContent = texto;
    }
}

api.dbConfigInfo();
api.receiveDbConfigInfo((event, info) => {
    mostrarCartaoChave(info.chaves);
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

// ===== Chave de segurança =====
function mostrarCartaoChave(chaves) {
    if (!chaves) return;
    el("cartaoChave").hidden = !(chaves.podeExportar || chaves.podeImportar);
    el("avisoChaveAusente").hidden = chaves.estado !== "ausente";
    el("frmExportar").hidden = !chaves.podeExportar;
    el("frmImportar").hidden = !chaves.podeImportar;
}

function mostrarResultadoChave(texto, ok) {
    el("resultadoChave").textContent = texto;
    el("resultadoChave").className = `text-sm m-0 min-h-[20px] ${ok ? "texto-sucesso" : "texto-perigo"}`;
}

el("frmExportar").addEventListener("submit", (event) => {
    event.preventDefault();
    if (el("inputSenhaExportar").value !== el("inputSenhaExportar2").value) {
        return mostrarResultadoChave("As senhas não conferem.", false);
    }
    api.exportKey(el("inputSenhaExportar").value);
});

el("frmImportar").addEventListener("submit", async (event) => {
    event.preventDefault();
    const arquivo = el("inputArquivoChave").files[0];
    if (!arquivo) return mostrarResultadoChave("Escolha o arquivo de chave.", false);
    api.importKey({ conteudo: await arquivo.text(), senha: el("inputSenhaImportar").value });
});

api.keyResult((event, r) => {
    if (r.cancelado) return;
    mostrarResultadoChave(r.mensagem, r.ok);
    if (r.ok) {
        el("inputSenhaExportar").value = "";
        el("inputSenhaExportar2").value = "";
        el("inputSenhaImportar").value = "";
        if (r.importada) api.dbConfigInfo();
    }
});

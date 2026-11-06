/**
 * Tela de Estoque de insumos
 * @Author Vitor de Assis Passos
 */

const el = (id) => document.getElementById(id);
const frmSupply = el("frmSupply");
const listaResultados = el("listaResultados");

const numero = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const abaixoDoMinimo = (i) => i.estoqueMinimo > 0 && i.quantidade < i.estoqueMinimo;

// Texto do botão e explicação de cada tipo de movimentação
const TIPOS = {
    "entrada": { botao: "Registrar entrada", rotulo: "Quantidade que chegou", ajuda: "Soma ao estoque (ex.: compra recebida)." },
    "saída": { botao: "Registrar saída", rotulo: "Quantidade usada", ajuda: "Tira do estoque (ex.: material usado em uma OS)." },
    "ajuste": { botao: "Registrar ajuste", rotulo: "Quantidade contada", ajuda: "O valor informado vira o novo saldo (use após contar o estoque)." },
};

let insumoAtual = null;
el("btnDelete").disabled = true;

// ========== Fornecedores para o select ==========
api.receiveSuppliers((event, dados) => {
    JSON.parse(dados).forEach((f) => {
        const opcao = document.createElement("option");
        opcao.value = f._id;
        opcao.textContent = f.nome + (f.ativo === false ? " (inativo)" : "");
        el("inputFornecedor").appendChild(opcao);
    });
});
api.searchSupplier("");

// ========== Lista de insumos (abre listando todos) ==========
api.searchSupply("");
el("frmSearchSupply").addEventListener("submit", (event) => {
    event.preventDefault();
    api.searchSupply(el("searchSupplyInput").value.trim());
});

api.receiveSupplies((event, dados) => {
    const lista = JSON.parse(dados);
    listaResultados.innerHTML = "";
    el("semResultados").hidden = lista.length > 0;
    const baixos = lista.filter(abaixoDoMinimo).length;
    el("contagemInsumos").textContent =
        `${lista.length} insumo${lista.length === 1 ? "" : "s"}` + (baixos ? ` · ${baixos} com estoque baixo` : "");

    lista.forEach((i) => {
        const li = document.createElement("li");
        li.className = "lista-item";
        li.dataset.id = i._id;
        if (insumoAtual && insumoAtual._id === i._id) li.classList.add("ativo");

        const titulo = document.createElement("div");
        titulo.className = "lista-item-titulo";
        const nome = document.createElement("span");
        nome.textContent = i.nome + (i.ativo === false ? " (inativo)" : "");
        titulo.appendChild(nome);
        if (abaixoDoMinimo(i)) {
            const badge = document.createElement("span");
            badge.className = "badge badge-perigo";
            badge.textContent = "Estoque baixo";
            titulo.appendChild(badge);
        }

        const detalhe = document.createElement("div");
        detalhe.className = "lista-item-detalhe";
        detalhe.textContent = `${numero(i.quantidade)} ${i.unidade}` + (i.categoria ? ` · ${i.categoria}` : "");

        li.append(titulo, detalhe);
        li.addEventListener("click", () => carregar(i));
        listaResultados.appendChild(li);
    });
});

// ========== Seleção de um insumo ==========
function carregar(i) {
    insumoAtual = i;
    listaResultados.querySelectorAll(".lista-item").forEach((li) => li.classList.toggle("ativo", li.dataset.id === i._id));

    el("inputIdSupply").value = i._id;
    el("tituloModo").textContent = `· ${i.nome}`;
    el("inputNome").value = i.nome;
    el("inputCategoria").value = i.categoria || "";
    el("inputUnidade").value = i.unidade;
    el("inputMinimo").value = i.estoqueMinimo || "";
    el("inputCusto").value = i.custoUnitario || "";
    el("inputFornecedor").value = i.fornecedor ? i.fornecedor._id : "";
    el("inputAtivo").checked = i.ativo !== false;
    // Depois de criado, o estoque só muda por movimentação
    el("campoInicial").hidden = true;
    el("textoSalvar").textContent = "Salvar alterações";
    el("btnDelete").disabled = false;

    mostrarEstoque(i);
    el("inputQtdMov").focus();
}

function mostrarEstoque(i) {
    el("movVazio").hidden = true;
    el("movConteudo").hidden = false;
    el("movNomeInsumo").textContent = i.nome;
    el("estoqueAtual").textContent = `${numero(i.quantidade)} ${i.unidade}`;

    const alerta = el("alertaMinimo");
    if (i.estoqueMinimo > 0) {
        alerta.className = `badge ${abaixoDoMinimo(i) ? "badge-perigo" : "badge-sucesso"}`;
        alerta.textContent = abaixoDoMinimo(i)
            ? `Abaixo do mínimo (${numero(i.estoqueMinimo)}): comprar`
            : `Acima do mínimo (${numero(i.estoqueMinimo)})`;
    } else {
        alerta.className = "badge";
        alerta.textContent = "Sem estoque mínimo definido";
    }

    // Últimas movimentações primeiro
    const tabela = el("tabelaMovimentos");
    tabela.innerHTML = "";
    [...i.movimentos].reverse().forEach((m) => {
        const tr = document.createElement("tr");
        const sinal = m.tipo === "entrada" ? "+" : m.tipo === "saída" ? "−" : "=";
        const classeTipo = { "entrada": "badge-sucesso", "saída": "badge-aviso", "ajuste": "badge-info" }[m.tipo];
        const celulas = [
            [new Date(m.data).toLocaleDateString("pt-BR"), "numero"],
            null,
            [`${sinal}${numero(m.quantidade)}`, "num"],
            [numero(m.saldo), "num"],
            [m.motivo || "—", "truncate max-w-[180px]"],
            [m.usuario || "", "texto-mutado"],
        ];
        celulas.forEach((c) => {
            const td = document.createElement("td");
            if (c) {
                td.className = c[1];
                td.textContent = c[0];
            } else {
                const badge = document.createElement("span");
                badge.className = `badge ${classeTipo}`;
                badge.textContent = m.tipo;
                td.appendChild(badge);
            }
            tr.appendChild(td);
        });
        tabela.appendChild(tr);
    });
}

// ========== Tipo de movimentação ==========
const tipoSelecionado = () => document.querySelector('input[name="tipoMov"]:checked').value;
function atualizarTipo() {
    const t = TIPOS[tipoSelecionado()];
    el("btnRegistrar").innerHTML = icone(tipoSelecionado() === "saída" ? "saida" : tipoSelecionado() === "ajuste" ? "ajuste" : "entrada", 16);
    el("btnRegistrar").append(" " + t.botao);
    el("rotuloQtd").firstChild.textContent = t.rotulo + " ";
    el("explicacaoTipo").textContent = t.ajuda;
}
document.querySelectorAll('input[name="tipoMov"]').forEach((r) => r.addEventListener("change", atualizarTipo));
atualizarTipo();

// O main responde com o insumo atualizado
el("frmMovimento").addEventListener("submit", (event) => {
    event.preventDefault();
    api.moveSupply({
        _id: el("inputIdSupply").value,
        tipo: tipoSelecionado(),
        quantidade: el("inputQtdMov").value,
        motivo: el("inputMotivo").value.trim(),
    });
});

api.supplyMoved((event, dados) => {
    const i = JSON.parse(dados);
    insumoAtual = i;
    mostrarEstoque(i);
    el("inputQtdMov").value = "";
    el("inputMotivo").value = "";
    api.searchSupply(el("searchSupplyInput").value.trim()); // atualiza a lista
});

// ========== Cadastrar / salvar ==========
frmSupply.addEventListener("submit", (event) => {
    event.preventDefault();
    const insumo = {
        nome: el("inputNome").value.trim(),
        categoria: el("inputCategoria").value.trim(),
        unidade: el("inputUnidade").value,
        estoqueMinimo: el("inputMinimo").value,
        custoUnitario: el("inputCusto").value,
        fornecedor: el("inputFornecedor").value,
        ativo: el("inputAtivo").checked,
    };
    if (el("inputIdSupply").value === "") {
        insumo.estoqueInicial = el("inputInicial").value;
        api.createSupply(insumo);
    } else {
        insumo._id = el("inputIdSupply").value;
        api.updateSupply(insumo);
    }
});

el("btnDelete").addEventListener("click", () => api.deleteSupply(el("inputIdSupply").value));
el("btnLimpar").addEventListener("click", () => location.reload());
api.resetForm(() => location.reload());

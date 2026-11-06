/**
 * Tela de Estoque de insumos
 * @Author Vitor de Assis Passos
 */

const el = (id) => document.getElementById(id);
const frmSupply = el("frmSupply");
const painelMovimento = el("painelMovimento");
const listaResultados = el("listaResultados");

const numero = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const abaixoDoMinimo = (i) => i.estoqueMinimo > 0 && i.quantidade < i.estoqueMinimo;

el("btnDelete").disabled = true;

// Fornecedores para o select
api.receiveSuppliers((event, dados) => {
    JSON.parse(dados).forEach((f) => {
        const opcao = document.createElement("option");
        opcao.value = f._id;
        opcao.textContent = f.nome + (f.ativo === false ? " (inativo)" : "");
        el("inputFornecedor").appendChild(opcao);
    });
});
api.searchSupplier("");

// Lista de insumos (abre listando todos)
api.searchSupply("");
el("frmSearchSupply").addEventListener("submit", (event) => {
    event.preventDefault();
    api.searchSupply(el("searchSupplyInput").value.trim());
});

api.receiveSupplies((event, dados) => {
    const lista = JSON.parse(dados);
    listaResultados.innerHTML = "";
    el("semResultados").hidden = lista.length > 0;
    lista.forEach((i) => {
        const li = document.createElement("li");
        li.className =
            "cursor-pointer rounded-[10px] border-b border-[var(--color-primary)] px-3 py-2 hover:bg-[var(--color-panel)]";

        const linha = document.createElement("div");
        linha.className = "flex items-center justify-between gap-2";
        const nome = document.createElement("p");
        nome.className = "font-semibold";
        nome.textContent = i.nome + (i.ativo === false ? " (inativo)" : "");
        linha.appendChild(nome);
        if (abaixoDoMinimo(i)) {
            const alerta = document.createElement("span");
            alerta.className = "bg-red-600 text-white text-xs rounded-full px-2 py-[2px] whitespace-nowrap";
            alerta.textContent = "estoque baixo";
            linha.appendChild(alerta);
        }

        const detalhe = document.createElement("p");
        detalhe.className = "text-sm text-[var(--color-text-secondary)]";
        detalhe.textContent = `${numero(i.quantidade)} ${i.unidade}` + (i.categoria ? ` · ${i.categoria}` : "");

        li.append(linha, detalhe);
        li.addEventListener("click", () => carregar(i));
        listaResultados.appendChild(li);
    });
});

// Carrega um insumo no formulário e mostra o painel de movimentação
function carregar(i) {
    el("inputIdSupply").value = i._id;
    el("tituloModo").textContent = `(${i.nome})`;
    el("inputNome").value = i.nome;
    el("inputCategoria").value = i.categoria || "";
    el("inputUnidade").value = i.unidade;
    el("inputMinimo").value = i.estoqueMinimo || "";
    el("inputCusto").value = i.custoUnitario || "";
    el("inputFornecedor").value = i.fornecedor ? i.fornecedor._id : "";
    el("inputAtivo").checked = i.ativo !== false;
    // depois de criado, o estoque só muda por movimentação
    // (style.display, porque o atributo hidden perde para a classe "flex" do Tailwind)
    el("campoInicial").style.display = "none";
    el("btnSalvar").textContent = "Salvar alterações";
    el("btnDelete").disabled = false;
    mostrarEstoque(i);
}

function mostrarEstoque(i) {
    painelMovimento.hidden = false;
    el("estoqueAtual").textContent = `${numero(i.quantidade)} ${i.unidade}`;
    const alerta = el("alertaMinimo");
    if (i.estoqueMinimo > 0) {
        alerta.textContent = abaixoDoMinimo(i)
            ? `Abaixo do mínimo (${numero(i.estoqueMinimo)}): comprar`
            : `Mínimo: ${numero(i.estoqueMinimo)}`;
        alerta.className = abaixoDoMinimo(i) ? "text-sm text-[var(--color-error)] font-semibold" : "text-sm text-[var(--color-text-secondary)]";
    } else {
        alerta.textContent = "";
    }

    // Últimas movimentações primeiro
    const tabela = el("tabelaMovimentos");
    tabela.innerHTML = "";
    [...i.movimentos].reverse().forEach((m) => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-[var(--color-panel)]";
        const sinal = m.tipo === "entrada" ? "+" : m.tipo === "saída" ? "−" : "=";
        [
            new Date(m.data).toLocaleDateString("pt-BR"),
            m.tipo,
            `${sinal}${numero(m.quantidade)}`,
            `saldo ${numero(m.saldo)}`,
            m.motivo || "",
            m.usuario || "",
        ].forEach((texto) => {
            const td = document.createElement("td");
            td.className = "px-2 py-1 truncate max-w-[140px]";
            td.textContent = texto;
            tr.appendChild(td);
        });
        tabela.appendChild(tr);
    });
}

// Cadastrar / salvar
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

// Movimentação: o main responde com o insumo atualizado
el("frmMovimento").addEventListener("submit", (event) => {
    event.preventDefault();
    api.moveSupply({
        _id: el("inputIdSupply").value,
        tipo: el("inputTipo").value,
        quantidade: el("inputQtdMov").value,
        motivo: el("inputMotivo").value.trim(),
    });
});

api.supplyMoved((event, dados) => {
    const i = JSON.parse(dados);
    mostrarEstoque(i);
    el("inputQtdMov").value = "";
    el("inputMotivo").value = "";
    api.searchSupply(el("searchSupplyInput").value.trim()); // atualiza a lista
});

el("btnDelete").addEventListener("click", () => api.deleteSupply(el("inputIdSupply").value));
el("btnLimpar").addEventListener("click", () => location.reload());
api.resetForm(() => location.reload());

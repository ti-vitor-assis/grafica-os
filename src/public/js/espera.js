/**
 * Sinais de espera: enquanto o sistema aguarda o banco (conectar, testar,
 * entrar), mostra que está trabalhando, para ninguém achar que travou.
 */

// Indicador que gira (ou pisca, para quem pediu menos movimento)
function indicadorGirando() {
    const s = document.createElement("span");
    s.className = "girando";
    s.setAttribute("aria-hidden", "true");
    return s;
}

// Põe o botão em espera ("Testando…" com o indicador) e o desabilita.
// Devolve a função que volta o botão ao normal.
function botaoEsperando(botao, texto) {
    const original = [...botao.childNodes];
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.replaceChildren(indicadorGirando(), ` ${texto}`);
    return () => {
        botao.replaceChildren(...original);
        botao.disabled = false;
        botao.removeAttribute("aria-busy");
    };
}

// Mostra "texto… 3s" com o indicador dentro do elemento; depois de
// segundosDica segundos acrescenta a dica (ex.: confira a internet).
// Devolve a função que para o contador e limpa o elemento.
function mensagemEsperando(elemento, texto, dica, segundosDica = 5) {
    const inicio = Date.now();
    const linha = document.createElement("span");
    const ajuda = document.createElement("small");
    const caixa = document.createElement("span");
    caixa.append(linha, ajuda);
    elemento.classList.add("status-espera");
    elemento.setAttribute("role", "status");
    elemento.replaceChildren(indicadorGirando(), caixa);

    const atualizar = () => {
        const segundos = Math.floor((Date.now() - inicio) / 1000);
        linha.textContent = segundos >= 1 ? `${texto}… ${segundos}s` : `${texto}…`;
        ajuda.textContent = dica && segundos >= segundosDica ? dica : "";
    };
    atualizar();
    const timer = setInterval(atualizar, 500);
    return () => {
        clearInterval(timer);
        elemento.classList.remove("status-espera");
        elemento.replaceChildren();
    };
}

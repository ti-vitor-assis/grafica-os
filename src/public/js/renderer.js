/**
 * Tela inicial (visão geral)
 * @Author Vitor de Assis Passos
 */

const el = (id) => document.getElementById(id)
const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// Nome de cada etapa como aparece na tela
const NOME_ETAPA = {
  "aberta": "Abertas",
  "aguardando arte": "Aguardando arte",
  "em produção": "Em produção",
  "pronta": "Prontas para entrega",
}

// Botões da barra lateral e do cabeçalho abrem as janelas pelo nome
document.querySelectorAll("[data-janela]").forEach((botao) => {
  botao.addEventListener("click", () => api.openWindow(botao.dataset.janela))
})
el("alertaEstoque").addEventListener("click", () => api.openWindow("estoque"))
el("alertaBackup").addEventListener("click", () => api.makeBackup())

// Pede os dados ao main
function carregarDashboard() {
  api.requestDashboard()
}

// Diferença em dias entre o prazo e hoje (negativo = atrasada)
function diasAtePrazo(prazo) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dia = new Date(prazo)
  dia.setHours(0, 0, 0, 0)
  return Math.round((dia - hoje) / 86400000)
}

// Etiqueta da coluna "Situação"
function situacao(prazo) {
  const dias = diasAtePrazo(prazo)
  if (dias < 0) return { texto: `Atrasada ${-dias} dia${dias < -1 ? "s" : ""}`, classe: "badge-perigo" }
  if (dias === 0) return { texto: "Vence hoje", classe: "badge-aviso" }
  return { texto: `Vence em ${dias} dia${dias > 1 ? "s" : ""}`, classe: "badge-info" }
}

// Produção: barra segmentada por etapa + lista com as quantidades
function desenharProducao(porEtapa, atrasadas, entreguesMes) {
  const total = porEtapa.reduce((soma, e) => soma + e.total, 0)
  el("totalAndamento").textContent = total
  el("totalAtrasadas").textContent = atrasadas
  el("totalAtrasadas").classList.toggle("texto-perigo", atrasadas > 0)
  el("totalEntreguesMes").textContent = entreguesMes

  const barra = el("barraEtapas")
  const lista = el("listaEtapas")
  barra.innerHTML = ""
  lista.innerHTML = ""
  barra.setAttribute(
    "aria-label",
    porEtapa.map((e) => `${NOME_ETAPA[e.etapa]}: ${e.total}`).join(", ")
  )

  porEtapa.forEach((e, i) => {
    if (e.total > 0) {
      const segmento = document.createElement("span")
      segmento.className = `etapa-${i + 1}`
      segmento.style.flexGrow = e.total
      segmento.title = `${NOME_ETAPA[e.etapa]}: ${e.total}`
      barra.appendChild(segmento)
    }

    const li = document.createElement("li")
    const amostra = document.createElement("span")
    amostra.className = `amostra etapa-${i + 1}`
    const nome = document.createElement("span")
    nome.textContent = NOME_ETAPA[e.etapa]
    const valor = document.createElement("b")
    valor.className = "numero"
    valor.textContent = e.total
    li.append(amostra, nome, valor)
    lista.appendChild(li)
  })
  barra.classList.toggle("vazia", total === 0)
}

api.receiveDashboard((event, dados) => {
  const { atrasadas, lista, financeiro, estoqueBaixo, porEtapa, entreguesMes, backup } = JSON.parse(dados)

  // Lembrete de backup: nunca feito ou com 7 dias ou mais (só administrador)
  const DIAS_LEMBRETE_BACKUP = 7
  const alertaBackup = el("alertaBackup")
  if (backup && (backup.dias === null || backup.dias >= DIAS_LEMBRETE_BACKUP)) {
    const titulo = document.createElement("b")
    titulo.textContent = backup.dias === null ? "Nenhum backup feito ainda: " : `Último backup há ${backup.dias} dias: `
    el("textoAlertaBackup").replaceChildren(titulo, "clique para fazer um agora e guarde-o fora deste computador")
    alertaBackup.hidden = false
  } else {
    alertaBackup.hidden = true
  }

  // Alerta de estoque baixo (vem null para quem não cuida do estoque)
  const alerta = el("alertaEstoque")
  if (estoqueBaixo && estoqueBaixo.length > 0) {
    const itens = estoqueBaixo
      .map((i) => `${i.nome} (${i.quantidade.toLocaleString("pt-BR")} ${i.unidade})`)
      .join(", ")
    el("textoAlertaEstoque").innerHTML = ""
    const titulo = document.createElement("b")
    titulo.textContent = "Estoque baixo: "
    el("textoAlertaEstoque").append(titulo, itens, " · clique para abrir o estoque")
    alerta.hidden = false
  } else {
    alerta.hidden = true
  }

  // Indicadores financeiros (vêm null para quem não tem permissão "financeiro")
  if (financeiro) {
    el("kpiRecebido").textContent = formatoMoeda.format(financeiro.recebidoMes)
    el("kpiFaturado").textContent = formatoMoeda.format(financeiro.faturadoMes)
    el("kpiReceber").textContent = formatoMoeda.format(financeiro.aReceber)
    el("kpiOrcamentos").textContent = String(financeiro.orcamentosPendentes)
  }

  desenharProducao(porEtapa, atrasadas, entreguesMes)

  // Tabela de prazos
  const tabela = el("tabelaPrazos")
  tabela.innerHTML = ""
  lista.forEach((os) => {
    const linha = document.createElement("tr")
    const { texto, classe } = situacao(os.prazoFinal)
    const colunas = [
      [String(os.numero), "numero"],
      [os.cliente ? os.cliente.nome : (os.clienteCopia && os.clienteCopia.nome) || "(cliente excluído)", "truncate max-w-[1px]"],
      // Só dia/mês: os prazos desta lista são sempre próximos de hoje
      [new Date(os.prazoFinal).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), "numero"],
    ]
    colunas.forEach(([valor, classeTd]) => {
      const td = document.createElement("td")
      td.className = classeTd
      td.textContent = valor
      linha.appendChild(td)
    })
    const td = document.createElement("td")
    const etiqueta = document.createElement("span")
    etiqueta.className = `badge ${classe}`
    etiqueta.textContent = texto
    td.appendChild(etiqueta)
    linha.appendChild(td)
    tabela.appendChild(linha)
  })
  el("semPrazos").hidden = lista.length > 0
})

// Recarrega quando alguma OS é criada, alterada ou excluída
api.onDashboardChanged(() => carregarDashboard())

// Carrega quando o banco conecta (antes disso a consulta ficaria esperando)
api.dbStatus((event, status) => {
  if (status === "conectado") carregarDashboard()
})

/**
 * Tela inicial (dashboard)
 * @Author Vitor de Assis Passos
 */

console.log("Processo de renderização")

const tabelaPrazos = document.getElementById("tabelaPrazos")
const semPrazos = document.getElementById("semPrazos")
const semOS = document.getElementById("semOS")
const canvas = document.getElementById("pieChart")
const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// Gráfico criado vazio; os números chegam do banco em api.receiveDashboard
const grafico = new Chart(canvas.getContext("2d"), {
  type: "pie",
  data: {
    labels: ["Serviços Atrasados", "Serviços Entregues", "Serviços Pendentes"],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ["#f87171", "#60a5fa", "#facc15"],
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#E0E0E0" },
      }
    }
  }
})

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
function etiquetaSituacao(prazo) {
  const dias = diasAtePrazo(prazo)
  if (dias < 0) return { texto: `ATRASADA ${-dias} DIA${dias < -1 ? "S" : ""}`, cor: "bg-red-500" }
  if (dias === 0) return { texto: "VENCE HOJE", cor: "bg-orange-500" }
  return { texto: `VENCE EM ${dias} DIA${dias > 1 ? "S" : ""}`, cor: "bg-yellow-600" }
}

api.receiveDashboard((event, dados) => {
  const { atrasadas, pendentes, entregues, lista, financeiro } = JSON.parse(dados)

  // Indicadores financeiros
  document.getElementById("kpiRecebido").textContent = formatoMoeda.format(financeiro.recebidoMes)
  document.getElementById("kpiFaturado").textContent = formatoMoeda.format(financeiro.faturadoMes)
  document.getElementById("kpiReceber").textContent = formatoMoeda.format(financeiro.aReceber)
  document.getElementById("kpiOrcamentos").textContent = String(financeiro.orcamentosPendentes)

  // Gráfico
  grafico.data.datasets[0].data = [atrasadas, entregues, pendentes]
  grafico.update()
  const vazio = atrasadas + entregues + pendentes === 0
  canvas.hidden = vazio
  semOS.hidden = !vazio

  // Tabela de prazos
  tabelaPrazos.innerHTML = ""
  lista.forEach((os) => {
    const linha = document.createElement("tr")
    const { texto, cor } = etiquetaSituacao(os.prazoFinal)

    const colunas = [
      String(os.numero),
      os.cliente ? os.cliente.nome : "(cliente excluído)",
      // Só dia/mês: os prazos desta lista são sempre próximos de hoje
      new Date(os.prazoFinal).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    ]
    colunas.forEach((valor) => {
      const td = document.createElement("td")
      td.className = "py-2 px-3 border-b border-gray-600 truncate"
      td.textContent = valor
      linha.appendChild(td)
    })

    const tdSituacao = document.createElement("td")
    tdSituacao.className = "py-2 px-3 border-b border-gray-600"
    const etiqueta = document.createElement("span")
    etiqueta.className = `${cor} text-white py-1 px-2 rounded-full text-xs whitespace-nowrap`
    etiqueta.textContent = texto
    tdSituacao.appendChild(etiqueta)
    linha.appendChild(tdSituacao)

    tabelaPrazos.appendChild(linha)
  })
  semPrazos.hidden = lista.length > 0
})

// Recarrega quando alguma OS é criada, alterada ou excluída
api.onDashboardChanged(() => carregarDashboard())

// Carrega quando o banco conecta (antes disso a consulta ficaria esperando)
api.dbStatus((event, status) => {
  if (status === "conectado") carregarDashboard()
})

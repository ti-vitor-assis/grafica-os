/**
 * 
 * @Author Vitor de Assis Passos
 */


console.log("Processo de renderização")

const ctx = document.getElementById('pieChart').getContext('2d');

new Chart(ctx, {
  type: 'pie',
  data: {
    labels: ['Serviços Atrasados  ', 'Serviços Entregues ', 'Serviços Pendentes'],
    datasets: [{
      data: [30, 50, 20],
      backgroundColor: ['#f87171', '#60a5fa', '#facc15'],
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      }
    }
  }
});
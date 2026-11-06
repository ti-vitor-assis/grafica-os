/**
 * 
 * 
 */


document.addEventListener('DOMContentLoaded', () => {
    const footerRealTime = document.getElementById('footerRealTime');

    console.log(footerRealTime)
    if (!footerRealTime) return;

    const update = () => {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const time = now.toLocaleTimeString('pt-BR');
      footerRealTime.textContent = `${date.charAt(0).toUpperCase() + date.slice(1)} - ${time}`;
    };

    update();               // update immediately
    setInterval(update, 1000); // update every second
    
    console.log(footerRealTime)
  });

  api.dbStatus((event, message)=>{

    console.log(message)
    if(message === "conectado"){
      document.getElementById('iconeDB').src = "../public/img/dbonGreen.png"
    }else{
      document.getElementById('iconeDB').src = "../public/img/dboffRed.png"
    }
  })

// Mostra no rodapé quem está logado (na tela de login ainda não há ninguém)
api.receiveSession((event, usuario) => {
  if (!usuario) return
  const footer = document.querySelector('footer')
  const icone = document.getElementById('iconeDB')
  if (!footer || !icone || document.getElementById('footerUsuario')) return
  const p = document.createElement('p')
  p.id = 'footerUsuario'
  p.style.marginTop = '5px'
  p.textContent = `${usuario.nome} (${usuario.perfil})`
  footer.insertBefore(p, icone)
})
api.getSession()

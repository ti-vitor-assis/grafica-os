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
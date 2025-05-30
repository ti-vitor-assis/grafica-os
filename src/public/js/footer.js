/**
 * 
 * 
 */



document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('footerRealTime');

    console.log(el)
    if (!el) return;

    const update = () => {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const time = now.toLocaleTimeString('pt-BR');
      el.textContent = `${date.charAt(0).toUpperCase() + date.slice(1)} - ${time}`;
    };

    update();               // update immediately
    setInterval(update, 1000); // update every second
    
    console.log(el)
  });
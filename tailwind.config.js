/**
 * Configuração do Tailwind CSS
 * O CSS é gerado a partir das classes usadas nas telas e scripts:
 *   npm run css
 * (o arquivo gerado, src/public/css/tailwind.css, vai para o Git para o
 * app funcionar sem precisar compilar nada e sem internet)
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/views/**/*.html", "./src/public/js/**/*.js"],
  theme: {
    extend: {},
  },
  plugins: [],
};

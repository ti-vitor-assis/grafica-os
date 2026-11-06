/**
 * Gera o ícone do app (build/icon.ico, build/icon.png e src/public/img/icone.*)
 * a partir do mesmo desenho do logo da barra lateral (src/public/js/icones.js).
 *
 * Rodar quando o logo mudar:  npx electron scripts/gerar-icone.js
 */

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");
const TAMANHOS = [16, 24, 32, 48, 64, 128, 256];

// Desenho da impressora do logo (ícone "grafica")
const IMPRESSORA = '<path d="M6 9V3h12v6"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v7H6z"/><path d="M18 12h.01"/>';

// Quadrado roxo com cantos arredondados e a impressora em branco.
// Em tamanhos pequenos o traço fica mais grosso para continuar legível.
function svg(tamanho) {
    const traco = tamanho <= 24 ? 2.6 : tamanho <= 48 ? 2.2 : 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6D28D9"/></linearGradient></defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#g)"/>
  <g transform="translate(12 12) scale(1.6667)" fill="none" stroke="#fff" stroke-width="${traco}"
     stroke-linecap="round" stroke-linejoin="round">${IMPRESSORA}</g>
</svg>`;
}

// Monta um .ico com as imagens PNG (formato aceito pelo Windows Vista em diante)
function montarIco(pngs) {
    const cabecalho = Buffer.alloc(6);
    cabecalho.writeUInt16LE(0, 0);
    cabecalho.writeUInt16LE(1, 2); // tipo: ícone
    cabecalho.writeUInt16LE(pngs.length, 4);
    const entradas = [];
    let deslocamento = 6 + 16 * pngs.length;
    for (const { tamanho, dados } of pngs) {
        const e = Buffer.alloc(16);
        e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0);
        e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
        e.writeUInt8(0, 2);
        e.writeUInt8(0, 3);
        e.writeUInt16LE(1, 4); // planos
        e.writeUInt16LE(32, 6); // bits por pixel
        e.writeUInt32LE(dados.length, 8);
        e.writeUInt32LE(deslocamento, 12);
        deslocamento += dados.length;
        entradas.push(e);
    }
    return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.dados)]);
}

app.whenReady().then(async () => {
    const janela = new BrowserWindow({ show: false });
    await janela.loadURL("data:text/html,<html><body></body></html>");

    // Desenha cada tamanho num canvas (sem depender da janela aparecer)
    async function png(tamanho) {
        const url = await janela.webContents.executeJavaScript(`new Promise((ok, erro) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement("canvas");
                c.width = c.height = ${tamanho};
                c.getContext("2d").drawImage(img, 0, 0, ${tamanho}, ${tamanho});
                ok(c.toDataURL("image/png"));
            };
            img.onerror = erro;
            img.src = "data:image/svg+xml;base64," + ${JSON.stringify(Buffer.from(svg(tamanho)).toString("base64"))};
        })`);
        return Buffer.from(url.split(",")[1], "base64");
    }

    const pngs = [];
    for (const tamanho of TAMANHOS) pngs.push({ tamanho, dados: await png(tamanho) });
    const ico = montarIco(pngs);
    const grande = await png(512);

    for (const pasta of ["build", "src/public/img"]) fs.mkdirSync(path.join(RAIZ, pasta), { recursive: true });
    fs.writeFileSync(path.join(RAIZ, "build/icon.ico"), ico);
    fs.writeFileSync(path.join(RAIZ, "build/icon.png"), grande);
    fs.writeFileSync(path.join(RAIZ, "src/public/img/icone.ico"), ico);
    fs.writeFileSync(path.join(RAIZ, "src/public/img/icone.png"), pngs.find((p) => p.tamanho === 256).dados);
    console.log(`Ícone gerado (${TAMANHOS.join(", ")} px)`);
    app.quit();
});

/**
 * Gera um PDF a partir de um HTML, pergunta onde salvar e abre o arquivo.
 * Usado pela impressão da OS e pelos relatórios.
 */

const { BrowserWindow, dialog, shell, app } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

// html: documento completo; nomeArquivo: sugestão (ex.: "OS-0001.pdf");
// janelaPai: janela sobre a qual a caixa "Salvar como" aparece.
// Retorna o caminho salvo, ou null se o usuário cancelar.
async function gerarPDF(html, nomeArquivo, janelaPai) {
    // Janela invisível só para desenhar o HTML
    const janela = new BrowserWindow({
        show: false,
        webPreferences: { javascript: false },
    });

    try {
        await janela.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
        const pdf = await janela.webContents.printToPDF({
            pageSize: "A4",
            printBackground: true,
            margins: { marginType: "default" },
        });

        const { canceled, filePath } = await dialog.showSaveDialog(janelaPai, {
            title: "Salvar PDF",
            defaultPath: path.join(app.getPath("documents"), nomeArquivo),
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (canceled || !filePath) return null;

        await fs.writeFile(filePath, pdf);
        // Abre no leitor de PDF padrão, de onde o usuário pode imprimir
        await shell.openPath(filePath);
        return filePath;
    } finally {
        janela.destroy();
    }
}

module.exports = { gerarPDF };

/**
 * electron-builder (afterPack): grava o ícone e os dados do app no .exe.
 *
 * Com "signAndEditExecutable": false (necessário neste Windows sem
 * permissão para links simbólicos), o electron-builder não edita o .exe;
 * sem isto, o executável e os atalhos ficariam com o ícone do Electron.
 */

const path = require("node:path");

exports.default = async function iconeNoExe(contexto) {
    if (contexto.electronPlatformName !== "win32") return;
    const { rcedit } = await import("rcedit");
    const info = contexto.packager.appInfo;
    const exe = path.join(contexto.appOutDir, `${info.productFilename}.exe`);
    await rcedit(exe, {
        icon: path.resolve(__dirname, "..", "build", "icon.ico"),
        "file-version": info.version,
        "product-version": info.version,
        "version-string": {
            ProductName: info.productName,
            FileDescription: info.productName,
            CompanyName: info.companyName || "Vitor de Assis Passos",
            LegalCopyright: `MIT · ${info.companyName || "Vitor de Assis Passos"}`,
            OriginalFilename: `${info.productFilename}.exe`,
        },
    });
    console.log(`  • ícone gravado em ${path.basename(exe)}`);
};

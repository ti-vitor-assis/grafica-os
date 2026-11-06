/**
 * Configuração local do aplicativo (fica no computador, não no banco):
 * %APPDATA%\grafica-os\config.json no Windows.
 *
 * A string de conexão do MongoDB tem usuário e senha, então é gravada
 * criptografada com o safeStorage do Electron (no Windows usa a proteção
 * da conta do usuário: só esta conta neste computador consegue ler).
 */

const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const arquivo = () => path.join(app.getPath("userData"), "config.json");

function ler() {
  try {
    return JSON.parse(fs.readFileSync(arquivo(), "utf8"));
  } catch (error) {
    return {};
  }
}

function gravar(config) {
  fs.mkdirSync(path.dirname(arquivo()), { recursive: true });
  fs.writeFileSync(arquivo(), JSON.stringify(config, null, 2));
}

function lerUrlBanco() {
  const { mongo } = ler();
  if (!mongo || !mongo.valor) return null;
  try {
    return mongo.criptografado
      ? safeStorage.decryptString(Buffer.from(mongo.valor, "base64"))
      : mongo.valor;
  } catch (error) {
    console.log("Não foi possível ler a configuração do banco:", error.message);
    return null;
  }
}

function salvarUrlBanco(url) {
  const config = ler();
  config.mongo = safeStorage.isEncryptionAvailable()
    ? { criptografado: true, valor: safeStorage.encryptString(url).toString("base64") }
    : { criptografado: false, valor: url };
  gravar(config);
}

// Preferências simples (ex.: tema claro/escuro)
function lerPreferencia(chave, padrao) {
  const config = ler();
  return config[chave] !== undefined ? config[chave] : padrao;
}

function salvarPreferencia(chave, valor) {
  const config = ler();
  config[chave] = valor;
  gravar(config);
}

// Esconde a senha para mostrar na tela: mongodb+srv://ana:••••@cluster...
function mascararUrl(url) {
  return url ? url.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:••••@") : "";
}

module.exports = { lerUrlBanco, salvarUrlBanco, lerPreferencia, salvarPreferencia, mascararUrl };

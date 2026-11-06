# Gráfica OS

Aplicativo desktop para gerenciar uma gráfica: clientes, orçamentos, ordens de serviço (OS), produtos, pagamentos, estoque de insumos e relatórios.

Projeto desenvolvido no curso do SENAC.

![Tela inicial](docs/img/inicio.png)

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Login e usuários** | Login com senha (hash bcrypt), perfis administrador / atendente / produção e cadastro de funcionários |
| **Clientes** | Cadastro com validação de CPF e busca de endereço pelo CEP (ViaCEP) |
| **Produtos e serviços** | Catálogo com categoria, material, tamanho, cores, acabamento, unidade de venda (un, cento, milheiro, m²…) e preço |
| **Orçamentos** | Itens, validade e prazo de produção; impressão em PDF; ao ser aprovado, gera a OS automaticamente |
| **Ordens de serviço** | Número sequencial, itens, prazo, status da produção, aprovação da arte, pagamentos (sinal, parcelas, quitação) e impressão em PDF |
| **Estoque** | Insumos (papel, tinta, lona…) com entrada, saída e ajuste, histórico das movimentações e alerta de estoque baixo; cadastro de fornecedores |
| **Dashboard** | Gráfico das OS, lista de OS atrasadas ou perto do prazo, recebido e faturado no mês, valor a receber e orçamentos pendentes |
| **Relatórios (PDF)** | Clientes, OS em andamento, OS entregues, todas as OS, faturamento, produtos mais vendidos, contas a receber, recebimentos e estoque |

<p>
  <img src="docs/img/os.png" alt="Ordem de serviço" width="49%" />
  <img src="docs/img/orcamento.png" alt="Orçamento" width="49%" />
</p>

## Tecnologias

- [Electron](https://www.electronjs.org/) (aplicativo desktop com Node.js)
- [MongoDB](https://www.mongodb.com/) com [Mongoose](https://mongoosejs.com/)
- HTML, CSS e JavaScript, com [Tailwind CSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/) (gráfico do dashboard)
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) (senhas) e [dotenv](https://www.npmjs.com/package/dotenv) (configuração)
- [electron-builder](https://www.electron.build/) (instalador para Windows)

## Como rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou mais recente
- Um banco MongoDB: uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/atlas) ou um MongoDB instalado no computador

### Passo a passo

```bash
git clone https://github.com/ti-vitor-assis/grafica-os.git
cd grafica-os
npm install
```

Crie o arquivo `.env` na pasta do projeto, copiando o modelo `.env.example`, e coloque a string de conexão do seu banco:

```env
MONGO_URL=mongodb+srv://USUARIO:SENHA@SEU-CLUSTER.mongodb.net/serviceOrderPrintingPress
```

> O `.env` está no `.gitignore`: **nunca** envie a senha do banco para o GitHub.
> Com um MongoDB local, use `MONGO_URL=mongodb://127.0.0.1:27017/graficaos`.

Depois, é só iniciar:

```bash
npm start
```

### Primeiro acesso

Na primeira vez (banco sem nenhum usuário), a tela de login pede para criar o **administrador**. Depois disso, ele cadastra os outros funcionários em **Cadastro > Usuários**.

## Perfis de usuário

| Permissão | Administrador | Atendente | Produção |
|---|:---:|:---:|:---:|
| Clientes, orçamentos | ✔ | ✔ | |
| Ordens de serviço | ✔ | ✔ | ✔ |
| Produtos e preços | ✔ | | |
| Relatórios | ✔ | ✔ (sem os financeiros) | |
| Financeiro (faturamento, a receber, recebimentos) | ✔ | | |
| Estoque e fornecedores | ✔ | | ✔ |
| Excluir registros | ✔ | | |
| Usuários | ✔ | | |

As permissões são verificadas no processo principal (`main.js`), e não só escondidas na tela.

## Gerar o instalador (Windows)

```bash
npm run dist
```

O instalador é criado na pasta `dist/`. Por segurança, **o `.env` não vai dentro do instalador**. No computador onde o programa for instalado, crie o arquivo:

```
%APPDATA%\grafica-os\.env
```

com a mesma linha `MONGO_URL=...`. Se o arquivo não existir, o programa avisa ao abrir e oferece abrir essa pasta.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Abre o aplicativo |
| `npm run css` | Gera `src/public/css/tailwind.css` (rode depois de usar classes novas do Tailwind nas telas) |
| `npm run dist` | Gera o CSS e o instalador do Windows em `dist/` |

## Estrutura

```
main.js                 Processo principal: janelas, menu, login, permissões e handlers IPC
preload.js              Ponte segura entre as telas e o main (window.api)
database.js             Conexão com o MongoDB (lê MONGO_URL do .env)
src/
  model/                Modelos do Mongoose (Clientes, Products, ServiceOrder, Quote,
                        Usuario, Insumo, Fornecedor, Counter) e itens.js (itens e totais)
  views/                Telas (HTML)
  public/js/            Scripts das telas (renderers)
  public/css/           Estilos (CSS próprio + tailwind.css gerado)
  print/                Modelos dos PDFs (OS, orçamento e relatórios)
  reports/              Consultas dos relatórios
```

### Como as telas falam com o banco

As telas não acessam o banco diretamente. Elas chamam funções de `window.api` (definidas no `preload.js`), que enviam mensagens IPC para o `main.js`. O `main.js` confere a permissão do usuário, usa os modelos do Mongoose e devolve a resposta para a tela.

```
tela (renderer)  →  window.api (preload.js)  →  ipcMain (main.js)  →  Mongoose  →  MongoDB
```

## Licença

[MIT](LICENSE)

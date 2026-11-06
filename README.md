![GitHub License](https://img.shields.io/github/license/ti-vitor-assis/grafica-os)

# Gráfica OS 🖨️

Sistema para gestão de uma gráfica: orçamentos, ordens de serviço, pagamentos, estoque de insumos e relatórios. Desenvolvido com o framework Electron e o banco de dados MongoDB.

### Tela principal
![Tela principal](docs/img/inicio.png)

### Tema escuro
![Tela principal no tema escuro](docs/img/inicio-escuro.png)

### Orçamentos
![Orçamento](docs/img/orcamento.png)

### Ordem de serviço
![Ordem de serviço](docs/img/os.png)

### Ordem de serviço impressa
![Ordem de serviço impressa](docs/img/os-impressa.png)

### Cadastro de clientes
![Cadastro de clientes](docs/img/clientes.png)

### Estoque de insumos
![Estoque de insumos](docs/img/estoque.png)

### Relatórios
![Relatórios](docs/img/relatorios.png)
![Relatório de faturamento](docs/img/relatorio-faturamento.png)

### Login
![Login](docs/img/login.png)

## Funcionalidades

- **Orçamentos** com validade e prazo de produção; ao ser aprovado, vira uma OS automaticamente
- **Ordens de serviço** com número sequencial, itens, prazo, etapas da produção, aprovação da arte e pagamentos (sinal, parcelas e quitação)
- **Impressão em PDF** da OS, do orçamento e de 9 relatórios (faturamento, contas a receber, produtos mais vendidos, estoque...)
- **Clientes**, com validação de CPF e endereço preenchido pelo CEP
- **Produtos e serviços**, com unidade de venda (unidade, cento, milheiro, m²)
- **Estoque de insumos** (papel, tinta, lona...) com entrada, saída, ajuste, histórico e alerta de estoque baixo; cadastro de fornecedores
- **Usuários e perfis**: administrador, atendente e produção, cada um vendo só o que pode usar
- **Tema claro e escuro**

## Autor
Vitor de Assis Passos

## Pré-requisitos de instalação:
- Windows 10 ou superior
- Banco de dados MongoDB: instalado no computador (gratuito) **ou** na nuvem, pelo MongoDB Atlas

### Instalação do MongoDB:
Acesse o site oficial:
[MongoDB](https://www.mongodb.com/try/download/community)

Baixe o MongoDB Community Server e instale com a opção de "Install MongoDB as a Service" ativada (instalação padrão).

Após instalar, ele inicia automaticamente.

> Prefere o banco na nuvem? Crie uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/atlas) e copie a string de conexão em *Connect › Drivers*.

### Instalação do sistema Gráfica OS
Em [Releases](https://github.com/ti-vitor-assis/grafica-os/releases) faça o download da última versão (.exe) disponibilizada e execute no computador.

### Primeira execução
1. **Configurar o banco de dados:** na primeira vez, o sistema abre a tela de configuração. Clique em **Usar MongoDB local** (ou cole a string do Atlas), depois em **Testar conexão** e em **Salvar e conectar**.
2. **Criar o administrador:** informe seu nome, login e senha.
3. **Cadastrar a equipe:** em **Usuários**, crie o acesso de cada funcionário com o perfil adequado.

A configuração do banco fica salva neste computador (criptografada) e pode ser trocada depois pelo administrador em **Ferramentas › Configurar banco de dados**.

## Perfis de acesso

| Permissão | Administrador | Atendente | Produção |
|---|:---:|:---:|:---:|
| Clientes e orçamentos | ✔ | ✔ | |
| Ordens de serviço | ✔ | ✔ | ✔ |
| Produtos e preços | ✔ | | |
| Relatórios | ✔ | ✔ (sem os financeiros) | |
| Financeiro (faturamento, a receber, recebimentos) | ✔ | | |
| Estoque e fornecedores | ✔ | | ✔ |
| Excluir registros, usuários e configuração do banco | ✔ | | |

As permissões são verificadas no processo principal, e não apenas escondidas na tela.

## Para desenvolvedores

Requisitos: [Node.js](https://nodejs.org/) 20 ou mais recente.

```bash
git clone https://github.com/ti-vitor-assis/grafica-os.git
cd grafica-os
npm install
npm start
```

Na primeira execução, configure o banco pela própria tela do sistema. Se preferir, crie um arquivo `.env` na pasta do projeto (veja o `.env.example`), que tem prioridade sobre a tela:

```env
MONGO_URL=mongodb://127.0.0.1:27017/graficaos
```

| Comando | O que faz |
|---|---|
| `npm start` | Abre o sistema |
| `npm run css` | Gera o `tailwind.css` (rode depois de usar classes novas do Tailwind) |
| `npm run dist` | Gera o instalador do Windows em `dist/` |

**Tecnologias:** Electron, MongoDB com Mongoose, HTML/CSS/JavaScript, Tailwind CSS, bcryptjs e electron-builder.

**Estrutura:**

```
main.js            Processo principal: janelas, menu, login, permissões e IPC
preload.js         Ponte segura entre as telas e o main (window.api)
database.js        Conexão com o MongoDB
src/model/         Modelos do Mongoose
src/views/         Telas (HTML)
src/public/        CSS (app.css com os temas), ícones e scripts das telas
src/print/         Modelos dos PDFs (OS, orçamento e relatórios)
src/reports/       Consultas dos relatórios
```

## Licença
[MIT](LICENSE)

# Novidades

## 1.1.0 · LGPD e histórico de clientes

### Clientes
- Cadastro de **pessoa física** (nome, CPF, nascimento opcional) ou **jurídica** (razão social, nome fantasia, CNPJ, inscrição estadual opcional). RG e sexo não são mais pedidos; e-mail e endereço passam a ser opcionais.
- **CPF/CNPJ cifrado** no banco (AES-256-GCM). A busca é exata, com ou sem pontuação, em Clientes, OS e Orçamentos.
- Listas, relatórios e telas de OS mostram o documento **mascarado** (`***.982.247-**`). O número inteiro só aparece na ficha do cliente e nos PDFs entregues a ele.
- Cliente com OS ou orçamento **não é excluído, é desativado**. Cliente inativo não recebe OS nem orçamento novo.

### Histórico
- Cada OS e orçamento guarda uma **cópia do cliente da época**. A busca por CPF/CNPJ acha o histórico mesmo de clientes alterados, excluídos ou anonimizados.
- OS e orçamentos **não são mais excluídos**: OS é cancelada pelo status e orçamento é marcado como recusado.

### Orçamento → OS, mesmo antigo
- Qualquer orçamento gera OS: **pendente, vencido, recusado** (o cliente mudou de ideia) ou **já aprovado** (pedido repetido, gera mais uma OS).
- Fora da validade, se os preços mudaram, o sistema mostra a diferença e pergunta se **mantém os preços do orçamento ou usa os de hoje**. Produto inativo mantém o preço antigo.
- As OS geradas aparecem no orçamento e abrem com um clique.
- **Duplicar orçamento**: cria um novo com o mesmo cliente e itens, já com os preços de hoje.

### LGPD
- **Dados do cliente**: PDF com tudo o que a gráfica guarda sobre ele.
- **Anonimizar** (administrador): apaga os dados pessoais a pedido do cliente; as OS ficam.
- **Ferramentas › Limpeza LGPD**: depois de 5 anos, apaga os dados pessoais antigos, mostrando antes o que será feito.
- **Registro de auditoria**: quem entrou, cadastrou, consultou a ficha, exportou ou anonimizou. Relatório em **Relatórios › Segurança**.
- **Ajuda › Privacidade e LGPD**: aviso de privacidade, modelo de aviso para o balcão e termos de uso.

### Segurança (desde a 1.0)
- Chave de segurança por banco, com exportação e importação protegidas por senha para outros computadores.
- Login com bloqueio após 5 tentativas, senha com 8 caracteres (letras e números), sessão encerrada após 15 minutos parado ou com o bloqueio do Windows.
- Janelas isoladas, IPC só das telas do app com entrada higienizada, DevTools desligado no app instalado.

### Atualizando da 1.0
Ao abrir a 1.1.0 pela primeira vez, o banco é **atualizado sozinho** antes do login:
1. É gravado um backup cifrado em `%APPDATA%\grafica-os\backups`.
2. Os CPFs já cadastrados são cifrados; RG e sexo são retirados.
3. As OS e orçamentos antigos ganham a cópia do cliente.

Se a gráfica usa mais de um computador, atualize um primeiro, depois **exporte a chave** (Ferramentas › Configurar banco de dados) e importe-a nos demais.

## 1.0.0
Primeira versão: orçamentos, ordens de serviço com pagamentos, clientes, produtos, estoque de insumos, fornecedores, usuários com perfis, relatórios em PDF e tema claro/escuro.

# Novidades

## 1.0.0 · Primeira versão pública

### Gestão da gráfica
- **Orçamentos** com validade e prazo de produção; **ordens de serviço** com número sequencial, itens, prazo, etapas da produção, aprovação da arte e pagamentos (sinal, parcelas e quitação).
- **Produtos e serviços** com unidade de venda; **estoque de insumos** com entrada, saída, ajuste, histórico e alerta de estoque baixo; **fornecedores**.
- **Impressão em PDF** da OS, do orçamento e de 10 relatórios (faturamento, contas a receber, produtos mais vendidos, estoque, auditoria...).
- **Usuários e perfis** (administrador, atendente e produção), tema claro e escuro.
- **Configuração do banco pela própria tela**, sem precisar de arquivo `.env`.

### Clientes
- **Pessoa física** (nome, CPF, nascimento opcional) ou **jurídica** (razão social, nome fantasia, CNPJ, inscrição estadual opcional). E-mail e endereço são opcionais.
- **CPF/CNPJ cifrado** no banco (AES-256-GCM), com busca exata, com ou sem pontuação, em Clientes, OS e Orçamentos.
- Listas, relatórios e telas de OS mostram o documento **mascarado** (`***.982.247-**`); o número inteiro só aparece na ficha do cliente e nos PDFs entregues a ele.
- Cliente com OS ou orçamento **não é excluído, é desativado**.

### Histórico
- Cada OS e orçamento guarda uma **cópia do cliente da época**: a busca por CPF/CNPJ acha o histórico mesmo de clientes alterados, excluídos ou anonimizados.
- OS e orçamentos **não são excluídos**: a OS é cancelada pelo status e o orçamento é marcado como recusado.

### Orçamento → OS, mesmo antigo
- Qualquer orçamento gera OS: **pendente, vencido, recusado** (o cliente mudou de ideia) ou **já aprovado** (pedido repetido).
- Fora da validade, se os preços mudaram, o sistema mostra a diferença e pergunta se **mantém os preços do orçamento ou usa os de hoje**.
- As OS geradas aparecem no orçamento e abrem com um clique; **duplicar orçamento** cria um novo com os preços de hoje.

### LGPD
- **Dados do cliente** em PDF, **anonimização** a pedido, **Limpeza LGPD** depois de 5 anos e **registro de auditoria**.
- **Ajuda › Privacidade e LGPD**: aviso de privacidade, modelo de aviso para o balcão e termos de uso.

### Segurança
- Chave de segurança por banco, com exportação e importação protegidas por senha para outros computadores.
- Login com bloqueio após 5 tentativas, senha com 8 caracteres (letras e números), sessão encerrada após 15 minutos parado ou com o bloqueio do Windows.
- Janelas isoladas, IPC só das telas do app com entrada higienizada, DevTools desligado no app instalado.

### Bancos das versões de teste
Quem já usava uma versão de teste (antes da 1.0.0) não precisa fazer nada: ao abrir a 1.0.0, o banco é **atualizado sozinho** antes do login. Antes, é gravado um backup cifrado em `%APPDATA%\grafica-os\backups`; depois os CPFs são cifrados, RG e sexo são retirados e as OS e orçamentos antigos ganham a cópia do cliente.

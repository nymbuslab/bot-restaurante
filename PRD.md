---
doc: prd
titulo: PRD — Nymbus Pedidos
proposito: Requisitos do produto: visão, público, escopo atual e o que fica de fora.
manutencao: Revisar quando um módulo entrar ou sair do produto. Escopo detalhado por área fica em docs/; o que está em curso fica no PROGRESSO.md.
atualizado: 2026-07-13
relacionados: [CLAUDE.md, ROADMAP.md, PROGRESSO.md, CHANGELOG.md]
---

# PRD — Nymbus Pedidos

Documento de requisitos do produto. Plataforma SaaS de pedidos no WhatsApp para restaurantes.
Versão do sistema: ver `CHANGELOG.md`.

## 1. Visão

O restaurante recebe pedido pelo WhatsApp sem ninguém digitar cardápio. O cliente abre um link,
monta o pedido sozinho e o pedido cai no painel. O dono muda cardápio, preço e horário na hora,
sem depender de programador.

A cobrança é **valor fixo por mês, sem comissão por pedido**. No Plano Completo, o restaurante
também opera o salão: PDV, mesas, caixa do dia e comanda impressa na térmica.

Qualquer restaurante se cadastra sozinho e começa no mesmo dia. Não instala nada para vender pelo
WhatsApp. O app de impressão é opcional e só existe no Completo.

## 2. Problema

Pedido no WhatsApp hoje é manual. O atendente digita o cardápio, tira dúvida e anota item por item.
É lento, erra no pico do almoço e não escala. O cardápio muda todo dia (item acaba, preço sobe) e
nem sempre o atendente sabe.

As alternativas pesam no bolso. Marketplace cobra **comissão por pedido** e fica com o cliente.
Sistema de PDV tradicional é caro e engessado para restaurante pequeno.

## 3. Público-alvo

- **Dono ou gerente**: configura cardápio, horário e mensagens no painel. Não é técnico. Quer mudar
  o cardápio na hora e ver o pedido chegar.
- **Cliente final**: pede pelo WhatsApp, sem baixar app. Quer rapidez e saber o que vem no prato.
- **Operador de balcão e salão** (Completo): vende no PDV, controla mesas e fecha o caixa do dia.
- **Cozinha**: recebe a comanda impressa (Completo) ou consulta o pedido no painel.

## 4. Objetivos

- Receber o pedido completo pelo WhatsApp sem intervenção humana.
- Dar autonomia ao dono: cardápio, mensagem e horário mudam sozinhos e valem no próximo pedido.
- Isolar cada restaurante (multi-tenant), com dados separados.
- Reduzir erro de pedido: item, opcional e observação ficam registrados.
- Sustentar o negócio com assinatura fixa, sem comissão por pedido.
- No Completo, cobrir a operação do salão de ponta a ponta: venda, mesa, caixa e impressão.

## 5. Escopo atual (o que o produto faz)

### 5.1 Conta e onboarding

- Cadastro público em `/cadastro.html` (wizard de 4 etapas): cria a empresa e já deixa o básico
  configurado.
- Login por e-mail e senha (Supabase Auth, com bcrypt e JWT).
- Cada empresa ganha um **slug** único e um ambiente isolado.
- E-mail transacional: boas-vindas, "esqueci a senha" e avisos de assinatura.

### 5.2 Planos e cobrança

- **Essencial R$ 79/mês** e **Completo R$ 99/mês**. **7 dias grátis**, sem cartão para criar a conta.
- Checkout próprio (Stripe Elements) para ativar o trial com cartão. Portal de faturas e troca de
  cartão pelo painel.
- Upgrade e downgrade de plano com proration.
- **Sem comissão por pedido** em qualquer plano.
- Gate por plano no servidor e no painel. Do Completo: frete por raio e por bairro, PDV, Mesas,
  Caixa e impressão térmica.

### 5.3 Canal de pedido: WhatsApp e cardápio web

- O bot conecta por QR e **só responde quem falar com ele**. Nunca dispara mensagem em massa.
- Na conversa, o bot manda o **link do cardápio web** (`/c/:slug`). O cliente monta o pedido lá:
  itens, composição, opcionais, variações, observação, entrega e forma de pagamento.
- O servidor **recalcula preço e total** pelo cardápio. Nunca confia no valor que vem do cliente.
  Em seguida o bot **confirma** o pedido pelo WhatsApp.
- Fora do horário, o bot responde a mensagem de fechado. O dono pode forçar aberto ou fechado.
- O bot reconhece o cliente que volta e saúda pelo nome.
- Quando um humano assume a conversa, o bot silencia (estado atendente).

### 5.4 Cardápio

- Categorias e itens: preço, descrição, foto e disponível ou esgotado.
- **Composição** selecionável em subgrupos, com obrigatório, mínimo e máximo (ex.: "escolha 1
  proteína"). A composição não soma preço.
- **Opcionais** pagos (acréscimo com preço).
- **Variações** com preço e estoque próprios (ex.: sabores), exibidas como "a partir de R$ X".
- **Estoque** por item e por variação, com baixa automática na venda.
- Vitrine de destaques no cardápio web.
- Toda edição vale no próximo pedido, sem reiniciar nada.

### 5.5 Pedidos e dashboard

- Lista com filtro por período e tipo, busca, e o canal de origem (WhatsApp, PDV ou Mesa).
- Detalhe com itens, opcionais, observação, total e endereço.
- **Avisar cliente** que o pedido está pronto: mensagem manual, um clique, pelo WhatsApp do próprio
  restaurante.
- Cancelar pedido e cancelar item.
- Exportar CSV dos pedidos filtrados.
- Alerta de pedido novo, escopado ao canal WhatsApp.
- Dashboard com os números do período (vendas, ticket e itens mais vendidos).

### 5.6 Salão e balcão (Plano Completo)

- **PDV**: venda no balcão. Grade de produtos, carrinho com opcionais, observação e item por kg,
  desconto em R$ ou %, split de pagamento e troco. Tipo de venda Balcão (paga na hora e cai no
  caixa), Entrega ou Retirada (nascem a receber). Exige caixa aberto do dia.
- **Mesas**: abre mesa, lança pedido, transfere e junta, registra número de pessoas, pede a conta e
  fecha com split e recebimento parcial.
- **Caixa do dia**: abertura com fundo de troco, recebimento por pedido, sangria e suprimento,
  estorno de recebimento errado e cancelamento com rastro. O fechamento pede contagem de cédulas e
  conferência de cartão e Pix, e gera o relatório 80mm. Não fecha com venda do turno a receber nem
  com mesa aberta.

### 5.7 Impressão térmica (Plano Completo)

- App desktop **Nymbus Impressora** (Windows) imprime sozinho na térmica 80mm: delivery, PDV, mesas
  e relatório de caixa.
- Conecta por Rede (porta 9100) ou Serial (COM). A impressora é configurada no próprio app.
- Duas vias: cozinha (sem preço) e cupom do cliente (com a marca do restaurante).
- Reimprimir pelo painel.

### 5.8 Entrega e frete

- **Frete fixo** por restaurante, em qualquer plano.
- **No Completo**: frete **por raio** (distância até o cliente pelo CEP, com faixas de valor que o
  dono define) e **por bairro** (valor por bairro cadastrado).
- O CEP autopreenche o endereço (ViaCEP), com cache no banco.

### 5.9 Super-admin

- Área separada em `/admin-master`, com login próprio e rotas isoladas. Token de restaurante não
  entra lá, e o token master não entra no painel do restaurante.
- Gestão de restaurantes: listar, criar, **suspender e reativar** (suspenso não loga e o bot cai na
  hora) e **excluir** com confirmação forte.
- Métricas reais do banco: total de restaurantes, ativos e suspensos, pedidos no mês (geral e por
  restaurante) e quantos estão conectados agora.
- Monitoramento de incidentes e Configurações Master (identidade da plataforma e footer da landing).

### 5.10 Privacidade e LGPD

- Aceite de Termos e Privacidade no cadastro, com data e versão registradas.
- Exportar e excluir os dados da conta.
- Retenção automática: dado antigo é limpo por job.
- Trilha de auditoria dos eventos sensíveis, sem dado pessoal no detalhe.
- Inventário de tratamentos (ROPA) e lista de subprocessadores documentados.

### 5.11 Infraestrutura e dados

- **App stateless**: nada é gravado em disco. O Postgres (Supabase) guarda empresas, pedidos, config
  e cardápio; o Auth guarda as contas; o Storage guarda as imagens; a sessão do WhatsApp vive no
  banco.
- Backup e recuperação são do Supabase (point-in-time recovery).
- Deploy no Fly.io, com HTTPS gerenciado e domínio próprio.

## 6. Fora de escopo (o que o produto não faz)

- Não gerencia o ciclo do pedido (preparo, despacho, entrega) e não tem botão de status. Comunicar o
  cliente é resolvido pelo "Avisar cliente". O andamento fica no sistema que o restaurante já usa.
- Não é KDS (tela de cozinha).
- Não processa pagamento do cliente final online. O pagamento é combinado no pedido e recebido pelo
  restaurante.
- Não tem app próprio para o cliente. Tudo acontece no WhatsApp e no cardápio web.
- Não usa a API Oficial do WhatsApp. Usa biblioteca não-oficial.
- Não faz conta a prazo (fiado) nem cadastro de cliente no painel. Foi construído e removido em
  2026-07-13 para amadurecer a ideia. A auditoria e a pesquisa de mercado ficaram guardadas em
  `docs/superpowers/plans/2026-07-13-fiado-auditoria-e-correcoes.md` para um redesenho futuro.

## 7. Requisitos não-funcionais

- **Usabilidade**: painel utilitário, em português, para uso diário e com pressa.
- **Tempo real**: edição de cardápio e config vale no próximo pedido, sem reiniciar.
- **Isolamento**: dados e sessão de cada restaurante ficam separados. O backend garante, e o RLS é
  defesa em profundidade.
- **Dinheiro correto**: o servidor recalcula o pedido, o caixa confere o turno e o banco valida a
  coerência do recebimento (valor pago = valor + troco).
- **Robustez**: reconexão controlada do WhatsApp, com teto de tentativas e recuperação de sessão
  travada.
- **Segurança**: senha com hash (Supabase Auth), JWT validado localmente, CSP estrita, rate limit em
  login e cadastro, e HTTPS gerenciado no Fly.
- **Portabilidade**: roda em Windows (desenvolvimento) e Linux/Docker (produção).

## 8. Decisões e premissas

- Multi-tenant por linha (`empresa_id`) no Postgres. O isolamento é garantido no backend.
- Postgres gerenciado (Supabase): backup, HA, Auth e Storage prontos. Em troca, custo fixo e
  dependência do fornecedor.
- WhatsApp por biblioteca não-oficial (Baileys, WebSocket, sem Chromium): leve e barato. O caminho
  de produção séria é a Cloud API oficial (ver `ROADMAP.md`).
- O pedido é montado no **cardápio web**, não na conversa. Dá menos fricção e menos erro que digitar
  item por item no chat.
- O servidor sempre recalcula o pedido. Nunca confia no total que vem do cliente.
- Front sem framework (HTML, CSS e JS puros), para manter o projeto simples e leve.

## 9. Roadmap

A direção e as prioridades ficam no `ROADMAP.md`. O que está em curso fica no `PROGRESSO.md`.

Marcos do roadmap antigo já entregues:

- [x] Super-admin com métricas e suspensão de restaurante.
- [x] Backup (resolvido pelo Supabase).
- [x] HTTPS em produção (Fly).
- [x] Opcionais com regra, que viraram composição com obrigatório, mínimo e máximo.
- [x] Notificação de pedido novo: alerta no painel e impressão automática no Completo.

## 10. Métricas de sucesso

- % de pedidos concluídos pelo bot sem intervenção humana.
- Tempo médio para o cliente concluir um pedido.
- Nº de restaurantes ativos pagantes e pedidos por mês em cada um.
- Nº de edições de cardápio feitas pelo dono sem suporte.
- Conversão do trial em assinatura e churn mensal.

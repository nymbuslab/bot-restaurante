# PRD — Plataforma SaaS de Bot de Pedidos para Restaurantes (WhatsApp)

Documento de requisitos do produto. Versão 3.x.

## 1. Visão

Oferecer a restaurantes uma plataforma **SaaS multi-tenant** para **receber pedidos
pelo WhatsApp de forma automatizada**, com um painel onde o próprio dono gerencia
cardápio, horários e mensagens — sem depender de programador. O bot é a porta de
entrada; o preparo e a entrega seguem no sistema que a empresa já usa.

Qualquer restaurante do segmento pode se cadastrar, configurar seu ambiente e começar
a receber pedidos sem instalação local.

## 2. Problema

Restaurantes recebem pedidos pelo WhatsApp de forma manual: o atendente digita
cardápio, tira dúvidas, anota item por item. Isso é lento, sujeito a erro e não
escala em horário de pico. Cardápios mudam todo dia (itens acabam, preços mudam),
e soluções prontas costumam ser caras ou engessadas.

## 3. Público-alvo

- **Dono/gerente do restaurante**: usa o painel para configurar cardápio, horários
  e mensagens. Não é técnico. Precisa de algo direto, em português, que mude o
  cardápio "na hora".
- **Cliente final**: pede pelo WhatsApp. Quer rapidez e saber o que vem no prato.
- **Operador/cozinha**: consulta os pedidos recebidos no painel. O andamento é feito
  no sistema próprio da empresa.

## 4. Objetivos

- Receber pedidos completos pelo WhatsApp sem intervenção humana.
- Permitir que o dono edite cardápio/mensagens/horários sozinho, refletindo em tempo real.
- Suportar múltiplos restaurantes (multi-tenant) com dados totalmente isolados.
- Reduzir erros de pedido (itens, opcionais, observações ficam registrados).
- Custo baixo para começar (biblioteca não-oficial, sem banco externo).

## 5. Escopo atual (o que o produto FAZ)

### 5.1 Onboarding e autenticação

- Página de cadastro pública (`/cadastro.html`, wizard de 4 etapas): nome do restaurante,
  e-mail, senha, e configuração inicial.
- Login por e-mail + senha via **Supabase Auth** (bcrypt + JWT).
- Cada empresa recebe um **slug** único e uma linha na tabela `empresas` (Postgres/Supabase).

### 5.2 Atendimento (bot)

- Fluxo por categorias → itens → opcionais → observação → quantidade → revisão.
- Ao finalizar: pergunta "deseja adicionar bebida?" (se categoria "bebida" existir
  e o cliente ainda não tiver adicionado uma).
- Checkout: nome, tipo (entrega/retirada), endereço, pagamento, confirmação com total.
- **Horário de funcionamento** por dia da semana: fora do horário, o bot responde
  automaticamente com a mensagem de fechado configurável.
- Override manual de aberto/fechado independente do horário.
- **Taxa de entrega** fixa configurável; exibida ao cliente que escolhe delivery.
- **Só responde a mensagens recebidas após a conexão** (não dispara em massa).

### 5.3 Painel administrativo (por tenant)

- Login por e-mail + senha; cabeçalho exibe o nome do restaurante.
- **Conexão**: conectar/desconectar WhatsApp via QR; gerar novo QR (limpar sessão).
- **Cardápio**: CRUD de categorias e itens; preço; ativar/desativar; composição;
  opcionais. Mudanças valem imediatamente (sem reiniciar).
- **Configurações**: dados do restaurante, mensagens do bot, horário por dia da semana,
  taxa de entrega, formas de pagamento, toggle aberto/fechado.
- **Pedidos**: lista de pedidos com itens, opcionais, observação, total, entrega e telefone;
  botão para **avisar o cliente** que o pedido está pronto (mensagem manual, 1 por clique,
  pelo WhatsApp do próprio tenant — nunca em massa/automático).
- **Simulador**: testa o fluxo do bot direto no navegador, sem WhatsApp.

### 5.4 Persistência

- **Banco**: Postgres gerenciado no **Supabase**. Tabela `empresas` (perfil + `config`/
  `cardapio` em `jsonb`) e tabela `pedidos` (uma só, isolada por `empresa_id`).
- **Contas/senhas**: Supabase Auth (bcrypt). Sessão = JWT.
- **Sessão WhatsApp**: persistida no Postgres (adapter custom do Baileys) — stateless.
- **Imagens do cardápio**: Supabase Storage.
- **Backup**: gerenciado 100% pelo Supabase (point-in-time recovery). Com o app stateless,
  nada mora em disco — o backup manual do lado do app foi removido (v0.18.0).

### 5.5 Super-admin (gestão da plataforma)

Área **separada** do painel de restaurante, em `/admin-master`, com todas as rotas sob
`exigeSuperAdmin`. **Isolada**: um token de restaurante não acessa o super-admin e o token
master não acessa o painel de restaurante.

- **Login master próprio** por variáveis de ambiente (`SUPERADMIN_EMAIL` /
  `SUPERADMIN_SENHA_HASH`, mesmo esquema de hash do projeto); sem essas variáveis, as rotas
  `/api/admin/*` ficam desativadas (sem credencial padrão).
- **Gestão de tenants**: listar todos (nome, e-mail, slug, status, data de criação), criar
  manualmente, **suspender/reativar** (suspenso não consegue logar e tem o bot desconectado na
  hora) e **excluir** com confirmação forte (exige digitar o slug; remove o registro e a pasta
  de dados do tenant).
- **Métricas de uso** (reais, contadas do banco): total de restaurantes, ativos/suspensos,
  pedidos no mês somando todos os tenants e quantos estão conectados ao WhatsApp agora; além de
  pedidos no mês por restaurante.

## 6. Fora de escopo (o que o produto NÃO faz)

- Não gerencia o ciclo do pedido (preparo, despacho, entrega).
- **Não tem botões de status do pedido** (preparando / entregue / cancelado) no painel —
  decidido fora de escopo. O valor real (comunicar o cliente) é entregue pelo botão
  **"Avisar cliente"** (pedido pronto, entrega/retirada); gerenciar o ciclo contradiz a
  premissa de que o bot é porta de entrada e o andamento fica no sistema do restaurante.
- Não processa pagamento online.
- **Não calcula taxa de entrega por região/CEP** (taxa única por tenant) — fora de escopo por
  ora. Opções avaliadas e descartadas: por bairro cadastrado (manutenção infinita); por
  raio/km via geocoding (API paga, lida mal com endereço solto do WhatsApp); geolocalização
  por IP (inviável, não há IP do cliente). Reavaliar só se um cliente pagante pedir.
- Não tem app próprio para o cliente; tudo acontece no WhatsApp.
- Não usa a API Oficial do WhatsApp (usa biblioteca não-oficial).

## 7. Requisitos não-funcionais

- **Usabilidade**: painel simples, em português, utilitário (uso diário, com pressa).
- **Tempo real**: edições de cardápio e config refletem sem reiniciar o bot.
- **Isolamento**: dados e sessão WhatsApp de cada tenant completamente separados.
- **Robustez**: conexão manual com reconexão controlada (teto de tentativas) e opção de recuperar sessão travada.
- **Portabilidade**: roda em Windows (teste) e Linux/Docker (produção).
- **Segurança (mínima atual)**: senha com hash. **HTTPS automático no Fly.io** (certificado
  gerenciado no domínio `.fly.dev` + `force_https`); em VPS/local o HTTPS depende do operador.

## 8. Decisões e premissas

- Multi-tenant por linha (`empresa_id`) no Postgres, com isolamento garantido no backend
  (e RLS como defesa em profundidade).
- Postgres gerenciado (Supabase): backup/HA gerenciados, escala horizontal possível, e
  Auth/Storage prontos — em troca de custo fixo e dependência do fornecedor.
- Bebida e observação são comportamentos automáticos do fluxo (não configuráveis hoje).
- Bebidas identificadas pela categoria com "bebida" no nome.
- Cada WhatsApp conectado é uma conexão WebSocket (Baileys, sem Chromium) — consumo de
  RAM baixo; a infraestrutura escala bem mais por GB do que na versão antiga com Chromium.

## 9. Roadmap / próximos passos (priorizáveis)

- [x] **Painel de super-admin** para gerenciar tenants (listar, criar, suspender/reativar,
  excluir) + métricas de uso — **concluído** (ver seção 5.5).
- [x] **Backup dos dados** — **resolvido pelo Supabase** (point-in-time recovery gerenciado). O
  backup manual do lado do app (`npm run backup` + tela no painel), da era SQLite, foi removido
  na v0.18.0 quando o app virou stateless (nada mais em disco). Ver `CHANGELOG.md` v0.18.0.
- [ ] Notificação para cozinha/atendente quando chega pedido novo (webhook ou push).
- [ ] Tornar pergunta de bebida e observação configuráveis (liga/desliga) no painel.
- [ ] Opcionais com regras (ex.: "escolha 1 de 3", "máx. 2").
- [x] **HTTPS em produção** — **resolvido no Fly.io** (TLS gerenciado + `force_https`); em
  VPS/local depende do operador. Ver `DEPLOY.md`.

## 10. Métricas de sucesso (sugestão)

- % de pedidos concluídos pelo bot sem intervenção humana.
- Tempo médio para concluir um pedido pelo WhatsApp.
- Nº de tenants ativos e pedidos/mês por tenant.
- Nº de edições de cardápio feitas pelo dono sem suporte técnico.

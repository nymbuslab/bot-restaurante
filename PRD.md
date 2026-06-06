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

- Página de cadastro pública (`/cadastro.html`): nome do restaurante, e-mail, senha.
- Login por e-mail + senha (hash SHA-256); token em sessão.
- Cada empresa recebe um **slug** único e um diretório isolado em `data/tenants/{slug}/`.
- Migração automática de instalações legadas (cria tenant a partir de `data/config.json`).

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
- **Pedidos**: lista de pedidos com itens, opcionais, observação, total, entrega e telefone.
- **Simulador**: testa o fluxo do bot direto no navegador, sem WhatsApp.

### 5.4 Persistência

- **Pedidos**: SQLite por tenant (`data/tenants/{slug}/pedidos.db`).
- **Banco mestre de tenants**: SQLite em `data/empresas.db`.
- **Config e cardápio**: JSON por tenant com recarga ao vivo (cache por mtime).
- **Sessão WhatsApp**: `LocalAuth` dentro do diretório do tenant.

## 6. Fora de escopo (o que o produto NÃO faz)

- Não gerencia o ciclo do pedido (preparo, despacho, entrega).
- Não processa pagamento online.
- Não calcula taxa de entrega por região/CEP (taxa única por tenant).
- Não tem app próprio para o cliente; tudo acontece no WhatsApp.
- Não usa a API Oficial do WhatsApp (usa biblioteca não-oficial).
- Não tem painel de super-admin para gerenciar todos os tenants.

## 7. Requisitos não-funcionais

- **Usabilidade**: painel simples, em português, utilitário (uso diário, com pressa).
- **Tempo real**: edições de cardápio e config refletem sem reiniciar o bot.
- **Isolamento**: dados e sessão WhatsApp de cada tenant completamente separados.
- **Robustez**: conexão manual com watchdog (90s) e opção de recuperar sessão travada.
- **Portabilidade**: roda em Windows (teste) e Linux/Docker (produção).
- **Segurança (mínima atual)**: senha com hash; recomendado HTTPS em produção.

## 8. Decisões e premissas

- Multi-tenant via diretórios: simples, sem risco de vazamento entre tenants.
- SQLite para pedidos: sem servidor externo, ACID, suporta volume do segmento.
- Bebida e observação são comportamentos automáticos do fluxo (não configuráveis hoje).
- Bebidas identificadas pela categoria com "bebida" no nome.
- Cada WhatsApp conectado usa ~200 MB RAM (Chromium). Infraestrutura deve escalar
  conforme o número de tenants ativos.

## 9. Roadmap / próximos passos (priorizáveis)

- [ ] Notificação para cozinha/atendente quando chega pedido novo (webhook ou push).
- [ ] Botões de status do pedido no painel (preparando / entregue / cancelado).
- [ ] Taxa de entrega por bairro/CEP.
- [ ] Painel de super-admin para gerenciar tenants (listar, suspender, ver métricas).
- [ ] Tornar pergunta de bebida e observação configuráveis (liga/desliga) no painel.
- [ ] Opcionais com regras (ex.: "escolha 1 de 3", "máx. 2").
- [ ] HTTPS + senha forte para deploy público seguro.

## 10. Métricas de sucesso (sugestão)

- % de pedidos concluídos pelo bot sem intervenção humana.
- Tempo médio para concluir um pedido pelo WhatsApp.
- Nº de tenants ativos e pedidos/mês por tenant.
- Nº de edições de cardápio feitas pelo dono sem suporte técnico.

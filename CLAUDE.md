# CLAUDE.md

Guia de contexto para assistentes de IA (Claude Code) e desenvolvedores. Leia antes de
alterar. **Este arquivo é o índice/essencial** — o detalhe de cada assunto fica em `docs/`
(ver a seção final) e é consultado sob demanda. Mantenha-o enxuto (~200 linhas).

## Visão geral

Plataforma **SaaS multi-tenant** de atendimento de restaurantes no WhatsApp, com
**painel web administrativo** por empresa. Cada empresa cadastrada recebe seu próprio
ambiente isolado (cardápio, config, pedidos, sessão WhatsApp). O bot é a **porta de
entrada de pedidos**: na conversa do WhatsApp ele envia o **link do cardápio web**
(`/c/:slug`), onde o cliente monta o pedido (itens, opcionais, observação, entrega,
pagamento) e finaliza; o pedido cai no backend (recalculado lá) e o bot **confirma**
automaticamente. O andamento do pedido é feito por um sistema externo — este projeto
**não** gerencia o ciclo do pedido (preparo/entrega).

Idioma do projeto: **português (Brasil)**. Mensagens, comentários e UI em pt-BR.

## Stack

- Node.js (CommonJS, `require`). O **Baileys é ESM-only** → carregado via `import()`
  dinâmico (cacheado após o 1º load); não dá pra `require()` direto.
- `@whiskeysockets/baileys` (biblioteca **não-oficial** de WhatsApp via **WebSocket**,
  **sem browser/Chromium**) + `pino` (logger)
- `express` (API do painel + arquivos estáticos)
- **`pg` (PostgreSQL gerenciado no Supabase)** — empresas, pedidos, config e cardápio.
  Acesso async via pool (`src/db.js`). Migrações versionadas em `supabase/migrations/`
  (Supabase CLI: `npx supabase db push`).
- **`@supabase/supabase-js` — Auth (bcrypt + JWT) + Storage (imagens)**. Login em
  `src/supabase.js`; o token é o JWT do Supabase. Imagens do cardápio no bucket `cardapio`.
- **`jose`** — validação LOCAL do JWT (JWKS), sem ida à rede por request (`exigeAuth`).
- `qrcode` / `qrcode-terminal` (QR de conexão — data URL no painel + impressão no terminal)
- `stripe` (assinatura — ver [docs/assinatura-stripe.md](docs/assinatura-stripe.md))
- Front-end em HTML/CSS/JS puro (sem framework)
- **Google Stitch MCP** (`npx @_davideast/stitch-mcp`) — gerador de layout de tela via IA. **Sempre** que for criar uma nova tela, seção visual ou alterar o layout de uma tela existente no front-end, usar o Stitch MCP para gerar/propor o HTML e as referências de estilo, salvo quando a mudança for puramente estrutural (ex.: mover blocos de HTML existentes, renomear classes). A chave da API está nas variáveis de ambiente (`STITCH_API_KEY`).

> **App stateless — NADA é gravado em disco.** Tudo no Supabase: dados em Postgres (`empresas`,
> `pedidos`, `config`/`cardapio` jsonb), contas no Auth, **sessões do WhatsApp** na tabela
> `wa_auth` (adapter `src/wa-auth.js`, no lugar do `useMultiFileAuthState`) e **imagens** no
> Storage. Sem volume persistente; habilita múltiplas instâncias / hosts efêmeros.

> **Histórico:** o projeto usava `whatsapp-web.js` (Puppeteer/Chromium), trocado por Baileys
> por instabilidade (QR parava de gerar; erros `detached Frame`). Baileys é WebSocket, mais
> leve e estável. **Ambos são não-oficiais** — o caminho de produção séria é a WhatsApp Cloud
> API (ver `ROADMAP.md`).

## Como rodar

```bash
npm install
npm start            # inicia o painel (porta de PORT no .env, ex.: 3001)
```

**Requer `.env`** (ver `.env.example`) com as credenciais do Supabase — sem elas o app não sobe:

```
DATABASE_URL=...                 # Postgres (Settings → Database; prefira Session pooler 5432)
SUPABASE_URL=...                 # Settings → API
SUPABASE_ANON_KEY=...            # anon public
SUPABASE_SERVICE_ROLE_KEY=...    # service_role (secreto, só backend)
```

Para o **cardápio web** (canal de pedido): `PUBLIC_URL` (URL pública base p/ o bot montar o
link, ex.: `https://pedidos.seudominio.com`) e `CARDAPIO_LINK_SECRET` (assina o token que liga
o pedido ao cliente). **Opcionais** — sem eles o app sobe, mas o bot manda um aviso no lugar do link.

Para **planos e frete por raio**: `STRIPE_PRICE_ID_COMPLETO` (preço do **Plano Completo**, além do
`STRIPE_PRICE_ID` do Essencial) e `GEOAPIFY_API_KEY` (geocodificação do frete por raio). Detalhe em
[docs/planos-e-frete.md](docs/planos-e-frete.md).

Para **e-mail transacional** (boas-vindas, "esqueci a senha", confirmação de assinatura, avisos):
`RESEND_API_KEY` + `EMAIL_FROM` (remetente de domínio verificado no Resend). Sem isso, os e-mails
viram no-op (não quebram o fluxo). Módulo em `src/email.js`.

Schema: `npx supabase db push` aplica as migrações de `supabase/migrations/`.

No **primeiro acesso**, crie a primeira empresa pelo onboarding público em `/cadastro.html`
(nome, e-mail e senha). O tenant nasce limpo (cardápio vazio, identidade só com o nome).
Depois faça login e, na aba **Conexão**, clique em "Conectar ao WhatsApp".

**Testes:** `npm test` (runner nativo `node:test`, sem dep — testa a lógica pura crítica em
`test/`: validação de payload, magic bytes, slug, planos e frete por raio) e `npm run check`
(varredura de sintaxe). Os testes usam **env dummy** → rodam sem segredos (e no CI, ver
`.github/workflows/test.yml`). Para integração/fluxo do bot, use o **simulador** (`node testar-bot.js`
ou a aba Simulador). Ver [docs/testar-bot.md](docs/testar-bot.md).

## Arquitetura

```
index.js              -> sobe o servidor (NÃO inicia o bot) + jobs (higiene de sessões, retenção)
src/
  db.js               -> pool Postgres (pg), lê DATABASE_URL do .env
  supabase.js         -> clients do Supabase (Auth admin/anon + Storage)
  stripe.js           -> assinatura (Stripe): SetupIntent/checkout próprio, webhook, portal, faturas, trocaPlano (upgrade/downgrade)
  planos.js           -> mapa PURO de planos (Essencial/Completo): PLANO_INFO + planoDoPrice (price→plano)
  pagamentos.js       -> formas de pagamento PURO: vocabulário FIXO (FORMAS_PAGAMENTO: Dinheiro/PIX/Crédito/Débito; "A Prazo"/fiado entra na Fase 3) + normalizarFormasPagamento (whitelist/migra strings legadas) + ehAPrazo. `config.pagamentos` só aceita canônicos (whitelist ao salvar + normaliza na leitura do painel)
  plataforma.js       -> dados globais da plataforma (singleton plataforma_config) + creds master
  incidentes.js       -> histórico de incidentes (tabela incidentes): registrar (agrupa rajadas em janela de 5min) / listar / limparAntigos; alimenta a aba Monitoramento do master (GET /api/admin/incidentes)
  servidor.js         -> Express: API REST multi-tenant + serve /public + cardápio web (GET /c/:slug, GET/POST /api/c/:slug, POST /api/c/:slug/frete) + PDV (POST /api/pdv/vender, gate exigePdv) + agente de impressão (/api/agente/login·refresh·pendentes·:numero/impresso + FILA genérica /api/agente/fila·:id/impresso) + reimprimir (POST /api/pedidos/:id/reimprimir) + download do agente (GET /downloads/nymbus-impressora.exe)
  impressao-fila.js   -> fila de impressão GENÉRICA (tabela impressao_fila): o servidor renderiza o TEXTO das vias e enfileira (PDV/Mesas/Caixa/reimpressão); o agente busca, imprime e marca. Delivery NÃO usa (segue pelo polling de `pedidos`)
  empresas.js         -> CRUD de tenants na tabela `empresas` + Supabase Auth (cadastro/login)
  clientes.js         -> clientes por empresa: cadastro em background (bot/checkout, chave empresa_id+telefone) + CRUD admin do painel (PF/PJ, CPF/CNPJ, endereço, limite de crédito/fiado, liberação pontual). CPF/CNPJ validados em validacao.js. `resumoFiado` derivado de fiado.js. Excluir bloqueia se houver fiado em aberto. Sem gate de plano
  fiado.js            -> venda "A Prazo" (fiado): helpers PUROS `calcularVencimento` (dia fixo do mês) e `podeVenderAPrazo` (bloqueio por limite/vencimento, liberação pontual) + `venderAPrazo` (PDV Balcão) / `fecharMesaAPrazo` (Mesa) que criam pedido `a_prazo` vinculado a cliente SEM movimento no caixa + `resumoDoCliente` (gasto/saldo/vencido das vendas a prazo em aberto). Testado em test/fiado.test.js
  wa-auth.js          -> sessão Baileys persistida no Postgres (tabela wa_auth) — stateless
  multi-bot.js        -> gerencia um socket WhatsApp (Baileys) por tenant (Map slug→socket)
  fluxo.js            -> bot: saudação envia o LINK do cardápio web (/c/:slug?p=token); estados MENU/ATENDENTE
  cardapio-web.js     -> helpers PUROS do cardápio web (projeção whitelist, recálculo do pedido, token HMAC do link)
  frete.js            -> frete avançado (Plano Completo): por RAIO (Haversine + faixas + geocodificar() Geoapify c/ cache geo_cache) e por BAIRRO (normalizarNome/encontrarBairro/resolverFreteBairro — match exato normalizado, sem geocode). Puros
  cep.js              -> busca de CEP (ViaCEP) com cache no banco (tabela ceps)
  assets.js           -> cache-busting SEM build: versaoAssets (hash do conteúdo dos css/js de public/) + injetarVersao (injeta ?v nos assets das páginas HTML). Puro; o servidor.js serve HTML fresco (no-cache) com a versão
  email.js            -> e-mail transacional via Resend (boas-vindas, reset de senha, assinatura, avisos)
  store.js            -> config/cardápio (jsonb) com cache em memória; ensure() async
  sessoes.js          -> estado da conversa por cliente (em memória, expira em 30min)
  pedidos.js          -> tabela `pedidos` no Postgres, isolada por empresa_id (async)
  caixa.js            -> caixa do dia (Completo): abrir/receber/sangria/suprimento/fechar; `cancelarRecebido` (cancela pedido PAGO mantendo rastro: insere movimento `cancelamento` que deduz, não apaga o recebimento); fechamento com contagem de cédulas + conferência cartão/Pix (relatório mostra vendas LÍQUIDAS por forma + lista CANCELAMENTOS); NÃO fecha com vendas do turno a receber; monta o relatório 80mm no servidor (via relatorio-caixa.js); `venderLocal` (PDV: pedido "Balcão" recebido + 1 movimento por forma, transação); recebimento grava `valor_pago`/`troco` por forma (CHECK de coerência no banco: valor_pago = valor + troco); isolado por empresa_id
  caixa-calc.js       -> PURO: cálculos do caixa (resumo por forma, esperado em espécie/eletrônico, total em caixa, total da contagem de cédulas, diferença) — testado em test/caixa-calc.test.js
  pdv.js              -> PURO: PDV (vendas no local, Completo) — recalcular venda (kg+opcionais), aplicar desconto (R$/%), validar split, troco, resumo de pagamento — testado em test/pdv.test.js
public/
  index.html          -> landing (apresentação + preço + CTAs) · footer institucional (footer.js)
  login.html          -> login (e-mail + senha; roteia restaurante x master)
  cadastro.html       -> wizard de onboarding (4 etapas): cria empresa + configura
  checkout.html       -> checkout próprio (Stripe Elements) p/ ativar o trial com cartão
  admin.html          -> painel administrativo (inclui aba Assinatura + gate)
  admin-master.html   -> painel super-admin (gestão de tenants + assinatura + Config Master)
  termos.html / privacidade.html -> páginas legais (LGPD); identidade injetada de /api/plataforma/publico
  app.js, app-admin.js, footer.js, style.css -> lógica dos painéis, footer e estilos
  endereco-cep.js     -> util: máscara/busca de CEP (ViaCEP) + composição de endereço
  dinheiro.js         -> util: máscara monetária (centavos primeiro) + formatação BR
  documento.js        -> PURO (dual-mode): máscara + validação de CPF/CNPJ e telefone (WhatsApp); espelha validarCpf/validarCnpj de src/validacao.js (usado no cadastro de cliente)
  texto.js            -> PURO (dual-mode Node/browser): padroniza nomes (Title Case PT-BR: tituloPt + padronizarNomesCardapio) — no editor (blur) E no servidor ao salvar (PUT /api/cardapio) — testado em test/texto.test.js
  relatorio-caixa.js  -> PURO (dual-mode Node/browser): monta o relatório de fechamento de caixa 80mm — usado NO SERVIDOR por src/caixa.js — testado em test/relatorio-caixa.test.js
  comanda.js          -> PURO (dual-mode Node/browser): monta as 2 vias (cozinha sem preços / cupom com cabeçalho da marca + rodapé de marketing) — testado em test/comanda.test.js
  grupos.js           -> PURO (dual-mode Node/browser): composição selecionável — normaliza subgrupos + valida escolhas (obrigatório/mín/máx); usado por src/cardapio-web.js e src/pdv.js — testado em test/grupos.test.js
  variacoes.js        -> PURO (dual-mode): variações do item — opções com preço E estoque próprios ("a partir de R$ X"); normaliza/valida (≥1) + precoAPartir + todasEsgotadas; estoque por opção (item.id::variacao.id) baixado por public/estoque.js; usado por src/cardapio-web.js e src/pdv.js — testado em test/variacoes.test.js
  serial-escpos.js    -> PURO (dual-mode): encoder ESC/POS (init+CP850+avanço+corte legado ESC m/ESC i p/ Daruma) — usado NO AGENTE (vendor) — testado em test/serial-escpos.test.js
  cardapio.html/.js/.css -> cardápio web público (/c/:slug): cards premium + vitrine de Destaques em carrossel; monta o pedido (carrinho/checkout) e envia ao backend
supabase/migrations/  -> schema versionado (npx supabase db push)
scripts/setup-storage.js -> cria o bucket público de imagens (npm run setup-storage)
agente-impressora/    -> app desktop Electron (Plano B): imprime automaticamente numa térmica (USB / Rede 9100 / Serial COM). Consome /api/agente/pendentes (delivery — monta a comanda) E /api/agente/fila (PDV/Mesas/Caixa/reimpressão — texto já renderizado). Reusa public/comanda.js+serial-escpos.js via vendor/ (copy-shared.js no build). Poll a cada 3s. Plano: docs/superpowers/plans/2026-06-26-agente-impressora-electron.md
```

**Fluxo de dados:** painel edita config/cardápio via API → `store.setConfig/setCardapio` grava
no Postgres e atualiza o cache em memória (processo único) → `fluxo.js` lê do cache no próximo
atendimento, **sem reiniciar**. Cache por processo → múltiplas instâncias exigiriam invalidação/
pub-sub (hoje é instância única). O `tenantDir(slug)` segue como **chave** do tenant (basename é
o slug); nenhum arquivo é lido/gravado nesse caminho.

**Fluxo do pedido (cardápio web):** bot manda `/c/:slug?p=<token>` → a página busca `GET /api/c/:slug`
(projeção whitelist do cardápio) → o cliente monta o carrinho e faz `POST /api/c/:slug/pedido` → o
servidor **recalcula** preço/total a partir do cardápio (nunca confia no cliente), salva via
`pedidos.salvarPedido` e o bot **confirma** pelo WhatsApp (o `token` liga ao `chatId`; fallback no
telefone). Detalhe em [docs/modelo-dados.md](docs/modelo-dados.md).

## Multi-tenant

Cada empresa tem **slug** único gerado do nome (chave em tudo: linha `empresas`, `empresa_id`
dos pedidos, `wa_auth` da sessão, pasta de imagens no Storage), **linha em `empresas`** (Postgres,
`config`/`cardapio` jsonb, ligada ao usuário do Auth por `user_id`), **sessão WhatsApp** em
`wa_auth` e **imagens** no Storage (`cardapio/{slug}/`). Nada em disco.

Autenticação: `POST /api/login { email, senha }` → `{ token, slug, nome }`, onde `token` é o
**JWT do Supabase Auth** (viaja em `Authorization: Bearer ...`). O middleware `exigeAuth` (async)
valida o JWT **localmente** (`empresas.resolverPorToken` → `jose.jwtVerify` com o JWKS público;
fallback para `getUser` em erro), checa `ativo` a cada request (suspensão é imediata) e resolve
`req.slug` / `req.tenantDir`. JWT é stateless → logout é só descartar o token no cliente.

- **Conta de acesso, Privacidade/LGPD (exportar/excluir, retenção, Termos/Privacidade):** ver
  [docs/lgpd/lgpd-e-conta.md](docs/lgpd/lgpd-e-conta.md) (índice em [docs/lgpd/](docs/lgpd/README.md)).
- **Super-admin (painel master, métricas, suspender/excluir, Config Master):** ver
  [docs/super-admin.md](docs/super-admin.md).
- **Assinatura (Stripe):** ver [docs/assinatura-stripe.md](docs/assinatura-stripe.md).

## Convenções

- Comentários e textos ao usuário em português.
- **Textos ao usuário** seguem a voz da marca da skill `copy-nymbus` (`.claude/skills/`): benefício antes de recurso, frase curta, **sem travessão (—) como conector**, sem emoji. Auditoria/reescrita de copy pode usar o agente `copywriter`.
- Formatação WhatsApp: `*negrito*`, `_itálico_`.
- Evitar dependências novas sem necessidade; manter o front-end sem framework.
- Não expor senhas em respostas da API.
- Todo código novo passa `tenantDir` explicitamente — sem estado global de tenant.
- Ao adicionar nova rota à API, usar `exigeAuth` e referenciar `req.tenantDir`.
- **Valores monetários** — padrão **único** `dinheiro.js` (`window.Dinheiro`): inputs `type=text inputmode=numeric` + `Dinheiro.mascarar`/`Dinheiro.valor` (máscara "centavos primeiro"; **nunca** `type=number`/`parseFloat`); exibição via `Dinheiro.formatar`/`comPrefixo` — no `app.js` os atalhos `moedaBR`/`fmtBRn` delegam ao util → sempre `1.234,56` **com separador de milhar**; impressos dual-mode (`comanda.js`/`relatorio-caixa.js`) têm `fmtBR` que **espelha** o formato. Toda tela nova com R$ segue isso. Detalhe e exceções (% e kg) em [docs/design-system.md](docs/design-system.md). **Endereço** via `endereco-cep.js`.
- **CSP estrita (helmet):** todo JS do front é **externo** — **nunca** adicionar `<script>` inline nem
  handler inline (`onclick=`, `onsubmit=`) no HTML (a CSP bloqueia; usar `addEventListener` em `.js`).
  Origem externa nova (CDN/API) exige liberar a diretiva correspondente no `helmet` de `src/servidor.js`.
  Rotas de autenticação/cadastro têm **rate limit** (`express-rate-limit`); `trust proxy` ligado (Fly).

## Documentação detalhada (`docs/`)

O detalhe profundo de cada assunto vive em `docs/` (não carregado por padrão — leia o arquivo
relevante ao mexer na área):

- [docs/super-admin.md](docs/super-admin.md) — painel master: auth isolada, rotas, métricas, suspender/excluir (reflexo no Stripe), Configurações Master, footer da landing.
- [docs/assinatura-stripe.md](docs/assinatura-stripe.md) — monetização: **dois planos** (Essencial/Completo), eixos de acesso, checkout próprio, webhook, gate, upgrade/downgrade (proration), faturas, gestão de cartões.
- [docs/planos-e-frete.md](docs/planos-e-frete.md) — **planos (Essencial × Completo): frete por raio + impressão térmica**: gating por plano (`temFreteRaio`), aba Entrega, Geoapify/Haversine/faixas, escolha no checkout + upgrade na Assinatura + troca no master; **impressão térmica 80mm via AGENTE** (Plano Completo): o app desktop Nymbus Impressora imprime TODOS os fluxos automaticamente (delivery + PDV + Mesas + Caixa) — fila genérica `impressao_fila` (servidor renderiza o texto via `comanda.js`/`relatorio-caixa.js` e enfileira; agente busca/imprime via `serial-escpos.js` por Rede 9100/Serial COM); config da impressora (porta/corte/sem-acento) no próprio app; tela Configurações → Impressora = download do agente; **Reimprimir** re-enfileira; o caminho navegador (`window.print`/Web Serial) foi **removido** (Fase 3); **caixa do dia** (Plano Completo): **receber é no Pedido** (selo/filtro de pagamento na aba Pedidos); tela do caixa aberto estilo PDV (Total em Caixa, Vendas por forma, Movimentação, **extrato** do turno com estorno); **fechamento** = contagem de cédulas + conferência cartão/Pix → **relatório 80mm montado no servidor** e guardado p/ reimpressão; **não fecha com vendas a receber**; **Caixas anteriores** com resumo por linha (3 últimos, reabre relatório); gate `temCaixa` (front+back), tabelas `caixas` (+ `operador`/`obs_abertura`/`contado_eletronico`/`detalhe_fechamento`)/`caixa_movimentos` + `pedidos.recebido_em`, `src/caixa.js`/`caixa-calc.js`/`public/relatorio-caixa.js`; **PDV — vendas no local** (Plano Completo): aba dedicada (exige caixa aberto), grade de produtos + carrinho (opcionais/observação/itens por kg) → tela de pagamento (desconto R$/%, **split**, troco) → exige **caixa aberto do dia** (caixa aberto em dia anterior = `vencido` → PDV bloqueado até fechar; `caixaAberto` calcula `vencido` no fuso BR); **tipo de venda** (Balcão/Entrega/Retirada): Entrega abre overlay de endereço (CEP autopreenche via `EnderecoCep`) + **frete** calculado (`POST /api/pdv/frete`, fixo/raio) com lixeira p/ zerar (cortesia); **comportamento por tipo** (todos `origem='pdv'` + **baixa de estoque atômica** `store.baixarEstoqueTx`): **Balcão** paga na hora → **pedido recebido** + 1 movimento por forma no caixa (`caixa.venderLocal`), imprime cozinha (se houver) + cupom; **Entrega/Retirada** **sem cobrança** → nascem **a receber** (sem caixa), vão p/ **Pedidos** (recebimento depois, botão Receber), imprime Entrega = cozinha+cupom / Retirada = só cozinha (front esconde o pagamento → botão "Enviar para Pedidos"). As vias vão p/ `impressao_fila` (tipo `pdv`) e saem pelo agente; o PDV **nunca** abre o modal de novo pedido — esse alerta é escopado **no servidor** a `origem='web'` (`pedidos.ultimo`/`pendentes`). Rota `POST /api/pdv/vender` (gate `temPdv`), `src/pdv.js` (puro) + `caixa.venderLocal`, colunas `pedidos.desconto`/`pedidos.origem`, front em `public/app.js` (`carregarPdv`/`renderPdv*`).
- [docs/lgpd/](docs/lgpd/README.md) — **conformidade LGPD** (índice): [lgpd-e-conta.md](docs/lgpd/lgpd-e-conta.md) (conta de acesso + exportar/excluir/retenção/Termos/Privacidade/aceite), [ropa.md](docs/lgpd/ropa.md) (inventário de tratamentos), [subprocessadores.md](docs/lgpd/subprocessadores.md) (parceiros + região), [resposta-incidentes.md](docs/lgpd/resposta-incidentes.md). Aceite do dono gravado (`empresas.termos_aceitos_em`/`termos_versao`); trilha de auditoria em `src/auditoria.js` (tabela `auditoria`).
- [docs/modelo-dados.md](docs/modelo-dados.md) — schema (`empresas` + coluna `plano`, `pedidos`, **`itens_venda`** — projeção relacional dos itens via trigger, item do cardápio, `config.frete`, `geo_cache`) + **cardápio web** (API pública, recálculo no servidor, frete por raio, token de link) + estados enxutos do bot (`fluxo.js`).
- [docs/features.md](docs/features.md) — onboarding (wizard 4 etapas), utils de formulário (`endereco-cep.js`/`dinheiro.js`) e horário de funcionamento.
- [docs/gotchas.md](docs/gotchas.md) — pontos de atenção: anti-massa, conexão manual, sessão `wa_auth`, avisar cliente, segurança, backup, pooler.
- [docs/testar-bot.md](docs/testar-bot.md) — simulador de conversa (terminal + painel).
- [docs/design-system.md](docs/design-system.md) — tokens de cor/forma, componentes, tipografia, padrões de layout. (Referência visual por tela: `design/UI.md`.)

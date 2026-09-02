# CLAUDE.md

Guia de contexto para assistentes de IA (Claude Code) e desenvolvedores. Leia antes de
alterar. **Este arquivo é o índice/essencial** — o detalhe de cada assunto fica em `docs/`
(ver a seção final) e é consultado sob demanda. Mantenha-o enxuto (~200 linhas).

## Visão geral

Plataforma **SaaS multi-tenant de gestão para restaurantes** (pedidos, PDV, caixa, mesas e
cardápio), com **painel web administrativo** por empresa. Cada empresa cadastrada recebe seu
próprio ambiente isolado (cardápio, config, pedidos, sessão WhatsApp). O WhatsApp é **um canal
de entrada**, não a promessa central (reposicionamento de 2026-07-30; a voz da marca vive na
skill `copy-nymbus`). Nesse canal, o bot é a **porta de entrada de pedidos**: na conversa do
WhatsApp ele envia o **link do cardápio web**
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
- **Claude Design** (skill `design`) — protótipo de tela. **Sempre** que for criar tela nova, seção visual ou alterar o layout de uma tela existente, desenhar antes e mostrar ao dono, salvo quando a mudança for puramente estrutural (ex.: mover blocos de HTML existentes, renomear classes). **Semear a prancheta com os tokens REAIS de `public/style.css`** (o design system do projeto é aquele arquivo, não um cadastro na ferramenta) e guardar os `.dc.html` em `design/canvas/`, versionados. **Fallback:** se o Claude Design falhar, usar o `stitch` MCP, que segue configurado em `.opencode/opencode.json` (`STITCH_API_KEY`).

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
link limpo, ex.: `https://pedidos.seudominio.com`). Sem ela o app sobe, mas o bot manda um aviso
no lugar do link. `CARDAPIO_LINK_SECRET` é **opcional/legado**: o backend ainda aceita links antigos
com `?p=`, mas o bot não gera mais token; a confirmação usa o telefone informado no checkout.

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
(varredura de sintaxe). **`src/db.js` recusa acesso ao banco dentro do runner** (detecta
`NODE_TEST_CONTEXT`): o `.env` local aponta para produção, e um teste que esqueça de stubar
sairia gravando em dado real. Stube `db.query`/`db.pool.connect`; `PERMITIR_BANCO_EM_TESTE=1`
é a saída consciente. Os testes usam **env dummy** → rodam sem segredos. Quem garante isso é
**`npm run test:ci`**: roda a suíte a partir de uma pasta vazia, para o `dotenv` não repor o
`.env` local, que é a condição exata do runner. O hook de `pre-push` em `.githooks/` o executa
antes de deixar subir (ligue com `git config core.hooksPath .githooks` em cada clone). Sem isso a
suíte fica verde no notebook e vermelha no GitHub, que foi o que aconteceu por cinco dias em 21/08. **`npm run test:integracao`** é a terceira bateria e a única que toca banco: sobe o Express
numa porta livre e conversa por HTTP contra um Postgres REAL, num projeto Supabase separado e
descartável (`.env.test`, modelo em `.env.test.example`) — é o consumidor legítimo do
`PERMITIR_BANCO_EM_TESTE=1`. Mora em `test/integracao/`, fora do glob do `npm test` (que não
entra em subpasta), e **recusa rodar** se o `.env.test` apontar para o mesmo projeto do `.env`
ou se faltar a marca `BANCO_DE_TESTE=1`. Cobre isolamento entre empresas, recálculo de
preço do cardápio web, caixa (abrir/receber/estornar/fechar), PDV (venda, baixa de estoque,
porteiro do plano) e mesas (abrir/lançar/pagar, e o caixa que não fecha com mesa aberta). Para integração/fluxo do bot, use o **simulador** (`node testar-bot.js`
ou a aba Simulador). Ver [docs/testar-bot.md](docs/testar-bot.md).

## Arquitetura

```
index.js              -> sobe o servidor (NÃO inicia o bot) + jobs (higiene de sessões, retenção)
src/                  -> backend: Express/API multi-tenant, Postgres, bot (Baileys), caixa,
                          PDV, mesas, estoque, e-mail, Stripe, impressão
public/               -> painéis (admin/master), cardápio web público (/c/:slug), e utils
                          PURAS dual-mode (Node/browser) que servidor e front compartilham
supabase/migrations/  -> schema versionado (npx supabase db push)
scripts/              -> scripts administrativos (setup-storage, migrações de dado pontuais)
agente-impressora/    -> app desktop Electron (Plano B), imprime automaticamente na térmica
```

Papel de cada arquivo dentro de `src/` e `public/`, módulo a módulo, está em
[docs/arquitetura.md](docs/arquitetura.md) — leia sob demanda ao mexer numa área específica.

**Fluxo de dados:** painel edita config/cardápio via API → `store.setConfig/setCardapio` grava
no Postgres e atualiza o cache em memória (processo único) → `fluxo.js` lê do cache no próximo
atendimento, **sem reiniciar**. Cache por processo → múltiplas instâncias exigiriam invalidação/
pub-sub (hoje é instância única). O `tenantDir(slug)` segue como **chave** do tenant (basename é
o slug); nenhum arquivo é lido/gravado nesse caminho.

**Fluxo do pedido (cardápio web):** bot manda `/c/:slug` → a página busca `GET /api/c/:slug`
(projeção whitelist do cardápio) → o cliente monta o carrinho e faz `POST /api/c/:slug/pedido` → o
servidor **recalcula** preço/total a partir do cardápio (nunca confia no cliente), salva via
`pedidos.salvarPedido` e o bot **confirma** pelo WhatsApp usando o telefone informado no checkout.
Links antigos com `?p=` ainda são aceitos e podem usar o `chatId` legado. Detalhe em
[docs/modelo-dados.md](docs/modelo-dados.md).

## Multi-tenant

Cada empresa tem **slug** único gerado do nome (chave em tudo: linha `empresas`, `empresa_id`
dos pedidos, `wa_auth` da sessão, pasta de imagens no Storage), **linha em `empresas`** (Postgres,
`config`/`cardapio` jsonb, ligada ao usuário do Auth por `user_id`), **sessão WhatsApp** em
`wa_auth` e **imagens** no Storage (`cardapio/{slug}/`). Nada em disco.

Autenticação: `POST /api/login { email, senha }` cria sessão no Supabase Auth, seta o refresh token
em cookie `httpOnly` e devolve `{ token, slug, nome }`, onde `token` é o **JWT do Supabase Auth**
mantido em memória no front e enviado em `Authorization: Bearer ...`. `POST /api/refresh` renova o
access token; `POST /api/logout` revoga a sessão local. O middleware `exigeAuth` (async) valida o
JWT **localmente** (`empresas.resolverPorToken` → `jose.jwtVerify` com o JWKS público; fallback para
`getUser` em erro), checa `ativo` a cada request (suspensão é imediata) e resolve `req.slug` /
`req.tenantDir`.

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
- **Tabela nova no schema público:** a migração precisa do bloco de hardening — `enable row level
  security` + `revoke all ... from anon, authenticated` (modelo: `20260716120000_rls_hardening_2.sql`).
  O Supabase concede os grants por padrão, e sem isso o Advisor acusa "RLS Disabled in Public". RLS
  ligado **sem policy** é deny-all deliberado: o backend usa a conexão privilegiada do `DATABASE_URL`,
  que ignora RLS — policy só abriria um caminho que hoje está fechado.
- **Valores monetários** — padrão **único** `dinheiro.js` (`window.Dinheiro`): inputs `type=text inputmode=numeric` + `Dinheiro.mascarar`/`Dinheiro.valor` (máscara "centavos primeiro"; **nunca** `type=number`/`parseFloat`); exibição via `Dinheiro.formatar`/`comPrefixo` — no `app.js` os atalhos `moedaBR`/`fmtBRn` delegam ao util → sempre `1.234,56` **com separador de milhar**; impressos dual-mode (`comanda.js`/`relatorio-caixa.js`) têm `fmtBR` que **espelha** o formato. Toda tela nova com R$ segue isso. Detalhe e exceções (% e kg) em [docs/design-system.md](docs/design-system.md). **Endereço** via `endereco-cep.js`.
- **Página HTML nova declara o ícone da aba:** `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` no `<head>`. Sem a tag o navegador chuta `/favicon.ico`, ninguém responde e sobra 404 em todo carregamento. Detalhe em [docs/design-system.md](docs/design-system.md).
- **CSP estrita (helmet):** todo JS do front é **externo** — **nunca** adicionar `<script>` inline nem
  handler inline (`onclick=`, `onsubmit=`) no HTML (a CSP bloqueia; usar `addEventListener` em `.js`).
  Origem externa nova (CDN/API) exige liberar a diretiva correspondente no `helmet` de `src/servidor.js`.
  Rotas de autenticação/cadastro têm **rate limit** (`express-rate-limit`); `trust proxy` ligado (Fly).
- **Sessão e rate limit — duas regras que já causaram incidente** (detalhe em [docs/gotchas.md](docs/gotchas.md)):
  a conta do restaurante é **compartilhada** entre aparelhos, então o logout usa `"local"` (derrubar tudo
  só no reset de senha e na troca de credencial); e todo limitador passa por `limitador()`, cuja chave é o
  **`Fly-Client-IP`** — usar `req.ip` faz a plataforma inteira dividir o mesmo balde.

## Documentação detalhada (`docs/`)

O detalhe profundo de cada assunto vive em `docs/` (não carregado por padrão — leia o arquivo
relevante ao mexer na área):

- [docs/super-admin.md](docs/super-admin.md) — painel master: auth isolada, rotas, métricas, suspender/excluir (reflexo no Stripe), Configurações Master, footer da landing.
- [docs/assinatura-stripe.md](docs/assinatura-stripe.md) — monetização: **dois planos** (Essencial/Completo), eixos de acesso, checkout próprio, webhook, gate, upgrade/downgrade (proration), faturas, gestão de cartões.
- [docs/planos-e-frete.md](docs/planos-e-frete.md) — **planos (Essencial × Completo): frete por raio/bairro + impressão térmica**: gating por plano (`temFreteRaio`), aba Entrega, Geoapify/Haversine/faixas, frete por bairro, escolha no checkout + upgrade na Assinatura + troca no master; **impressão térmica 80mm via AGENTE** (Plano Completo): o app desktop Nymbus Impressora imprime TODOS os fluxos automaticamente (delivery + PDV + Mesas + Caixa) — fila genérica `impressao_fila` (servidor renderiza o texto via `comanda.js`/`relatorio-caixa.js` e enfileira; agente busca/imprime via `serial-escpos.js` por Rede 9100/Serial COM); config da impressora (porta/corte/sem-acento) no próprio app; tela Configurações → Impressora = download do agente; **Reimprimir** re-enfileira pedidos, relatórios e comprovantes de caixa pelo extrato; o caminho navegador (`window.print`/Web Serial) foi **removido** (Fase 3); **caixa do dia** (Plano Completo): **receber é no Pedido** (selo/filtro de pagamento na aba Pedidos); tela do caixa aberto estilo PDV (dinheiro em caixa, vendas líquidas por forma, total para conferência, Movimentação, **extrato** do turno com estorno); **fechamento** = conferência simplificada por forma de pagamento (esperado/contado/diferença) → **relatório 80mm montado no servidor** e guardado p/ reimpressão; **não fecha com vendas do turno a receber** nem mesa aberta; **Caixas anteriores** com resumo por linha (3 últimos, reabre relatório); gate `temCaixa` (front+back), tabelas `caixas` (+ `operador`/`obs_abertura`/`contado_eletronico`/`detalhe_fechamento`)/`caixa_movimentos` + `pedidos.recebido_em`, `src/caixa.js`/`caixa-calc.js`/`public/relatorio-caixa.js`; **PDV — vendas no local** (Plano Completo): aba dedicada (exige caixa aberto), grade de produtos + carrinho (opcionais/observação/itens por kg) → tela de pagamento (desconto R$/%, **split**, troco) → exige **caixa aberto do dia** (caixa aberto em dia anterior = `vencido` → PDV bloqueado até fechar; `caixaAberto` calcula `vencido` no fuso BR); **tipo de venda** (Balcão/Entrega/Retirada): Entrega abre overlay de endereço (CEP autopreenche via `EnderecoCep`) + **frete** calculado (`POST /api/pdv/frete`, fixo/raio/bairro) com lixeira p/ zerar (cortesia); **comportamento por tipo** (todos `origem='pdv'` + **baixa de estoque atômica** `store.baixarEstoqueTx`): **Balcão** paga na hora → **pedido recebido** + 1 movimento por forma no caixa (`caixa.venderLocal`), imprime cozinha (se houver) + cupom; **Entrega/Retirada** **sem cobrança** → nascem **a receber** (sem caixa), vão p/ **Pedidos** (recebimento depois, botão Receber), imprime Entrega = cozinha+cupom / Retirada = só cozinha (front esconde o pagamento → botão "Enviar para Pedidos"). As vias vão p/ `impressao_fila` (tipo `pdv`) e saem pelo agente; o PDV **nunca** abre o modal de novo pedido — esse alerta é escopado **no servidor** a `origem='web'` (`pedidos.ultimo`/`pendentes`). Rota `POST /api/pdv/vender` (gate `temPdv`), `src/pdv.js` (puro) + `caixa.venderLocal`, colunas `pedidos.desconto`/`pedidos.origem`, front em `public/app.js` (`carregarPdv`/`renderPdv*`).
- [docs/lgpd/](docs/lgpd/README.md) — **conformidade LGPD** (índice): [lgpd-e-conta.md](docs/lgpd/lgpd-e-conta.md) (conta de acesso + exportar/excluir/retenção/Termos/Privacidade/aceite), [ropa.md](docs/lgpd/ropa.md) (inventário de tratamentos), [subprocessadores.md](docs/lgpd/subprocessadores.md) (parceiros + região), [resposta-incidentes.md](docs/lgpd/resposta-incidentes.md). Aceite do dono gravado (`empresas.termos_aceitos_em`/`termos_versao`); trilha de auditoria em `src/auditoria.js` (tabela `auditoria`).
- [docs/modelo-dados.md](docs/modelo-dados.md) — schema (`empresas` + coluna `plano`, `pedidos`, **`itens_venda`** — projeção relacional dos itens via trigger, item do cardápio, `config.frete`, `geo_cache`) + **biblioteca de complementos** (`cardapio.grupos` + `item.grupos`: opção com id estável, regra efetiva por produto, saída do pedido no formato antigo, conversão reversível) + **cardápio web** (API pública, recálculo no servidor, frete por raio/bairro, link limpo com token legado aceito) + estados enxutos do bot (`fluxo.js`).
- [docs/features.md](docs/features.md) — onboarding (wizard 4 etapas), utils de formulário (`endereco-cep.js`/`dinheiro.js`) e horário de funcionamento.
- [docs/arquitetura.md](docs/arquitetura.md) — árvore completa de `src/` e `public/`, papel de cada arquivo, um por um.
- [docs/gotchas.md](docs/gotchas.md) — pontos de atenção: anti-massa, conexão manual, sessão `wa_auth`, avisar cliente, segurança, backup, pooler.
- [docs/testar-bot.md](docs/testar-bot.md) — simulador de conversa (terminal + painel).
- [docs/design-system.md](docs/design-system.md) — tokens de cor/forma, componentes, tipografia, padrões de layout. (Referência visual por tela: `design/UI.md`.)

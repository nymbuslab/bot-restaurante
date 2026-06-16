# Auditoria de Segurança — Prompts para Claude Code

Playbook de auditoria do **Bot SaaS (WhatsApp + Painel)**: Node.js/Express, Supabase
(Postgres via `pg` + Auth + Storage), Baileys, Stripe, deploy no Fly.io. Multi-tenant.

## Como usar

- Cada bloco é um **prompt pronto pra colar** no Claude Code, isolado e autocontido.
- Todos seguem o seu padrão: começam com `[1] LEITURA` (ler o código real antes de tocar),
  **auditam e reportam achados** com severidade, **propõem** a correção e **param no gate** —
  não implementam sem o seu OK. Implementação vira um segundo passo depois da aprovação.
- Rode na **ordem de prioridade** abaixo. Os 3 primeiros são os que evitam vazamento real.
- Commits (só depois de aprovar a correção): Conventional Commits em PT, sem acento no título.
  Tipos sugeridos: `fix(seguranca): ...`, `chore(seguranca): ...`, `docs(seguranca): ...`.

## Premissas confirmadas pelos docs (pra auditoria não reinventar)

- **Stripe = assinatura do restaurante ao SaaS** (cartão via Payment Element, PCI SAQ A,
  tokenizado). O SaaS **não** processa pagamento do cliente final → confirmar que nenhum
  número de cartão/CVV é gravado em lugar nenhum (deve ser só `stripe_customer_id` etc.).
- **Dado sensível real:** PII do cliente final em `pedidos` (nome/telefone/endereço),
  **sessões do WhatsApp em `wa_auth`** (quem lê sequestra a conexão) e credenciais.
- **`pg`/`DATABASE_URL` ignora RLS** (papel `postgres`). A barreira real entre tenants é o
  filtro por `empresa_id`/`slug` no backend. RLS é defesa-em-profundidade.

## Ordem de prioridade

1. Segredos e histórico do Git
2. Isolamento multi-tenant (IDOR + bypass de RLS)
3. RLS no Supabase (defesa em profundidade) + bucket de Storage
4. Validacao de entrada, injecao e XSS no painel
5. Rate limiting e brute force (login, cadastro, master)
6. Cabecalhos de seguranca, CORS e trust proxy
7. Webhook do Stripe e integridade de acesso
8. Hardening do super-admin
9. Logs e vazamento de dados sensiveis
10. Dependencias / supply chain
11. LGPD tecnico (varredura de PII)

---

## 1. Segredos e histórico do Git

```
[1] LEITURA
Antes de qualquer mudanca, leia o codigo real e me reporte (nao altere ainda):
- .gitignore (raiz)
- .env.example
- package.json (scripts) e ecosystem.config.js / fly.toml / Dockerfile
- src/db.js, src/supabase.js, src/stripe.js, src/plataforma.js, src/servidor.js
- supabase/migrations/ (so liste os arquivos)

[2] AUDITORIA — Segredos e Git
Verifique e me reporte numa tabela (item / status / risco / acao proposta):

a) .gitignore cobre: .env e variantes (.env.local, .env.production), *.db/*.sqlite,
   node_modules, data/tenants/ (residuo legado de sessao/imagem), qualquer pasta
   baileys-*/ legada, e arquivos de log.
b) Rode um scan no HISTORICO INTEIRO do git (nao so no working tree). Comandos:
   - git log --all --full-history -- .env "*.env" "*.key" "*.pem" data/
   - se gitleaks/trufflehog estiverem disponiveis, rode "gitleaks detect --source . -v";
     se nao, me diga o comando exato pra eu instalar/rodar.
   Liste TODO arquivo sensivel que algum dia foi commitado (mesmo que ja removido).
c) Confirme que NENHUM destes aparece hardcoded no codigo ou em arquivo versionado:
   SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
   SUPERADMIN_SENHA_HASH, DATABASE_URL com senha. Faca grep por esses nomes e por
   padroes de chave (sk_live, sk_test, service_role, eyJ... de JWT longo).
d) Confirme que .env.example tem so placeholders (sem valor real).
e) Confirme no front (public/*.js, *.html) que NAO ha SERVICE_ROLE_KEY nem chave secreta
   embutida. So a publishable do Stripe e a anon do Supabase (se houver) podem ir ao front.

[3] REPORTE E PARE
Para cada segredo que algum dia entrou no git: marque como VAZADO e liste o passo de
ROTACAO (gerar nova chave + invalidar a antiga no painel do fornecedor) — remover do
historico NAO basta. Proponha as correcoes de .gitignore/.env.example mas NAO commite ainda.
Reporte qualquer adaptacao fora deste spec. Aguarde meu OK.
```

---

## 2. Isolamento multi-tenant (IDOR + bypass de RLS)

> O achado mais provável e mais grave do projeto. Como o `pg` ignora RLS, qualquer rota que
> aceite um identificador vindo do request (e não do token) pode vazar dado de outro tenant.

```
[1] LEITURA
Leia e me reporte (nao altere ainda):
- src/servidor.js (TODAS as rotas, com atencao ao middleware exigeAuth e a como req.slug /
  req.tenantDir / empresa_id sao resolvidos)
- src/empresas.js (resolverPorToken, autenticar, cadastrar, excluir)
- src/pedidos.js, src/store.js, src/wa-auth.js (assinaturas das funcoes: recebem tenant
  explicito ou aceitam slug/id do request?)
- src/db.js (confirme com qual papel/usuario o pool conecta — se for o owner/postgres,
  RLS e BYPASSADO)

[2] AUDITORIA — Isolamento entre tenants
Reporte numa tabela (rota / origem do tenant / risco IDOR / acao):

a) Para CADA rota sob exigeAuth: o tenant usado na query vem do TOKEN (req.slug/req.tenantDir
   derivado do JWT) ou de algo no body/params/query (slug, empresa_id, id de pedido, id de
   imagem)? Qualquer rota que aceite identificador do cliente e o use sem reconferir contra
   o tenant do token = IDOR (cliente A le/edita dado do cliente B). Liste todas.
b) Confirme que TODA query em pedidos.js/store.js/wa-auth.js tem filtro por empresa_id/slug
   do tenant autenticado. Aponte qualquer SELECT/UPDATE/DELETE sem esse filtro.
c) Rotas que recebem :slug na URL (super-admin) devem estar SO sob exigeSuperAdmin, nunca
   acessiveis com token de restaurante. Confirme a separacao exigeAuth x exigeSuperAdmin.
d) Upload de imagem (POST /api/imagem): o caminho cardapio/{slug}/ usa o slug do TOKEN ou um
   slug recebido? Verifique se um tenant consegue gravar/sobrescrever na pasta de outro.
e) Confirme que o pool do pg conecta com papel que ignora RLS (provavel). Se sim, deixe
   explicito no relatorio que o filtro de backend e a UNICA barreira real entre tenants.

[3] REPORTE E PARE
Liste cada IDOR/escopo faltando com severidade (Critico/Alto/Medio). Proponha o teste pratico
pra cada um (ex.: autenticar como tenant A e tentar ler recurso de B por id). Proponha as
correcoes (sempre derivar tenant do token; rejeitar identificador do request) mas NAO
implemente ainda. Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 3. RLS no Supabase (defesa em profundidade) + bucket de Storage

```
[1] LEITURA
Leia e me reporte:
- supabase/migrations/ (todos os arquivos — procure por "enable row level security",
  "create policy", "alter table ... enable rls")
- scripts/setup-storage.js (config do bucket cardapio)
- onde o SUPABASE_ANON_KEY e usado (front? backend? em algum lugar?)

[2] AUDITORIA — RLS e Storage
Reporte (tabela / RLS ligado? / tem policy? / risco):

a) Para cada tabela (empresas, pedidos, wa_auth, plataforma_config e o que mais existir):
   RLS esta HABILITADO? Tem policy explicita? Tabela com RLS ligado e SEM policy bloqueia
   tudo via anon; tabela SEM RLS e exposta via anon vaza tudo. Liste o estado de cada uma.
b) O SUPABASE_ANON_KEY chega a ser exposto ao navegador? Se sim, qualquer um com a anon key
   consegue consultar tabelas sem RLS direto na API do Supabase. Teste/descreva o risco.
c) wa_auth contem a sessao do WhatsApp (sequestravel). Confirme que so o backend
   (service_role / conexao privilegiada) acessa, e que RLS bloqueia anon/authenticated.
d) Bucket cardapio e PUBLICO. Confirme que SO imagens de cardapio vao pra la — nada de PII,
   export de dados, json de config. Confirme limite de tipo/tamanho no upload.
e) Avalie se vale tornar o bucket privado com URL assinada (menor exposicao), pesando contra
   a simplicidade atual de URL publica. So recomende, nao mude.

[3] REPORTE E PARE
Liste tabelas sem RLS/policy como achado. Proponha as policies (escopo por user_id/empresa_id)
como migration nova em supabase/migrations/, mas NAO aplique (npx supabase db push) sem meu OK.
Lembre que RLS aqui e defesa-em-profundidade — nao substitui o filtro de backend do prompt 2.
Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 4. Validação de entrada, injeção e XSS no painel

```
[1] LEITURA
Leia e me reporte:
- src/servidor.js (handlers que recebem body: cadastro, config, cardapio, pedido, imagem,
  troca de senha/email)
- src/pedidos.js, src/store.js, src/empresas.js (como montam as queries SQL)
- public/app.js e public/app-admin.js (como renderizam dados que vieram do usuario:
  nome do restaurante, nome de item, observacao, endereco — innerHTML x textContent)

[2] AUDITORIA — Injecao e XSS
Reporte (local / problema / acao):

a) SQL: confirme que TODA query usa parametros do pg ($1, $2...) e que NAO ha concatenacao
   de string com input do usuario (ex.: `WHERE slug = '` + slug + `'`). Aponte qualquer
   template string montando SQL.
b) Validacao de payload: cadastro/config/cardapio aceitam jsonb livre. Existe validacao de
   tipo/tamanho/campos esperados antes de gravar? Um config/cardapio gigante ou malformado
   pode inflar o banco ou quebrar o bot/painel. Proponha schema de validacao (sem
   necessariamente adicionar lib — pode ser validacao manual enxuta, mantendo o padrao do
   projeto de evitar dependencia nova).
c) XSS no painel: o painel renderiza nome de item, observacao do cliente, nome do
   restaurante etc. Procure innerHTML/insertAdjacentHTML com dado do usuario sem escape.
   Como o conteudo vem de clientes via WhatsApp (observacao do pedido), e vetor real de XSS
   armazenado no painel do dono. Liste cada ponto e proponha textContent/escape.
d) Upload: POST /api/imagem valida MIME real (nao so extensao), tamanho maximo e nome de
   arquivo (sem path traversal)? Reporte.

[3] REPORTE E PARE
Liste por severidade. Proponha as correcoes mantendo o front sem framework e evitando deps
novas onde der. NAO implemente ainda. Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 5. Rate limiting e brute force

```
[1] LEITURA
Leia e me reporte:
- src/servidor.js (rotas POST /api/login, POST /api/cadastro, POST /api/admin/login,
  PATCH /api/conta/senha, PATCH /api/conta/email, DELETE /api/conta, e qualquer rota de
  setup-intent/assinatura)
- como o app trata IP do cliente (trust proxy?) — relevante atras do Fly.io
- package.json (ja existe express-rate-limit ou similar?)

[2] AUDITORIA — Brute force e abuso
Reporte (rota / protegida? / risco / acao):

a) Login de restaurante e login MASTER: hoje aceitam tentativas ilimitadas? Sem rate limit,
   a senha do super-admin (SHA-256, conta unica) e alvo de brute force. Proponha limite por
   IP + e-mail (ex.: 5-10 tentativas / janela curta) com express-rate-limit.
b) Cadastro publico: protegido contra criacao em massa de tenants? Proponha limite.
c) Enumeracao de conta: o fluxo de cadastro com auto-reparo de conta orfa e o login que tenta
   restaurante-depois-master podem revelar se um e-mail existe (mensagens/timing diferentes).
   Verifique se as respostas de erro sao genericas e o timing e estavel. Reporte.
d) Setup-intent / assinatura: protegidos contra spam que cria Customers no Stripe a toa?
e) Confirme trust proxy correto no Express (Fly.io) pra o rate limit por IP nao agrupar todo
   mundo no IP do proxy.

[3] REPORTE E PARE
Proponha onde aplicar rate limit e os limites, com mensagens de erro genericas (sem revelar
existencia de conta). NAO implemente ainda. Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 6. Cabeçalhos de segurança, CORS e trust proxy

```
[1] LEITURA
Leia e me reporte:
- src/servidor.js (setup do Express: middlewares, cors, headers, ordem; onde serve /public)
- public/*.html (quais origens externas carregam: js.stripe.com, viacep.com.br, Google Fonts,
  Supabase Storage)
- fly.toml (force_https, headers)

[2] AUDITORIA — Headers e CORS
Reporte (item / estado / acao):

a) helmet (ou headers equivalentes) esta ativo? Avalie: HSTS (ja ha HTTPS no Fly),
   X-Content-Type-Options, X-Frame-Options/frame-ancestors (o painel usa iframe pra Termos
   ?embed e pro Payment Element do Stripe — a CSP/frame precisa permitir Stripe sem abrir
   geral), Referrer-Policy.
b) CSP: proponha uma Content-Security-Policy que permita SO as origens necessarias
   (js.stripe.com, fonts, supabase storage, viacep) e bloqueie o resto. Cuidado pra nao
   quebrar o Payment Element nem o iframe de Termos. Liste as diretivas.
c) CORS: a API e same-origin (front servido pelo proprio Express)? Se sim, CORS deve ser
   restrito/ausente, nao "*". Confirme.
d) Confirme force_https no fly.toml e que nao ha endpoint HTTP exposto.

[3] REPORTE E PARE
Proponha a config de helmet/CSP/CORS especifica deste app (nao generica), testando
mentalmente contra Stripe Elements e o iframe de Termos. NAO implemente ainda. Reporte
adaptacoes fora do spec. Aguarde meu OK.
```

---

## 7. Webhook do Stripe e integridade de acesso

```
[1] LEITURA
Leia e me reporte:
- src/stripe.js (todas as rotas: setup-intent, confirmar, webhook, portal, cartoes, faturas)
- src/servidor.js (ordem de registro do webhook vs express.json global; middlewares aplicados)
- src/empresas.js (acessoLiberado, exigeAssinatura, aplicarSubscription)

[2] AUDITORIA — Stripe e liberacao de acesso
Reporte (item / estado / risco):

a) Webhook usa raw body + verificacao de assinatura (stripe.webhooks.constructEvent) ANTES de
   qualquer parse JSON, com STRIPE_WEBHOOK_SECRET? Confirme. Sem isso, qualquer um POSTa um
   evento falso e libera acesso/assinatura.
b) Idempotencia: eventos repetidos (Stripe reentrega) nao causam efeito duplicado? Confirme
   nas rotas confirmar/aplicarSubscription.
c) Confirme que o estado de acesso (acessoLiberado/bot ligado) vem SEMPRE da fonte de verdade
   (estado da subscription no banco/Stripe), nunca de um campo enviado pelo client.
d) Confirme que nenhum dado de cartao (numero, CVV, validade) e gravado no banco — so devem
   existir stripe_customer_id, stripe_subscription_id e no maximo bandeira/ultimos4 vindos do
   Stripe. Faca grep por colunas/variaveis suspeitas (card, cvv, numero_cartao).
e) Confirme que STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET so existem no backend (nunca no front).

[3] REPORTE E PARE
Liste qualquer brecha por severidade. NAO altere ainda. Reporte adaptacoes fora do spec.
Aguarde meu OK.
```

---

## 8. Hardening do super-admin

```
[1] LEITURA
Leia e me reporte:
- src/servidor.js (exigeSuperAdmin, credenciaisMaster, login master, tokensAdmin)
- src/plataforma.js (master_email/master_senha_hash, hashSenha sha256+salt)
- scripts/gerar-hash.js
- public/app-admin.js e public/login.html (como o destino master e decidido)

[2] AUDITORIA — Super-admin
Reporte (item / estado / acao):

a) Hash da senha master: hoje e SHA-256+salt. Por ser conta unica e isolada e aceitavel, mas
   avalie migrar pra bcrypt/argon2 (resistente a brute force offline caso o hash vaze). So
   recomende com pros/contras — nao mude.
b) Confirme comparacao com crypto.timingSafeEqual (anti timing attack) no login master.
c) Login master tem rate limit? (cruza com o prompt 5) — confirme.
d) Confirme que a area master nao e descoberta por link/redirect visivel e que um token de
   restaurante NUNCA acessa /api/admin/* (e vice-versa). Teste mental: token de restaurante
   chamando rota master deve dar 401/403.
e) Token master e opaco, em memoria, em sessionStorage (cai ao fechar a aba) — confirme que
   continua assim e que nao ha persistencia indevida.

[3] REPORTE E PARE
NAO altere ainda. Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 9. Logs e vazamento de dados sensíveis

```
[1] LEITURA
Leia e me reporte:
- toda chamada a console.log / pino / logger no projeto (src/* e index.js)
- como erros sao devolvidos ao cliente nas rotas (src/servidor.js): vaza stack/mensagem
  interna/detalhe de SQL?

[2] AUDITORIA — Logs e erros
Reporte (local / o que vaza / acao):

a) Aponte qualquer log que imprima: telefone, endereco, nome do cliente, conteudo de mensagem
   do WhatsApp, JWT/token, conteudo de wa_auth (creds/chaves da sessao), DATABASE_URL,
   chaves do Stripe/Supabase. Esses NUNCA devem ir pro log (em prod o log do Fly e acessivel).
b) Confirme que respostas de erro ao cliente sao genericas (sem stack trace, sem mensagem de
   driver SQL, sem revelar existencia de conta). Aponte rotas que vazam detalhe interno.
c) Confirme que o nivel de log do pino em producao nao e debug/trace com payload completo.

[3] REPORTE E PARE
Liste os pontos. Proponha redacao/remocao dos logs sensiveis e respostas de erro genericas.
NAO implemente ainda. Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 10. Dependências / supply chain

```
[1] LEITURA
Leia e me reporte:
- package.json e package-lock.json (existe lockfile commitado?)
- versoes de: @whiskeysockets/baileys, @supabase/supabase-js, stripe, express, pg, jose

[2] AUDITORIA — Dependencias
Reporte (item / estado / acao):

a) Rode "npm audit" e me traga o resumo (criticas/altas primeiro), com o pacote, a via
   (direta ou transitiva) e se ha fix sem breaking change.
b) Confirme que package-lock.json esta commitado (build reproduzivel).
c) Recomende habilitar o Dependabot no GitHub (Settings > Code security) pra alerta automatico
   de dependencia vulneravel — me diga o passo exato.
d) Baileys e biblioteca NAO-OFICIAL (risco de bloqueio do numero / quebra quando o WhatsApp
   muda). Isso ja esta no ROADMAP (Cloud API). So registre como risco conhecido, nao acione.

[3] REPORTE E PARE
Liste vulnerabilidades por severidade. NAO rode "npm audit fix" ainda (pode quebrar). Proponha
o plano de update. Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## 11. LGPD técnico (varredura de PII)

> Você já tem bastante (exportar/excluir conta, retenção, anonimização, Termos/Privacidade).
> Aqui é fechar buracos de PII que escapam desses fluxos.

```
[1] LEITURA
Leia e me reporte:
- src/pedidos.js (anonimizarAntigos: o que ele zera e o que mantem)
- index.js (jobs agendados: anonimizacao e higiene de sessao)
- src/wa-auth.js (wa_auth guarda algum dado pessoal alem da credencial da sessao?)
- as rotas de exportar/excluir conta em src/servidor.js / src/empresas.js

[2] AUDITORIA — PII e LGPD tecnico
Reporte (fonte de PII / coberta por anonimizacao/exclusao? / acao):

a) Mapeie TODOS os lugares onde existe PII do cliente final: tabela pedidos (cliente,
   telefone, endereco, chat_id), sessoes em memoria (sessoes.js), wa_auth, logs (cruza com
   prompt 9). A anonimizacao de pedidos cobre todos os campos de PII? Sobra telefone/endereco
   em algum jsonb ou coluna que ela nao toca?
b) Exclusao de conta (DELETE /api/conta) e do super-admin: realmente apagam empresa + pedidos
   (cascata) + wa_auth + usuario do Auth + imagens? Confirme que nao sobra PII orfa em lugar
   nenhum (Storage, jsonb, logs).
c) Backup do Supabase (point-in-time recovery) retem PII pelo periodo de retencao — registre
   isso na politica (titular que pediu exclusao ainda existe no backup ate expirar). So
   documente, nao mude infra.
d) Os textos de Termos/Privacidade ja estao marcados como "merecem revisao juridica" nos docs
   — reforce isso no relatorio (limite de responsabilidade, prazo de retencao, DPO).

[3] REPORTE E PARE
Liste PII descoberta e o que escapa dos fluxos atuais. Proponha correcoes (ampliar
anonimizacao, limpar orfaos) e o trecho de doc pra ROADMAP/PROGRESSO. NAO implemente ainda.
Reporte adaptacoes fora do spec. Aguarde meu OK.
```

---

## Depois da auditoria

Quando o Claude Code reportar os achados de cada prompt, priorize a implementação assim:
**Crítico** (vaza dado de cliente / sequestro de sessão / acesso indevido) primeiro,
depois **Alto**, e registre o que for deferido em `ROADMAP.md`/`PROGRESSO.md` com a
justificativa — no seu padrão de "deferimento pragmático documentado". Cada correção vira
um commit próprio, em PT, sem acento no título.

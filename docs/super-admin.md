# Super-admin (conta master)

Área de gestão de **todos** os tenants, separada do painel de restaurante.

- **Conta master fixa**, via variáveis de ambiente (nunca hardcoded/commitada):
  `SUPERADMIN_EMAIL` e `SUPERADMIN_SENHA_HASH`. O hash usa a **mesma** `hashSenha`
  (`sha256(senha + SALT)`) do `empresas.js` — gere com `npm run gerar-hash-admin -- "senha"`
  (script `scripts/gerar-hash.js` importa a função real, então o salt nunca diverge).
  Sem as duas envs, as rotas `/api/admin/*` ficam desativadas (login responde **503**;
  nunca há credencial default). Carregamento de `.env` via `dotenv` (ver `.env.example`).
  Em produção (Fly.io): `fly secrets set SUPERADMIN_EMAIL=... SUPERADMIN_SENHA_HASH=...`.
- **Isolamento total de auth:** o super-admin usa um Map `tokensAdmin` próprio (token opaco
  em memória, SHA-256+salt) — **separado e diferente** do JWT do Supabase usado pelo
  restaurante. `exigeSuperAdmin` valida só o token master; `exigeAuth` só o JWT de restaurante.
  Um token nunca cruza para o outro lado. Login master: `POST /api/admin/login { email, senha }`
  → `{ token }`. Comparação de hash com `crypto.timingSafeEqual`. (O super-admin **não** migrou
  para o Supabase Auth — segue env-based, por ser conta única e isolada.)
- **Rotas** (todas sob `exigeSuperAdmin`):
  `GET /api/admin/tenants` (lista) · `POST /api/admin/tenants` (cria, reusa `empresas.cadastrar`) ·
  `PATCH /api/admin/tenants/:slug/suspender` · `PATCH .../reativar` ·
  `DELETE /api/admin/tenants/:slug` (destrutivo) · `GET /api/admin/metrics` (métricas).
- **Métricas (`GET /api/admin/metrics`):** retorna `{ totais: { restaurantes, ativos,
  suspensos, conectados, pedidosMes }, porTenant: { <slug>: { pedidosMes, conectado } } }`.
  Contagem de pedidos do mês é **real e on-demand**: `pedidos.contarNoMes(tenantDir, inicioISO)`
  faz `COUNT(*) WHERE empresa_id = ? AND criado_em >= ?` no Postgres. "Conectados" vem de
  `multiBot.getEstado(slug).status`. O
  **corte do mês usa o fuso BR** (America/Sao_Paulo, UTC-3, sem DST) convertido para UTC ISO —
  `inicioDoMesBR()` em `servidor.js` — para o número bater com a intuição do admin brasileiro
  sem misturar fusos. Se o nº de tenants crescer para centenas, cachear (TTL curto).
- **Suspensão (efeito real):** `setAtivo(slug,0)` → login do restaurante já é recusado
  (`autenticar` filtra `ativo`) + `exigeAuth` checa `ativo` a cada request (a sessão aberta
  cai no próximo request, mesmo com JWT válido) + `multiBot.desconectar(slug)` (bot para).
  **Reflete no Stripe:** se houver `stripeSubscriptionId`, **pausa a cobrança**
  (`stripe.pausarAssinatura` → `pause_collection: void`, reversível) para não cobrar enquanto
  suspenso; **Reativar** retoma (`retomarAssinatura`). Se o Stripe falhar, a suspensão/reativação
  (bloqueio de acesso) acontece mesmo assim e a rota devolve `avisoStripe` → o painel master
  alerta o admin (toast) a verificar/contatar o suporte.
- **Exclusão (destrutiva, ordem importa):** **cancela a assinatura no Stripe ANTES** (se houver
  `stripeSubscriptionId`) — senão a assinatura ficaria órfã cobrando o cartão; **se o cancelamento
  falhar, ABORTA a exclusão (502)** e orienta a contatar o suporte. Depois `multiBot.desconectar`
  (libera sessão Baileys) → `empresas.excluir(slug)`, que apaga a linha em `empresas` (**cascateia**
  os `pedidos`), remove o **usuário do Supabase Auth** (`auth.admin.deleteUser`) e apaga
  `data/tenants/{slug}/` (sessões/imagens). **Trava de segurança:** o corpo deve trazer
  `{ confirmacao: "<slug>" }` igual ao slug da URL, senão responde 400 sem apagar nada. O mesmo
  cancelamento-antes-de-apagar vale para o **autoatendimento** (`DELETE /api/conta`), que exige
  senha + `"EXCLUIR"`; `cancelarAssinatura`/`pausarAssinatura`/`retomarAssinatura` são **idempotentes**
  (toleram assinatura já cancelada/inexistente).
- **Tela (`public/admin-master.html` + `public/app-admin.js`):** página **separada** do
  painel de restaurante (não usar `admin.html`/`app.js`). Login master + dashboard de tenants
  na mesma página (gate por token). Token guardado em `sessionStorage["tokenAdmin"]` — chave
  **própria** (≠ `"token"` do restaurante) e **`sessionStorage` por escolha de segurança**: a
  sessão master expira ao fechar a aba, exigindo novo login a cada sessão do navegador.
  **Acesso pelo login único:** o formulário de `login.html` tenta primeiro o login de restaurante
  (`/api/login`); se falhar, tenta o master (`/api/admin/login`) com as mesmas credenciais e,
  dando certo, grava `tokenAdmin` e redireciona para `/admin-master.html`. Não há **link visível**
  para a área master (o redirecionamento só ocorre com a senha master correta — sem vazar que a
  área existe). Os dois fluxos de auth seguem **isolados** (endpoints/tokens/middlewares
  separados); só a tela de login decide o destino. CSS reusa a identidade Nymbus (classes `.am-*`
  em `style.css`); exclusão usa confirmação forte (digitar o slug habilita o botão).
- **Menu (3 abas):** **Dashboard · Clientes · Configurações Master** (reusa o shell do painel do
  cliente — sidebar/indicador/entrada em cascata se aplicam). **Dashboard:** header + **Exportar**
  (CSV dos clientes, client-side), **4 cards hero** (Clientes ativos/Em teste/Assinantes/Cancelados
  de `totais`), faixa secundária (Cortesia/Em atraso/Pedidos no mês/Conectados) e **"Últimos
  Clientes Cadastrados"** (top 5 por `criadoEm`, avatar de iniciais, badge de status, olho →
  Gerenciar). Sem setas de tendência (não há histórico → seria decorativo) e **avatar neutro**
  (sem foto). **Clientes:** a tabela completa de tenants com filtro + Gerenciar (o que já existia).
- **Configurações Master ("aba Nymbus"):** edita os dados globais da plataforma na tabela
  **singleton `plataforma_config`** (módulo `src/plataforma.js`: `obter`/`salvar` empresa +
  `obterMaster`/`salvarMaster` credenciais). Campos: **dados da empresa** (Razão Social, Nome
  Fantasia, CNPJ opcional, Endereço, Telefone) + **contato/redes** (WhatsApp de suporte, Facebook,
  Instagram) + **dados de acesso do master** (e-mail/senha). Rotas: `GET/PUT /api/admin/plataforma`
  (dados empresa) · `PATCH /api/admin/conta` (troca e-mail/senha do master, **exige senha atual**) ·
  `GET /api/plataforma` (cliente — suporte WhatsApp, DB→env) · **público** `GET /api/plataforma/publico`
  (footer da landing, sem auth, nada sensível). `telefone`/`suporteWhatsapp` guardam só dígitos.
- **Credenciais do master migraram pro banco (editáveis):** o login master agora lê
  `master_email`/`master_senha_hash` de `plataforma_config` (`credenciaisMaster()` em `servidor.js`),
  caindo na env `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA_HASH` só como **bootstrap** (a env ainda é o
  gate que habilita `/api/admin/*`). Senha em hash (mesma `hashSenha` sha256+salt); troca exige a
  senha atual. `exigeSuperAdmin` (token opaco) inalterado.
- **Footer da landing** (`index.html`) consome `GET /api/plataforma/publico` e exibe Nome Fantasia,
  Razão Social, CNPJ, Endereço, Telefone e ícones Facebook/Instagram **quando preenchidos** (vazio =
  footer padrão, sem placeholder falso).

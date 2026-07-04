# Pontos de atenção (gotchas)

- **Mensagens em tempo real (anti-massa)**: ao conectar, o Baileys entrega o histórico/sync.
  O bot SÓ processa mensagens com `type === 'notify'` (recebidas ao vivo), ignorando
  `'append'` (histórico). NÃO remover esse filtro em `multi-bot.js` — é o que evita responder
  a conversas antigas em massa (equivale ao antigo filtro de timestamp do whatsapp-web.js).
- **Conexão manual**: `index.js` não chama `multiBot.iniciar()`. A conexão é disparada
  pelo painel (`POST /api/bot/conectar`). Reconexão controlada via `connection.update`:
  `restartRequired` (normal pós-QR) reconecta; `loggedOut` (401) para e marca desligado;
  teto de tentativas para não martelar o WhatsApp. No `connection: open`, o número conectado
  (`sock.user.id` → `jidDecode`) é guardado e exposto por `getEstado` como `numero`; o painel
  o exibe no estado "conectado" da aba Conexão.
- **Memória por tenant**: sem Chromium — cada tenant é só uma conexão WebSocket (Baileys),
  consumo de RAM baixíssimo. A máquina de 1 GB no Fly.io suporta muito mais tenants do que
  os ~3–4 da era Chromium/Puppeteer.
- **Sessão WhatsApp**: persistida na tabela `wa_auth` (Postgres), por slug — adapter
  `usePostgresAuthState` em `src/wa-auth.js` (substitui o `useMultiFileAuthState`). Reset =
  `multiBot.resetarSessao` → apaga as linhas do tenant (novo QR). Creds/chaves serializadas
  com `BufferJSON`. NÃO há mais pasta `baileys-*/` em disco.
  - **Escala/volume:** uma conexão gera ~50 linhas minúsculas (≈20 KB): `pre-key` (~30,
    **bounded** — repostas conforme consumidas), `app-state-sync-key`, `creds`, e 1 `session:`
    por cliente atendido. PK `(slug, chave)` + **UPSERT** (`ON CONFLICT DO UPDATE`): **reconectar
    NÃO duplica** — o nº de linhas depende do conteúdo da sessão, não de quantas vezes conecta.
    O único crescimento é ~1 `session:` por cliente novo (≈1 KB cada); trivial pro Postgres.
    **Higiene automática:** `limparSessoesAntigas` (em `wa-auth.js`, agendada no `index.js` —
    1x no boot + a cada 24h) apaga `session:*` inativas há +90 dias (coluna `atualizado_em`);
    seguro, pois o Baileys recria a sessão no próximo contato. NÃO toca creds/pre-keys.
  - **Sensível:** essas linhas SÃO a sessão do WhatsApp (quem lê pode sequestrar a conexão).
    Protegidas por RLS + conexão privilegiada do backend; `SERVICE_ROLE_KEY` nunca no front/git.
- **Imagens do cardápio**: no Supabase Storage (bucket público `cardapio`, pasta `{slug}/`).
  O upload (`POST /api/imagem`) sobe pro Storage e o item guarda a URL pública; não há mais
  rota `/imagens` nem arquivos em disco. Bucket criado por `npm run setup-storage`.
- **Avisar cliente**: `POST /api/pedido/avisar` envia, pelo socket do tenant
  (`enviarMensagem(slug, jid, texto)`), uma mensagem de "pedido pronto". Templates editáveis
  em `config.json` → `mensagens.pedidoPronto.entrega`/`.retirada` (variáveis `{cliente}` e
  `{numero}`). Envio **MANUAL**, 1 cliente por clique — nunca automático/massa. Exige WhatsApp
  conectado; normaliza o telefone para `<digitos>@s.whatsapp.net`; grava `avisadoEm` no sucesso.
- **Segurança**: login de restaurante via **Supabase Auth** (senha em bcrypt; sessão é JWT
  stateless, sobrevive a reinício do app). Super-admin usa **bcrypt** (`bcryptjs`) env-based,
  com migração graciosa do SHA-256+salt legado (conta única e isolada); token master via
  `crypto.randomBytes` com TTL de 12h. HTTPS é responsabilidade do host (no Fly era automático; em VPS depende
  de Nginx + TLS).
- **Primeiro acesso**: a primeira empresa é criada pelo wizard público (`/cadastro.html`) ou
  pelo super-admin (`/admin-master`). Tenant novo nasce limpo (ver `empresas.configInicial`,
  gravado no `config` jsonb).
- **Cache do store (1 instância)**: `store.js` mantém config/cardápio em memória por tenant;
  `setConfig/setCardapio` gravam no Postgres e atualizam o cache. Como é processo único, fica
  coerente; várias instâncias exigiriam invalidação/pub-sub.
- **Pooler do Supabase**: para app sempre-ligado, prefira o **Session pooler (5432)** ao
  Transaction pooler (6543) — `db.js` avisa no boot se detectar 6543.
- **Backup**: **gerenciado 100% pelo Supabase** (point-in-time recovery). Com o app stateless,
  TUDO mora no Supabase — dados em Postgres (`empresas`/`pedidos`/`config`/`cardapio`), sessões
  do WhatsApp em `wa_auth` e imagens no Storage. Não há mais backup do lado do app: o antigo
  `npm run backup`/`scripts/backup.js` (empacotava a `data/` em `.tar.gz`) foi **removido na
  v0.18.0** por ficar obsoleto — não havia mais nada em disco para empacotar.
- **Monitoramento (2 camadas, complementares)**: (1) **Externo** — monitor de uptime
  (UptimeRobot, grátis) batendo em `GET /health` (rota leve em `servidor.js`, devolve
  `{ok:true,uptime}` — só **vivacidade**, NÃO testa o Supabase), a cada 5 min, com alerta por
  e-mail/push. É a **única** forma de saber que o app **caiu** (o painel é servido pelo próprio
  app → não abre se ele está offline). Monitorar o domínio do cliente (`pedidos.…/health`) pega
  app+DNS+cert; o `fly.dev/health` isola o app. (2) **Interno** — aba **Monitoramento** no
  `/admin-master` (banco/latência, app, bots, fila) + **histórico de incidentes** (`incidentes.js`);
  só visível **com o app no ar**. Resumo: o externo avisa "app/host caiu"; o interno mostra
  "banco lento/fora" quando está tudo de pé.

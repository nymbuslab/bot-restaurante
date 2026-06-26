# Agente de impressão — Plano A: Backend (app principal)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao app principal o suporte que o agente desktop consome: coluna `pedidos.impresso_em`, rotas `/api/agente/*` (login com refresh no corpo, renovar, listar pendentes, marcar impresso) e a página de download no painel.

**Architecture:** Reaproveita o que já existe — `empresas.autenticar`/`renovarSessao` (Supabase Auth com refresh token), o middleware `exigeAuth` (JWT local) e o padrão de `pedidos.avisarPedido` (UPDATE por tenant). O agente é um cliente HTTP do tenant: loga e recebe o refresh **no corpo** (diferente do painel, que usa cookie httpOnly), faz polling de `/api/agente/pendentes` (pedidos do cardápio web ainda não impressos) e marca cada um via `/api/agente/pedidos/:numero/impresso`.

**Tech Stack:** Node.js CommonJS, Express, Postgres (Supabase, migrations versionadas), `node:test` para lógica pura, `npm run check` (varredura de sintaxe).

## Global Constraints

- pt-BR em comentários/mensagens; sem emojis.
- Reusar `exigeAuth` em toda rota autenticada (valida JWT local + checa `ativo`); resolve `req.slug`/`req.tenantDir`.
- Rotas de auth do agente entram no `loginLimiter`/`refreshLimiter` existentes (rate limit).
- O refresh token do agente viaja **no corpo JSON** (o app Electron guarda no cofre do SO), **não** em cookie.
- Escopo do polling: **só pedidos do cardápio web** — ou seja, ainda **não recebidos** (`recebido_em IS NULL`); pedidos de PDV/balcão já nascem recebidos e **não** entram.
- Migration no padrão `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; nome `YYYYMMDDHHMMSS_descricao.sql` (a última é `20260625120000`).
- Testes do projeto cobrem **lógica pura** (sem DB); rotas/queries são validadas por `npm run check` + smoke (curl) contra o servidor local.

---

### Task 1: Coluna `impresso_em` + funções em `pedidos.js`

**Files:**
- Create: `supabase/migrations/20260626120000_pedido_impresso.sql`
- Modify: `src/pedidos.js` (`mapRow` ~26-44, exports ~187; novas funções `pendentes`/`marcarImpresso`)

**Interfaces:**
- Produces:
  - `pedidos.pendentes(dir)` → `Promise<Array<pedido>>` — pedidos do tenant com `impresso_em IS NULL` e `recebido_em IS NULL` (cardápio web não impresso), ordenados por `numero`, mapeados por `mapRow` (inclui `impressoEm`).
  - `pedidos.marcarImpresso(dir, numero)` → `Promise<boolean>` — marca `impresso_em = now()` se ainda nulo; retorna `true` se marcou, `false` se já estava impresso/não existe (idempotente).
  - `mapRow` passa a expor `impressoEm`.

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260626120000_pedido_impresso.sql`:

```sql
-- Marca quando o AGENTE DE IMPRESSÃO desktop já imprimiu o pedido. Nulo = ainda
-- não impresso pelo agente. Usado pelo polling (/api/agente/pendentes) para não
-- reimprimir e para ser idempotente entre reinícios/instâncias do agente.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS impresso_em timestamptz;
```

- [ ] **Step 2: Aplicar a migration**

Run: `npx supabase db push`
Expected: aplica `20260626120000_pedido_impresso` sem erro (coluna criada).

- [ ] **Step 3: Expor `impressoEm` no `mapRow`**

Em `src/pedidos.js`, no objeto retornado por `mapRow` (logo após a linha `recebidoEm: ...`), adicione:

```javascript
    impressoEm: r.impresso_em ? new Date(r.impresso_em).toISOString() : null,
```

- [ ] **Step 4: Implementar `pendentes` e `marcarImpresso`**

Em `src/pedidos.js`, após a função `avisarPedido` (~117-122), adicione:

```javascript
// Pedidos do cardápio web ainda não impressos pelo agente desktop: não impressos
// (impresso_em nulo) E ainda não recebidos (recebido_em nulo → exclui PDV/balcão,
// que nasce recebido). Ordena por numero (imprime na ordem que caíram).
async function pendentes(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT * FROM pedidos
      WHERE empresa_id = $1 AND impresso_em IS NULL AND recebido_em IS NULL
      ORDER BY numero ASC
      LIMIT 50`,
    [empId]
  );
  return r.rows.map(mapRow);
}

// Marca o pedido como impresso (idempotente): só atualiza se ainda estava nulo.
// Retorna true se marcou agora, false se já estava impresso/não existe.
async function marcarImpresso(dir, numero) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `UPDATE pedidos SET impresso_em = now()
      WHERE empresa_id = $1 AND numero = $2 AND impresso_em IS NULL
      RETURNING numero`,
    [empId, parseInt(numero, 10) || 0]
  );
  return r.rowCount > 0;
}
```

- [ ] **Step 5: Exportar as novas funções**

Em `src/pedidos.js`, no `module.exports` (~187), adicione `pendentes` e `marcarImpresso`:

```javascript
module.exports = { salvarPedido, lerTodos, ultimo, lerPorId, avisarPedido, pendentes, marcarImpresso, contarNoMes, anonimizarAntigos, fecharConexao, esquecer, contarVendasDoItem };
```

- [ ] **Step 6: Verificar e confirmar o escopo**

Run: `npm run check`
Expected: sem erros de sintaxe.

Confirme que pedidos de PDV nascem com `recebido_em` preenchido (para o filtro de `pendentes` excluí-los):
Run: `grep -nE "recebido_em|recebidoEm|venderLocal" src/caixa.js | head`
Expected: o INSERT/UPDATE do PDV define `recebido_em`. Se NÃO definir, ajuste o `WHERE` de `pendentes` para usar `status = 'novo'` em vez de `recebido_em IS NULL` (cardápio web nasce `status='novo'`).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260626120000_pedido_impresso.sql src/pedidos.js
git commit -m "feat(impressora): coluna impresso_em + pedidos.pendentes/marcarImpresso"
```

---

### Task 2: Rotas de autenticação do agente

**Files:**
- Modify: `src/servidor.js` (perto das rotas `/api/login` ~253 e `/api/refresh` ~270)

**Interfaces:**
- Consumes: `empresas.autenticar(email, senha)` → `{ token, slug, nome, refreshToken, ... }`; `empresas.renovarSessao(refreshToken)` → `{ token, slug, nome, refreshToken, ... }` (já existentes).
- Produces:
  - `POST /api/agente/login` `{ email, senha }` → `{ token, refresh, slug, nome }` (200) ou 401.
  - `POST /api/agente/refresh` `{ refresh }` → `{ token, refresh, slug, nome }` (200) ou 401.

- [ ] **Step 1: Implementar `/api/agente/login` e `/api/agente/refresh`**

Em `src/servidor.js`, logo após a rota `/api/refresh` (após a linha ~282 que fecha o handler), adicione:

```javascript
// ---- Agente de impressão desktop ----
// Diferente do painel (que guarda o refresh em cookie httpOnly), o agente é um app
// Electron e guarda o refresh no cofre do SO → devolvemos o refresh NO CORPO.
app.post("/api/agente/login", loginLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    const r = await empresas.autenticar(email, senha);
    if (!r) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    res.json({ token: r.token, refresh: r.refreshToken, slug: r.slug, nome: r.nome });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao entrar. Tente de novo." });
  }
});

app.post("/api/agente/refresh", refreshLimiter, async (req, res) => {
  try {
    const r = await empresas.renovarSessao((req.body || {}).refresh);
    if (!r) return res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
    res.json({ token: r.token, refresh: r.refreshToken, slug: r.slug, nome: r.nome });
  } catch (e) {
    res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
  }
});
```

- [ ] **Step 2: Verificar sintaxe**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 3: Smoke test (servidor local rodando)**

Run: `curl -s -X POST http://localhost:3001/api/agente/login -H "Content-Type: application/json" -d '{"email":"SEU_EMAIL","senha":"SUA_SENHA"}' | head -c 200`
Expected: JSON com `token`, `refresh`, `slug`, `nome`. (Com credenciais erradas → 401 `{erro:...}`.)

- [ ] **Step 4: Commit**

```bash
git add src/servidor.js
git commit -m "feat(impressora): rotas /api/agente/login e /refresh (refresh no corpo)"
```

---

### Task 3: Rotas de pedidos do agente (pendentes + marcar impresso)

**Files:**
- Modify: `src/servidor.js` (após as rotas do agente da Task 2)

**Interfaces:**
- Consumes: `exigeAuth` (resolve `req.tenantDir`/`req.slug`); `pedidos.pendentes(dir)` e `pedidos.marcarImpresso(dir, numero)` (Task 1).
- Produces:
  - `GET /api/agente/pendentes` (auth) → `Array<pedido>` (cardápio web não impresso).
  - `POST /api/agente/pedidos/:numero/impresso` (auth) → `{ ok: true, marcado: boolean }`.

- [ ] **Step 1: Implementar as rotas**

Em `src/servidor.js`, logo após as rotas da Task 2, adicione:

```javascript
// Pedidos novos (cardápio web) que o agente ainda não imprimiu — alvo do polling.
app.get("/api/agente/pendentes", exigeAuth, async (req, res) => {
  try {
    res.json(await pedidos.pendentes(req.tenantDir));
  } catch (e) {
    res.status(500).json({ erro: "Falha ao consultar pendentes." });
  }
});

// O agente confirma que imprimiu (idempotente): não reimprime em reinício/2 agentes.
app.post("/api/agente/pedidos/:numero/impresso", exigeAuth, async (req, res) => {
  try {
    const marcado = await pedidos.marcarImpresso(req.tenantDir, req.params.numero);
    res.json({ ok: true, marcado });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao marcar como impresso." });
  }
});
```

- [ ] **Step 2: Verificar sintaxe**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 3: Smoke test (com um token válido do passo anterior)**

```bash
TOKEN="<token do /api/agente/login>"
curl -s http://localhost:3001/api/agente/pendentes -H "Authorization: Bearer $TOKEN" | head -c 300
# faça um pedido pelo cardápio web, confirme que ele aparece, então:
curl -s -X POST http://localhost:3001/api/agente/pedidos/<NUMERO>/impresso -H "Authorization: Bearer $TOKEN"
# repита o GET: o pedido marcado some da lista; repetir o POST → {ok:true, marcado:false}
```
Expected: o pedido aparece em `pendentes`; após marcar, some; marcar de novo retorna `marcado:false` (idempotente).

- [ ] **Step 4: Commit**

```bash
git add src/servidor.js
git commit -m "feat(impressora): rotas /api/agente/pendentes e marcar-impresso"
```

---

### Task 4: Página de download no painel

**Files:**
- Modify: `public/admin.html` (nova seção/aba "Impressora — app desktop")
- Modify: `public/app.js` (wiring mínimo, se a seção precisar)
- Reference: a impressão web atual (`impressao.js`) **continua** — esta página só adiciona o caminho do app.

**Interfaces:**
- Consumes: nada de tasks anteriores (conteúdo estático + link de download).
- Produces: uma página no painel com o link do instalador e o passo a passo. O `.exe` ainda não existe (vem no Plano B) — o link aponta para o destino final (Storage/seu domínio) e fica como **"em breve"** até o Plano B publicar o build.

- [ ] **Step 1: Adicionar a seção no painel**

Em `public/admin.html`, dentro da área de Configurações → Impressora (onde hoje ficam as opções de impressão), adicione uma subseção (sem handler inline — CSP estrita):

```html
<section class="cfg-secao" id="impressora-app">
  <h3>App de impressão automática (recomendado)</h3>
  <p class="campo-ajuda">
    Instale o <strong>Nymbus Impressora</strong> no computador ligado à impressora.
    Faça login com esta mesma conta, escolha a impressora e os pedidos novos passam a
    imprimir <strong>automaticamente</strong>, sem abrir a tela de impressão do navegador.
  </p>
  <a id="btn-baixar-impressora" class="botao primario" href="#" aria-disabled="true">Baixar (em breve)</a>
  <ol class="impressora-passos">
    <li>Baixe e instale o app no computador do restaurante.</li>
    <li>Abra o Nymbus Impressora e entre com o login do painel.</li>
    <li>Clique em "Detectar impressoras" e escolha a sua (USB, Rede ou Serial/COM).</li>
    <li>Faça um teste de impressão. Pronto: os pedidos novos imprimem sozinhos.</li>
  </ol>
  <p class="campo-ajuda">A impressão pelo navegador continua disponível como alternativa.</p>
</section>
```

(Quando o Plano B publicar o instalador, trocar o `href` pela URL real do `.exe` e remover o `aria-disabled`/"(em breve)".)

- [ ] **Step 2: Verificar sintaxe + render**

Run: `npm run check`
Expected: sem erros.

Validação (manual/Playwright no painel): a seção aparece em Configurações → Impressora com o passo a passo; nenhum handler inline (CSP). Sem ferramenta → "check OK, UI não validada".

- [ ] **Step 3: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(impressora): secao de download do app desktop no painel"
```

---

## Self-Review

**Cobertura da spec (parte backend):**
- Coluna `pedidos.impresso_em` → Task 1 ✓
- `/api/agente/login` + `/api/agente/refresh` (refresh no corpo) → Task 2 ✓
- `/api/agente/pendentes` (cardápio web não impresso) → Task 3 ✓
- `/api/agente/pedidos/:numero/impresso` (idempotente) → Task 3 ✓
- Página de download no painel + coexistência com a impressão web → Task 4 ✓
- Escopo "PDV não entra" → filtro `recebido_em IS NULL` (Task 1, com verificação no Step 6) ✓

**Placeholders:** nenhum "TBD/TODO" — todo passo tem código real. (O link do `.exe` é intencionalmente "em breve" até o Plano B; documentado.)

**Consistência de tipos:** `pendentes(dir)`/`marcarImpresso(dir, numero)` usados igual nas rotas (Task 3) e definidos na Task 1; rotas usam `req.tenantDir`/`exigeAuth` no padrão do projeto; auth devolve `{token, refresh, slug, nome}` consistente entre login/refresh.

**Escopo:** este plano é só o **backend**. O **Plano B (app Electron)** — auth/cofre, polling, transportes USB/Rede/Serial, UI, empacotamento — é separado e consome estas rotas.

**Nota de teste:** o projeto não tem testes de rota/DB (só lógica pura); por isso a validação aqui é `npm run check` + `npx supabase db push` + smoke curl. Nenhum teste falso foi criado só para "passar".

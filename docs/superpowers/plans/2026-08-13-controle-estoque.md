# Controle de estoque (split de Produtos 3/4) — Plano de Implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para tocar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** Entregar a tela de Controle de estoque (Plano Completo) com histórico de
movimentação, e fazer o cancelamento devolver ao estoque nos cinco caminhos onde hoje ele não
devolve.

**Arquitetura:** O saldo continua no jsonb `empresas.cardapio`. Uma tabela nova,
`estoque_movimentos`, registra toda mudança de saldo, sempre gravada na mesma transação que
muda o número, pela mesma função. A regra de cálculo vive em funções puras dual-mode
(`public/estoque.js`), testadas sem banco; o acesso à tabela fica isolado em `src/estoque-db.js`.

**Stack:** Node.js CommonJS, `pg` (Postgres/Supabase), Express, front HTML/CSS/JS puro,
testes com `node:test`. Sem dependência nova.

**Spec:** [docs/superpowers/specs/2026-08-13-controle-estoque-design.md](../specs/2026-08-13-controle-estoque-design.md)

## Global Constraints

- **A migration (Task 1) vai para produção ANTES do código.** O `INSERT` de movimento roda
  dentro da transação de venda: sem a tabela, toda venda quebra.
- Sem dependência nova. CommonJS (`require`), sem `import` estático.
- Comentários, mensagens e UI em **português (Brasil)**.
- Textos ao usuário seguem a skill `copy-nymbus`: **sem travessão como conector**, sem emoji.
- **CSP estrita:** nenhum `<script>` inline, nenhum `onclick=`/`onsubmit=` no HTML. Todo evento
  por `addEventListener` em arquivo `.js`.
- Toda tabela nova leva o bloco de hardening na migration: `enable row level security` +
  `revoke all ... from anon, authenticated` + `comment on table`.
- Quantidade **não é dinheiro**: usar `Estoque.formatarQtd` (inteiro para `un`, decimal com
  vírgula para `kg`), nunca `Dinheiro.mascarar`. Campos de quantidade usam
  `type="text" inputmode="decimal"`.
- Funções puras **não mutam** o cardápio recebido.
- Toda alteração de saldo passa pela trava de linha que já existe
  (`SELECT ... FROM empresas WHERE slug = $1 FOR UPDATE`).
- Gate de plano: `exigeAuth` + `exigePdv` (é o gate de Plano Completo que Mesas já reusa; a
  mensagem "Recurso do Plano Completo" é genérica).
- Validação a cada tarefa: `npm test` e `npm run check` passam.
- Commits pequenos, mensagem em pt-BR no padrão do repo (`tipo(escopo): descrição`).
- **O `.env` local aponta para o banco de produção.** Nenhuma tarefa deste plano roda script de
  dados; a migration é aditiva.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260813120000_estoque_movimentos.sql` (novo) | Tabela, índices e hardening. |
| `public/estoque.js` (existente) | PURO dual-mode. Ganha `calcularBaixa`, `calcularDevolucao`, `diffEstoque`. `aplicarBaixa` vira casca. |
| `src/estoque-db.js` (novo) | Único ponto que fala com `estoque_movimentos`: grava na transação de quem chamou, lista, resume, aplica retenção. |
| `src/store.js` (existente) | `baixarEstoqueTx` grava a venda; ganha `devolverEstoqueTx` e `ajustarEstoqueTx`; `setCardapio` vira transacional com diff. |
| `src/pedidos.js`, `src/mesas-db.js`, `src/caixa.js` (existentes) | Cancelamento devolve ao estoque. |
| `src/servidor.js` (existente) | Quatro rotas novas; `devolver` no corpo das rotas de cancelamento. |
| `public/admin.html`, `public/app.js`, `public/style.css` | Tela, gaveta e a caixinha de devolução. |
| `index.js` | Faxina diária da retenção. |
| `test/estoque.test.js`, `test/store-estoque.test.js`, `test/estoque-db.test.js` (novo) | Cobertura. |

---

### Task 1: Migration da tabela `estoque_movimentos`

**Files:**
- Create: `supabase/migrations/20260813120000_estoque_movimentos.sql`

**Interfaces:**
- Consumes: nada.
- Produces: tabela `estoque_movimentos` com as colunas `id, empresa_id, item_id, variacao_id,
  tipo, quantidade, saldo_depois, descricao, unidade, pedido_id, numero, obs, criado_em`.
  Todas as tarefas seguintes dependem dela.

- [ ] **Passo 1: Escrever a migration**

```sql
-- ============================================================
-- estoque_movimentos — trilha de TODA mudança de saldo de estoque.
--
-- O saldo continua morando no jsonb `empresas.cardapio` (item.estoque e
-- item.variacoes[].estoque). Esta tabela NÃO é fonte de verdade do saldo: é o
-- histórico. Cada linha é gravada DENTRO da mesma transação que altera o jsonb,
-- pela mesma função (store.baixarEstoqueTx / devolverEstoqueTx / ajustarEstoqueTx),
-- então não tem como divergir do número.
--
-- Por que não derivar a venda de `itens_venda`: ao cancelar UM item do pedido, o
-- `pedidos.itens` muda, o trigger reprojeta e a linha de venda DESAPARECE de lá.
-- Com a devolução entrando como movimento, o mesmo estoque seria contado duas
-- vezes. Não é escrita dupla do mesmo fato: itens_venda conta FATURAMENTO (inclui
-- item sem controle de estoque); esta conta PRATELEIRA.
--
-- Como o saldo não é a soma das linhas, a retenção (12 meses) pode apagar
-- movimento antigo sem estragar o número.
--
-- item_id é TEXT e sem FK: o id do item vive no jsonb e não tem tipo garantido
-- (a base tem numérico e string). Mesmo motivo de itens_venda.item_id ser solto.
-- ============================================================

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id           bigserial PRIMARY KEY,
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  item_id      text NOT NULL,              -- referência SOLTA ao cardápio (jsonb)
  variacao_id  text,                       -- preenchido quando o saldo é o da variação
  tipo         text NOT NULL,              -- venda|devolucao|entrada|perda|contagem|ajuste
  quantidade   numeric NOT NULL,           -- assinada: +20 entrada, -3 perda, ±N contagem
  saldo_depois numeric NOT NULL,           -- saldo após aplicar o movimento
  descricao    text NOT NULL DEFAULT '',   -- nome do produto COMO ESTAVA (snapshot)
  unidade      text NOT NULL DEFAULT 'un', -- 'un' | 'kg'
  pedido_id    bigint,                     -- venda/devolução: pedido que originou
  numero       integer,                    -- nº do pedido (conveniência, sem join)
  obs          text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- Extrato de UM saldo (gaveta do produto), mais recente primeiro.
CREATE INDEX IF NOT EXISTS estoque_mov_saldo_idx
  ON estoque_movimentos (empresa_id, item_id, variacao_id, criado_em DESC);
-- Resumo por período e retenção.
CREATE INDEX IF NOT EXISTS estoque_mov_data_idx
  ON estoque_movimentos (empresa_id, criado_em DESC);

-- Hardening (convenção do projeto, modelo em 20260716120000_rls_hardening_2.sql):
-- acesso só pelo backend privilegiado (DATABASE_URL, que ignora RLS). RLS ligado
-- SEM policy = deny-all deliberado para anon/authenticated.
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estoque_movimentos FROM anon, authenticated;
COMMENT ON TABLE public.estoque_movimentos IS
  'Trilha de movimentação de estoque por tenant. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
```

- [ ] **Passo 2: Aplicar**

Rodar: `npx supabase db push`
Esperado: a migration `20260813120000_estoque_movimentos` aparece como aplicada, sem erro.

- [ ] **Passo 3: Conferir que a tabela existe e está trancada**

Rodar no SQL Editor do Supabase:

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'estoque_movimentos';
SELECT count(*) FROM estoque_movimentos;
```

Esperado: `relrowsecurity = true` e contagem `0`.

- [ ] **Passo 4: Commit**

```bash
git add supabase/migrations/20260813120000_estoque_movimentos.sql
git commit -m "feat(estoque): cria a tabela de movimentacao de estoque"
```

---

### Task 2: `calcularBaixa` e `calcularDevolucao` (puras)

**Files:**
- Modify: `public/estoque.js`
- Test: `test/estoque.test.js`

**Interfaces:**
- Consumes: os helpers privados que já existem em `public/estoque.js` (`temControle`,
  `_mapaItens`, `_agregar`, `_agregarVariacoes`, `_chaveVar`).
- Produces:
  - `calcularBaixa(cardapio, itensPayload) -> { cardapio, movimentos }` — quantidade negativa.
  - `calcularDevolucao(cardapio, itensPayload) -> { cardapio, movimentos }` — positiva.
  - `movimentos` é `[{ itemId, variacaoId|null, quantidade, saldoDepois, descricao, unidade }]`.
  - `aplicarBaixa(cardapio, itensPayload) -> cardapio` mantém a assinatura de hoje.

- [ ] **Passo 1: Escrever os testes que falham**

Adicionar em `test/estoque.test.js` (o arquivo já existe e já importa `../public/estoque`):

```js
const baseMov = {
  categorias: [
    { nome: "Cat", itens: [
      { id: "a1", nome: "Espeto", unidade: "un", estoque: 3, estoqueMinimo: 1 },
      { id: "a2", nome: "Picanha", unidade: "kg", estoque: 2 },
      { id: "a3", nome: "Refri", unidade: "un" }, // sem controle
      { id: "a4", nome: "Marmitex", unidade: "un", variacoes: [
        { id: "v1", nome: "P", preco: 18, estoque: 5 },
        { id: "v2", nome: "G", preco: 25 },        // variação sem controle
      ] },
    ] },
  ],
};
const cloneMov = () => JSON.parse(JSON.stringify(baseMov));

test("calcularBaixa: movimento negativo com saldo resultante", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a1", qtd: 2 }]);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 1);
  assert.deepEqual(r.movimentos, [
    { itemId: "a1", variacaoId: null, quantidade: -2, saldoDepois: 1, descricao: "Espeto", unidade: "un" },
  ]);
});

test("calcularBaixa: item sem controle não gera movimento", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a3", qtd: 5 }]);
  assert.deepEqual(r.movimentos, []);
});

test("calcularBaixa: trava em zero e registra o delta aplicado", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a1", qtd: 10 }]);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 0);
  assert.equal(r.movimentos[0].quantidade, -3); // tinha 3, não -10
  assert.equal(r.movimentos[0].saldoDepois, 0);
});

test("calcularBaixa: kg com três casas", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a2", qtd: "0,5" }]);
  assert.equal(r.movimentos[0].saldoDepois, 1.5);
  assert.equal(r.movimentos[0].quantidade, -0.5);
  assert.equal(r.movimentos[0].unidade, "kg");
});

test("calcularBaixa: variação tem movimento próprio", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a4", qtd: 1, variacoes: [{ id: "v1", qtd: 2 }, { id: "v2", qtd: 1 }] }]);
  assert.equal(r.movimentos.length, 1); // v2 não é controlada
  assert.deepEqual(r.movimentos[0], {
    itemId: "a4", variacaoId: "v1", quantidade: -2, saldoDepois: 3,
    descricao: "Marmitex (P)", unidade: "un",
  });
});

test("calcularBaixa: não muta o cardápio recebido", () => {
  const original = cloneMov();
  E.calcularBaixa(original, [{ id: "a1", qtd: 2 }]);
  assert.equal(original.categorias[0].itens[0].estoque, 3);
});

test("calcularDevolucao: soma de volta com movimento positivo", () => {
  const r = E.calcularDevolucao(cloneMov(), [{ id: "a1", qtd: 2 }]);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 5);
  assert.equal(r.movimentos[0].quantidade, 2);
  assert.equal(r.movimentos[0].saldoDepois, 5);
});

test("calcularDevolucao: item sem controle agora não ganha estoque", () => {
  const r = E.calcularDevolucao(cloneMov(), [{ id: "a3", qtd: 2 }]);
  assert.deepEqual(r.movimentos, []);
  assert.equal(r.cardapio.categorias[0].itens[2].estoque, undefined);
});

test("aplicarBaixa segue devolvendo só o cardápio", () => {
  const novo = E.aplicarBaixa(cloneMov(), [{ id: "a1", qtd: 1 }]);
  assert.equal(novo.categorias[0].itens[0].estoque, 2);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA com `E.calcularBaixa is not a function`.

- [ ] **Passo 3: Implementar**

Em `public/estoque.js`, adicionar o motor comum e as duas funções, e reescrever `aplicarBaixa`
como casca (substitui o corpo atual, que fica sem uso):

```js
  // Arredonda respeitando a unidade (kg tem 3 casas; un é inteiro).
  function _round(n, ehKg) {
    return ehKg ? Math.round(n * 1000) / 1000 : Math.round(n);
  }
  // Motor comum da baixa (sinal -1) e da devolução (sinal +1). Devolve uma CÓPIA
  // do cardápio e a lista de movimentos com o saldo resultante de cada um.
  // Saldo nunca fica negativo: o movimento registra o delta EFETIVAMENTE aplicado.
  function _movimentar(cardapio, itensPayload, sinal) {
    const mapa = _mapaItens(cardapio);
    const ped = _agregar(itensPayload, mapa);
    const pedV = _agregarVariacoes(itensPayload);
    const movimentos = [];
    function aplicar(alvo, pedido, ehKg, itemId, variacaoId, descricao) {
      const atual = Math.max(0, ehKg
        ? (parseFloat(String(alvo.estoque).replace(",", ".")) || 0)
        : (parseInt(alvo.estoque, 10) || 0));
      const novo = _round(Math.max(0, atual + sinal * pedido), ehKg);
      if (novo === atual) return null;
      movimentos.push({
        itemId: itemId, variacaoId: variacaoId,
        quantidade: _round(novo - atual, ehKg), saldoDepois: novo,
        descricao: descricao, unidade: ehKg ? "kg" : "un",
      });
      return novo;
    }
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it) return it;
          let novoIt = it;
          if (temControle(it) && ped[it.id]) {
            const ehKg = it.unidade === "kg";
            const novo = aplicar(it, ped[it.id], ehKg, it.id, null, it.nome || "");
            if (novo !== null) novoIt = Object.assign({}, it, { estoque: novo });
          }
          if (Array.isArray(it.variacoes) && it.variacoes.length) {
            let mudou = false;
            const novasVar = it.variacoes.map(function (v) {
              if (!v || v.id == null || !temControle(v)) return v;
              const q = pedV[_chaveVar(it.id, v.id)];
              if (!q) return v;
              const novo = aplicar(v, q, false, it.id, String(v.id), (it.nome || "") + " (" + (v.nome || "") + ")");
              if (novo === null) return v;
              mudou = true;
              return Object.assign({}, v, { estoque: novo });
            });
            if (mudou) novoIt = Object.assign({}, novoIt, { variacoes: novasVar });
          }
          return novoIt;
        }),
      });
    });
    return { cardapio: Object.assign({}, cardapio, { categorias: categorias }), movimentos: movimentos };
  }
  function calcularBaixa(cardapio, itensPayload) { return _movimentar(cardapio, itensPayload, -1); }
  function calcularDevolucao(cardapio, itensPayload) { return _movimentar(cardapio, itensPayload, 1); }
  // Casca compatível: quem só quer o cardápio novo (código antigo) continua chamando.
  function aplicarBaixa(cardapio, itensPayload) { return calcularBaixa(cardapio, itensPayload).cardapio; }
```

E incluir no `return` do módulo: `calcularBaixa: calcularBaixa, calcularDevolucao: calcularDevolucao`.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA, incluindo os testes que já existiam de `aplicarBaixa` e `validarEstoque`
(o contrato não mudou).

- [ ] **Passo 5: Commit**

```bash
git add public/estoque.js test/estoque.test.js
git commit -m "feat(estoque): calcula baixa e devolucao com lista de movimentos"
```

---

### Task 3: `diffEstoque` (pura)

**Files:**
- Modify: `public/estoque.js`
- Test: `test/estoque.test.js`

**Interfaces:**
- Consumes: `temControle`, `statusEstoque` de `public/estoque.js`.
- Produces: `diffEstoque(cardapioAntes, cardapioDepois) -> movimentos`, mesmo shape da Task 2.
  Usada pelo `store.setCardapio` (Task 8) para transformar edição de cardápio em movimento.

- [ ] **Passo 1: Escrever os testes que falham**

```js
test("diffEstoque: mudança de saldo vira movimento de ajuste", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens[0].estoque = 10; // era 3
  assert.deepEqual(E.diffEstoque(antes, depois), [
    { itemId: "a1", variacaoId: null, quantidade: 7, saldoDepois: 10, descricao: "Espeto", unidade: "un" },
  ]);
});

test("diffEstoque: saldo igual não gera movimento", () => {
  assert.deepEqual(E.diffEstoque(cloneMov(), cloneMov()), []);
});

test("diffEstoque: ligar o controle gera movimento com o saldo inicial", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens[2].estoque = 12; // Refri era ilimitado
  const m = E.diffEstoque(antes, depois);
  assert.equal(m.length, 1);
  assert.equal(m[0].itemId, "a3");
  assert.equal(m[0].quantidade, 12);
  assert.equal(m[0].saldoDepois, 12);
});

test("diffEstoque: desligar o controle não gera movimento de saldo", () => {
  const antes = cloneMov(), depois = cloneMov();
  delete depois.categorias[0].itens[0].estoque; // virou ilimitado
  assert.deepEqual(E.diffEstoque(antes, depois), []);
});

test("diffEstoque: alcança variação", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens[3].variacoes[0].estoque = 9; // era 5
  assert.deepEqual(E.diffEstoque(antes, depois), [
    { itemId: "a4", variacaoId: "v1", quantidade: 4, saldoDepois: 9, descricao: "Marmitex (P)", unidade: "un" },
  ]);
});

test("diffEstoque: item novo já controlado entra como movimento", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens.push({ id: "a9", nome: "Suco", unidade: "un", estoque: 4 });
  const m = E.diffEstoque(antes, depois);
  assert.deepEqual(m, [{ itemId: "a9", variacaoId: null, quantidade: 4, saldoDepois: 4, descricao: "Suco", unidade: "un" }]);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA com `E.diffEstoque is not a function`.

- [ ] **Passo 3: Implementar**

```js
  // Mapa dos saldos do cardápio (item e variação), por chave estável: "itemId" ou
  // "itemId::variacaoId". Por padrão só entra quem está CONTROLADO; com
  // `incluirIlimitados` entram também os sem controle (com `controlado: false` e
  // `quantidade: null`), que é o que `acharSaldo` precisa para a primeira contagem.
  function _mapaSaldos(cardapio, incluirIlimitados) {
    const mapa = {};
    ((cardapio && cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) {
        if (!it || it.id == null) return;
        if (temControle(it) || incluirIlimitados) {
          const st = statusEstoque(it);
          mapa[String(it.id)] = {
            itemId: it.id, variacaoId: null, controlado: st.controlado,
            quantidade: st.quantidade, minimo: st.minimo,
            descricao: it.nome || "", unidade: it.unidade === "kg" ? "kg" : "un",
          };
        }
        (Array.isArray(it.variacoes) ? it.variacoes : []).forEach(function (v) {
          if (!v || v.id == null) return;
          if (!temControle(v) && !incluirIlimitados) return;
          const stv = statusEstoque(v);
          mapa[_chaveVar(it.id, v.id)] = {
            itemId: it.id, variacaoId: String(v.id), controlado: stv.controlado,
            quantidade: stv.quantidade, minimo: stv.minimo,
            descricao: (it.nome || "") + " (" + (v.nome || "") + ")", unidade: "un",
          };
        });
      });
    });
    return mapa;
  }
  // Compara dois cardápios e devolve os movimentos de AJUSTE (o dono mexeu no
  // número pelo editor do item). Desligar o controle NÃO é movimento de saldo:
  // o item passa a ser ilimitado, não a ter uma quantidade diferente.
  function diffEstoque(cardapioAntes, cardapioDepois) {
    const a = _mapaSaldos(cardapioAntes);
    const d = _mapaSaldos(cardapioDepois);
    const movimentos = [];
    Object.keys(d).forEach(function (k) {
      const dep = d[k];
      const ant = a[k];
      const antes = ant ? ant.quantidade : null;
      if (antes === dep.quantidade) return;
      const ehKg = dep.unidade === "kg";
      movimentos.push({
        itemId: dep.itemId, variacaoId: dep.variacaoId,
        quantidade: antes === null ? dep.quantidade : _round(dep.quantidade - antes, ehKg),
        saldoDepois: dep.quantidade, descricao: dep.descricao, unidade: dep.unidade,
      });
    });
    return movimentos;
  }
```

Incluir `diffEstoque: diffEstoque` no `return` do módulo.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add public/estoque.js test/estoque.test.js
git commit -m "feat(estoque): compara cardapios para virar movimento de ajuste"
```

---

### Task 4: `src/estoque-db.js`

**Files:**
- Create: `src/estoque-db.js`
- Test: `test/estoque-db.test.js`

**Interfaces:**
- Consumes: `src/db.js` (`db.query`, `db.pool`).
- Produces:
  - `empresaId(dir) -> Promise<uuid>` — slug para uuid, com cache (padrão de `pedidos.js`).
    Exportado porque a Task 6 usa.
  - `registrarTx(client, empresaId, movimentos, ctx) -> Promise<number>` — `ctx` é
    `{ tipo, pedidoId?, numero?, obs? }`. Ignora movimento com `quantidade` zero.
  - `listar(dir, { itemId, variacaoId, limite, antes }) -> Promise<movimento[]>` (camelCase).
  - `resumo(dir, { itemId, variacaoId, dias }) -> Promise<{ entrada, venda, devolucao, perda, contagem, ajuste }>`.
  - `limparAntigos(meses) -> Promise<number>`.

- [ ] **Passo 1: Escrever os testes que falham**

Criar `test/estoque-db.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const estoqueDb = require("../src/estoque-db");

function fakeClient() {
  const calls = [];
  return { calls, async query(sql, params) { calls.push({ sql, params }); return { rows: [], rowCount: 1 }; } };
}

const MOV = [
  { itemId: "a1", variacaoId: null, quantidade: -2, saldoDepois: 1, descricao: "Espeto", unidade: "un" },
  { itemId: "a4", variacaoId: "v1", quantidade: -1, saldoDepois: 3, descricao: "Marmitex (P)", unidade: "un" },
];

test("registrarTx: um INSERT só, com todos os movimentos", async () => {
  const c = fakeClient();
  const n = await estoqueDb.registrarTx(c, "emp-uuid", MOV, { tipo: "venda", pedidoId: 7, numero: 12 });
  assert.equal(n, 2);
  assert.equal(c.calls.length, 1);
  assert.match(c.calls[0].sql, /INSERT INTO estoque_movimentos/i);
  assert.equal(c.calls[0].params.length, 2 * 12);
  assert.equal(c.calls[0].params[0], "emp-uuid");
  assert.equal(c.calls[0].params[3], "venda");
});

test("registrarTx: lista vazia não toca o banco", async () => {
  const c = fakeClient();
  assert.equal(await estoqueDb.registrarTx(c, "emp-uuid", [], { tipo: "venda" }), 0);
  assert.equal(c.calls.length, 0);
});

test("registrarTx: movimento de quantidade zero é descartado", async () => {
  const c = fakeClient();
  const n = await estoqueDb.registrarTx(c, "emp-uuid",
    [{ itemId: "a1", variacaoId: null, quantidade: 0, saldoDepois: 3, descricao: "x", unidade: "un" }],
    { tipo: "ajuste" });
  assert.equal(n, 0);
  assert.equal(c.calls.length, 0);
});

test("registrarTx: tipo desconhecido é recusado", async () => {
  const c = fakeClient();
  await assert.rejects(() => estoqueDb.registrarTx(c, "emp-uuid", MOV, { tipo: "chute" }), /tipo/i);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA com `Cannot find module '../src/estoque-db'`.

- [ ] **Passo 3: Implementar**

```js
// ============================================================
// ESTOQUE-DB — único ponto que fala com `estoque_movimentos` (a trilha de
// movimentação). O SALDO não mora aqui: ele continua no jsonb do cardápio. Esta
// tabela é histórico, gravado SEMPRE dentro da transação de quem alterou o saldo
// (store.baixarEstoqueTx / devolverEstoqueTx / ajustarEstoqueTx) — por isso
// `registrarTx` recebe o `client` do chamador em vez de abrir conexão própria.
// Isolado por empresa_id, resolvido do slug com cache (padrão de pedidos.js).
// ============================================================

const path = require("path");
const db = require("./db");

const TIPOS = ["venda", "devolucao", "entrada", "perda", "contagem", "ajuste"];
const slugDe = (dir) => path.basename(dir);
const idCache = {}; // slug -> empresa_id (uuid)

async function empresaId(dir) {
  const slug = slugDe(dir);
  if (idCache[slug]) return idCache[slug];
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  idCache[slug] = r.rows[0].id;
  return idCache[slug];
}

// Grava os movimentos na transação do chamador. Movimento de quantidade zero é
// descartado (nada mudou de saldo → não é evento).
async function registrarTx(client, empId, movimentos, ctx = {}) {
  const tipo = String(ctx.tipo || "");
  if (!TIPOS.includes(tipo)) throw new Error("Tipo de movimento inválido: " + tipo);
  const linhas = (movimentos || []).filter((m) => m && Number(m.quantidade) !== 0);
  if (!linhas.length) return 0;
  const valores = [];
  const params = [];
  linhas.forEach((m, i) => {
    const b = i * 12;
    valores.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`);
    params.push(
      empId, String(m.itemId),
      m.variacaoId == null ? null : String(m.variacaoId),
      tipo, Number(m.quantidade), Number(m.saldoDepois),
      String(m.descricao || "").slice(0, 120), m.unidade === "kg" ? "kg" : "un",
      ctx.pedidoId == null ? null : Number(ctx.pedidoId),
      ctx.numero == null ? null : Number(ctx.numero),
      ctx.obs == null ? null : String(ctx.obs).slice(0, 200),
      new Date()
    );
  });
  await client.query(
    `INSERT INTO estoque_movimentos
       (empresa_id, item_id, variacao_id, tipo, quantidade, saldo_depois,
        descricao, unidade, pedido_id, numero, obs, criado_em)
     VALUES ${valores.join(",")}`,
    params
  );
  return linhas.length;
}

function mapRow(r) {
  return {
    id: r.id, itemId: r.item_id, variacaoId: r.variacao_id, tipo: r.tipo,
    quantidade: Number(r.quantidade), saldoDepois: Number(r.saldo_depois),
    descricao: r.descricao, unidade: r.unidade,
    pedidoId: r.pedido_id, numero: r.numero, obs: r.obs,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
  };
}

// Extrato de UM saldo, mais recente primeiro. `antes` é cursor por data (ISO):
// devolve o que for anterior a ele (paginação sem OFFSET).
async function listar(dir, { itemId, variacaoId = null, limite = 30, antes = null } = {}) {
  const empId = await empresaId(dir);
  const lim = Math.min(Math.max(parseInt(limite, 10) || 30, 1), 100);
  const params = [empId, String(itemId), variacaoId == null ? null : String(variacaoId)];
  let sql = `SELECT * FROM estoque_movimentos
              WHERE empresa_id = $1 AND item_id = $2 AND variacao_id IS NOT DISTINCT FROM $3`;
  if (antes) { params.push(antes); sql += ` AND criado_em < $${params.length}`; }
  params.push(lim);
  sql += ` ORDER BY criado_em DESC, id DESC LIMIT $${params.length}`;
  const r = await db.query(sql, params);
  return r.rows.map(mapRow);
}

// Soma por tipo nos últimos `dias` (cabeçalho da gaveta). Sempre devolve as seis
// chaves, zeradas quando não houve movimento.
async function resumo(dir, { itemId, variacaoId = null, dias = 30 } = {}) {
  const empId = await empresaId(dir);
  const d = Math.min(Math.max(parseInt(dias, 10) || 30, 1), 365);
  const r = await db.query(
    `SELECT tipo, SUM(quantidade)::float8 AS total
       FROM estoque_movimentos
      WHERE empresa_id = $1 AND item_id = $2 AND variacao_id IS NOT DISTINCT FROM $3
        AND criado_em > now() - make_interval(days => $4)
      GROUP BY tipo`,
    [empId, String(itemId), variacaoId == null ? null : String(variacaoId), d]
  );
  const out = {};
  TIPOS.forEach((t) => { out[t] = 0; });
  r.rows.forEach((row) => { out[row.tipo] = Number(row.total) || 0; });
  return out;
}

// Retenção: apaga movimento mais antigo que `meses`. Seguro porque o SALDO não é
// a soma das linhas — apagar histórico velho não altera número nenhum. Global.
async function limparAntigos(meses = 12) {
  try {
    const r = await db.query(
      "DELETE FROM estoque_movimentos WHERE criado_em < now() - make_interval(months => $1)",
      [meses]
    );
    return r.rowCount;
  } catch (e) {
    console.error("estoque-db.limparAntigos:", e.message);
    return 0;
  }
}

module.exports = { registrarTx, listar, resumo, limparAntigos, empresaId, TIPOS };
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/estoque-db.js test/estoque-db.test.js
git commit -m "feat(estoque): modulo de acesso a trilha de movimentacao"
```

---

### Task 5: Venda grava movimento em `baixarEstoqueTx`

**Files:**
- Modify: `src/store.js:63-79`
- Test: `test/store-estoque.test.js`

**Interfaces:**
- Consumes: `Estoque.calcularBaixa` (Task 2), `estoqueDb.registrarTx` (Task 4).
- Produces: `baixarEstoqueTx(client, dir, itensPayload, ctx)` — `ctx` opcional
  `{ pedidoId, numero }`. Retorno segue sendo o **cardápio novo** (chamadores não mudam).

- [ ] **Passo 1: Escrever os testes que falham**

Adicionar em `test/store-estoque.test.js` (o `fakeClient` do arquivo devolve `{ rows: [{ cardapio }] }`
para `SELECT cardapio`; ele precisa passar a devolver também o `id` — ajustar a linha
`if (/SELECT cardapio/i.test(sql)) return { rows: [{ cardapio }] };` para
`if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio }] };`):

```js
test("baixarEstoqueTx: grava o movimento de venda na MESMA transação", async () => {
  const c = fakeClient(clone());
  await store.baixarEstoqueTx(c, "/x/slug-teste", [{ id: "a1", qtd: 2 }], { pedidoId: 7, numero: 12 });
  assert.match(c.calls[0].sql, /SELECT id, cardapio[\s\S]*FOR UPDATE/i);
  assert.match(c.calls[1].sql, /UPDATE empresas SET cardapio/i);
  assert.match(c.calls[2].sql, /INSERT INTO estoque_movimentos/i);
  assert.equal(c.calls[2].params[0], "emp-uuid"); // empresa_id veio do mesmo SELECT
  assert.equal(c.calls[2].params[3], "venda");
  assert.equal(c.calls[2].params[8], 7);          // pedido_id
});

test("baixarEstoqueTx: item sem controle não gera INSERT", async () => {
  const c = fakeClient(clone());
  await store.baixarEstoqueTx(c, "/x/slug", [{ id: "a3", qtd: 5 }]);
  assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA — a 3ª query não existe (`c.calls[2]` é `undefined`).

- [ ] **Passo 3: Implementar**

Substituir o corpo de `baixarEstoqueTx` em `src/store.js`:

```js
async function baixarEstoqueTx(client, dir, itensPayload, ctx = {}) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const cardapio = r.rows[0].cardapio || { categorias: [] };
  const check = Estoque.validarEstoque(cardapio, itensPayload);
  if (!check.ok) { const e = new Error(check.erro); e.code = "ESTOQUE"; throw e; }
  const { cardapio: novo, movimentos } = Estoque.calcularBaixa(cardapio, itensPayload);
  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
  // Trilha na MESMA transação: se o INSERT falhar, a venda inteira faz ROLLBACK.
  await estoqueDb.registrarTx(client, r.rows[0].id, movimentos, {
    tipo: "venda", pedidoId: ctx.pedidoId, numero: ctx.numero,
  });
  return novo;
}
```

E, no topo do arquivo, `const estoqueDb = require("./estoque-db");`.

> **Nota para quem executa:** o `pedidoId` só existe **depois** do `salvarPedido`, e a baixa
> roda **antes** dele nos quatro chamadores. Nesta tarefa o `ctx` fica vazio (movimento sem
> pedido). A Task 6 amarra o pedido ao movimento.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA, incluindo os testes antigos de `baixarEstoqueTx`.

- [ ] **Passo 5: Commit**

```bash
git add src/store.js test/store-estoque.test.js
git commit -m "feat(estoque): venda registra movimento na transacao da baixa"
```

---

### Task 6: Amarrar o número do pedido ao movimento da venda

**Files:**
- Modify: `src/store.js`, `src/servidor.js:926`, `src/servidor.js:2086`, `src/servidor.js:2269`, `src/caixa.js:193`
- Test: `test/store-estoque.test.js`

**Interfaces:**
- Consumes: `baixarEstoqueTx` (Task 5).
- Produces: `store.amarrarPedidoTx(client, empresaIdOuNull, dir, pedidoId, numero) -> Promise<void>`,
  que carimba `pedido_id`/`numero` nos movimentos de venda recém-gravados que ainda estão sem
  pedido, dentro da mesma transação.

- [ ] **Passo 1: Escrever o teste que falha**

```js
test("amarrarPedidoTx: carimba o pedido nos movimentos órfãos da transação", async () => {
  const c = fakeClient(clone());
  await store.amarrarPedidoTx(c, "emp-uuid", "/x/slug", 7, 12);
  const q = c.calls[c.calls.length - 1];
  assert.match(q.sql, /UPDATE estoque_movimentos[\s\S]*SET pedido_id/i);
  assert.match(q.sql, /pedido_id IS NULL/i);
  assert.deepEqual(q.params, [7, 12, "emp-uuid"]);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA com `store.amarrarPedidoTx is not a function`.

- [ ] **Passo 3: Implementar**

Em `src/store.js`:

```js
// Carimba o pedido nos movimentos de venda gravados NESTA transação (que nasceram
// sem pedido_id porque a baixa roda antes do salvarPedido). Restringe a linhas
// órfãs do próprio tenant; como a linha da empresa está travada (FOR UPDATE), não
// existe venda concorrente do mesmo tenant para carimbar por engano.
async function amarrarPedidoTx(client, empresaId, dir, pedidoId, numero) {
  if (!empresaId || !pedidoId) return;
  await client.query(
    `UPDATE estoque_movimentos SET pedido_id = $1, numero = $2
      WHERE empresa_id = $3 AND tipo = 'venda' AND pedido_id IS NULL`,
    [pedidoId, numero == null ? null : numero, empresaId]
  );
}
```

Exportar `amarrarPedidoTx` no `module.exports` de `src/store.js`.

O `empresa_id` vem de `estoqueDb.empresaId(dir)`, que já existe e tem cache por slug (só vai ao
banco na primeira chamada do processo). `baixarEstoqueTx` **continua devolvendo só o cardápio**,
para não quebrar os quatro chamadores.

Nos quatro chamadores, logo após o `salvarPedido`/`lancarItens` e **antes** do `COMMIT`:

```js
await store.amarrarPedidoTx(clientTx, await estoqueDb.empresaId(dir), dir, pedido.id, pedido.numero);
```

- `src/servidor.js:926` (cardápio web) — `dir` é `dir`, pedido em `pedido`.
- `src/servidor.js:2086` (PDV a receber) — `dir` é `req.tenantDir`.
- `src/servidor.js:2269` (item na mesa) — o retorno de `mesasDb.lancarItens` traz o pedido;
  usar o id/numero dele.
- `src/caixa.js:193` (balcão) — `dir`, pedido salvo logo abaixo na mesma transação.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/store.js src/servidor.js src/caixa.js src/estoque-db.js test/store-estoque.test.js
git commit -m "feat(estoque): liga o movimento de venda ao pedido que o gerou"
```

---

### Task 7: `devolverEstoqueTx` e `ajustarEstoqueTx`

**Files:**
- Modify: `src/store.js`
- Test: `test/store-estoque.test.js`

**Interfaces:**
- Consumes: `Estoque.calcularDevolucao` (Task 2), `estoqueDb.registrarTx` (Task 4).
- Produces:
  - `devolverEstoqueTx(client, dir, itensPayload, ctx) -> Promise<cardapio>` — `ctx` é
    `{ pedidoId, numero, obs? }`.
  - `ajustarEstoqueTx(client, dir, { itemId, variacaoId, tipo, quantidade, contado, obs })
     -> Promise<{ cardapio, movimento }>` — `tipo` é `entrada`, `perda` ou `contagem`.

- [ ] **Passo 1: Escrever os testes que falham**

```js
test("devolverEstoqueTx: soma de volta e grava movimento de devolução", async () => {
  const c = fakeClient(clone());
  const novo = await store.devolverEstoqueTx(c, "/x/slug", [{ id: "a1", qtd: 2 }], { pedidoId: 7, numero: 12 });
  assert.equal(novo.categorias[0].itens[0].estoque, 5); // 3 + 2
  const ins = c.calls.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
  assert.equal(ins.params[3], "devolucao");
  assert.equal(ins.params[4], 2);
});

test("ajustarEstoqueTx: entrada soma", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "entrada", quantidade: 5 });
  assert.equal(r.movimento.saldoDepois, 8);
  assert.equal(r.movimento.quantidade, 5);
});

test("ajustarEstoqueTx: perda maior que o saldo trava em zero", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "perda", quantidade: 10 });
  assert.equal(r.movimento.saldoDepois, 0);
  assert.equal(r.movimento.quantidade, -3); // o delta aplicado, não o pedido
});

test("ajustarEstoqueTx: contagem calcula a diferença", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "contagem", contado: 7 });
  assert.equal(r.movimento.quantidade, 4); // contou 7, tinha 3
  assert.equal(r.movimento.saldoDepois, 7);
});

test("ajustarEstoqueTx: contagem liga o controle de item ilimitado", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a3", tipo: "contagem", contado: 12 });
  assert.equal(r.cardapio.categorias[0].itens[2].estoque, 12);
  assert.equal(r.movimento.quantidade, 12);
});

test("ajustarEstoqueTx: contagem igual ao saldo não grava", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "contagem", contado: 3 });
  assert.equal(r.movimento, null);
  assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
});

test("ajustarEstoqueTx: item inexistente falha", async () => {
  const c = fakeClient(clone());
  await assert.rejects(() => store.ajustarEstoqueTx(c, "/x/slug", { itemId: "zzz", tipo: "entrada", quantidade: 1 }), /não encontrado/i);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA com `store.devolverEstoqueTx is not a function`.

- [ ] **Passo 3: Implementar**

```js
// Devolve ao estoque (cancelamento). Espelho da baixa: mesma trava, mesma
// transação, movimento positivo. Item que NÃO está controlado agora é ignorado
// (devolver criaria quantidade do nada).
async function devolverEstoqueTx(client, dir, itensPayload, ctx = {}) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const { cardapio: novo, movimentos } = Estoque.calcularDevolucao(r.rows[0].cardapio || { categorias: [] }, itensPayload);
  if (!movimentos.length) return novo;
  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
  await estoqueDb.registrarTx(client, r.rows[0].id, movimentos, {
    tipo: "devolucao", pedidoId: ctx.pedidoId, numero: ctx.numero, obs: ctx.obs,
  });
  return novo;
}

// Movimento lançado na tela de Controle de estoque: entrada, perda ou contagem.
// `contagem` recebe `contado` (o que foi contado de verdade) e o delta sai daqui.
// Reusa o motor de baixa/devolução montando um payload de um item só.
async function ajustarEstoqueTx(client, dir, { itemId, variacaoId = null, tipo, quantidade, contado, obs }) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const cardapio = r.rows[0].cardapio || { categorias: [] };
  const alvo = Estoque.acharSaldo(cardapio, itemId, variacaoId);
  if (!alvo) throw new Error("Produto não encontrado no cardápio.");
  let delta;
  if (tipo === "contagem") {
    delta = Number(contado) - (alvo.controlado ? alvo.quantidade : 0);
    if (!alvo.controlado && Number(contado) === 0) delta = 0;
  } else if (tipo === "entrada") {
    delta = Math.abs(Number(quantidade) || 0);
  } else if (tipo === "perda") {
    delta = -Math.abs(Number(quantidade) || 0);
  } else {
    throw new Error("Tipo de movimento inválido: " + tipo);
  }
  const payload = [variacaoId == null
    ? { id: itemId, qtd: Math.abs(delta) }
    : { id: itemId, qtd: 0, variacoes: [{ id: variacaoId, qtd: Math.abs(delta) }] }];
  const calc = delta >= 0
    ? Estoque.calcularDevolucao(Estoque.garantirControle(cardapio, itemId, variacaoId), payload)
    : Estoque.calcularBaixa(cardapio, payload);
  const movimento = calc.movimentos[0] || null;
  if (!movimento) return { cardapio, movimento: null };
  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(calc.cardapio), slug]);
  await estoqueDb.registrarTx(client, r.rows[0].id, [movimento], { tipo, obs });
  return { cardapio: calc.cardapio, movimento };
}
```

Esta tarefa exige **duas funções puras novas** em `public/estoque.js`, com teste próprio no
mesmo ciclo:

```js
  // Localiza um saldo (item ou variação) e devolve { itemId, variacaoId, controlado,
  // quantidade, minimo, descricao, unidade }. null se o id não existe no cardápio.
  // Enxerga também o item ilimitado (é dele que sai a primeira contagem).
  function acharSaldo(cardapio, itemId, variacaoId) {
    const chave = variacaoId == null ? String(itemId) : _chaveVar(itemId, variacaoId);
    return _mapaSaldos(cardapio, true)[chave] || null;
  }
  // Liga o controle num item/variação ainda ilimitado, colocando estoque 0, para a
  // primeira contagem ter de onde partir. Cópia, não muta. Já controlado volta igual.
  function garantirControle(cardapio, itemId, variacaoId) {
    const alvo = String(itemId);
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || String(it.id) !== alvo) return it;
          if (variacaoId == null) {
            return temControle(it) ? it : Object.assign({}, it, { estoque: 0 });
          }
          if (!Array.isArray(it.variacoes)) return it;
          return Object.assign({}, it, {
            variacoes: it.variacoes.map(function (v) {
              if (!v || String(v.id) !== String(variacaoId)) return v;
              return temControle(v) ? v : Object.assign({}, v, { estoque: 0 });
            }),
          });
        }),
      });
    });
    return Object.assign({}, cardapio, { categorias: categorias });
  }
```

Incluir `acharSaldo` e `garantirControle` no `return` do módulo.

Testes das duas (adicionar em `test/estoque.test.js`):

```js
test("acharSaldo: acha item, variação e devolve null para id inexistente", () => {
  assert.equal(E.acharSaldo(cloneMov(), "a1", null).quantidade, 3);
  assert.equal(E.acharSaldo(cloneMov(), "a4", "v1").quantidade, 5);
  assert.equal(E.acharSaldo(cloneMov(), "a3", null).controlado, false);
  assert.equal(E.acharSaldo(cloneMov(), "zzz", null), null);
});

test("garantirControle: item ilimitado passa a ter estoque 0 sem mutar o original", () => {
  const c = cloneMov();
  const novo = E.garantirControle(c, "a3", null);
  assert.equal(novo.categorias[0].itens[2].estoque, 0);
  assert.equal(c.categorias[0].itens[2].estoque, undefined);
});
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/store.js public/estoque.js test/store-estoque.test.js test/estoque.test.js
git commit -m "feat(estoque): devolucao e ajuste manual gravam movimento"
```

---

### Task 8: `setCardapio` transacional com movimento de ajuste

**Files:**
- Modify: `src/store.js:55-61`
- Test: `test/store-estoque.test.js`

**Interfaces:**
- Consumes: `Estoque.diffEstoque` (Task 3), `estoqueDb.registrarTx` (Task 4).
- Produces: `setCardapio(dir, dados)` com a mesma assinatura de hoje (devolve `dados`), agora
  gravando os movimentos de `ajuste`. Chamador único: `PUT /api/cardapio`
  (`src/servidor.js:1730`), que não muda.

- [ ] **Passo 1: Escrever o teste que falha**

```js
test("setCardapio: mudança de estoque pelo editor vira movimento de ajuste", async () => {
  const chamadas = [];
  const fakePool = { connect: async () => ({
    query: async (sql, params) => {
      chamadas.push({ sql, params });
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio: clone() }] };
      return { rows: [] };
    },
    release() {},
  }) };
  const dbMod = require("../src/db");
  const original = dbMod.pool;
  dbMod.pool = fakePool;
  try {
    const novo = clone();
    novo.categorias[0].itens[0].estoque = 10; // era 3
    await store.setCardapio("/x/slug", novo);
    const ins = chamadas.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.ok(ins, "deveria gravar o ajuste");
    assert.equal(ins.params[3], "ajuste");
    assert.equal(ins.params[4], 7);
  } finally { dbMod.pool = original; }
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA — nenhuma query de `INSERT INTO estoque_movimentos`.

- [ ] **Passo 3: Implementar**

```js
// Salva o cardápio inteiro (único chamador: PUT /api/cardapio). Transacional
// porque o que mudou de ESTOQUE vira movimento de 'ajuste': lê o estado anterior
// travando a linha, grava o novo e registra o diff. Como é comparação de estados,
// qualquer caminho que salve cardápio fica coberto sem precisar lembrar de nada.
async function setCardapio(dir, dados) {
  const slug = slugDe(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
    if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
    await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(dados), slug]);
    const movimentos = Estoque.diffEstoque(r.rows[0].cardapio || { categorias: [] }, dados);
    await estoqueDb.registrarTx(client, r.rows[0].id, movimentos, { tipo: "ajuste", obs: "Editor do produto" });
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  if (!cache[slug]) cache[slug] = { config: {}, cardapio: dados };
  else cache[slug].cardapio = dados;
  return dados;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/store.js test/store-estoque.test.js
git commit -m "feat(estoque): editar estoque no produto vira movimento de ajuste"
```

---

### Task 9: Rotas de leitura

**Files:**
- Modify: `src/servidor.js`

**Interfaces:**
- Consumes: `store.getCardapio`, `estoque.statusEstoque`, `estoqueDb.listar/resumo`, `exigePdv`.
- Produces:
  - `GET /api/estoque` → `{ linhas: [{ itemId, variacaoId, nome, categoria, controlado,
    quantidade, minimo, unidade, esgotado, baixo }], contadores: { esgotados, baixos, controlados } }`
  - `GET /api/estoque/movimentos?itemId=&variacaoId=&limite=&antes=` → `{ movimentos, resumo }`

- [ ] **Passo 1: Implementar as rotas**

Colocar junto das rotas de cardápio (após `GET /api/cardapio/item/:id/vendas`,
`src/servidor.js:1752`):

```js
// ============================================================
// CONTROLE DE ESTOQUE (Plano Completo) — visão consolidada + trilha.
// A lista sai do CACHE do cardápio (sem ida ao banco); só o extrato consulta.
// ============================================================

// Uma linha por SALDO: o item e, quando houver, cada variação (que tem estoque
// próprio). Item sem controle entra com `controlado: false` para a tela poder
// oferecer "Controlar" sem obrigar a abrir o editor do produto.
function linhasEstoque(cardapio) {
  const linhas = [];
  ((cardapio && cardapio.categorias) || []).forEach((c) => {
    ((c && c.itens) || []).forEach((it) => {
      if (!it || it.id == null || it.arquivado) return;
      const temVar = Array.isArray(it.variacoes) && it.variacoes.length;
      const st = estoque.statusEstoque(it);
      linhas.push({
        itemId: String(it.id), variacaoId: null, nome: it.nome || "", categoria: c.nome || "",
        controlado: st.controlado, quantidade: st.quantidade, minimo: st.minimo,
        unidade: st.unidade, esgotado: st.esgotado, baixo: st.baixo, temVariacoes: !!temVar,
      });
      if (!temVar) return;
      it.variacoes.forEach((v) => {
        if (!v || v.id == null) return;
        const stv = estoque.statusEstoque(v);
        linhas.push({
          itemId: String(it.id), variacaoId: String(v.id),
          nome: v.nome || "", categoria: c.nome || "", pai: it.nome || "",
          controlado: stv.controlado, quantidade: stv.quantidade, minimo: stv.minimo,
          unidade: stv.unidade, esgotado: stv.esgotado, baixo: stv.baixo,
        });
      });
    });
  });
  return linhas;
}

app.get("/api/estoque", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    await store.ensure(req.tenantDir);
    const linhas = linhasEstoque(store.getCardapio(req.tenantDir));
    const controlados = linhas.filter((l) => l.controlado);
    res.json({
      linhas,
      contadores: {
        controlados: controlados.length,
        esgotados: controlados.filter((l) => l.esgotado).length,
        baixos: controlados.filter((l) => l.baixo).length,
      },
    });
  } catch (e) {
    console.error("GET /api/estoque:", e.message);
    res.status(500).json({ erro: "Não foi possível carregar o estoque." });
  }
});

app.get("/api/estoque/movimentos", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  const itemId = String(req.query.itemId || "");
  if (!itemId) return res.status(400).json({ erro: "Informe o produto." });
  const variacaoId = req.query.variacaoId ? String(req.query.variacaoId) : null;
  try {
    const [movimentos, resumo] = await Promise.all([
      estoqueDb.listar(req.tenantDir, { itemId, variacaoId, limite: req.query.limite, antes: req.query.antes || null }),
      estoqueDb.resumo(req.tenantDir, { itemId, variacaoId, dias: 30 }),
    ]);
    res.json({ movimentos, resumo });
  } catch (e) {
    console.error("GET /api/estoque/movimentos:", e.message);
    res.status(500).json({ erro: "Não foi possível carregar o histórico." });
  }
});
```

Conferir que `estoque` e `estoqueDb` estão no topo do arquivo:
`const estoque = require("../public/estoque");` (já existe) e
`const estoqueDb = require("./estoque-db");` (adicionar).

- [ ] **Passo 2: Conferir sintaxe e testes**

Rodar: `npm run check && npm test`
Esperado: sem erro.

- [ ] **Passo 3: Conferir a resposta com o app rodando**

Rodar: `npm start` e, autenticado no painel, no console do navegador:
`await (await fetch('/api/estoque', { headers: { Authorization: 'Bearer ' + localStorage.token } })).json()`
Esperado: `linhas` com um objeto por produto e `contadores` batendo com os selos que a aba
Cardápio já mostra.

- [ ] **Passo 4: Commit**

```bash
git add src/servidor.js
git commit -m "feat(estoque): rotas de leitura do estoque e do historico"
```

---

### Task 10: Rotas de escrita

**Files:**
- Modify: `src/servidor.js`

**Interfaces:**
- Consumes: `store.ajustarEstoqueTx` (Task 7), `db.pool`, `exigePdv`.
- Produces:
  - `POST /api/estoque/movimentos` `{ itemId, variacaoId?, tipo, quantidade?, contado?, obs? }`
    → `{ ok: true, movimento, quantidade }`
  - `POST /api/estoque/minimo` `{ itemId, variacaoId?, minimo }` → `{ ok: true }`

- [ ] **Passo 1: Implementar**

```js
app.post("/api/estoque/movimentos", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  const b = req.body || {};
  const tipo = String(b.tipo || "");
  if (!["entrada", "perda", "contagem"].includes(tipo)) {
    return res.status(400).json({ erro: "Movimento inválido." });
  }
  const itemId = String(b.itemId || "");
  if (!itemId) return res.status(400).json({ erro: "Informe o produto." });
  const num = (v) => Math.max(0, parseFloat(String(v).replace(",", ".")) || 0);
  if (tipo !== "contagem" && num(b.quantidade) <= 0) {
    return res.status(400).json({ erro: "Informe uma quantidade maior que zero." });
  }
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const r = await store.ajustarEstoqueTx(client, req.tenantDir, {
      itemId, variacaoId: b.variacaoId ? String(b.variacaoId) : null, tipo,
      quantidade: num(b.quantidade), contado: num(b.contado),
      obs: String(b.obs || "").slice(0, 200),
    });
    await client.query("COMMIT");
    store.sincronizarCardapio(req.tenantDir, r.cardapio);
    res.json({ ok: true, movimento: r.movimento, quantidade: r.movimento ? r.movimento.saldoDepois : null });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ erro: e.message || "Não foi possível registrar o movimento." });
  } finally {
    client.release();
  }
});

// Mínimo não mexe em saldo, então NÃO é movimento: grava direto no cardápio.
app.post("/api/estoque/minimo", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  const b = req.body || {};
  const itemId = String(b.itemId || "");
  if (!itemId) return res.status(400).json({ erro: "Informe o produto." });
  const minimo = Math.max(0, parseFloat(String(b.minimo).replace(",", ".")) || 0);
  try {
    await store.ensure(req.tenantDir);
    const atual = store.getCardapio(req.tenantDir);
    const novo = estoque.definirMinimo(atual, itemId, b.variacaoId ? String(b.variacaoId) : null, minimo);
    if (!novo) return res.status(404).json({ erro: "Produto não encontrado." });
    await store.setCardapio(req.tenantDir, novo);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Não foi possível salvar o mínimo." });
  }
});
```

Função pura nova em `public/estoque.js`, com teste no mesmo ciclo:

```js
  // Define o estoque mínimo de um item/variação. Devolve uma CÓPIA do cardápio,
  // ou null se o id não existir. Não mexe no saldo (não é movimento).
  function definirMinimo(cardapio, itemId, variacaoId, minimo) {
    const alvo = String(itemId);
    const min = Math.max(0, Number(minimo) || 0);
    let achou = false;
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || String(it.id) !== alvo) return it;
          if (variacaoId == null) {
            achou = true;
            return Object.assign({}, it, { estoqueMinimo: min });
          }
          if (!Array.isArray(it.variacoes)) return it;
          return Object.assign({}, it, {
            variacoes: it.variacoes.map(function (v) {
              if (!v || String(v.id) !== String(variacaoId)) return v;
              achou = true;
              return Object.assign({}, v, { estoqueMinimo: min });
            }),
          });
        }),
      });
    });
    return achou ? Object.assign({}, cardapio, { categorias: categorias }) : null;
  }
```

```js
test("definirMinimo: grava no item e na variação, e devolve null para id inexistente", () => {
  const c = cloneMov();
  assert.equal(E.definirMinimo(c, "a1", null, 4).categorias[0].itens[0].estoqueMinimo, 4);
  assert.equal(E.definirMinimo(c, "a4", "v1", 2).categorias[0].itens[3].variacoes[0].estoqueMinimo, 2);
  assert.equal(E.definirMinimo(c, "zzz", null, 1), null);
  assert.equal(c.categorias[0].itens[0].estoqueMinimo, 1); // não mutou
});
```

- [ ] **Passo 2: Rodar os testes**

Rodar: `npm test && npm run check`
Esperado: PASSA.

- [ ] **Passo 3: Conferir com o app rodando**

Com `npm start`, no console autenticado: lançar uma entrada de 1 unidade num produto de teste
e conferir que `GET /api/estoque/movimentos?itemId=...` devolve a linha com `tipo: "entrada"`,
`quantidade: 1` e o `saldoDepois` certo.

- [ ] **Passo 4: Commit**

```bash
git add src/servidor.js public/estoque.js test/estoque.test.js
git commit -m "feat(estoque): rotas de lancamento de movimento e de minimo"
```

---

### Task 11: Cancelamento devolve em `pedidos.js`

**Files:**
- Modify: `src/pedidos.js:236-270`, `src/servidor.js:1848`, `src/servidor.js:1867`
- Test: `test/pedidos-devolucao.test.js` (novo)

**Interfaces:**
- Consumes: `store.devolverEstoqueTx` (Task 7).
- Produces:
  - `cancelarPedido(dir, pedidoId, { devolver })` — transacional.
  - `cancelarItemPedido(dir, pedidoId, itemIdx, { devolver })` — transacional.
  - As rotas aceitam `{ devolver: boolean }` no corpo (padrão `true`).

- [ ] **Passo 1: Escrever os testes que falham**

Criar `test/pedidos-devolucao.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbMod = require("../src/db");
const pedidos = require("../src/pedidos");

const CARDAPIO = { categorias: [{ nome: "Cat", itens: [
  { id: "a1", nome: "Espeto", unidade: "un", estoque: 3 },
  { id: "a2", nome: "Refri", unidade: "un" }, // sem controle
] }] };

// Substitui db.pool e db.query por um cliente falso que empilha as queries e
// responde as leituras do fluxo. Restaura no fim, dê certo ou não. Cada teste usa
// um slug diferente: empresaId() tem cache por slug.
function comPoolFalso(pedido, fn) {
  const calls = [];
  const client = {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio: JSON.parse(JSON.stringify(CARDAPIO)) }] };
      if (/FROM pedidos/i.test(sql)) return { rows: [pedido] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const origPool = dbMod.pool, origQuery = dbMod.query;
  dbMod.pool = { connect: async () => client };
  dbMod.query = async (sql, params) => client.query(sql, params);
  return Promise.resolve()
    .then(() => fn(client))
    .finally(() => { dbMod.pool = origPool; dbMod.query = origQuery; });
}

test("cancelarPedido com devolver: devolve na mesma transação, antes do status", async () => {
  await comPoolFalso({ id: 7, numero: 12, itens: [{ id: "a1", qtd: 2 }] }, async (c) => {
    await pedidos.cancelarPedido("/x/tenant-a", 7, { devolver: true });
    const sqls = c.calls.map((q) => q.sql);
    const iIns    = sqls.findIndex((s) => /INSERT INTO estoque_movimentos/i.test(s));
    const iStatus = sqls.findIndex((s) => /UPDATE pedidos SET status = 'cancelado'/i.test(s));
    const iCommit = sqls.findIndex((s) => /^\s*COMMIT/i.test(s));
    assert.ok(iIns > -1, "deveria gravar a devolução");
    assert.ok(iIns < iStatus && iStatus < iCommit, "devolução antes do status, tudo antes do COMMIT");
    const ins = c.calls[iIns];
    assert.equal(ins.params[3], "devolucao");
    assert.equal(ins.params[4], 2);  // quantidade devolvida
    assert.equal(ins.params[5], 5);  // saldo depois: 3 + 2
    assert.equal(ins.params[8], 7);  // pedido_id
  });
});

test("cancelarPedido com devolver=false: cancela sem tocar no estoque", async () => {
  await comPoolFalso({ id: 8, numero: 13, itens: [{ id: "a1", qtd: 2 }] }, async (c) => {
    await pedidos.cancelarPedido("/x/tenant-b", 8, { devolver: false });
    assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
    assert.ok(c.calls.some((q) => /UPDATE pedidos SET status = 'cancelado'/i.test(q.sql)));
  });
});

test("cancelarItemPedido devolve só o item cancelado", async () => {
  const ped = { id: 9, numero: 14, itens: [{ id: "a1", qtd: 2 }, { id: "a2", qtd: 1 }], taxa_entrega: 0, desconto: 0 };
  await comPoolFalso(ped, async (c) => {
    await pedidos.cancelarItemPedido("/x/tenant-c", 9, 0, { devolver: true });
    const ins = c.calls.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.equal(ins.params.length, 12); // um movimento só
    assert.equal(ins.params[1], "a1");
    assert.equal(ins.params[4], 2);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA (hoje `cancelarPedido` não abre transação e não devolve nada).

- [ ] **Passo 3: Implementar**

`cancelarPedido` passa a abrir transação, ler os itens do pedido, devolver quando pedido, e só
então marcar `status='cancelado'`. A devolução vai **antes** do `UPDATE` de status e dentro da
mesma transação, para nunca existir pedido cancelado sem estoque devolvido:

```js
async function cancelarPedido(dir, pedidoId, { devolver = true } = {}) {
  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `SELECT id, numero, itens FROM pedidos
        WHERE empresa_id = $1 AND id = $2 AND recebido_em IS NULL AND status <> 'cancelado' FOR UPDATE`,
      [empId, pedidoId]
    );
    if (!r.rows[0]) throw new Error("Pedido não encontrado, já recebido ou já cancelado.");
    if (devolver) {
      await store.devolverEstoqueTx(client, dir, r.rows[0].itens || [], {
        pedidoId: r.rows[0].id, numero: r.rows[0].numero, obs: "Pedido cancelado",
      });
    }
    await client.query("UPDATE pedidos SET status = 'cancelado' WHERE id = $1", [pedidoId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

`cancelarItemPedido` recebe o mesmo tratamento, devolvendo **apenas** o item do índice
cancelado (`[itens[itemIdx]]`) antes de regravar o jsonb do pedido.

Após o `COMMIT`, sincronizar o cache: `store.sincronizarCardapio(dir, cardapioNovo)` com o
retorno de `devolverEstoqueTx`.

Nas duas rotas (`src/servidor.js:1848` e `:1867`), ler `const devolver = req.body?.devolver !== false;`
e repassar.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test && npm run check`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/pedidos.js src/servidor.js test/pedidos-devolucao.test.js
git commit -m "feat(estoque): cancelar pedido devolve ao estoque"
```

---

### Task 12: Cancelamento devolve em `mesas-db.js`

**Files:**
- Modify: `src/mesas-db.js:284-300`, `src/mesas-db.js:449-470`, `src/servidor.js:2454`
- Test: `test/mesas-devolucao.test.js` (novo)

**Interfaces:**
- Consumes: `store.devolverEstoqueTx` (Task 7).
- Produces: `cancelar(dir, id, { devolver })` e `cancelarItem(dir, mesaId, pedidoId, itemIdx, { devolver })`.

- [ ] **Passo 1: Escrever os testes que falham**

Criar `test/mesas-devolucao.test.js`, copiando o helper `comPoolFalso` da Task 11 (a branch
`FROM pedidos` passa a devolver **a lista inteira** de pedidos abertos, `{ rows: pedidosRows }`):

```js
test("mesas.cancelar devolve os itens de TODOS os pedidos abertos da mesa", async () => {
  const abertos = [
    { id: 21, numero: 30, itens: [{ id: "a1", qtd: 1 }] },
    { id: 22, numero: 31, itens: [{ id: "a1", qtd: 2 }] },
  ];
  await comPoolFalso(abertos, async (c) => {
    await mesasDb.cancelar("/x/tenant-m1", 5, { devolver: true });
    const ins = c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.equal(ins.length, 2); // um por pedido, cada movimento amarrado ao seu
    assert.deepEqual(ins.map((q) => q.params[8]), [21, 22]);
  });
});

test("mesas.cancelarItem devolve só o item removido da comanda", async () => {
  const ped = [{ id: 23, numero: 32, itens: [{ id: "a1", qtd: 2 }, { id: "a2", qtd: 1 }] }];
  await comPoolFalso(ped, async (c) => {
    await mesasDb.cancelarItem("/x/tenant-m2", 5, 23, 0, { devolver: true });
    const ins = c.calls.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.equal(ins.params[1], "a1");
    assert.equal(ins.params[4], 2);
  });
});

test("mesas.cancelar com devolver=false não grava movimento", async () => {
  await comPoolFalso([{ id: 24, numero: 33, itens: [{ id: "a1", qtd: 1 }] }], async (c) => {
    await mesasDb.cancelar("/x/tenant-m3", 6, { devolver: false });
    assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA.

- [ ] **Passo 3: Implementar**

`cancelar` hoje roda um `UPDATE` que alcança vários pedidos de uma vez. Passa a: abrir
transação, `SELECT id, numero, itens ... FOR UPDATE` dos pedidos abertos da mesa, devolver os
itens de cada um (uma chamada de `devolverEstoqueTx` por pedido, para o movimento sair amarrado
ao pedido certo), marcar todos como cancelados e liberar a mesa, tudo na mesma transação.

`cancelarItem` já lê o pedido antes; acrescentar a devolução do item removido antes de regravar
o jsonb, na mesma transação.

Na rota `src/servidor.js:2454`, ler `devolver` do corpo e repassar.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test && npm run check`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/mesas-db.js src/servidor.js test/mesas-devolucao.test.js
git commit -m "feat(estoque): cancelar mesa e item da comanda devolve ao estoque"
```

---

### Task 13: Cancelamento devolve em `caixa.cancelarRecebido`

**Files:**
- Modify: `src/caixa.js:287-332`, `src/servidor.js:1848`
- Test: `test/caixa-devolucao.test.js` (novo)

**Interfaces:**
- Consumes: `store.devolverEstoqueTx` (Task 7).
- Produces: `cancelarRecebido(dir, pedidoId, { devolver })`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `test/caixa-devolucao.test.js`. O falso precisa de mais branches porque a função lê o
caixa aberto e o líquido por forma antes de cancelar:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbMod = require("../src/db");
const caixa = require("../src/caixa");

const CARDAPIO = { categorias: [{ nome: "Cat", itens: [
  { id: "a1", nome: "Espeto", unidade: "un", estoque: 3 },
] }] };

test("cancelarRecebido devolve ao estoque dentro da MESMA transação do caixa", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
      if (/FROM caixas/i.test(sql)) return { rows: [{ id: 3, aberto_em: new Date(), fechado_em: null }] };
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio: JSON.parse(JSON.stringify(CARDAPIO)) }] };
      if (/FROM pedidos/i.test(sql)) return { rows: [{ id: 41, numero: 50, status: "recebido", itens: [{ id: "a1", qtd: 2 }] }] };
      if (/SUM\(/i.test(sql)) return { rows: [{ forma: "Dinheiro", valor: 30 }] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const origPool = dbMod.pool, origQuery = dbMod.query;
  dbMod.pool = { connect: async () => client };
  dbMod.query = async (sql, params) => client.query(sql, params);
  try {
    await caixa.cancelarRecebido("/x/tenant-cx", 41, { devolver: true });
    const sqls = calls.map((q) => q.sql);
    const iCaixa  = sqls.findIndex((s) => /INSERT INTO caixa_movimentos/i.test(s));
    const iDev    = sqls.findIndex((s) => /INSERT INTO estoque_movimentos/i.test(s));
    const iStatus = sqls.findIndex((s) => /UPDATE pedidos SET status = 'cancelado'/i.test(s));
    const iCommit = sqls.findIndex((s) => /^\s*COMMIT/i.test(s));
    assert.ok(iCaixa > -1 && iDev > -1, "deveria deduzir do caixa e devolver ao estoque");
    assert.ok(iCaixa < iDev && iDev < iStatus && iStatus < iCommit,
      "tudo na mesma transação, com o status por último");
    assert.equal(calls[iDev].params[3], "devolucao");
    assert.equal(calls[iDev].params[8], 41); // pedido_id
  } finally {
    dbMod.pool = origPool;
    dbMod.query = origQuery;
  }
});
```

> Se alguma leitura da função real não casar com as branches acima, ajustar a branch (a
> asserção que importa é a **ordem** das escritas dentro da transação).

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA.

- [ ] **Passo 3: Implementar**

A função já é transacional. Acrescentar, depois de inserir o movimento de `cancelamento` no
caixa e antes do `UPDATE pedidos SET status = 'cancelado'`:

```js
    if (devolver) {
      const novoCardapio = await store.devolverEstoqueTx(client, dir, ped.rows[0].itens || [], {
        pedidoId: ped.rows[0].id, numero: ped.rows[0].numero, obs: "Pedido pago cancelado",
      });
      cardapioParaCache = novoCardapio;
    }
```

O `SELECT` do pedido que já existe precisa trazer `itens` e `numero`. Após o `COMMIT`,
`store.sincronizarCardapio(dir, cardapioParaCache)` quando houver.

Na rota de cancelar (`src/servidor.js:1848`), repassar `devolver` também no ramo do pedido pago.

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npm test && npm run check`
Esperado: PASSA.

- [ ] **Passo 5: Commit**

```bash
git add src/caixa.js src/servidor.js test/caixa-devolucao.test.js
git commit -m "feat(estoque): cancelar pedido pago devolve ao estoque"
```

---

### Task 14: Caixinha "devolver ao estoque" na confirmação

**Files:**
- Modify: `public/admin.html` (modal de confirmação), `public/app.js:135-181`, `public/style.css`

**Interfaces:**
- Consumes: as rotas das Tasks 11 a 13, que aceitam `{ devolver }`.
- Produces: `confirmarComOpcao(titulo, mensagem, rotuloOpcao, txtConfirmar) -> Promise<false | { opcao: boolean }>`
  em `public/app.js`, reusando o mesmo `#modal-overlay`.

- [ ] **Passo 1: Acrescentar a caixinha ao modal**

Em `public/admin.html`, dentro do bloco do `#modal-overlay`, entre a mensagem e os botões:

```html
<label class="modal-opcao" id="modal-opcao-wrap" hidden>
  <input type="checkbox" id="modal-opcao" checked />
  <span id="modal-opcao-texto"></span>
</label>
```

- [ ] **Passo 2: Implementar a função**

Em `public/app.js`, ao lado de `confirmar()` (que continua como está):

```js
// Confirmação com UMA caixinha opcional (ex.: "devolver ao estoque"), marcada por
// padrão. Devolve false se cancelou, ou { opcao: boolean } se confirmou. Reusa o
// mesmo modal do confirmar() — a caixinha some de novo ao fechar.
function confirmarComOpcao(titulo, mensagem, rotuloOpcao, txtConfirmar = "Confirmar") {
  const wrap = $("modal-opcao-wrap");
  const check = $("modal-opcao");
  $("modal-opcao-texto").textContent = rotuloOpcao;
  check.checked = true;
  wrap.hidden = false;
  return confirmar(titulo, mensagem, txtConfirmar).then((ok) => {
    const marcado = check.checked;
    wrap.hidden = true;
    return ok ? { opcao: marcado } : false;
  });
}
```

O focus-trap de `confirmar()` circula entre dois botões; com a caixinha visível ela entra no
meio. Ajustar `onKey` para montar a lista de focáveis dinamicamente:

```js
      const foco = [$("modal-cancelar"), $("modal-confirmar")];
      if (!$("modal-opcao-wrap").hidden) foco.splice(1, 0, $("modal-opcao"));
```

e circular por essa lista (Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao último).

- [ ] **Passo 3: Trocar as chamadas de cancelamento**

Nos pontos onde hoje se chama `confirmar()` para cancelar pedido (`public/app.js:4505`), item do
pedido (`:4418`), mesa e item da comanda, usar `confirmarComOpcao` com o rótulo
**"Devolver os itens ao estoque"** e enviar `{ devolver: r.opcao }` no corpo do `POST`.

Texto do produto, sem travessão e sem emoji, por exemplo: *"O pedido fica marcado como
cancelado. Se os itens não foram preparados, deixe a devolução marcada para o estoque voltar ao
que era."*

- [ ] **Passo 4: Estilo**

Em `public/style.css`, `.modal-opcao` como linha de caixinha alinhada à esquerda, com o mesmo
espaçamento e tipografia dos demais rótulos do modal (reusar tokens existentes, sem cor nova).

- [ ] **Passo 5: Validar no navegador**

Rodar: `npm start`, abrir um pedido de teste, cancelar com a caixinha marcada e depois
desmarcada. Conferir no extrato do produto que a primeira gerou devolução e a segunda não.
Conferir Esc, Tab circulando entre os três elementos, e o foco voltando ao botão de origem.

- [ ] **Passo 6: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(estoque): caixinha de devolucao na confirmacao de cancelamento"
```

---

### Task 15: Retenção do histórico

**Files:**
- Modify: `index.js`

**Interfaces:**
- Consumes: `estoqueDb.limparAntigos` (Task 4).
- Produces: faxina diária, no mesmo formato das quatro que já rodam.

- [ ] **Passo 1: Implementar**

Depois do bloco de incidentes em `index.js`:

```js
// Retenção do histórico de estoque: apaga movimento com mais de 12 meses. Seguro
// porque o SALDO mora no jsonb do cardápio, não na soma das linhas — apagar
// histórico velho não altera número nenhum. Global, idempotente. Boot + 24h.
const MESES_RETENCAO_ESTOQUE = 12;
async function limparEstoque() {
  try {
    const n = await estoqueDb.limparAntigos(MESES_RETENCAO_ESTOQUE);
    if (n > 0) console.log(`🧹 Estoque: ${n} movimento(s) > ${MESES_RETENCAO_ESTOQUE} meses apagado(s).`);
  } catch (e) {
    console.error("Retenção de estoque falhou (ignorado):", e.message);
  }
}
setTimeout(limparEstoque, 105_000);              // 105s após o boot
setInterval(limparEstoque, 24 * 60 * 60 * 1000); // a cada 24h
```

E `const estoqueDb = require("./src/estoque-db");` no topo.

- [ ] **Passo 2: Conferir**

Rodar: `npm run check && npm start`
Esperado: o app sobe sem erro e sem log de falha na faxina.

- [ ] **Passo 3: Commit**

```bash
git add index.js
git commit -m "feat(estoque): retencao de 12 meses do historico de movimentacao"
```

---

### Task 16: Protótipo da tela no Stitch

**Files:**
- Nenhum arquivo de código.

**Interfaces:**
- Consumes: o design system do projeto já gravado no Stitch.
- Produces: protótipo aprovado pelo dono, que guia as Tasks 17 e 18.

- [ ] **Passo 1: Gerar**

Gerar no Stitch MCP, reusando o `designSystem` do projeto (não criar outro), duas telas: a
lista com filtros e a gaveta com extrato. Descrever a lista com produto, categoria, selo,
quantidade em corpo grande, mínimo e as três ações, mais a sub-linha recuada de variação e a
linha apagada de produto sem controle.

- [ ] **Passo 2: Conferir contraste**

Calcular o contraste dos selos (Esgotado, Baixo) sobre o fundo e avisar o dono se algum
reprovar, com alternativa.

- [ ] **Passo 3: Mostrar e aguardar aprovação**

**Não seguir para a Task 17 sem o "ok" do dono.** Ajustar desenho é barato; refazer tela
implementada não.

---

### Task 17: Tela de Controle de estoque (lista e filtros)

**Files:**
- Modify: `public/admin.html:73-77`, `public/app.js`, `public/style.css`

**Interfaces:**
- Consumes: `GET /api/estoque` (Task 9), protótipo aprovado (Task 16).
- Produces: aba `aba-estoque` funcional, com `carregarEstoque()` e `renderEstoque()` em
  `public/app.js`, seguindo o padrão de `carregarComplementos`/`renderComplementos`.

- [ ] **Passo 1: Ativar o item do menu**

Em `public/admin.html:73-77`, tirar a `nav-tag` "Em breve" do botão de Controle de estoque e
dar a ele `data-aba="estoque"`, como os vizinhos Categorias e Complementos.

- [ ] **Passo 2: Marcar a seção**

Acrescentar `<section class="aba" id="aba-estoque">` com cabeçalho (título "Controle de
estoque" e subtítulo curto), a faixa de contadores, a busca, os chips de filtro
(Só controlados / Todos / Esgotados / Baixo) e o container `<div id="estoque-lista"></div>`.
Sem `<script>` inline e sem handler inline.

- [ ] **Passo 3: Implementar o carregamento e a renderização**

Em `public/app.js`, seguindo o padrão das abas existentes: `carregarEstoque()` busca
`/api/estoque`, guarda em variável de módulo, e `renderEstoque()` aplica busca e filtro e monta
as linhas. Estados obrigatórios: esqueleto enquanto carrega, vazio apontando para o Cardápio,
erro com botão de tentar de novo, e o convite de plano quando a rota responder 403.
Quantidade sai por `Estoque.formatarQtd(q, unidade)`.

- [ ] **Passo 4: Validar no navegador**

Rodar: `npm start`. Conferir a lista completa, o filtro abrindo em "Só controlados", a busca, os
contadores clicando como filtro, a sub-linha de variação e o produto sem controle apagado.
Conferir no celular (largura de 390px) que a linha não quebra.

- [ ] **Passo 5: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(estoque): tela de controle de estoque com lista e filtros"
```

---

### Task 18: Gaveta com extrato e as três ações

**Files:**
- Modify: `public/admin.html`, `public/app.js`, `public/style.css`

**Interfaces:**
- Consumes: `GET /api/estoque/movimentos`, `POST /api/estoque/movimentos`,
  `POST /api/estoque/minimo` (Tasks 9 e 10).
- Produces: gaveta `#estoque-gaveta`, no mesmo padrão da gaveta de Complementos.

- [ ] **Passo 1: Marcar a gaveta**

Fora da `<section>` da aba (como a gaveta de Complementos, que fica fora por ser usada de mais
de um lugar): cabeçalho com nome do produto e saldo em destaque, campo de mínimo, três botões
(Entrada, Perda, Contagem), bloco de resumo dos últimos 30 dias e lista do extrato com botão
"Carregar mais".

- [ ] **Passo 2: Implementar o extrato**

`abrirGavetaEstoque(linha)` busca `/api/estoque/movimentos`, monta o resumo e as linhas. Cada
linha traz data, o rótulo do tipo, a quantidade com sinal e o saldo que ficou. Movimento com
`pedidoId` mostra o número e abre o modal do pedido ao clicar. "Carregar mais" usa o `criadoEm`
do último item como cursor `antes`.

- [ ] **Passo 3: Implementar os três lançamentos**

Entrada e Perda pedem quantidade e observação opcional. Contagem pede o contado e mostra a
diferença calculada **antes** de confirmar, por exemplo *"Você contou 7. O sistema tinha 9. Vai
registrar menos 2."*. Depois de gravar, atualizar o saldo na linha da lista e recarregar o
extrato sem fechar a gaveta.

O botão **Controlar**, do produto sem controle, abre a mesma gaveta em modo contagem, pedindo
quantidade inicial e mínimo.

- [ ] **Passo 4: Validar no navegador**

Rodar: `npm start`. Lançar entrada, perda e contagem num produto de teste; conferir que o saldo
muda na lista, que o extrato mostra as três linhas na ordem certa e que a venda feita pelo
cardápio web aparece no extrato com o número do pedido. Conferir Esc fechando a gaveta, foco
voltando à linha de origem e o comportamento no celular.

- [ ] **Passo 5: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(estoque): gaveta com extrato e lancamento de movimento"
```

---

### Task 19: Documentação e fechamento

**Files:**
- Modify: `CLAUDE.md`, `docs/modelo-dados.md`, `docs/planos-e-frete.md`, `PROGRESSO.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: tudo acima.
- Produces: documentação em dia e a etapa 3/4 fechada com os desdobramentos abertos.

- [ ] **Passo 1: `CLAUDE.md`**

Acrescentar `src/estoque-db.js` à árvore de arquitetura, com uma linha sobre a responsabilidade
dele, e citar a tela de Controle de estoque na linha do `servidor.js`. Manter o arquivo enxuto
(alvo de ~200 linhas): o detalhe vai para `docs/`.

- [ ] **Passo 2: `docs/modelo-dados.md`**

Documentar a tabela `estoque_movimentos`, os seis tipos de movimento, a identidade de
reconciliação e o motivo de a venda não ser derivada de `itens_venda`.

- [ ] **Passo 3: `docs/planos-e-frete.md`**

Acrescentar Controle de estoque à lista de recursos do Plano Completo, com o gate usado.

- [ ] **Passo 4: `CHANGELOG.md`**

Novo marco descrevendo o efeito observável: tela de estoque com histórico, e cancelamento
passando a devolver.

- [ ] **Passo 5: `PROGRESSO.md`**

Mover a etapa 3/4 para ✅ Concluído e **abrir item em 📋 Próximos Passos para cada
desdobramento**, no mínimo:

- **(P1) Split de Produtos 4/4: Insumos** (já existe; conferir se o texto continua válido).
- **(P2) Estoque por opção de complemento** — o "Bacon" que acaba. Ficou fora desta etapa e
  depende do `id` estável de opção; entra junto de Insumos.
- **(P2) Extrato geral do restaurante** — hoje só existe extrato por produto.
- **(P2) Validar no navegador com caixa aberto** — se a validação do PDV/Mesas não tiver sido
  possível, registrar o empecilho.

- [ ] **Passo 6: Commit**

```bash
git add CLAUDE.md docs/modelo-dados.md docs/planos-e-frete.md CHANGELOG.md PROGRESSO.md
git commit -m "docs(estoque): documenta a trilha de movimentacao e fecha a etapa 3/4"
```

---

## Ordem de deploy

1. **Task 1 em produção primeiro** (`npx supabase db push`). Sem a tabela, a Task 5 derruba
   toda venda.
2. Tasks 2 a 15 (backend) podem ir juntas.
3. Tasks 16 a 18 (tela) depois, com o protótipo aprovado antes de codar.
4. **Teste de fumaça logo após o deploy do backend:** fazer uma venda real de um produto
   controlado e conferir que ela aparece no extrato com o número do pedido.

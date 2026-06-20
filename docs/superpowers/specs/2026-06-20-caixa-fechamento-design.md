# Caixa / Fechamento do dia — Design

**Data:** 2026-06-20
**Plano:** exclusivo do **Plano Completo** (Essencial mantém as funções básicas)
**Status:** design aprovado, aguardando plano de implementação

## Problema

Hoje o pedido nasce no WhatsApp com `status: "novo"` e uma **forma de pagamento declarada**
(`pedidos.pagamento`), mas **nunca há registro de que o dinheiro entrou** — não existe fluxo de
**recebimento** nem de **fechamento de caixa**. Num negócio **delivery-first**, o dinheiro chega
**depois** do pedido (na entrega/retirada ou Pix confirmado), então o caixa precisa de um evento de
recebimento separado da criação do pedido, e o fechamento precisa conciliar o **dinheiro físico** da
gaveta com o esperado.

## Escopo

### Dentro do v1

- **Caixa/fechamento do dia** com conferência de dinheiro físico (não é PDV de balcão — venda
  presencial fica para a feature de PDV/mesas, depois).
- **Recebimento por pedido (explícito):** o pedido só entra no caixa quando o operador marca
  **Receber** (forma e valor pré-preenchidos do pedido, editáveis); estornável antes do fechamento.
- **Abertura** com fundo de troco; **sangria** (retirada) e **suprimento** (reforço) de dinheiro.
- **Fechamento** com cálculo do esperado em espécie, contagem informada e **diferença** (sobra/falta).
- **Histórico** de caixas fechados.
- **Exclusivo do Plano Completo** (gate no front **e** no backend — é recurso de servidor).

### Fora do v1 (futuro)

- PDV de balcão / venda presencial / mesas (feature à parte).
- Múltiplos operadores/turnos simultâneos (hoje há **1 conta por tenant** → 1 operador).
- "Caixa do entregador" (float de dinheiro em poder do entregador).
- Integração com gaveta física / impressão do relatório de fechamento (depende do **agente local** —
  ver ROADMAP).
- Pagamento online de verdade (gateway do cliente).

## Conceito e fluxo

1. **Abrir caixa** — operador informa o **fundo de troco** (dinheiro inicial). Só **1 caixa aberto por
   vez** por tenant.
2. **Pedido "a receber"** — vem do WhatsApp com forma declarada; sem dinheiro registrado.
3. **Receber** — operador clica **Receber** no pedido quando o dinheiro entra. Forma e valor vêm do
   pedido (editáveis p/ troco/gorjeta/parcial) → cria um **movimento de recebimento** no caixa aberto
   e marca o pedido como **recebido**. Exige caixa aberto; **estornável** antes do fechamento.
4. **Sangria / Suprimento** — retira/reforça **dinheiro** na gaveta (valor + motivo). Só espécie.
5. **Fechar caixa** — calcula **esperado em espécie** = `fundo + recebido em dinheiro + suprimentos −
   sangrias`. Mostra **recebido por forma** (Pix/cartão só no relatório, não na gaveta). Operador
   **conta a gaveta** e informa → sistema mostra a **diferença** e fecha.
6. **Histórico** — caixas fechados com detalhe.

**Regra-chave:** a forma **"Dinheiro"** (match case-insensitive em `forma_pagamento`) é a que conta na
conferência física; as demais somam no relatório, mas não na contagem da gaveta.

## Modelo de dados

Migration nova em `supabase/migrations/` (sem tocar no fluxo do bot).

### Tabela `caixas`

```sql
create table public.caixas (
  id               bigint generated always as identity primary key,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  aberto_em        timestamptz not null default now(),
  fechado_em       timestamptz,
  fundo_troco      numeric(10,2) not null default 0,
  status           text not null default 'aberto',   -- 'aberto' | 'fechado'
  contado_dinheiro numeric(10,2),                     -- informado no fechamento
  diferenca        numeric(10,2),                     -- contado − esperado_especie (no fechamento)
  observacao       text
);
-- No máximo 1 caixa aberto por empresa:
create unique index caixas_um_aberto_por_empresa
  on public.caixas (empresa_id) where (status = 'aberto');
```

### Tabela `caixa_movimentos`

```sql
create table public.caixa_movimentos (
  id              bigint generated always as identity primary key,
  caixa_id        bigint not null references public.caixas(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null,                 -- 'recebimento' | 'sangria' | 'suprimento'
  forma_pagamento text,                          -- preenchido p/ recebimento; null p/ sangria/suprimento
  valor           numeric(10,2) not null,
  pedido_id       bigint references public.pedidos(id) on delete set null,
  descricao       text,                          -- motivo (sangria/suprimento)
  criado_em       timestamptz not null default now()
);
```

### Coluna em `pedidos`

```sql
alter table public.pedidos add column recebido_em timestamptz;  -- null = a receber
```

`recebido_em` é o flag rápido "a receber × recebido" (evita join na listagem). O detalhe real
(forma/valor recebidos, que podem diferir do declarado) vive no movimento, preservando
`pedidos.pagamento`/`pedidos.total`.

RLS: seguir o hardening atual (revoke anon/authenticated; acesso só pelo backend privilegiado).

## Backend

### `src/caixa-calc.js` (PURO — testável)

Sem dependência de banco; recebe dados e devolve números.

- `resumoCaixa(caixa, movimentos)` → `{ recebidoPorForma: {forma: valor}, totalRecebido,
  recebidoDinheiro, suprimentos, sangrias, esperadoEspecie }`.
  - `recebidoDinheiro` = soma dos recebimentos cuja forma é "Dinheiro" (case-insensitive).
  - `esperadoEspecie` = `fundo_troco + recebidoDinheiro + suprimentos − sangrias`.
- `calcularDiferenca(esperadoEspecie, contadoDinheiro)` → `contado − esperado` (>0 sobra, <0 falta).

### `src/caixa.js` (async — orquestra o banco, usa `caixa-calc`)

- `caixaAberto(dir)` → o caixa aberto atual (ou null).
- `abrirCaixa(dir, { fundoTroco })` → cria caixa aberto; erro se já houver um aberto.
- `receberPedido(dir, pedidoId, { forma, valor })` → exige caixa aberto; cria movimento
  `recebimento` (com `pedido_id`) e seta `pedidos.recebido_em = now()`. Erro se o pedido já estiver
  recebido ou não pertencer ao tenant.
- `estornarRecebimento(dir, pedidoId)` → remove o movimento de recebimento e zera `recebido_em`
  (só com caixa **aberto**; bloqueado após o fechamento).
- `registrarMovimento(dir, { tipo, valor, descricao })` → `sangria`/`suprimento`; exige caixa aberto.
- `resumo(dir)` → dados do caixa aberto + `resumoCaixa(...)` + listas (pedidos a receber / recebidos).
- `fecharCaixa(dir, { contadoDinheiro, observacao })` → calcula `esperadoEspecie` e `diferenca`,
  grava `contado_dinheiro`/`diferenca`/`fechado_em`/`status='fechado'`.
- `listarCaixas(dir)` / `detalheCaixa(dir, caixaId)` → histórico.

### Rotas (`src/servidor.js`, `exigeAuth`, **gated por plano**)

`POST /api/caixa/abrir`, `GET /api/caixa` (resumo do aberto), `POST /api/caixa/receber/:pedidoId`,
`POST /api/caixa/estornar/:pedidoId`, `POST /api/caixa/movimento` (sangria/suprimento),
`POST /api/caixa/fechar`, `GET /api/caixa/historico`, `GET /api/caixa/:id`.

**Gate de plano:** novo helper `empresas.temCaixa(emp)` = `acessoLiberado(emp) && plano === "completo"`
(mesmo padrão de `temFreteRaio`). As rotas do caixa retornam **403** se `!temCaixa` — diferente da
impressão (que é local e só gateia no front); o caixa é **recurso de servidor**, então o backend
também barra.

## UI (`public/admin.html` + `public/app.js` + `public/style.css`)

- Novo item **"Caixa"** na sidebar (e bottom-nav mobile). No **Essencial** o item aparece **com
  cadeado/upsell** (padrão frete/impressão), servindo de gancho de upgrade; no Completo, abre normal.
- **Aba Caixa:**
  - *Sem caixa aberto:* card "Abrir caixa" (campo **fundo de troco**, via `dinheiro.js`).
  - *Caixa aberto:* cabeçalho (aberto desde, fundo); **resumo ao vivo** (recebido por forma,
    sangrias/suprimentos, esperado em espécie); botões **Sangria** e **Suprimento** (modal: valor +
    motivo); lista de **pedidos a receber** (botão **Receber** → modal com forma/valor pré-preenchidos)
    e **recebidos** (botão **Estornar**); botão **Fechar caixa** (modal de conferência: mostra o
    esperado em espécie, campo **contado**, calcula **diferença**, confirma).
  - **Histórico** de caixas fechados (lista → detalhe).
- Atalho **"Receber pagamento"** no modal de detalhe do pedido (aba Pedidos), chamando o mesmo
  endpoint de `receber`.
- Campos monetários sempre via `dinheiro.js`; CSP estrita (JS externo, sem inline).

## Regras / casos de borda

- **Receber sem caixa aberto** → bloqueia e sugere abrir o caixa.
- **Receber pedido já recebido** → bloqueia (idempotência).
- **Fechar com pedidos ainda "a receber"** → avisa (quantos), mas **permite** fechar.
- **Estorno** só com caixa aberto; após o fechamento, o caixa é imutável.
- **Dinheiro de delivery** → assume-se que o operador marca **Receber** quando o dinheiro está em
  mãos (não modelamos o float do entregador no v1).
- **Isolamento:** toda query filtra por `empresa_id` (padrão atual); `receber/estornar` valida que o
  pedido pertence ao tenant e ao caixa aberto.
- **Forma "Dinheiro"** identificada por nome (case-insensitive). Documentado como suposição; se o
  tenant usar outro rótulo para espécie, só essa forma conta na gaveta.

## Testes

- **`node:test` (`test/caixa-calc.test.js`)** — funções puras: `resumoCaixa` (recebido por forma,
  recebido em dinheiro, esperado em espécie com fundo+suprimento−sangria), `calcularDiferenca`
  (sobra/falta/zero), forma "Dinheiro" case-insensitive, caixa sem movimentos.
- **Playwright** — fluxo E2E (conta Completo): abrir caixa → receber 2 pedidos (dinheiro + Pix) →
  suprimento + sangria → fechar com contagem → diferença correta; e gate (Essencial → 403 / cadeado).
- `npm run check` + suíte existente verdes.

## Documentação (parte da entrega)

- `PROGRESSO.md` (→ Concluído), `ROADMAP.md` (Fase 1 "Caixa / fechamento" → entregue),
  `CLAUDE.md` (módulos `caixa.js`/`caixa-calc.js`, tabelas, gate `temCaixa`),
  `docs/planos-e-frete.md` (Caixa como 3º benefício do Completo), `CHANGELOG.md` (marco observável),
  `docs/modelo-dados.md` (tabelas `caixas`/`caixa_movimentos` + `pedidos.recebido_em`).

## Decisões travadas

- Caixa **Completo-only** (gate front + back).
- **Recebimento por pedido** explícito (não automático), estornável antes do fechamento.
- **Fechamento com conferência de dinheiro físico** (fundo + sangria/suprimento + contagem + diferença);
  Pix/cartão só no relatório.
- **1 caixa aberto por vez** por tenant; 1 operador (a conta do tenant).
- Cálculos puros em `caixa-calc.js`; orquestração em `caixa.js`; **migration nova** (2 tabelas + 1 coluna).

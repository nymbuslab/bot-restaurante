# Unidade de medida (un/kg) — Design

**Data:** 2026-06-22
**Escopo:** Item do cardápio pode ser vendido por **unidade** (un) ou por **peso** (kg).
Item por kg é **informativo na vitrine** (preço por kg, não-adicionável) e vendido só no
local. Etapa **3b de 3** do cardápio (1. lista+busca ✓, 2. só-local ✓, 3a. estoque ✓).

## Problema

Pratos de self-service/buffet são vendidos **por kg**, pesados no balcão. Hoje todo item é
tratado por **unidade inteira**, e não há como mostrar "R$ X/kg" nem deixar claro que o item
não se pede por peso online.

## Objetivo

- Marcar a **unidade** do item (un/kg).
- Item **kg**: preço exibido como **"R$ X/kg"**; estoque/mínimo em **kg** (aceita decimal);
  na vitrine aparece com nota **"Pesado no balcão"** e **não é adicionável**; nunca entra em
  pedido online (servidor rejeita).
- Item **un**: comportamento atual, sem mudança.

## Não-objetivos (YAGNI)

- **Sem** pedido por peso (cliente não digita gramas). Decisão de produto: kg é informativo.
- **Sem** baixa automática de estoque para kg (não há pedido online de kg).
- **Sem** outras unidades (L, dúzia…). Só un e kg.
- **Sem** migration (campo no jsonb).

## Modelo de dados

Novo campo no item: `unidade` (`'un'` | `'kg'`). **Ausente/`'un'` = unidade** (default,
compatível com tudo que existe). `'kg'` = vendido por peso. Gravado **só quando kg** (item un
não guarda o campo).

## Componentes

### 1. Helpers puros (`public/estoque.js`)

- `statusEstoque(item)` passa a **respeitar a unidade**: para kg, parseia `estoque`/
  `estoqueMinimo` como **decimal** (parseFloat, vírgula→ponto); para un, inteiro (parseInt).
  Retorna também `unidade` (`'un'`/`'kg'`) no objeto.
- Novo `formatarQtd(quantidade, unidade) -> string`: un → inteiro ("120"); kg → decimal BR
  ("12,5", sem zeros à toa).
- `aplicarBaixa`/`validarEstoque` **não mudam** — itens kg nunca chegam lá (rejeitados no
  recálculo).

### 2. Modal do item (`public/admin.html` + `public/app.js`)

- Seletor **Unidade** (un / kg) perto dos campos de estoque (segmentado de 2 opções, padrão
  `.linha`/segmented já usado).
- `abrirEditorItem`: marca o seletor conforme `it.unidade` (default un).
- `salvarEditorItem`: grava `unidade: 'kg'` quando kg (omite quando un). Parse do estoque:
  **decimal** quando kg, inteiro quando un.
- Microtexto quando kg: *"Item por kg: aparece no cardápio com o preço por kg e é vendido só
  no local (pesado no balcão) — não entra em pedido online."* O toggle "Disponível para
  entrega" fica **desabilitado** (não se aplica a item não-pedível).

### 3. Lista de itens — unidade dinâmica (`public/app.js` `renderCardapio`)

- **Preço:** un → "R$ 18,00"; kg → "R$ 59,90<small>/kg</small>".
- **Estoque/Mínimo:** o sufixo (hoje fixo "un") passa a ser `est.unidade` ("un"/"kg"), e o
  número usa `formatarQtd` (decimal no kg). Item não controlado segue "—".

### 4. Projeção pública (`src/cardapio-web.js`)

- `projetarCardapio`: **mantém** o item kg (é informativo) e expõe `unidade`.
- `recalcularItens`: **rejeita** item `unidade === 'kg'` (como arquivado/indisponível) — kg
  nunca entra em pedido.

### 5. Vitrine pública (`public/cardapio.js` + `public/cardapio.css`)

- Item kg: preço como **"R$ X/kg"**; nota **"Pesado no balcão"** (chip); **não-adicionável**
  (reusa o tratamento do `esgotado`: card vira `div`, sem "+ Adicionar", clique não abre o
  modal). Diferente do esgotado só no texto da nota.
- Prioridade quando kg E esgotado: como kg não baixa estoque, o normal é não ficar esgotado;
  se ambos, mostrar "Esgotado" (estado mais forte). (Borda rara.)

## Fluxo de dados

1. Dono escolhe unidade no modal → `PUT /api/cardapio` grava `unidade` (só se kg).
2. Lista e vitrine exibem preço/estoque com a unidade certa.
3. Vitrine: kg aparece informativo, não-adicionável.
4. Pedido com item kg (cliente burlando o front) → servidor rejeita no recálculo.

## Tratamento de erros / bordas

- **Item un (sem `unidade`):** tudo como hoje (default un).
- **Estoque decimal só no kg:** o modal parseia decimal quando kg; para un, inteiro (um item
  un não tem "12,5 unidades").
- **kg não baixa estoque:** como não entra em pedido, `aplicarBaixa` nunca o toca; o estoque
  do kg é manual/informativo.
- **kg + indisponível/arquivado:** seguem as regras existentes (fora da vitrine).

## Validação

- `npm run check` e `npm test` (com testes novos) passam.
- **Testes (puros):**
  - `statusEstoque`: kg parseia decimal e devolve `unidade: 'kg'`; un inteiro.
  - `formatarQtd`: un inteiro; kg "12,5".
  - `recalcularItens`: item kg → lança (não pedível).
  - `projetarCardapio`: item kg **fica** na projeção e expõe `unidade`.
- **Visual (harness/Playwright):** modal com seletor un/kg + microtexto; tabela com item kg
  ("R$ X/kg", "12,5 kg"); vitrine com item kg não-adicionável + "Pesado no balcão".

## Riscos

Baixo-médio. Pontos de atenção: (a) o sufixo de unidade na tabela (etapa 3a) era fixo "un" —
trocar por dinâmico sem quebrar o alinhamento; (b) `statusEstoque` mudar de parseInt para
parse-por-unidade sem afetar os itens un existentes; (c) garantir que kg **não** seja
pedível (teste do recálculo). Sem migration, sem mudar `pedidos`.

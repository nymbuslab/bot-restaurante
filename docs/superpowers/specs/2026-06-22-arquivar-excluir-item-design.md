# Arquivar / excluir item com vendas — Design

**Data:** 2026-06-22
**Escopo:** Proteger a exclusão de itens do cardápio que já têm vendas. Modal de alerta,
**arquivamento** (soft delete) como ação recomendada, "Mostrar arquivados" + restaurar.

## Problema

Hoje, clicar na lixeira de um item **remove na hora, sem confirmação** (a remoção fica
pendente do botão "Salvar cardápio"). Isso é arriscado: excluir um item que já foi
**vendido** pode confundir relatórios/faturamento e remove um item do cardápio sem volta.

Padrão de mercado (Square, Lightspeed, Erply, Shopify): **não se exclui produto com
histórico de vendas — arquiva-se** (inativa), preservando relatório e estoque. O print de
referência do usuário já traz "Mostrar inativos".

> No nosso caso, cada pedido guarda um **snapshot** do item (`pedidos.itens` jsonb com
> id/nome/preço), então excluir **não corrompe** o faturamento já registrado. Mesmo assim
> arquivar é o padrão certo (evita órfãos por-item em relatórios futuros, e é reversível).

## Objetivo

Ao excluir um item:
- **sem vendas** → confirmação simples → exclui de verdade;
- **com vendas** → modal de alerta recomendando **Arquivar** (some do cardápio, preserva
  histórico/estoque), com a opção destrutiva "Excluir mesmo assim";
- itens arquivados ficam fora do cardápio e da vitrine, visíveis sob "**Mostrar
  arquivados**", com **Restaurar**.

## Não-objetivos (YAGNI)

- **Sem** exclusão em massa / lixeira com expiração (hard delete agendado). Fora de escopo.
- **Sem** relatório de vendas por item (só a contagem usada na decisão).
- **Sem** migration: `arquivado` vive no `cardapio` jsonb.

## Modelo de dados

Novo campo no item (jsonb): `arquivado` (boolean). **Ausente/false = ativo.** `true` =
arquivado (fora do cardápio/vitrine, preservado nos dados).

## Componentes

### 1. Detecção de vendas (backend)

- `pedidos.contarVendasDoItem(dir, itemId) -> Promise<number>` — conta pedidos da empresa
  cujo `itens` jsonb contém o id. SQL com containment:
  `SELECT count(*) FROM pedidos WHERE empresa_id = $1 AND itens @> $2::jsonb`, com
  `$2 = JSON.stringify([{ id: itemId }])`.
- Rota `GET /api/cardapio/item/:id/vendas` (sob `exigeAuth`) → `{ vendas: N }`. O front
  chama ao clicar em excluir, para escolher qual modal mostrar.

### 2. Vitrine e pedido — arquivado fica fora (`src/cardapio-web.js`)

- `projetarCardapio`: pular itens `arquivado === true` (como já pula `disponivel === false`).
- `recalcularItens`: tratar item `arquivado` como indisponível (lança "Item indisponível"),
  para um pedido nunca referenciar item arquivado.

### 3. Modal de exclusão (`public/admin.html` + `public/app.js`)

Novo modal `#item-del-overlay` (padrão `modal-overlay > modal-caixa`):

- **Sem vendas:** título "Excluir item?", texto "Esta ação não pode ser desfeita.",
  botões **Cancelar** (secundário) e **Excluir** (perigo).
- **Com vendas:** título "Este item tem vendas", texto "**<nome>** tem **N venda(s)**
  registrada(s). Excluir pode afetar relatórios e faturamento. Recomendamos **arquivar** —
  ele some do cardápio, mas o histórico e o estoque são preservados.", botões **Cancelar**,
  **Excluir mesmo assim** (perigo) e **Arquivar** (primário/recomendado).

O handler de `data-del-item` deixa de excluir direto: chama
`GET /api/cardapio/item/:id/vendas`, abre o modal na variante certa, e executa a ação
escolhida.

### 4. Ações (todas persistem na hora via `PUT /api/cardapio`)

- **Arquivar:** `item.arquivado = true` → PUT → `renderCardapio()` + toast "Item arquivado".
- **Excluir (hard):** `splice` do item → PUT → `renderCardapio()` + toast "Item excluído".
  (Passa a salvar imediatamente — corrige o comportamento atual de só remover na memória.)
- **Restaurar:** `item.arquivado = false` → PUT → `renderCardapio()` + toast "Item
  restaurado".

> Salvar na hora vale só para estas três ações (arquivar/excluir/restaurar). Toggle de
> disponível e renome de categoria seguem como hoje (persistem no "Salvar cardápio").

### 5. "Mostrar arquivados" + render (`public/admin.html` + `public/app.js`)

- Checkbox **"Mostrar arquivados"** ao lado da busca (estado de view `mostrarArquivados`,
  não persistido). Espelha o "Mostrar inativos" do print.
- `renderCardapio` filtra por categoria, nesta ordem:
  1. se `!mostrarArquivados`, **excluir** itens `arquivado`;
  2. aplicar a busca por nome (Busca).
- Item arquivado (quando exibido): linha **acinzentada** com tag **"Arquivado"** na coluna
  PRODUTO; a coluna AÇÕES troca para **Restaurar** + **Excluir** (hard, com a mesma
  confirmação simples). O toggle de disponível fica desabilitado (não faz sentido em item
  fora do cardápio).
- Badge de contagem da categoria conta **itens ativos** (não arquivados); as métricas do
  topo idem.

## Fluxo de dados

1. Dono clica na lixeira → front chama `GET .../item/:id/vendas`.
2. `vendas === 0` → modal simples → Excluir (hard, salva).
3. `vendas > 0` → modal de alerta → Arquivar (recomendado) **ou** Excluir mesmo assim.
4. Arquivar → `arquivado=true`, salva → some do cardápio/vitrine.
5. "Mostrar arquivados" → lista os arquivados com Restaurar.

## Tratamento de erros / bordas

- **Item nunca salvo no banco ainda** (recém-adicionado e ainda sem id persistido): tem id
  local (`novoId`); a contagem de vendas retorna 0 → exclusão simples. OK.
- **Falha na rota de vendas:** se a checagem falhar (rede), tratar como **com vendas**
  (mostra o modal de alerta — mais seguro que excluir às cegas).
- **Falha no PUT** ao arquivar/excluir/restaurar: reverter a mudança em `cardapioAtual`,
  re-renderizar e avisar erro (não deixar a UI divergir do banco).
- **Pedido referenciando item arquivado:** `recalcularItens` rejeita (item 2).
- **Excluir de verdade item com vendas:** os pedidos mantêm o snapshot; o faturamento
  passado fica intacto; só o item some do cardápio. O modal explica o risco.

## Validação

- `npm run check` e `npm test` (com testes novos) passam.
- **Testes (puros, onde possível):**
  - `recalcularItens`: item `arquivado` → lança (não pedível).
  - `projetarCardapio`: item `arquivado` fica fora da projeção.
  - `pedidos.contarVendasDoItem`: coberto por teste de integração leve **se** houver harness
    de DB; senão, validar manualmente via rota (documentar). (Não criar suíte de DB nova.)
- **Validação visual (Playwright/harness):** modal nas duas variantes (com/sem vendas);
  item arquivado acinzentado + tag + Restaurar; "Mostrar arquivados" filtra; desktop+mobile.
- **Validação de servidor (local):** `GET .../item/:id/vendas` retorna a contagem certa;
  projeção/pedido barram item arquivado.

## Riscos

Médio. Pontos sensíveis: (a) a **query de containment** no `pedidos.itens` precisa casar o
formato real (id numérico dentro de objetos do array) — validar com um pedido real; (b)
**salvar na hora** muda o comportamento atual da exclusão (hoje deferido) — garantir o
rollback em falha do PUT; (c) manter os **data-attrs/handlers** intactos no render novo.

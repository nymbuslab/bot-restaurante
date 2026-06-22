# Estoque ativo (controle por item) — Design

**Data:** 2026-06-22
**Escopo:** Item do cardápio ganha **controle de estoque ativo** — quantidade + estoque
mínimo, com baixa automática a cada pedido e "Esgotado" na vitrine. Modal de cadastro,
lista de itens, vitrine pública e validação/baixa no servidor.

## Problema

Hoje não há controle de estoque: um item pode ser pedido infinitas vezes mesmo que o
ingrediente tenha acabado. O restaurante quer **contar o estoque** de itens contáveis,
ser avisado quando está **acabando**, e que a vitrine **pare de vender** o que zerou.

Esta é a **etapa 3a de 3** do cardápio (1. lista+busca ✓; 2. entrega/só-local ✓; 3a.
**estoque ativo** — este spec). A **unidade de medida (un/kg)** é a etapa **3b**, separada
(mexe em preço e no fluxo de pedido por peso) e **fora deste spec**.

## Objetivo

Permitir, por item, definir **estoque** e **estoque mínimo**. Com isso:
- o dono vê **alerta** de "baixo"/"esgotado" na lista;
- cada pedido do cardápio web **desconta** o estoque (fonte de verdade no servidor);
- item **esgotado** aparece como **"Esgotado"** (não adicionável) na vitrine;
- pedir **mais do que tem** é **rejeitado**.

## Não-objetivos (YAGNI)

- **Sem** unidade de medida un/kg (etapa 3b).
- **Sem** tela/aba dedicada de estoque — só campos no modal + selo na lista.
- **Sem** histórico de movimentação de estoque / relatórios.
- **Sem** baixa em criação manual de pedido — **não existe** esse caminho hoje
  (`salvarPedido` é chamado só no `POST /api/c/:slug/pedido`; o modal de "novo pedido"
  do painel só imprime comanda, não grava pedido).
- **Sem** migration: os campos vivem no `cardapio` jsonb.

## Modelo de dados

Dois campos novos no item (jsonb, dentro de `cardapio.categorias[].itens[]`):

```json
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "disponivel": true,
  "estoque": 12, "estoqueMinimo": 5 }
```

- `estoque` (número ≥ 0) | **ausente/null/`""` = item NÃO controlado** (ilimitado,
  comportamento atual). Só item com número entra no controle. Compatível com tudo que
  já existe.
- `estoqueMinimo` (número ≥ 0, default 0). Só dispara o alerta "baixo" no painel; ausente
  = 0 (sem alerta "baixo", só "esgotado" em 0).

> **Controlado** = `estoque` é um número finito (inclui 0). **Não controlado** =
> `estoque` ausente/null/vazio. Esta distinção é a regra central — usar uma função pura
> única para decidir (`temEstoqueControlado(item)`).

## Componentes

### 1. Modal do item (`public/admin.html` + `public/app.js`)

- Uma `.linha` com dois campos numéricos: **"Estoque"** e **"Estoque mínimo"**
  (ex.: `editor-estoque`, `editor-estoque-min`), `inputmode="numeric"`, **opcionais**
  (vazio = não controla).
- `abrirEditorItem`: preenche os campos com `it.estoque`/`it.estoqueMinimo` (vazio se
  ausentes; novo item: vazio).
- `salvarEditorItem`: grava `estoque`/`estoqueMinimo` como número quando preenchidos;
  **campo vazio → omite o campo** (não grava 0, pra não transformar "não controlado" em
  "controlado zerado").

### 2. Lista de itens (`public/app.js` `renderCardapio`)

Na linha do item, ao lado do nome (reusando `.item-linha-titulo`/`.item-linha-tag` da
etapa 2):
- `estoque === 0` → tag **"Esgotado"** (vermelho/error).
- `0 < estoque ≤ estoqueMinimo` → tag **"Baixo"** (âmbar/warning).
- controlado e acima do mínimo → indicador discreto **"Est. N"** (cinza).
- não controlado → nada.

Função pura de apoio reutilizável (browser+node): `statusEstoque(item) ->
{ controlado, esgotado, baixo, quantidade }`.

### 3. Projeção pública (`src/cardapio-web.js` `projetarCardapio`)

- Expõe **apenas** `esgotado: (controlado && estoque === 0)` — **não vaza a contagem**
  do estoque pro cliente. Item esgotado **continua na projeção** (aparece como
  "Esgotado", não some).

### 4. Vitrine pública (`public/cardapio.js` + `public/cardapio.css`)

- Card de item `esgotado`: **acinzentado**, selo **"Esgotado"**, **não clicável/não
  adicionável** (não abre o modal de adicionar).
- Itens não esgotados: comportamento atual.

### 5. Servidor — validação + baixa (`src/servidor.js` `POST /api/c/:slug/pedido`)

Helpers **puros** novos em `src/cardapio-web.js` (testáveis):

- `validarEstoque(cardapio, itensPayload) -> { ok, erro }` — para cada item controlado
  do payload: se `estoque === 0` → erro *"<nome> está esgotado."*; se `qtd > estoque` →
  erro *"Restam só N unidades de <nome>."*. Item não controlado é ignorado. `ok:true` se
  nenhum problema.
- `aplicarBaixa(cardapio, itensPayload) -> cardapioAtualizado` — retorna uma **cópia** do
  cardápio com `estoque` de cada item controlado descontado de `qtd` (trava em 0). Não
  muta o original.

Fluxo no handler, **após** o `recalcularItens` e a validação de só-local (etapa 2):
1. `const v = validarEstoque(store.getCardapio(dir), b.itens)` → se `!v.ok`, responde
   **400** com `v.erro` (sem salvar).
2. salva o pedido (como hoje).
3. **após salvar:** `store.setCardapio(dir, aplicarBaixa(store.getCardapio(dir), b.itens))`
   — relê o cardápio fresco, aplica a baixa e persiste (jsonb + cache). Best-effort: se a
   baixa falhar, o pedido já está salvo (logar o erro, não derrubar a resposta).

### 6. Reconciliação (já existe)

O dono **reajusta `estoque` no modal** a qualquer momento (reabastecer/corrigir). É a
saída para a dessincronização com o sistema externo de pedidos.

## Fluxo de dados

1. Dono define estoque no modal → `PUT /api/cardapio` grava no jsonb.
2. Vitrine busca `GET /api/c/:slug` → projeção com `esgotado` → mostra "Esgotado".
3. Cliente faz pedido → servidor **valida** (rejeita esgotado/over-order) → salva →
   **desconta** o estoque.
4. Estoque baixo/zerado reflete na lista do painel (selo) e na vitrine (Esgotado).

## Tratamento de erros / bordas

- **Item não controlado** (`estoque` ausente): nunca valida nem desconta; vitrine normal.
- **Campo vazio no modal:** omitir o campo (não virar `0`). Limpar o campo de um item
  controlado = voltar a ser não controlado (ilimitado).
- **Over-order / esgotado:** rejeitado no servidor com mensagem clara (item 5).
- **Carrinho velho (localStorage)** com item que esgotou depois: o servidor valida no
  envio e rejeita; a vitrine recarregada mostra "Esgotado".
- **Baixa trava em 0:** `aplicarBaixa` nunca deixa `estoque` negativo.
- **Disponível vs estoque:** são independentes. Item `disponivel:false` continua fora da
  vitrine (regra atual); o controle de estoque só atua em item visível e controlado.

## Limitações assumidas (v1)

- **Concorrência (last-write-wins):** a baixa é ler→descontar→gravar o jsonb inteiro.
  Dois pedidos simultâneos no **mesmo** item podem fazer a 2ª gravação sobrescrever a 1ª
  (perde 1 baixa). Para o volume de **um restaurante**, é aceitável. Evolução futura:
  update atômico no Postgres (`jsonb_set` com `WHERE`), fora do escopo do v1. **Anotar no
  código.**
- **Sem reserva de estoque no carrinho:** o estoque só baixa **ao enviar** o pedido (não
  ao adicionar ao carrinho). Dois clientes podem ter o mesmo último item no carrinho; o
  primeiro a enviar leva, o segundo é rejeitado na hora do envio.

## Validação

- `npm run check` e `npm test` (com testes novos dos helpers) passam.
- **Testes dos helpers** (`test/cardapio-web.test.js`):
  - `statusEstoque`: não controlado / esgotado (0) / baixo (≤ mínimo) / normal.
  - `validarEstoque`: esgotado rejeita; `qtd > estoque` rejeita com N; item não
    controlado ignora; payload ok passa.
  - `aplicarBaixa`: desconta qtd, trava em 0, não muta o original, ignora não controlado.
  - `projetarCardapio`: expõe `esgotado` certo e **não** expõe `estoque`.
- **Validação visual (Playwright/harness):** campos no modal; selos "Esgotado"/"Baixo"/
  "Est. N" na lista; card "Esgotado" não adicionável na vitrine.
- **Validação de servidor (local):** pedido normal desconta; over-order → 400; esgotado →
  400; item não controlado → sem baixa.

## Riscos

Médio. O ponto sensível é a **baixa persistir corretamente** (jsonb + cache) sem corromper
o cardápio e sem derrubar a resposta do pedido se algo falhar (best-effort após o salvar).
A defesa de verdade contra venda a mais é a **validação no servidor**; o front (vitrine
"Esgotado") é só conveniência.

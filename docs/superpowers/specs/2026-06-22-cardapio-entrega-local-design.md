# Item "Apenas local" (entrega × só no local) — Design

**Data:** 2026-06-22
**Escopo:** Item do cardápio ganha a opção de ser vendido **só no local** (sem entrega):
modal de cadastro (painel do dono), lista de itens, vitrine pública (`/c/:slug`) e
validação do pedido no servidor.

## Problema

Hoje todo item do cardápio pode ser pedido para **Entrega** ou **Retirada**
indistintamente. Alguns pratos (ex.: self-service por peso, prato que não viaja
bem) só fazem sentido **no local** — o restaurante quer mostrá-los no cardápio
digital, mas deixar claro que **não há entrega** desses itens.

Esta é a **etapa 2 de 3** do cardápio acordadas com o usuário (1. lista+busca —
concluída; 2. Entrega/Apenas local — este spec; 3. Estoque + unidade un/kg).

## Objetivo

Permitir marcar um item como **"só no local"**. Esse item:
- aparece normalmente no cardápio digital, com um selo **"Só no local"**;
- **não pode** ser incluído num pedido de **Entrega** (só **Retirada**);
- a regra é aplicada na vitrine (UX), no checkout (bloqueio) e no servidor (verdade).

## Não-objetivos (YAGNI)

- **Sem** estado "só entrega" (item que não pode ser retirado). Só existe o novo
  estado "só no local". O usuário pediu apenas este.
- **Sem** migration: o campo vive no `cardapio` jsonb.
- **Sem** mudança no fluxo do bot (continua mandando o link da vitrine).
- **Sem** mudança no modelo da tabela `pedidos` (`tipo_entrega` já existe).
- **Sem** unidade de medida / estoque (etapa 3).

## Modelo de dados

Novo campo no item do cardápio (jsonb, dentro de `cardapio.categorias[].itens[]`):

```json
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "disponivel": true,
  "apenasLocal": true }
```

- `apenasLocal` (boolean). **Ausente ou `false`** = entrega normal (comportamento
  atual de todos os itens já cadastrados → compatível, nada a migrar).
  `true` = vendido só no local.
- No modal, o toggle é **"Disponível para entrega"**: marcado ⇒ `apenasLocal = false`;
  desmarcado ⇒ `apenasLocal = true`. Default do toggle: **marcado** (entregável).

## Componentes

### 1. Modal de cadastro/edição do item (`public/admin.html` + `public/app.js`)

- Novo toggle **"Disponível para entrega"** logo abaixo do toggle "Disponível para
  pedidos" (reusa o mesmo componente `.campo.toggle` já existente, ex.: id
  `editor-entrega`).
- Microtexto auxiliar: *"Desligado: o item aparece no cardápio com o aviso 'Só no
  local' e não pode ser pedido para entrega."*
- `abrirEditorItem`: ao abrir um item existente, `editor-entrega.checked =
  it.apenasLocal !== true` (novo item: `checked = true`).
- `salvarEditorItem`: grava `apenasLocal: !$("editor-entrega").checked` no objeto do
  item, junto dos campos atuais.

### 2. Lista de itens — tag "Só no local" (`public/app.js` `renderCardapio`)

- A linha do item (etapa 1) ganha uma **tag discreta "Só no local"** quando
  `item.apenasLocal === true`, ao lado do nome (ex.: `<span class="item-linha-tag">`).
  Lê o mesmo campo; sem novo dado. Apenas informativo para o dono.

### 3. Projeção pública (`src/cardapio-web.js` `projetarCardapio`)

- A whitelist passa a incluir `apenasLocal: item.apenasLocal === true` (boolean
  normalizado). Não é dado sensível. Itens com `disponivel === false` continuam
  fora da projeção (regra atual inalterada).

### 4. Vitrine pública — selo "Só no local" (`public/cardapio.js` + `public/cardapio.css`)

- No card do item do cardápio, quando `item.apenasLocal`, renderizar um **selo
  "Só no local"** (estilo de chip, perto do nome/preço). O item **continua
  adicionável** ao carrinho (pode ser retirada).

### 5. Regra no checkout (`public/cardapio.js`)

O cliente escolhe **Entrega/Retirada no checkout** (toggle `[data-tipo]`), com o
carrinho já montado. Logo, a regra atua no render do checkout:

- Computar `carrinhoTemSoLocal` = algum item do carrinho tem `apenasLocal`.
- Se `carrinhoTemSoLocal`:
  - O botão **"Entrega"** do toggle fica **desabilitado** (visualmente apagado,
    `disabled`/classe), e **"Retirada"** vira a opção ativa (`tipoEntrega =
    "Retirada"`).
  - Mostrar uma **nota** perto do toggle: *"Seu carrinho tem itens vendidos só no
    local — disponível apenas para Retirada."*
  - Remover o item só-local do carrinho **reabilita** Entrega (re-render).
- Se não houver item só-local: comportamento atual (Entrega default).

Isso evita o beco sem saída de deixar escolher Entrega e só barrar no envio.

### 6. Validação no servidor (`src/servidor.js` `POST /api/c/:slug/pedido`)

Fonte de verdade — nunca confia no cliente:

- Helper **puro novo** em `src/cardapio-web.js`:
  `itensSoLocal(cardapio, itensPayload) -> string[]` — devolve os **nomes** dos
  itens do payload que são `apenasLocal` (cruza por `id` no cardápio). Vazio se
  nenhum.
- No handler, **após** `recalcularItens`: se `tipoEntrega === "Entrega"` e
  `itensSoLocal(...).length > 0`, responder **400** com mensagem clara, ex.:
  *"Estes itens são vendidos só no local e não saem para entrega: <nomes>.
  Troque para Retirada ou remova-os."* (sem salvar o pedido).

## Fluxo de dados

1. Dono marca/desmarca "Disponível para entrega" no modal → `PUT /api/cardapio`
   grava `apenasLocal` no jsonb (como qualquer outro campo do item).
2. Vitrine busca `GET /api/c/:slug` → projeção inclui `apenasLocal` → mostra o selo.
3. Cliente monta o carrinho; no checkout, se há item só-local, Entrega é
   desabilitada e Retirada assume.
4. `POST /api/c/:slug/pedido` recalcula e **valida**: Entrega + item só-local → 400.

## Tratamento de erros / bordas

- **Item antigo (sem o campo):** `apenasLocal` ausente = `false` = entregável. Nada
  muda para o que já existe.
- **Carrinho misto** (itens normais + 1 só-local) em pedido de Entrega: bloqueia
  (a presença de **qualquer** item só-local impede a entrega do pedido). A nota e o
  400 explicam.
- **Cliente burla o front** (manda Entrega via API com item só-local): o servidor
  rejeita (item 6). É a defesa real.
- **Item indisponível** (`disponivel === false`): nem chega à vitrine (fora da
  projeção); a regra de só-local só se aplica a itens visíveis.

## Validação

- `npm run check` e `npm test` (incl. testes novos do helper) passam.
- **Testes do helper `itensSoLocal`** (`test/cardapio-web.test.js` ou arquivo
  próprio): cardápio com item só-local → retorna o nome quando está no payload;
  retorna vazio quando não há só-local; ignora id inexistente; item normal não entra.
- **Validação visual (Playwright)**:
  - Modal: toggle "Disponível para entrega" liga/desliga e persiste no item.
  - Lista: item só-local mostra a tag "Só no local".
  - Vitrine: selo "Só no local" no card; item ainda adicionável.
  - Checkout: com item só-local no carrinho, Entrega desabilitada + nota +
    Retirada ativa; remover o item reabilita Entrega.
- **Validação de servidor** (script/local): `POST` com Entrega + item só-local → 400;
  com Retirada → ok; Entrega sem item só-local → ok.

## Riscos

Baixo-médio. Sem migration, sem mudar contrato de pedido. O ponto de atenção é o
**checkout** (`cardapio.js`): garantir que desabilitar Entrega e reabilitar ao
remover o item funcione no re-render, sem quebrar o cálculo de frete/total já
existente. A defesa de verdade é a validação no servidor — mesmo que o front falhe,
o pedido inválido é rejeitado.

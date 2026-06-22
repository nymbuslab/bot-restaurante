# Produto em destaque — Design

**Data:** 2026-06-22
**Escopo:** Marcar item como **destaque** no cadastro; refletir no cardápio digital com uma
**seção "Destaques" no topo** + **selo** no card.

## Problema

O restaurante tem itens "carro-chefe" (ex.: marmitex) que quer mostrar **logo de cara** no
cardápio digital, para o cliente ver primeiro. Hoje todos os itens têm o mesmo peso visual.

## Objetivo

- Checkbox **"Destaque no cardápio"** no cadastro do item.
- Na vitrine: **seção "Destaques" no topo** da aba "Todos" + **selo estrela** no card. O item
  destaque continua aparecendo na categoria dele também.

## Não-objetivos (YAGNI)

- **Sem** ordenação manual dos destaques (ordem = ordem do cardápio).
- **Sem** chip "Destaques" na navegação (a seção no topo já entrega o "veja de cara").
- **Sem** limite de quantos destaques. Sem migration (campo no jsonb).

## Modelo de dados

Novo campo no item: `destaque` (boolean). **Ausente/false = normal.** `true` = destaque.

## Componentes

### 1. Modal do item (`public/admin.html` + `public/app.js`)

- Checkbox **"Destaque no cardápio"** junto dos toggles (Disponível/Entrega), no padrão
  `.campo.toggle`.
- `abrirEditorItem`: marca conforme `it.destaque`. `salvarEditorItem`: grava `destaque: true`
  quando marcado (omite quando false).

### 2. Lista do painel (`public/app.js` `renderCardapio`)

- Selo **estrela "Destaque"** ao lado do nome (coluna Produto), junto das tags existentes
  ("Só no local"/"Arquivado").

### 3. Projeção pública (`src/cardapio-web.js` `projetarCardapio`)

- Expõe `destaque: item.destaque === true` por item.

### 4. Vitrine pública (`public/cardapio.js` + `public/cardapio.css`)

- `itensVisiveis()`: quando `catAtiva === null` e **sem busca**, **prepor** um grupo
  `{ nome: "Destaques", itens: [todos os itens com `destaque` de todas as categorias] }`. Sem
  itens destaque → não adiciona a seção.
- `cardItem`: **selo estrela "Destaque"** quando `it.destaque`.
- O item destaque **continua** na categoria dele (aparece nos dois lugares — padrão de
  "destaques/mais pedidos").

## Fluxo de dados

1. Dono marca "Destaque no cardápio" → `PUT /api/cardapio` grava `destaque`.
2. Projeção expõe `destaque` → vitrine monta a seção "Destaques" + selo.

## Tratamento de erros / bordas

- **Sem itens em destaque:** a seção não aparece.
- **Busca ativa / categoria específica:** sem a seção (é da aba "Todos"); o item destaque
  ainda mostra o selo onde aparecer.
- **Destaque + esgotado/kg:** aparece na seção com o tratamento dele (esgotado/"no balcão").
- **Item antigo (sem `destaque`):** normal (default false).

## Validação

- `npm run check` e `npm test` passam (atualizar o `deepEqual` da projeção: itens ganham
  `destaque`).
- **Teste:** `projetarCardapio` expõe `destaque`.
- **Visual (harness/Playwright):** checkbox no modal; selo estrela na tabela do painel; seção
  "Destaques" no topo da vitrine + selo no card.

## Riscos

Baixo. Reusa o render de grupos/título da vitrine (prepor um grupo) e o padrão de selo. Único
cuidado: o item destaque aparece **duas vezes** na aba "Todos" (na seção e na categoria) — é
intencional. Sem migration, sem mudar pedido.

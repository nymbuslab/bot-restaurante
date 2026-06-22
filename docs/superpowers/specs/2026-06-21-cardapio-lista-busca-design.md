# Cardápio em lista com busca — Design

**Data:** 2026-06-21
**Escopo:** Painel administrativo › aba Cardápio › "Gestão de Itens" (tela do dono).

## Problema

A gestão de itens hoje renderiza cada item como um **card** numa grade
(`renderCardapio` em `public/app.js`). Visualmente bonito, mas com cardápio grande
a localização de um item específico fica ruim — o dono precisa varrer a grade.
Padrão de e-commerce/admin para listas longas é a **linha** (densa, escaneável)
com **busca**.

Esta é a **primeira de três etapas** independentes acordadas para o cardápio
(1. lista, 2. Entrega/Apenas local, 3. Estoque + unidade un/kg). Estoque fica
fora desta etapa — entra completo na etapa 3.

## Objetivo

Trocar a grade de cards por uma **lista agrupada por categoria** com **busca por
nome no topo**, mantendo todas as ações que já existem. Mudança restrita ao
front-end da tela do dono.

## Não-objetivos (YAGNI)

- Nenhum campo novo de dados (sem estoque, sem unidade, sem flags). Etapas futuras.
- Não mexer no modal de cadastro/edição de item.
- Não mexer na vitrine pública (`public/cardapio.*`) — é a tela do cliente.
- Sem reordenação por arrastar (drag-and-drop). Não pedido.
- Sem filtro por categoria/status — só busca por nome. YAGNI.
- Sem alternância cards ↔ lista. A lista substitui os cards (fonte única).

## Arquitetura

Mudança **só de front-end**, em dois arquivos:

- `public/app.js` — `renderCardapio()` passa a montar **linhas** em vez de cards;
  novo helper de filtro de busca; novo listener no campo de busca. A função
  `ligarEventosCardapio()` continua religando os eventos por render.
- `public/style.css` — estilos novos `.cardapio-busca*` e `.item-linha*`;
  as classes de card (`.cards-grid`, `.item-card*`) saem de uso na aba (podem
  ser removidas se não forem usadas em outro lugar — verificar com grep antes).

Sem backend, sem migration, sem mudança no `cardapio` jsonb, sem tocar
`recalcularItens`/`projetarCardapio`/fluxo de pedido.

### Estado de dados (inalterado)

A fonte continua sendo `cardapioAtual.categorias[].itens[]`, com o item no
formato atual: `{ id, nome, preco, desc, disponivel, composicao, opcionais, imagem }`.
A busca é **estado de view efêmero** (variável de módulo, ex.: `cardapioBusca`),
**não** persistido e **não** enviado no PUT `/api/cardapio`.

## Componentes

### 1. Barra de busca (topo da lista)

- Campo de texto único, `placeholder="Buscar item…"`, com `aria-label`.
- Posicionado acima do `#cardapioContainer` (dentro do `cardapio-topo` ou logo
  abaixo dele). Largura total no mobile.
- Filtra **em tempo real** no evento `input` (sem botão, sem debounce — a lista
  é local e pequena).
- Normalização: comparação **case-insensitive e sem acento** (`String.prototype
  .normalize("NFD")` removendo diacríticos) entre o termo e `item.nome`.
- `Esc` no campo limpa a busca e re-renderiza tudo.
- Quando há texto: re-renderiza mostrando só itens cujo nome casa; **categorias
  sem nenhum item casando não aparecem**.
- Busca vazia (`""`): comportamento normal, todas as categorias e itens.

### 2. Linha de item (substitui o card)

Layout da linha (desktop), da esquerda para a direita:

```
[miniatura 40px] | Nome (+ desc opcional, 1 linha truncada) | Preço | [toggle Disp] | ✎ | ✕
```

- **Miniatura:** `item.imagem` se houver; senão o placeholder SVG já existente
  (mesmo ícone do card), em caixa ~40×40px com `border-radius`.
- **Nome:** `escapar(item.nome) || "(sem nome)"`. Se `item.desc`, mostra abaixo
  em fonte menor/esmaecida, truncada com reticências (1 linha).
- **Preço:** `R$ ${moedaBR(item.preco)}`, alinhado.
- **Toggle Disponível:** o mesmo checkbox `.itDisp` de hoje (mesmos data-attrs
  `data-c`/`data-i`), com rótulo curto ("Disp."/"Indisp.").
- **Ações:** botão de editar (`data-edit-item="ci-ii"`) e de excluir
  (`data-del-item="ci-ii"`), mesmos seletores/handlers de hoje. Os ícones são os
  **mesmos SVG inline já usados nos cards** (lápis = editar, lixeira = excluir).

> **Ícones, nunca emoji.** Os glifos `✎`/`✕`/`●` que aparecem nos mockups deste
> documento são só rascunho de layout. Na implementação, toda iconografia é **SVG
> inline** (reusando os SVGs que já existem no `renderCardapio` atual). Sem emoji
> em nenhum lugar da UI.
- **Indisponível:** a linha inteira recebe classe `item-linha--indisp` e fica
  esmaecida (reusa a semântica do `item-indisp` atual).

### 3. Cabeçalho de categoria (mantido)

Igual ao de hoje: nome editável (`.catNome`, `data-cat`), badge de contagem,
botão "Excluir" da categoria (`data-del-cat`). Ao fim de cada categoria, a ação
"+ Adicionar item nesta categoria" (`data-add-item="ci"`) — mesmos seletores.

> A contagem do badge reflete o total real da categoria (não o filtrado), para
> não confundir durante a busca. (Decisão: badge = total; busca só oculta linhas.)

### 4. Estado vazio da busca

Quando a busca não casa com nenhum item em nenhuma categoria, o
`#cardapioContainer` mostra uma mensagem única:
"Nenhum item encontrado para *'<termo>'*." (com o termo escapado).

## Responsividade

- **Desktop:** linha em grid horizontal, colunas alinhadas entre itens.
- **Mobile (≤ ~640px):** a linha empilha — miniatura + nome na primeira faixa;
  preço + toggle + ações na segunda. **Sem scroll horizontal.** Alvos de toque
  ≥ 40px.

## Acessibilidade

- Campo de busca com `aria-label`; foco visível (já há tokens de foco no CSS).
- `Esc` limpa a busca.
- Botões de ação com `aria-label` ("Editar item" / "Excluir item"), como hoje.
- Contraste do texto esmaecido (desc, indisponível) dentro do padrão do design
  system.

## Tratamento de erros / bordas

- **Cardápio vazio** (sem categorias): mantém o comportamento atual (a área de
  categorias simplesmente não renderiza itens). A busca opera sobre o que existir.
- **Categoria sem itens:** cabeçalho aparece com badge "0 itens" e só o
  "+ Adicionar item" (igual hoje), exceto durante busca ativa (aí some).
- **Item sem nome:** exibe "(sem nome)"; na busca, nome vazio nunca casa com
  termo não-vazio.
- A busca **não** altera o array de dados — só filtra o que é renderizado. Editar,
  excluir e toggle continuam operando sobre os índices reais `ci/ii`.

## Validação

- `npm run check` (varredura de sintaxe) e `npm test` (suíte atual) passam.
- **Validação visual (Playwright)**, desktop + mobile:
  - Golden path: lista renderiza agrupada por categoria; linhas mostram
    miniatura/nome/preço/toggle/ações.
  - Busca: digitar filtra por nome (com acento e sem acento); categoria sem
    match some; `Esc` limpa; estado vazio aparece quando não há match.
  - Ações: toggle de disponível, editar (abre modal) e excluir funcionam pelos
    índices certos mesmo com busca ativa.
  - Mobile: sem scroll horizontal; linha empilhada.

## Riscos

Baixo. Reescrita do HTML por item + CSS novo + um listener de busca. Sem backend,
sem migration, sem mudança de contrato de dados. Único cuidado: garantir que os
**data-attrs e seletores** (`itDisp`, `data-edit-item`, `data-del-item`,
`data-del-cat`, `data-add-item`, `catNome`) sigam idênticos para os handlers de
`ligarEventosCardapio()` continuarem válidos.

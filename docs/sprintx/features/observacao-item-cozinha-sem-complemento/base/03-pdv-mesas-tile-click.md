# PDV e Mesas — clique no produto pula o modal quando não há grupo/variação/kg

## Contrato de entrada

PDV e Mesas compartilham a mesma grade e os mesmos handlers (`public/app.js`). Mesas entra em "modo PDV" via `ativarMesaModoPdv()` (`public/app.js:7738`), que reaproveita `carregarPdv`/`pdvGrid`/`pdvTileClick` — não existe um caminho de clique separado para mesa.

Clique num tile de produto chama `pdvTileClick(item)` (`public/app.js:6043`):

```js
function pdvTileClick(item) {
  const bib = pdvGruposDoItem(item);
  const vars = (window.Variacoes ? window.Variacoes.normalizarVariacoes(item.variacoes) : []);
  const ehKg = item.unidade === "kg";
  if (bib.length || vars.length || ehKg) { abrirPdvItemModal(item, null); return; }
  // Item simples: soma na linha existente (sem opcionais/obs/composição) ou cria nova.
  const ex = pdvCart.find((l) => l.id === item.id && !l.opcionais.length && !l.observacao && !(l.composicao && l.composicao.length));
  if (ex) ex.qtd += 1;
  else pdvCart.push({ uid: pdvUidSeq++, id: item.id, nome: item.nome, preco: Number(item.preco) || 0, unidade: "un", qtd: 1, composicao: [], opcionais: [], observacao: "" });
  renderPdvCarrinho();
}
```

`item` vem de `cardapioAtual` (resposta crua de `GET /api/cardapio`, sem whitelist — `item.cozinha` está disponível). `pdvGruposDoItem(item)` resolve os grupos vinculados ao item pela mesma regra do servidor (`public/app.js:6059`, comentário confirma "mesma regra do servidor em `src/pdv.js`").

Existe um segundo caminho de clique-direto para item que só tem variação (sabor) e nenhum grupo, disparado pela busca por sabor: `pdvVariacaoClick(item, v)` (`public/app.js:6007`):

```js
function pdvVariacaoClick(item, v) {
  if (pdvGruposDoItem(item).length) { abrirPdvItemModal(item, null); return; }
  // ...push direto ao carrinho com observacao: ""
}
```

## Contrato de saída

Quando `bib.length || vars.length || ehKg` é falso, o item é empilhado direto em `pdvCart` com `observacao: ""` fixo — o operador nunca vê um campo para preencher. `renderPdvCarrinho()` redesenha o carrinho a partir de `pdvCart` (fora do escopo desta ingestão, não lido em detalhe).

## Limites e cotas

NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

NÃO DOCUMENTADO.

## Riscos para a nossa implementação

- **Este é o gap real.** Um item com `cozinha === true`, sem grupos (`pdvGruposDoItem(item).length === 0`), sem variações e não vendido por kg entra direto no carrinho sem qualquer chance de observação — em PDV **e** em Mesas, porque os dois usam a mesma função.
- `abrirPdvItemModal(item, uid)` (`public/app.js:6067`) já renderiza corretamente um item sem nenhum grupo/variação: os blocos de `bib.forEach`/`if (vars.length)` simplesmente não emitem HTML, e a seção de observação (linha `6155-6156`) é incondicional, igual ao cardápio web. Ou seja, abrir esse modal para um item simples hoje já funciona (mostra só nome, preço, observação, quantidade e "Adicionar") — não precisa de HTML novo.
- Mudar a condição de abertura em `pdvTileClick` (linha 6047) para incluir `item.cozinha === true` resolve o caso descrito pelo dono (ex.: marmitex) sem tocar em `abrirPdvItemModal`. O mesmo vale, se a F2 confirmar o escopo, para `pdvVariacaoClick` (linha 6008).
- Consequência colateral aceitável: hoje, para item simples, `pdvTileClick` tenta **agrupar** na mesma linha existente do carrinho (`pdvCart.find(...)`) — um segundo clique no mesmo item simples soma quantidade na linha, sem duplicar. Se o item passar a abrir modal por causa de `cozinha`, esse agrupamento automático por clique deixa de existir para ele (o modal sempre cria/edita uma linha explicitamente, com o próprio botão "Adicionar"/"Salvar") — mesmo comportamento que já existe hoje para qualquer item com grupo/variação/kg. Não é regressão, é o padrão já estabelecido para itens com modal.

## Fonte

`public/app.js:5985-6055` (tile e cliques), `public/app.js:6067-6226` (`abrirPdvItemModal`), `public/app.js:7738-7746` (`ativarMesaModoPdv`) — acessado em 2026-09-03

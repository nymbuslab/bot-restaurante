# Cardápio web (`/c/:slug`) — modal de item já pergunta observação sempre

## Contrato de entrada

Clique em qualquer card de item do cardápio web dispara `abrirModal(it)` (`public/cardapio.js:457`). A decisão de abrir ou não o modal está em `cardItem`/`heroCard`:

```
var naoAbre = it.esgotado || kg;   // public/cardapio.js:361, :418
```

Ou seja: o modal só **não** abre quando o item está esgotado ou é vendido por kg (pesagem no balcão, fora do fluxo de carrinho). Presença ou ausência de `grupos`/`variacoes` **não** entra nessa decisão — o modal sempre abre para item disponível vendido por unidade, tenha ou não complementos configurados.

## Contrato de saída

Dentro de `abrirModal`, a seção de observação é montada incondicionalmente, fora do loop que desenha grupos/variações (`public/cardapio.js:552-556`):

```
'<div class="cd-m-obs-cab">' + IC.balao + '<span class="cd-m-obs-tit">Alguma observação?</span>' ...
'<textarea id="cdModalObs" rows="2" maxlength="200" placeholder="Ex.: tirar a cebola, maionese à parte etc."></textarea>'
```

Ao confirmar (`confirmarModal`, chamada em `cdModalAdd` click), a linha do carrinho grava `observacao: ($("cdModalObs").value || "").trim()` (`public/cardapio.js:737`). O carrinho local já tem o campo `observacao` documentado no comentário de topo do arquivo (`public/cardapio.js:30`).

## Limites e cotas

Textarea com `maxlength="200"` (`public/cardapio.js:556`); contador "`X`/200" atualizado a cada input (`public/cardapio.js:584-585`).

## Erros conhecidos e tratamento

NÃO DOCUMENTADO (não há validação de erro específica para o campo — é sempre opcional, sem `required`).

## Riscos para a nossa implementação

- **Não há gap a fechar no cardápio web.** Item de cozinha sem complemento comprado pelo cliente via link do WhatsApp já passa pelo modal e já pode deixar observação, hoje, em produção. Qualquer tarefa desta feature que toque `public/cardapio.js` seria mudança de comportamento não pedida (risco de regressão), não correção de lacuna.
- Único ponto de atenção real: como `item.cozinha` não chega na projeção pública (ver `01-flag-item-cozinha.md`), o front do cardápio web não tem como saber se o item é "de cozinha" — mas não precisa saber, porque o modal já é universal ali.

## Fonte

`public/cardapio.js:340-589` — acessado em 2026-09-03

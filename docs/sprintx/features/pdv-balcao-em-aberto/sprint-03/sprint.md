---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-03
titulo: PDV - abrir Comanda e acrescentar itens (UI)
status: nao_iniciado
criterio_saida: PDV mostra o tile Comanda na tela de cobranca; o modal de detalhe do pedido mostra Acrescentar item para pedidos editaveis e leva ao modo de lancamento que chama a rota da sprint-02
fases: [F-03.1, F-03.2, F-03.3]
riscos: ["Toda tela/elemento novo desta sprint exige prototipo aprovado no Claude Design antes do codigo (regra global do projeto) - ver nota abaixo", "T-03.01, T-03.02 e T-03.03 alteram o mesmo public/app.js - marcadas sequenciais para nao conflitar"]
atualizado_em: 2026-09-10
---

# Sprint 03 — PDV - abrir Comanda e acrescentar itens (UI)

## Objetivo

Entregar a UI que usa o backend da sprint-02: o tile "Comanda" na tela de cobrança do PDV, o
modo de PDV que lança itens num pedido já aberto (espelhando `mesaModoId`), e o botão
"Acrescentar item" no modal de detalhe do pedido.

**Portão de design (regra global do projeto, não é fase da sprintx).** Antes de escrever
qualquer HTML/CSS/JS de tela desta sprint — o tile "Comanda", o banner "Acrescentando à
Comanda #NN" e o botão "Acrescentar item" no modal — gerar o protótipo na skill `design`
(Claude Design), semeado com os tokens reais de `public/style.css`, e aguardar aprovação do
dono antes de implementar. Isso vale mesmo durante execução autônoma da F6: é um portão que a
autonomia não dispensa.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-03.1 | Tile Comanda na tela de cobrança | nenhuma |
| F-03.2 | Modo PDV de acrescentar itens a Comanda existente | nenhuma |
| F-03.3 | Botão Acrescentar item no modal do pedido | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

Harness de `public/app.js` confirma: (1) "Comanda" nos tiles de tipo de venda com o
comportamento de Entrega/Retirada; (2) `pdvCobrar` chama a rota de acréscimo quando
`pedidoModoId` está setado; (3) o botão "Acrescentar item" aparece só quando `podeModificar`.

## Riscos conhecidos

- Toda tela/elemento novo exige protótipo aprovado no Claude Design antes da implementação — ver nota no Objetivo.
- T-03.01, T-03.02 e T-03.03 alteram o mesmo arquivo `public/app.js` — sequenciadas de propósito para não conflitar entre si.

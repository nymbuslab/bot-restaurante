# Sprint 03 — Front: o ícone na grade, e fechamento

## Objetivo

Colocar o ícone de reimpressão na coluna de ações que já existe na grade do caixa aberto, com bloqueio durante o envio (D-07), e fechar a entrega com validação visual e documentação.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-03.1 | Ícone e ação na grade | nenhuma |
| F-03.2 | Validação visual e fechamento | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

O ícone aparece nas linhas de sangria, suprimento e cancelamento e não aparece em recebimento nem na linha de saldo inicial; o clique enfileira 1 trabalho e o botão fica desabilitado durante o envio; `npm test`, `npm run check` e `npm run test:integracao` terminam com `fail 0`.

## Riscos conhecidos

- **`data-id` da ação existente é o `pedidoId`, não o id do movimento** (`base/rotas-gates-e-front.md`, risco 4). O ícone novo usa o id do MOVIMENTO; não misturar os dois no mesmo `querySelectorAll`.
- **CSP estrita:** nada de `onclick=` inline; listener via `addEventListener` em `.js` (`base/rotas-gates-e-front.md`).
- **Mistura de controles na coluna:** botão de texto "Estornar" nas linhas de recebimento e ícone nas outras. Os dois nunca caem na mesma linha, então não competem visualmente. Registrado como observação aceita, não como problema a resolver.
- **Conferência no papel real fica pendente** por D-08: a tarefa fecha com teste e visual validados, e a comparação com o papel da térmica vira item em Próximos Passos.

# Dívida observada

> Substitua TODOS os marcadores `{{assim}}` ao acrescentar uma linha.
> Este arquivo é o destino da tentação. Registro, NUNCA correção.
> Nada aqui é corrigido dentro do trabalho que o descobriu: cada item tem raio próprio
> e merece seu próprio trabalho.
>
> ARQUIVO APPEND-ONLY. Nunca reescreva nem apague linhas. Um item resolvido ganha
> NOVA linha marcando a resolução e citando o trabalho que a fez.

Atualizado em: 2026-09-05

---

## Achados

| Data | Arquivo:linha | O que foi visto | Por que incomoda | Risco de mexer | Trabalho de origem |
|---|---|---|---|---|---|
| 2026-09-05 | `public/comprovante-caixa.js:80` | `linhas.push("Operador: " + d.operador)` empurra texto livre direto, sem passar por `quebrar()` — mesmo padrão do defeito corrigido em `comanda.js`, mas neste arquivo `d.descricao` (linha 91, vizinha) já usa `quebrar()` corretamente | Nome de operador maior que ~36 colunas ultrapassaria a largura da bobina 80mm no comprovante de caixa; risco menor que o de `comanda.js` porque é nome de usuário cadastrado, não texto livre de até centenas de caracteres | BAIXO — zona Financeiro tocada (o arquivo é comprovante de caixa), mas campo de tamanho tipicamente curto e controlado no cadastro | quebra-linha-obs-cozinha |

### Como preencher cada coluna

- **O que foi visto** — factual, sem adjetivo. Descreva o que está lá, não o que você acha disso.
- **Por que incomoda** — a consequência concreta e observável, não a ofensa estética.
- **Risco de mexer** — a faixa que um trabalho para corrigir isso provavelmente teria, com o
  sinal que a justifica. Ex.: "ALTO — zona fiscal".
- **Trabalho de origem** — o `trabalho_id` em que o achado apareceu, para rastrear.

---

## Código morto suspeito

> Camada 10. Suspeita de morto NÃO autoriza remoção (regra inviolável 10).
> Remover código morto em legado é mudança de raio próprio.

| Data | Arquivo | Evidência | Método de verificação | Trabalho de origem |
|---|---|---|---|---|
| 2026-09-05 | `src/stripe.js` (exports `stripe`, `PRICE_ID`, `PRICE_ID_COMPLETO`, `PUBLISHABLE_KEY`) | Nenhum chamador fora do próprio arquivo — `src/servidor.js` (único importador do módulo, `const stripeBilling = require("./stripe")`) só acessa `.CONFIGURADO`, `.PLANO_INFO` e as funções (`criarCheckout`, `criarPortal` etc.); os 4 exports acima nunca aparecem como `stripeBilling.X` em nenhum arquivo | `grep -rn "\bSIMBOLO\b" --include=*.js src public index.js` por símbolo, um a um (Camada 1, L-06) | legadox (Camada 1, extensão de L-06) |

---

## Resoluções

> Uma linha nova por item resolvido. A linha original permanece intocada acima.

| Data | Item resolvido (data + arquivo do achado original) | Trabalho que resolveu |
|---|---|---|
| {{AAAA-MM-DD}} | {{referência ao achado original}} | {{trabalho_id}} |

---

## Achados graves comunicados imediatamente

> Dado de cliente exposto, credencial no código, falha de segurança ativa não são dívida:
> são ocorrência nova e urgente. Registre aqui E comunique ao usuário na hora, sem
> corrigir por conta própria dentro do trabalho em andamento.

| Data | O que foi visto | Comunicado a | Ocorrência aberta |
|---|---|---|---|
| {{AAAA-MM-DD}} | {{o quê, sem expor o segredo em si}} | {{quem}} | {{id da ocorrência | pendente}} |

# Montagem e enfileiramento do comprovante de caixa (caminho atual)

## Contrato de entrada

`enfileirarComprovanteCaixa(req, tipo, movimentos, extras)` (`src/servidor.js:2424`):

- `req` — precisa de `req.tenantDir` e `req.slug`.
- `tipo` — string; os três em uso são `"sangria"`, `"suprimento"` e `"cancelamento"` (chaves lidas de `config.impressao.caixa` em `src/servidor.js:2428`).
- `movimentos` — um movimento ou array de movimentos. Aceita chaves em camelCase E em snake_case: `dadosComprovanteCaixa` (`src/servidor.js:2391`) lê `mov.pedidoId || mov.pedido_id`, `mov.forma || mov.forma_pagamento`, `mov.criadoEm || mov.criado_em`, `mov.caixaId || mov.caixa_id`. Isso existe porque a chamada de sangria/suprimento passa a linha crua do banco (`src/servidor.js:2445`).
- `extras` — `{ pedido }` no caso de cancelamento (`src/servidor.js:2278`).

Chamadores hoje, os dois únicos:

1. `POST /api/pedidos/:id/cancelar` → `enfileirarComprovanteCaixa(req, "cancelamento", cancelado.cancelamentos || [], { pedido })` (`src/servidor.js:2278`).
2. `POST /api/caixa/movimento` → `enfileirarComprovanteCaixa(req, mov.tipo, mov)` (`src/servidor.js:2445`).

`montarComprovanteCaixa(d)` (`public/comprovante-caixa.js:66`) consome o objeto montado por `dadosComprovanteCaixa` e usa: `restaurante`, `tipo`, `caixaId`, `operador`, `pedidoNumero`/`pedidoId`, `mesa`, `forma`, `formas[]`, `valor`, `descricao`, `criadoEm`.

## Contrato de saída

`enfileirarComprovanteCaixa` devolve um destes três (`src/servidor.js:2428`, `2432`, `2434`, `2437`):

- `{ solicitado: false }` — o toggle daquele tipo está desligado em `config.impressao.caixa`, OU a lista de vias saiu vazia. Nada é enfileirado e NÃO há erro.
- `{ solicitado: true, id }` — enfileirado; `id` é a linha de `impressao_fila`.
- `{ solicitado: true, erro: "O comprovante não foi para a impressora. Confira o agente de impressão." }` — qualquer exceção no caminho. O `catch` é largo e engole a causa em `console.error`.

`montarComprovanteCaixa` devolve **uma string** de texto 80mm (`linhas.join("\n")`, `public/comprovante-caixa.js:90`).

## Limites e cotas

- `configComprovanteCaixa` só aceita objeto: array ou não-objeto viram `{}` (`src/servidor.js:2386-2389`), e a comparação é `!== true`, então só o booleano `true` liga o comprovante.
- Largura do comprovante: constante `LARGURA` em `public/comprovante-caixa.js` (usada em `quebrar(...)`, linha 87).
- `impressaoFila.enfileirar` corta o `tipo` em 40 caracteres (`src/impressao-fila.js:43`) e devolve `null` sem inserir quando a lista de vias fica vazia (`src/impressao-fila.js:38`).

## Erros conhecidos e tratamento

- Falha ao enfileirar NÃO desfaz o movimento financeiro; devolve o texto de aviso acima, que as rotas propagam como `avisoImpressao` (`src/servidor.js:2283`, `2446`) e o painel mostra junto da confirmação (`public/app.js`, `toastResultadoComImpressao`).
- Nenhum outro código de erro é definido. `NÃO DOCUMENTADO` para retry, backoff ou reenfileiramento: não existe nenhum hoje.

## Riscos para a nossa implementação

1. **RISCO ALTO — cancelamento é um comprovante feito de VÁRIOS movimentos.** `normalizarMovimentosComprovante` (`src/servidor.js:2411-2422`) funde a lista de cancelamentos do mesmo pedido em UMA via, somando `valor` e montando `formas[]`. Reimprimir a partir de UM `id` de movimento produziria um comprovante **diferente do original** (só uma forma, valor parcial) a menos que a rota reagrupe os irmãos. Não existe coluna que marque o lote; o agrupamento possível é por `(caixa_id, pedido_id, tipo='cancelamento')`.
2. **`operador` vem do caixa ABERTO agora**, não do caixa do movimento (`dadosComprovanteCaixa` recebe `caixaAtual` de `caixa.caixaAberto(req.tenantDir)`, `src/servidor.js:2429`). Reimprimir movimento de caixa já fechado traria operador errado ou vazio.
3. **`criadoEm` cai para `new Date()` quando ausente** (`src/servidor.js:2407`). A reimpressão precisa passar o `criado_em` guardado, senão o papel sai com a hora de agora e deixa de bater com o extrato.
4. **`pedidoNumero` não está em `caixa_movimentos`**; vem por `extras.pedido` ou do JOIN. A rota de reimpressão precisa do JOIN com `pedidos` para não imprimir "Pedido ID" cru no lugar do número.
5. O toggle é consultado DENTRO de `enfileirarComprovanteCaixa`. Se a reimpressão reusar essa função como está, o toggle desligado bloqueia também a reimpressão manual (é a decisão em aberto D-01).

## Fonte

`src/servidor.js:2386-2447`, `public/comprovante-caixa.js:66-91`, `src/impressao-fila.js:36-46` — acessado em 2026-08-30

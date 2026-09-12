# Pontos onde um cancelamento/estorno de venda realmente acontece

## Contrato de entrada

6 pontos de negócio distintos, cobertos por 6 rotas HTTP diferentes em `src/servidor.js` (todas
atrás de `exigeAuth`; as de caixa/mesa também têm `exigeCaixa`/`exigePdv`):

| # | Rota | Função | Grava `caixa_movimentos`? | Valor pronto p/ margem? |
|---|------|--------|---------------------------|--------------------------|
| P1 | `POST /api/pedidos/:id/cancelar` (não pago) | `pedidos.cancelarPedido` — `src/pedidos.js:255-284` | Não | Não (usar `pedido.total`) |
| P2 | `POST /api/pedidos/:id/cancelar` (pago/PDV) | `caixa.cancelarRecebido` — `src/caixa.js:344-416` | Sim (`tipo='cancelamento'`, :378-382) | Sim (`cancelamentos[].valor`) |
| P3 | `POST /api/pedidos/:id/cancelar-item` | `pedidos.cancelarItemPedido` — `src/pedidos.js:289-333` | Não | Não (derivar diferença de total) |
| P4 | `POST /api/caixa/estornar/:pedidoId` | `caixa.estornarRecebimento` — `src/caixa.js:285-334` | Sim (`tipo='estorno'`, :316-320) | Sim (`net.rows[].net`) |
| P5 | `POST /api/mesas/:id/cancelar` | `mesasDb.cancelar` — `src/mesas-db.js:341-402` | Não (bloqueia se já houve recebimento, :354-364) | Não (usar `mesa.totalConsumido` antes do cancelamento) |
| P6 | `POST /api/mesas/:id/cancelar-item` | `mesasDb.cancelarItem` — `src/mesas-db.js:595-662` | Não | Não (derivar diferença de total) |

Não existe endpoint de cancelamento específico de PDV — uma venda de PDV é um pedido com
`recebido_em` já setado (via `caixa.venderLocal`), então cancelá-la cai em P2. Não existe função
de "estorno de mesa" separada (busca por "estorn" em `mesas-db.js` só acha comentários).

## Contrato de saída

P2 retorna `cancelamentos: [{forma, valor, pedidoId, pedidoNumero, ...}]` (pode ter múltiplas
linhas — um pedido pago em duas formas gera duas linhas). P4 calcula `net.rows[].net` na mesma
transação. P1, P3, P5, P6 não calculam nem retornam um valor pronto em R$ hoje.

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Não aplicável.

## Riscos para a nossa implementação

- **Só P2 e P4 já têm valor pronto e vivem no MESMO arquivo (`src/caixa.js`) que o helper
  `_avisarRelatoriosTelegram`** — extensão natural e de baixo risco (mesmo padrão fire-and-forget
  após `COMMIT`, já usado em `fecharCaixa`).
- **P1 e P3 vivem em `src/pedidos.js`**, que NÃO importa `./empresas`/`./telegram` hoje. Risco de
  **dependência circular**: `src/empresas.js:12` já faz `require("./pedidos")` — se `pedidos.js`
  vier a fazer `require("./empresas")`, fecha um ciclo `pedidos.js ⇄ empresas.js`. Precisaria de
  um jeito de evitar isso (ex.: `caixa.js` exportar uma função de aviso reutilizável e
  `pedidos.js` importar só `./caixa`, que já não tem esse ciclo).
- **P5 e P6 vivem em `src/mesas-db.js`**, que já importa `./caixa` (`src/mesas-db.js:9`) — sem
  risco de ciclo, mas hoje `caixa.js` não exporta `_avisarRelatoriosTelegram` nem nada equivalente
  (é função privada, fora do `module.exports`).
- P1, P3, P5 e P6 tratam de cancelamento **antes do pagamento** (pedido nunca foi cobrado) — não
  há "dinheiro saindo do caixa" nesses casos, diferente de P2/P4 (que revertem um valor JÁ
  recebido). Isso é uma distinção de PRODUTO relevante para decidir o escopo desta rodada — ver
  pergunta correspondente na F2.

## Fonte

`src/servidor.js:2335-2371,2450-2454,3139-3180`, `src/pedidos.js:255-333`,
`src/caixa.js:285-416,599-634,640-765,814-817`, `src/mesas-db.js:341-402,595-662`,
`src/empresas.js:12` — acessado em 2026-09-07

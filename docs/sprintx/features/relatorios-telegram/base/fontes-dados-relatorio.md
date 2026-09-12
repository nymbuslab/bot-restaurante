# Fontes de dados para o relatório (vendas, produtos, estoque)

## Contrato de entrada

- `src/caixa.js` — `resumo(dir)` (`src/caixa.js:465-515`): caixa aberto do dia + `resumo: calc.resumoCaixa(caixa, movimentos)`. `fecharCaixa(dir, {contado, contagem, eletronico})` (`src/caixa.js:593-714`) persiste o fechamento em `caixas.detalhe_fechamento`. `listarCaixas(dir)` (`:716`) e `detalheCaixa(dir, id)` (`:750`) consultam histórico.
- `src/caixa-calc.js` — PURO, sem I/O. `resumoCaixa(caixa, movimentos)` (`:7-40`) já devolve `recebidoPorForma`, `totalRecebido`, `recebidoDinheiro`, `suprimentos`, `sangrias`, `cancelamentos`, `canceladoPorForma`, `esperadoEspecie`. Demais helpers: `esperadoPorForma`, `esperadoEletronico`, `totalEmCaixa`, `calcularDiferenca`, `totalContagem` (`:42-88`).
- `src/dashboard-calc.js` — PURO. `montarDashboard(raw, cardapio)` (`:21-112`) a partir de `pedidos.dashboardRaw(dir)` (`src/pedidos.js:372`, exposta em `GET /api/dashboard`, `src/servidor.js:2244-2246`): top 10 produtos por faturamento (`:71-78`), ranking de categorias por quantidade (`:80-93`), vendas hoje/ontem/7 dias/mês (`:31-43,53-59`), ticket médio e taxa de cancelamento do mês (`:96-97`), canais de venda (%) e forma de pagamento predominante (%) (`:99-107`).
- `GET /api/estoque` (`src/servidor.js:2020-2038`, gated por `exigePdv`/Plano Completo) — devolve `{ linhas, contadores: { controlados, esgotados: N, baixos: N } }` via `estoque.linhasDeEstoque(cardapio)` (função pura em `public/estoque.js`). Regra de "baixo": `quantidade > 0 && quantidade <= minimo` (`public/estoque.js:18-25`, `statusEstoque(item)`).

## Contrato de saída

Ver campos listados acima — cada função já devolve objetos agregados prontos, sem necessidade de recalcular soma/agrupamento no relatório novo.

## Limites e cotas

NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

NÃO DOCUMENTADO nesta ingestão.

## Riscos para a nossa implementação

- `src/pdv.js` NÃO é fonte de dados históricos — é calculadora pura de UMA venda em curso (recalcular preço, desconto, split, troco — `src/pdv.js:37-187`). A persistência de venda PDV acontece via `caixa.venderLocal` (`src/caixa.js:200`). Não usar `pdv.js` para montar relatório.
- `public/relatorio-caixa.js` (`montarRelatorioFechamento`, linhas 41-123) é formatador de texto 48 colunas para impressora térmica — não é fonte de dado nova e não deve ser reaproveitado como está para Telegram (que aceita Markdown/HTML, formato de tela diferente do papel).
- `dashboard-calc.js` é a fonte mais pronta para um "resumo de vendas" amplo (produtos, canais, ticket médio); `caixa-calc.js` é mais focado em conferência de dinheiro do turno (útil para um relatório tipo "fechamento do dia"). A escolha de QUAL desses (ou os dois) compõe o relatório do Telegram é decisão de descoberta (F2), não uma obrigação técnica.
- `GET /api/estoque` está gated por `temPdv` (Plano Completo) — se o relatório de "estoque baixo" for oferecido a clientes do plano Essencial também, precisa decidir se helper interno (`estoque.linhasDeEstoque`) é chamado direto (sem o gate HTTP) ou se o alerta de estoque no Telegram fica restrito a quem já tem PDV.

## Fonte

`src/caixa.js:465-515,593-714,716,750`, `src/caixa-calc.js:7-88`, `src/dashboard-calc.js:21-112`, `src/pedidos.js:372`, `src/servidor.js:2020-2038,2244-2246`, `public/estoque.js:18-25`, `src/pdv.js:37-187`, `public/relatorio-caixa.js:41-123` — acessado em 2026-09-06

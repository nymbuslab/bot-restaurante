# Referência de formatação completa — public/relatorio-caixa.js

## Contrato de entrada

`montarRelatorioFechamento(d)` (`public/relatorio-caixa.js:41`, 127 linhas no arquivo todo)
recebe um objeto plano montado manualmente em `src/caixa.js:712-728` (um TERCEIRO objeto,
diferente de `resumo` e de `detalhe`):

- `d.restaurante` (:53) — nome do restaurante
- `d.abertoEm`, `d.fechadoEm` (:55) — ISO strings, formatadas via `dataHoraBR`
- `d.operador` (:56)
- `d.recebidoPorForma`, `d.canceladoPorForma` (:43-44) — de `resumo.recebidoPorForma`/`canceladoPorForma`
- `d.formas` (formas eletrônicas configuradas) e `d.formaDinheiro` (:45-46)
- `d.fundoTroco`, `d.suprimentos`, `d.sangrias` (:73-75) — de `caixa.fundo_troco` e `resumo.*`
- `d.cancelamentos` (array `{descricao, forma, valor}`, :90-98) — de `movimentos` filtrados por tipo
- `d.contadoDinheiro` (:103), `d.eletronicoPorForma` (:102)

## Contrato de saída

Texto de 48 colunas para impressora térmica. Internamente já calcula: `totalVendas` (:78-79,
líquido), `totalConferencia` (:82-83, esperado), `totalOperador` (:110, informado pelo
operador), `dif` (:113, diferença) e o estado textual `"CONFERIDO"/"SOBROU"/"FALTOU"` (:116).

## Limites e cotas

Formatação fixa para 48 colunas (papel térmico 80mm) — não aplicável a mensagem de Telegram
(que aceita Markdown livre).

## Erros conhecidos e tratamento

Não aplicável (formatador puro).

## Riscos para a nossa implementação

Este objeto `d` é o candidato mais completo pra reuso conceitual no formatador do Telegram — já
tem operador, datas, por forma esperado × contado, e permite recalcular diferença/estado com a
MESMA fórmula que o cupom físico usa (evita ter duas fórmulas de "sobrou/faltou" divergentes no
sistema). Duas lacunas: (1) não calcula quantidade de transações por forma — só valores; (2) só
aponta a diferença GLOBAL, não por forma (`detalhe.esperadoPorForma`/`detalhe.contadoPorForma`
já existem separados e permitiriam calcular diferença por forma, mas o `relatorio-caixa.js` não
faz isso hoje). Reaproveitar a MESMA fórmula de diferença/estado (não reescrever) é importante
para o texto do Telegram não divergir do cupom impresso em nenhum caso de borda (arredondamento,
sinal).

## Fonte

`public/relatorio-caixa.js:1-127` (lido por completo), `src/caixa.js:712-728` (montagem do
objeto `d`) — acessado em 2026-09-07

# Estado atual dos formatadores de mensagem (src/telegram.js)

## Contrato de entrada

`formatarMensagemFechamentoCaixa(detalhe)` (`src/telegram.js:171-196`) — o comentário da própria
função declara a entrada: "o resumo de caixa-calc.js (resumoCaixa) — totalRecebido,
recebidoPorForma, suprimentos, sangrias, cancelamentos". Campos efetivamente lidos:
`d.totalRecebido` (:179), `d.recebidoPorForma` (:180, iterado), `d.suprimentos`, `d.sangrias`,
`d.cancelamentos` (:188-190). NÃO lê: operador, data/hora, quantidade por forma, total
informado pelo operador, diferença, nem qual forma faltou/sobrou — nenhum desses campos é
referenciado no arquivo inteiro.

`formatarMensagemEstoqueBaixo(linhas)` (`src/telegram.js:198-213`) — recebe as linhas de
`public/estoque.js` (`linhasDeEstoque`) já filtradas por baixo/esgotado, cada uma com `nome`,
`quantidade`, `minimo`, `unidade` e os flags `esgotado`/`baixo`. Filtra
`criticos = linhas.filter(l => l.esgotado || l.baixo)` (:203) — **lista única**, sem separar
zerado de mínimo.

`config.telegram` — chaves confirmadas hoje em todo o projeto: `chatId` (id numérico do chat),
`codigoVinculacao` (código de uso único do deep link), `ultimoEnvio` (`{ em, status, erro? }`).
Nenhuma outra chave existe. Não há campo de preferências de tipo de relatório.

## Contrato de saída

Fechamento: título `*Fechamento de caixa*`, total recebido, seção "Por forma de pagamento" (só
valor, sem quantidade), extras (suprimentos/sangrias/cancelamentos) só se != 0.

Estoque: `criticos.length === 0` → "Sem itens com estoque baixo no momento."; senão, para cada
item: esgotado → `"- nome: esgotado"`; baixo → `"- nome: restam X (mínimo Y)"`. Título único
`*Estoque baixo*`.

## Limites e cotas

Ambas passam por `_encurtar()` (`src/telegram.js`), que corta em 4096 caracteres (limite do
`sendMessage`, já documentado na base da feature `relatorios-telegram`).

## Erros conhecidos e tratamento

Não aplicável — funções puras, não lançam por si (validado nos testes de `test/telegram.test.js`
T-01.05/T-01.06).

## Riscos para a nossa implementação

- A chamada em `src/caixa.js:757` (`_avisarRelatoriosTelegram(dir, resumo, cfg)`) só passa
  `resumo`, `cfg` e `dir` — três parâmetros. Para o formatador ganhar operador/data/quantidade
  por forma/diferença, a ASSINATURA dessa função (e o que ela repassa aos formatadores) precisa
  mudar, não só o corpo dos formatadores.
- Qualquer preferência nova de tipo de relatório (`config.telegram.tipos` ou equivalente) precisa
  seguir o MESMO padrão de merge já corrigido na feature anterior (ler o config inteiro via
  `store.ensure`+`store.getConfig`, mesclar só a sub-chave, nunca substituir `config` inteiro —
  `store.setConfig` faz replace total do jsonb).

## Fonte

`src/telegram.js:1-226` (lido por completo), `src/caixa.js:596-634` — acessado em 2026-09-07

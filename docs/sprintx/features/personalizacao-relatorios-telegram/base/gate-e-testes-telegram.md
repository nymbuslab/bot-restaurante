# Gate de plano e padrão de testes já existentes para o módulo Telegram

## Contrato de entrada

`empresas.temRelatoriosTelegram(emp)` (`src/empresas.js:376-378`):
`return acessoLiberado(emp) && planoDe(emp) === "completo";` — idêntico à regra de
`temCaixa`/`temPdv`/`temImpressao` (função própria, mesma regra, "porque sempre pode mudar sem
afetar o vizinho" per comentário do código). Nada mudou desde a feature anterior.

## Contrato de saída

Não aplicável.

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Não aplicável.

## Riscos para a nossa implementação

Arquivos de teste já existentes para o módulo Telegram, com o padrão a seguir:

- `test/telegram.test.js` — testa `src/telegram.js` isolado. Recarrega o módulo (`delete
  require.cache` + `require`) pra capturar env vars diferentes por teste; stuba `global.fetch`
  com `stubFetch(handler)`, restaura em `afterEach`.
- `test/telegram-fechamento-caixa.test.js` (245 linhas) — testa `caixa.fecharCaixa` disparando
  os envios. Stub de `dbMod.pool.connect()`/`dbMod.query` com match por regex no SQL; stub de
  `empresas.buscarPorSlug` e `telegram.enviar` por substituição direta de propriedade, restaurada
  em `finally`; fixture `configDe(chatId)` (tenant frio vs. vinculado); `cardapioDe()`; helper
  `flushar()` (`setImmediate`) pra aguardar o fire-and-forget antes de asserir.
- `test/telegram-admin-rotas.test.js` e `test/telegram-admin-ui.test.js` — leitura do
  arquivo-fonte como texto (`fs.readFileSync` + `indexOf`/regex), sem subir servidor Express nem
  DOM real. Env dummy do Supabase obrigatório no topo.
- `test/telegram-job.test.js` — mesmo padrão de leitura de `index.js` como texto.
- `test/empresas-telegram.test.js` — stub de `db.query` (`comQueryFake`).

Padrão geral: (a) env dummy do Supabase/DB no topo de todo teste que faz `require` de módulo
tocando banco; (b) stub por substituição direta de propriedade do módulo, sempre restaurado em
`finally`; (c) dois estilos — comportamento real (funções puras/quase-puras) vs. leitura de
arquivo-fonte como texto (UI/rotas/job sem harness de servidor/DOM). Qualquer task nova de rota
ou UI deve seguir o estilo (c); qualquer task nova de função pura deve seguir o estilo (b).

## Fonte

`src/empresas.js:372-378`, `test/telegram.test.js`, `test/telegram-fechamento-caixa.test.js`,
`test/telegram-admin-rotas.test.js`, `test/telegram-admin-ui.test.js`, `test/telegram-job.test.js`,
`test/empresas-telegram.test.js` — acessado em 2026-09-07

# Padrões de teste do projeto (para TDD desta feature)

> Modo INTERNO. Fonte: `CLAUDE.md` (raiz do repo) + arquivos de teste existentes, lidos diretamente.

## Contrato de entrada

- Runner: `node:test` nativo, sem dependência extra. `npm test` roda a suíte principal (`test/`, sem subpastas); `npm run test:integracao` roda `test/integracao/**` à parte, tocando um Postgres REAL descartável (`.env.test`, `BANCO_DE_TESTE=1`) — é a bateria que exercita rotas HTTP fim a fim (`CLAUDE.md`, seção "Como rodar").
- **`src/db.js` recusa acesso ao banco dentro do runner padrão** (detecta `NODE_TEST_CONTEXT`) — qualquer teste que precise de banco de verdade tem que rodar em `test/integracao/`, nunca em `test/` direto; a exceção consciente é `PERMITIR_BANCO_EM_TESTE=1`.
- Testes de integração existentes diretamente relevantes para esta feature (nomes e primeiras linhas lidos, não o corpo inteiro):
  - `test/integracao/pdv.test.js` — venda de PDV (rota `/api/pdv/vender`).
  - `test/integracao/mesas.test.js` (linhas 1-45 lidas) — cobre a máquina de estados da mesa (`livre → ocupada → fechando → livre`) e o cruzamento "caixa não fecha com mesa aberta". Usa `tenant.criarEmpresa`/`tenant.prepararLoja`/`tenant.cardapioDeUmItem` (helpers de `test/integracao/ajuda/`) e roda os casos **em ordem, compartilhando a mesma mesa** (`mesaId` no escopo do módulo) — não são testes isolados uns dos outros.
  - `test/integracao/cozinha-observacao.test.js` — comprova que a observação de item sai na via de cozinha real da fila de impressão (precedente direto para validar que o acréscimo desta feature também sai na via de cozinha).
- Testes de lógica pura de PDV fora de integração: `test/pdv.test.js`, `test/pdv-clique-produto.test.js`.
- Padrão de "arnês" para testar trecho de `public/app.js` sem instanciar o DOM inteiro (`test/apoio/pdv-modal-harness.js`, lido linhas 1-40): usa `vm.runInNewContext` sobre um TRECHO extraído do arquivo por `indexOf` de marcadores de função (ex.: `"function pdvVariacaoClick("` até o próximo `"\nfunction pdvBadgeDoItem"`), injetando um contexto mínimo (`pdvCart`, stubs de `renderPdvCarrinho`, etc.). É o padrão já usado para testar lógica de clique/modal do PDV sem depender do resto do arquivo.

## Contrato de saída

NÃO DOCUMENTADO (formato de output do runner é o padrão `node:test`, sem customização observada).

## Limites e cotas

NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

- `npm run test:ci` existe especificamente para rodar a partir de uma pasta vazia (evita o `dotenv` repor o `.env` local de produção) — é o que o hook de `pre-push` chama. Relevante só se esta feature mexer em algo que dependa de env vars novas (não previsto).

## Riscos para a nossa implementação

- Qualquer rota nova (`POST /api/pedidos/:id/itens` ou equivalente) precisa de teste em `test/integracao/`, seguindo o padrão de `mesas.test.js`/`pdv.test.js` (empresa de teste, cardápio de um item, chamada HTTP real contra Postgres descartável) — não dá para testar a transação (baixa de estoque + gravação + amarração de movimento) só com teste de lógica pura.
- Se a UI do modal de pedido (`abrirModalPedido`) ganhar um botão "Adicionar item", o padrão de arnês de `pdv-modal-harness.js` é o caminho já validado no projeto para testar isso sem montar o DOM inteiro — mas os marcadores `indexOf` desse arnês são FRÁGEIS a mudança de nome/posição de função; se a task tocar `pdvVariacaoClick`/`pdvTileClick`/`pdvGruposDoItem`, o arnês pode quebrar por texto, não por lógica.
- `mesas.test.js` roda casos em ordem, compartilhando estado — um padrão a seguir (ou explicitamente evitar) na F3 ao desenhar os testes desta feature, para não introduzir um estilo de teste inconsistente com o resto da suíte de integração.

## Fonte

`CLAUDE.md` (raiz do repo), seção "Como rodar" — lido nesta sessão (contexto de sistema).
`test/integracao/mesas.test.js:1-45` — lido em 2026-09-07.
`test/apoio/pdv-modal-harness.js:1-40` — lido em 2026-09-07.
Listagem de `test/pdv*.test.js`, `test/apoio/*.js`, `test/integracao/*.js` via glob — em 2026-09-07.

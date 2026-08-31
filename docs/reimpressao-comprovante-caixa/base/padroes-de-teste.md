# Padrões de teste do projeto

## Contrato de entrada

Três baterias, todas com o runner nativo `node:test` (sem dependência), declaradas em `package.json`:

| Comando | O que roda | Toca banco? |
|---|---|---|
| `npm test` | `node --test test/*.test.js` (só a raiz de `test/`, NÃO entra em subpasta) | Não |
| `npm run check` | `node scripts/check-syntax.js` — varredura de sintaxe | Não |
| `npm run test:ci` | `node scripts/test-ci.js` — roda a suíte de uma pasta vazia, para o `dotenv` não repor o `.env` local | Não |
| `npm run test:integracao` | `node scripts/test-integracao.js` — sobe o Express numa porta livre e fala HTTP contra Postgres REAL | Sim, contra `.env.test` |

`src/db.js` **recusa** acesso ao banco dentro do runner (detecta `NODE_TEST_CONTEXT`); `PERMITIR_BANCO_EM_TESTE=1` é a saída consciente, e o consumidor legítimo é a bateria de integração (`CLAUDE.md`, seção "Como rodar").

**Helpers de integração** (`test/integracao/ajuda/`):

- `ambiente.js` → `{ RAIZ, refDoProjeto, refTeste }` — recusa rodar se o `.env.test` apontar para o mesmo projeto do `.env` ou faltar `BANCO_DE_TESTE=1`.
- `app.js` → `{ subir, derrubar, pedir }`. `pedir(rota, { token, metodo, corpo })` devolve `{ status, corpo }`.
- `tenant.js` → `{ criarEmpresa, prepararLoja, cardapioDeUmItem, limparTudo }`. `criarEmpresa(nome, { plano })` aceita `plano: "completo"`.

**Esqueleto de um teste de integração** (`test/integracao/caixa-comprovantes.test.js:1-28`): `require("./ajuda/ambiente")` na primeira linha, `before` criando a empresa e preparando a loja, `after` com `app.derrubar()` + `tenant.limparTudo()`.

**Como o teste de comprovantes liga os toggles** (`test/integracao/caixa-comprovantes.test.js:33-40`): faz `GET /api/config`, mescla `cfg.impressao = { ...cfg.impressao, caixa }`, e faz `PUT /api/config`.

**Testes de função pura** ficam em `test/*.test.js` e importam o módulo dual-mode direto (ex.: `test/comprovante-caixa.test.js` para `public/comprovante-caixa.js`).

**Testes de front sem browser**: `test/avisos-falha.test.js` lê `public/app.js` como texto e casa regex contra um trecho delimitado (helper `trecho(marcador, ateMarcador)`, `test/avisos-falha.test.js:23-28`). É o padrão usado para travar comportamento de tela sem subir navegador.

## Contrato de saída

- `node:test` imprime `ℹ tests / pass / fail`. Task só fecha com `fail 0`.
- Estado atual no `HEAD` de referência: 519 em `npm test`, 46 em `npm run test:integracao`, 119 arquivos em `npm run check`.

## Limites e cotas

- `npm test` **não entra em subpasta** (o glob é `test/*.test.js`), por isso `test/integracao/` fica fora dele por construção.
- A bateria de integração leva ~48s (medido nesta sessão em 2026-08-30).
- Hook de `pre-push` em `.githooks/` roda `npm run test:ci` antes de deixar subir; liga com `git config core.hooksPath .githooks`.

## Erros conhecidos e tratamento

- Suíte verde no notebook e vermelha no GitHub: causa conhecida é o `dotenv` repondo o `.env` local; `npm run test:ci` é o que fecha esse buraco (`CLAUDE.md`, seção "Como rodar").
- Teste de integração que dependia da ORDEM da fila de impressão foi trocado por busca do comprovante pelo CONTEÚDO (`PROGRESSO.md`, item de 2026-08-30). Repetir esse cuidado: não assumir ordem na `impressao_fila`.

## Riscos para a nossa implementação

1. A validação de "o comprovante reimpresso é igual ao original" pede comparação de string do texto 80mm. O teste puro (`test/comprovante-caixa.test.js`) é o lugar barato para isso; a integração prova o caminho HTTP.
2. O ícone no front precisa de teste que não dependa de navegador: seguir o padrão `trecho()` de `test/avisos-falha.test.js`, e validar o visual à parte com Playwright.
3. `NÃO DOCUMENTADO`: não existe hoje nenhum teste que cubra reimpressão de comprovante de caixa (a feature não existe).

## Fonte

`package.json` (scripts), `test/integracao/ajuda/{ambiente,app,tenant}.js` (linhas de `module.exports`), `test/integracao/caixa-comprovantes.test.js:1-40`, `test/avisos-falha.test.js:23-28`, `CLAUDE.md` (seção "Como rodar") — acessado em 2026-08-30

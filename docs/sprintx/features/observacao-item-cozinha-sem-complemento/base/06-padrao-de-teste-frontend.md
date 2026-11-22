# Padrão de teste para funções soltas dentro de `public/app.js`

## Contrato de entrada

Runner: `node:test` nativo (`npm test`, roda `test/*.test.js` na raiz de `test/`, sem entrar em subpastas). O projeto já tem precedente direto para testar um trecho de `public/app.js` sem carregar o arquivo inteiro nem um DOM real: `test/caixa-reimpressao-front.test.js`.

Padrão observado (`test/caixa-reimpressao-front.test.js:1-38`):
1. Lê `public/app.js` como texto (`fs.readFileSync`).
2. Recorta o trecho de interesse com `indexOf("function X")` até o próximo marcador conhecido.
3. Monta um contexto (`vm.runInNewContext`) com stubs mínimos das globais que o trecho usa (`$`, funções auxiliares, `window.*` se necessário).
4. Executa o trecho recortado nesse contexto e chama a função exportada por ele, fazendo assert no HTML/estado resultante.

## Contrato de saída

Teste roda em Node puro, sem browser nem Playwright, cobrindo a lógica de decisão (não o CSS/layout).

## Limites e cotas

O recorte de string é frágil a reordenação de funções dentro de `app.js` — o próprio teste existente documenta isso com `assert.ok(inicio > -1 && fim > inicio, "trecho do caixa nao encontrado")`, falhando alto e claro se o marcador sumir.

## Erros conhecidos e tratamento

NÃO DOCUMENTADO.

## Riscos para a nossa implementação

- `pdvTileClick`, `pdvGruposDoItem`, `pdvCart` e `abrirPdvItemModal` são funções/variáveis de módulo (fechamento de arquivo, não `window.X`), então testar `pdvTileClick` isolado exige recortar (no mínimo) `pdvTileClick` + `pdvGruposDoItem` + o array `pdvCart` do arquivo real, ou stubar `pdvGruposDoItem` via `vm` context e inspecionar se `abrirPdvItemModal`/`pdvCart.push` foi chamado (mock das duas).
- Teste funcional mais simples e direto: extrair só a expressão de decisão (a condição `bib.length || vars.length || ehKg || <o que a F3 decidir>`) como teste de unidade puro, chamando `pdvTileClick` de fato com um `item` fixture (`{ id, nome, preco, unidade: "un", cozinha: true }`) e um `pdvGruposDoItem` stub que devolve `[]`, then assert que `abrirPdvItemModal` (stub) foi chamado em vez de `pdvCart.push`.
- Cobertura funcional completa (visual) exigiria Playwright, como já é praxe no projeto para UI (`CLAUDE.md`: "depois de implementar, rodar o app e olhar" + `webapp-testing` skill) — mas o `criterio_aceite` de cada task de código pode ficar só no teste `node:test`, com o Playwright reservado para a validação final de UI da F6 (mesmo padrão da reimpressão de comprovante).

## Fonte

`test/caixa-reimpressao-front.test.js:1-38`, `test/comanda.test.js:17-22,100,107` — acessado em 2026-09-03

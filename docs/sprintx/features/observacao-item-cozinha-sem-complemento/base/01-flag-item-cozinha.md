# Flag `item.cozinha` no modelo de dados

## Contrato de entrada

Campo booleano opcional em cada item do cardápio (`cardapio.categorias[].itens[].cozinha`), gravado no jsonb `empresas.config`/`cardapio`. Definido no editor de produto do painel: checkbox "Imprime na cozinha" — `public/app.js:2524` (reset ao abrir editor de item novo), `:2540` (carrega valor ao editar item existente), `:2650` (grava `novoItem.cozinha = true` se marcado; campo omitido quando falso).

## Contrato de saída

- Na API privada do painel (`GET /api/cardapio`, usada por PDV/Mesas via `carregarPdv` em `public/app.js:5915`), o item vem cru do jsonb, incluindo `cozinha`.
- Na projeção pública do cardápio web (`GET /api/c/:slug`), o campo `cozinha` **não é exposto** — `projetarCardapio` em `src/cardapio-web.js:34-51` monta um objeto whitelist e não inclui essa chave. Confirmado por leitura direta da função: não há `cozinha` na lista de campos devolvidos.

## Limites e cotas

NÃO DOCUMENTADO (não há limite específico documentado para este campo; segue o teto genérico de payload de `validarCardapio`, fora do escopo desta feature).

## Erros conhecidos e tratamento

NÃO DOCUMENTADO.

## Riscos para a nossa implementação

- Qualquer lógica no cardápio web (`public/cardapio.js`) que dependa de `item.cozinha` não vai funcionar, porque o campo nunca chega ao cliente. Se a feature precisar da flag no cardápio web, `projetarCardapio` precisa passar a incluir `cozinha` na projeção — mudança de contrato público, ainda que o valor não tenha sensibilidade (é só um comportamento de impressão interno).
- No PDV/Mesas o campo já chega inteiro (rota autenticada, sem whitelist), então nenhuma mudança de contrato é necessária nesses dois canais.

## Fonte

`public/app.js:2524`, `public/app.js:2540`, `public/app.js:2650`, `src/cardapio-web.js:23-56` — acessado em 2026-09-03

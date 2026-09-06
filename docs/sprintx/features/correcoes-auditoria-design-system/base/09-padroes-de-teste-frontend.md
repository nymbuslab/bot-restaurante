# Padrões de teste do projeto e a lacuna de teste para front-end estático (área transversal)

## Contrato de entrada

- Framework de teste: **`node:test`** nativo (sem dependência externa), comando
  `npm test` = `node --test test/*.test.js` (`package.json:12`). 48 arquivos hoje em `test/*.test.js`
  (contagem por `Glob`, 2026-09-05).
- Padrão observado em `test/caixa-calc.test.js:1-3`: `require("node:test")` +
  `require("node:assert/strict")`, importando funções PURAS exportadas por um módulo de
  `src/` (ex. `../src/caixa-calc`) e testando entrada/saída sem DOM, sem rede, sem banco.
- `npm run check` = `node scripts/check-syntax.js` — varredura de sintaxe (não é teste de
  comportamento).
- `npm run test:ci` = `node scripts/test-ci.js` — roda a suíte a partir de pasta vazia (garante
  que não depende do `.env` local).
- `npm run test:integracao` = `node scripts/test-integracao.js` — sobe o Express real e conversa
  por HTTP contra um Postgres de teste descartável; cobre backend (rotas, banco), não
  renderização de DOM/CSS.
- `CLAUDE.md` (raiz), seção "Definição de tarefa concluída", item 4: para mudança de UI, "Com
  ferramenta de validação visual disponível (Playwright, Chrome MCP, etc.): testar golden path +
  1-2 edges óbvios. Sem ferramenta disponível: declarar explicitamente 'build passou, UI não
  validada'." Ou seja, o próprio projeto já reconhece Playwright como via de validação visual —
  mas usada AD HOC durante a entrega (rodada manualmente pelo agente, relatada em prosa no
  `PROGRESSO.md`), nunca como arquivo de teste commitado em `test/`.
- Busca por `playwright` dentro de `test/*.test.js`: **0 ocorrências** — confirma que não existe
  hoje nenhum teste de DOM/CSS/acessibilidade persistido como parte da suíte automatizada.

## Contrato de saída

- A suíte `npm test` hoje só cobre módulos PUROS (lógica de cálculo, validação, parsing) que
  rodam em Node sem DOM — os arquivos "dual-mode" citados no `CLAUDE.md` raiz
  (`public/dinheiro.js`, `public/busca.js`, `public/estoque.js` e similares).
- `public/app.js` **NÃO é um módulo dual-mode**: não tem `module.exports`, depende de `document`/
  `window` globais, e mistura estado, DOM e lógica de negócio no mesmo arquivo — não pode ser
  `require()`ado por um teste `node:test` sem simular um DOM completo (jsdom não está nas
  dependências do projeto, `package.json:20-36` não lista `jsdom` nem qualquer lib de DOM
  virtual).
- Portanto, os 12 achados desta feature se dividem em duas categorias de testabilidade:
  1. **Testáveis por `node:test` puro, se extraídos**: nenhum dos 12 achados hoje tem lógica
     isolável óbvia (são todos mudança de markup/CSS/condição de exibição dentro de `app.js` ou
     `admin.html`/`admin-master.html`/`style.css`) — extrair uma função pura SÓ para poder testar
     seria over-engineering não pedido pelo escopo original.
  2. **Não testáveis por `node:test`**: mudanças de atributo HTML (`aria-label`, `aria-live`,
     `role`), de token/valor CSS (contraste, breakpoint, padding), e de tag (`h1`→`h2`).

## Limites e cotas

NÃO DOCUMENTADO (não se aplica).

## Erros conhecidos e tratamento

- Não há erro; é uma lacuna estrutural do projeto para este TIPO de mudança (front-end estático),
  não desta feature especificamente.

## Riscos para a nossa implementação

- **A regra inviolável 3 do sprintx ("TDD é obrigatório: o teste é escrito antes da
  implementação") e a regra 4 ("task só conclui com teste de integração E funcional verdes")
  não têm, hoje, um formato natural de teste automatizado para 10 dos 12 achados** (os 2
  restantes — nenhum, na verdade todos os 12 são desta natureza). Isso é uma decisão que a F2
  precisa resolver explicitamente com o dono, porque muda a forma de todas as tasks do plano.
  Alternativas observáveis no ecossistema do próprio projeto (nenhuma inventada, todas já usadas
  em trabalhos anteriores conforme `PROGRESSO.md`):
  1. **Teste estático de arquivo** (novo padrão para este projeto): um `node:test` que lê o
     arquivo-fonte via `fs.readFileSync` e usa regex/string match para confirmar a presença do
     atributo/valor esperado (ex.: confirma que `admin.html` contém
     `id="qr-fechar" aria-label="Fechar"`, ou que `style.css` contém `max-width: 1100px` no bloco
     do `.pdv`). É rápido, roda no `npm test`, mas testa só PRESENÇA de texto, não comportamento
     visual real (não pega, por exemplo, se o CSS tem um seletor mais específico anulando o
     efeito).
  2. **Validação visual manual via Playwright MCP**, como já foi feito em pelo menos 6 entregas
     anteriores (`PROGRESSO.md`, entradas de 2026-08-29 a 2026-08-31: "Playwright com o
     `style.css` real em 1366x768 e 390x844", "Playwright visível usando usuário de teste") —
     sem virar arquivo de teste commitado, só relatado em prosa no fechamento da task.
  - As duas não são mutuamente exclusivas — é razoável usar (1) para os achados de HTML/atributo
    (aria-label, role, heading) e (2) como confirmação visual dos achados de CSS puro (contraste,
    breakpoint, altura de botão), já que teste estático não prova que "o texto ficou legível" ou
    "a grade não ficou espremida".
  - **NÃO DOCUMENTADO**: o dono não expressou preferência entre (1) e (2), nem se aceita (1)
    como "teste de integração"/"teste funcional" válido para efeitos da regra 4 do sprintx —
    pergunta obrigatória da F2.

## Fonte

- `package.json:10-19` (scripts de teste) — lido em 2026-09-05.
- `test/caixa-calc.test.js:1-3` (padrão de teste puro) — lido em 2026-09-05.
- Busca `Glob test/*.test.js` (48 arquivos) e `Grep "playwright" em test/` (0 ocorrências) —
  executado em 2026-09-05.
- `CLAUDE.md` (raiz), seções "Como rodar" e "Definição de tarefa concluída" — lido em 2026-09-05.
- `PROGRESSO.md`, múltiplas entradas de 2026-08-29 a 2026-08-31 citando validação Playwright ad
  hoc (não commitada) — lido em 2026-09-05.

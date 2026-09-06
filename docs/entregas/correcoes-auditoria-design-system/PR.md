Corrige 12 achados de uma auditoria de design system (6 Alto, 5 Médio, 1 Baixo): avisos de sucesso/erro agora são lidos em voz alta por leitor de tela, botões de fechar anunciam "Fechar", contraste corrigido, telas de carregando/vazio/erro consistentes, e a ordem interna de decisão de PDV/Mesas/Caixa foi reorganizada para não confundir "sem caixa" com "erro de conexão".
Motivo: a auditoria (`docs/design-system/AUDIT.md`) reprovou o painel em acessibilidade e consistência visual. Os 2 achados classificados como Bloqueio (paginação de Pedidos, confirmação de exclusão sem nome) ficam fora deste PR, tratados à parte.

## Arquivos alterados

```
(raiz)
  M .gitignore
  M PROGRESSO.md
docs/design-system/
  A AUDIT.md
  A DESIGN-SYSTEM.md
  A RESUMO.md
docs/entregas/correcoes-auditoria-design-system/
  A ATENCAO.md
  A ENTREGA.md
  A QA-PACOTE.md
docs/legado/manual/
  A correcoes-auditoria-design-system.md
docs/legado/raio/
  A correcoes-auditoria-design-system.md
docs/sprintx/features/correcoes-auditoria-design-system/
  A 00-AUDITORIA.md
  A 00-BLOQUEIOS.md
  A 00-DECISOES.md
  A FECHAMENTO.md
  A ORQUESTRADOR.md
  A PORTAO-E2.md
docs/sprintx/features/correcoes-auditoria-design-system/base/
  A 00-INDICE.md
  A 00-LACUNAS.md
  A 00-toasts-e-botoes-fechar.md
  A 01-contraste-cor.md
  A 02-estados-carregamento-e-erro.md
  A 03-cardapio-estados-vazios.md
  A 04-campo-vs-auth-campo.md
  A 05-heading-painel-master.md
  A 06-button-mini-touch.md
  A 07-pdv-breakpoint.md
  A 08-abas-configuracoes-editor.md
  A 09-padroes-de-teste-frontend.md
docs/sprintx/features/correcoes-auditoria-design-system/sprint-01/
  A fases.md
  A sprint.md
  A tasks.md
docs/sprintx/features/correcoes-auditoria-design-system/sprint-02/
  A fases.md
  A sprint.md
  A tasks.md
public/
  M admin-master.html
  M admin.html
  M app.js
  M style.css
test/
  A arquivo-estatico.test.js
  A design-system-botoes-fechar.test.js
  A design-system-campo-auth-campo.test.js
  A design-system-cardapio-busca-vazia.test.js
  A design-system-cardapio-vazio.test.js
  A design-system-carregando.test.js
  A design-system-contraste.test.js
  A design-system-editor-tabs.test.js
  A design-system-erro-rede.test.js
  A design-system-heading-master.test.js
  A design-system-mini-lista.test.js
  A design-system-pdv-breakpoint.test.js
  A design-system-toast.test.js
test/apoio/
  A arquivo-estatico.js
```

Total: 52 arquivos.

## Origem

Trabalho sprintx `correcoes-auditoria-design-system` — feature de correção, não ocorrência de cliente.

## Raio de impacto

> **ALTO**

Sinais: 74 chamadores diretos de `toast()` em `public/app.js` (muito acima do teto de 15 do limiar MÉDIO/ALTO), e a zona Financeiro (caixa e PDV) tocada — `carregarCaixa`/`carregarPdv`/`carregarMesas` tiveram a ordem do gate de exibição reorganizada (de "esconde tudo, decide depois" para "mostra otimista, esconde no erro"). Qualquer um dos dois sinais isoladamente já classificaria ALTO. Nenhuma migração de banco, nenhum dado histórico reinterpretado — a mudança em si é só de apresentação (ARIA, CSS, texto de carregando, ordem de exibição).
Zonas tocadas: Financeiro (caixa e PDV) — `public/app.js` não está listado entre os arquivos dessa zona no `PERFIL.md`, mas suas funções são a contraparte de front-end dela.

## O que foi testado

- Harness de teste estático de arquivo (`contemTrecho`/`trechoEntre`), base para as 12 correções
- Toast com `aria-live` (aviso de sucesso/erro anunciado por leitor de tela)
- `aria-label="Fechar"` nos 4 botões de fechar (detalhe de pedido, QR Code, editor de item, adicionar cartão)
- Token de contraste do selo "Livre" das mesas
- Estado "Carregando…" em Pedidos, PDV, Mesas e Caixa
- Aviso de erro de conexão distinto de "abra o caixa" em PDV e Mesas
- Estado vazio do Cardápio (sem categoria) e da busca sem resultado
- Unificação visual de `.campo`/`.auth-campo`
- Título único (`<h1>`) por aba do Painel Master
- Altura de toque de `button.mini` no Cardápio (mobile)
- Breakpoint da grade de produtos do PDV em telas de notebook
- `role="tab"` nas abas do editor de item (Principal/Complementos/Variações)

Suíte: 573 passed, 0 failed — `npm test`. `npm run check`: 141 arquivos sem erro de sintaxe.

## Como reverter

Classe de reversão: **REVERSÍVEL**. Efeitos que o versionador não desfaz: nenhum — mudança 100% em arquivos de front-end estático (JS/HTML/CSS), sem migração de banco, sem dado gravado. `git revert`/`git restore` desfaz por completo, e os 14 arquivos de teste novos podem ser removidos junto sem deixar rastro em produção.

## Roteiro de teste manual

[QA-PACOTE.md](../../entregas/correcoes-auditoria-design-system/QA-PACOTE.md) — 17 casos (7 bloqueantes), **ainda não executado por um humano**.
Colaterais a observar: os Casos 1 a 7 testam exatamente o gate de PDV/Mesas/Caixa (o ponto do raio ALTO) — nunca liberar venda com caixa fechado, e nunca confundir queda de conexão com "sem caixa". Fora dessa área, os relatórios de fechamento de caixa e os comprovantes impressos devem continuar com os mesmos valores de sempre — nenhuma correção mexeu em cálculo.

## Onde eu quero seu olho

### OLHO OBRIGATÓRIO — ler linha a linha

- `public/app.js` — raio ALTO; reordena o gate de PDV/Mesas/Caixa sem cobertura de execução real (só teste estático de texto); ponto exato que os Casos 1-7 do roteiro manual (ainda não executado) testam
- `public/admin.html` — raio ALTO; markup novo dos blocos de erro de rede acionados pelo `app.js` acima
- `public/admin-master.html` — raio ALTO (conjunto-alvo do trabalho); mudança em si é cosmética (`<h1>`→`<h2>`, coberta por teste estático)
- `public/style.css` — raio ALTO (conjunto-alvo do trabalho)
- Os demais 34 arquivos (toda a documentação de processo em `docs/`) — nenhum critério de leitura rápida ou dispensável se aplica a documentação de planejamento/auditoria; sobem por regra de desempate, não por indício de defeito. Detalhe arquivo a arquivo em [ATENCAO.md](ATENCAO.md)

### LEITURA RÁPIDA — conferir intenção, não implementação

- `test/apoio/arquivo-estatico.js` — código novo em arquivo novo, com os dois testes verdes (T-01.01)

### DISPENSÁVEL — a máquina já provou

- Os 13 arquivos `test/*.test.js` — cada um só acrescenta caso, suíte verde, nenhuma asserção existente alterada ou removida. Lista completa em [ATENCAO.md](ATENCAO.md)

## Fora de escopo

Os 2 achados classificados como Bloqueio na mesma auditoria (`docs/design-system/AUDIT.md`) ficam fora: paginação da lista de Pedidos, e confirmação de exclusão de item sem mostrar o nome do item. Nenhum dos dois é tocado por este PR.

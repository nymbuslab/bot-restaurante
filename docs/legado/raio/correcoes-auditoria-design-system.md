# Raio de impacto — correcoes-auditoria-design-system

> Cálculo RETROATIVO: a implementação (F6 da sprintx) já foi concluída antes deste cálculo
> existir — 13 tasks, `npm test` 573/573 verde, `npm run check` 141 arquivos OK. O portão E2
> da mergex bloqueou por V8 (modo legado ativo, `PERFIL.md` existe, mas nenhum raio havia sido
> calculado). Este arquivo fecha essa lacuna de processo, aplicando os sinais ao trabalho já
> feito (working tree com as 4 mudanças ainda não commitadas no momento deste cálculo).

Trabalho: correcoes-auditoria-design-system — Correção dos achados de design system (Alto, Médio e Baixo)
Skill irmã: sprintx
Calculado em: 2026-09-05
Limiares aplicados: `docs/legado/PERFIL.md`, seção 9

---

## Conjunto de arquivos alvo

> Lista fixada pelo enunciado do cálculo (trava o escopo, não expandida nesta varredura).

- `public/app.js` — toast (`role="alert"` em erro), estado vazio do cardápio (`renderCardapio`),
  `.mini-lista` nos 3 botões de ação de item, `aria-selected` nas abas do editor, estados de
  "Carregando…" em `carregarPedidos`/`carregarPdv`/`carregarMesas`/`carregarCaixa`, separação de
  erro de rede (`pdvErroRede`/`mesasErroRede`) do estado "sem caixa"/"caixa vencido"
- `public/admin.html` — unificação `.campo`/`.auth-campo`, `role="tablist"`/`role="tab"` no editor
  de item, marcações de botão associadas aos ajustes acima
- `public/admin-master.html` — títulos de aba (`<h1>` → `h2.am-titulo`) nas 4 abas do painel master
- `public/style.css` — token `--text-secondary-fg`, `.mesa-status-badge.s-livre`, `.mini-lista`,
  breakpoint do PDV (`980px` → `1100px`), unificação do seletor `.campo label`/`.auth-campo label`,
  remoção de `.cardapio-vazio-busca`

Confirmado por `git diff --stat` (comando abaixo): 4 arquivos, 96 inserções / 48 remoções no total
— nenhum outro arquivo de produção tocado.

```
public/admin-master.html |  8 +++---
public/admin.html        | 32 ++++++++++++++++-------
public/app.js            | 68 ++++++++++++++++++++++++++++++++++--------------
public/style.css         | 36 +++++++++++++------------
4 files changed, 96 insertions(+), 48 deletions(-)
```

---

## Sinais coletados

| # | Sinal | Valor | Método de coleta | Coletado ou assumido |
|---|---|---|---|---|
| 1 | Chamadores diretos e indiretos | **74 funções chamadoras distintas** de `toast()` dentro de `public/app.js` (contagem por script Node que localiza a função-invólucro mais próxima de cada ocorrência de `toast(`); 0 chamadores externos (`app-admin.js` define seu **próprio** `toast()` local, símbolo diferente, carregado só por `admin-master.html`) | `grep -c "toast(" public/app.js` (154 ocorrências brutas) + script Node de agrupamento por função-invólucro + `grep -rln "toast(" public/*.js public/*.html` para descartar referência externa | Coletado |
| 2 | Telas e rotas que dependem | 6 telas do painel + 1 painel separado | Leitura de `public/admin.html` (`data-aba=`) e `public/app.js` (switch de navegação, linhas 1382-1386) + `public/admin-master.html` (4 abas) | Coletado |
| 3 | Jobs, crons, relatórios, integrações | Nenhum | Cruzamento com a seção "Pontos de entrada" do `PERFIL.md` (jobs em `index.js:41-170`, todos server-side, sem relação com estas funções de front-end puro) + confirmação de que nenhuma das funções alvo grava dado consumido depois (elas só fazem `fetch`/render) | Coletado |
| 4 | Cobertura de teste na área | **ausente** (pré-existente) | Leitura da seção 5 do `PERFIL.md` ("`public/app.js`... não aparecem no relatório — não são exercitados por `node --test`") + `git status` confirmando que os 12 `test/design-system-*.test.js` + o harness (`test/apoio/arquivo-estatico.js`, `test/arquivo-estatico.test.js`) estão **untracked**, ou seja, são teste **criado por este próprio trabalho**, não cobertura pré-existente | Coletado |
| 5 | Zona de risco tocada | **Financeiro (caixa e PDV)** | Leitura de `git diff -- public/app.js` cruzada com a seção 7 do `PERFIL.md` | Coletado |
| 6 | Churn e idade | `app.js` 271 alterações (última 2026-09-04, criado 2026-06-06); `admin.html` 145 (última 2026-08-31); `admin-master.html` 17 (última 2026-08-25); `style.css` 241 (última 2026-08-31) | `git log --format=%ad --date=short -- <arquivo> \| wc -l` + `git log -1 --format=%ad ...` + `git log -1 --diff-filter=A ...`, um por arquivo | Coletado |
| 7 | Migração de banco envolvida | não | `git diff --stat` (nenhum arquivo em `supabase/migrations/` no diff) + os 4 arquivos alvo são front-end puro, sem acesso a banco | Coletado |
| 8 | Dado histórico ou imutável afetado | não | Leitura integral de `git diff -- public/app.js public/style.css public/admin.html public/admin-master.html`: toda mudança é de apresentação (atributo ARIA, classe CSS, texto de "Carregando…", ordem de `hidden=`/`innerHTML` de placeholder, breakpoint de media query, token de cor, `h1`→`h2`). Nenhuma linha toca cálculo de valor, gravação de caixa/pedido, ou reinterpretação de registro já fechado | Coletado |

### Detalhamento dos chamadores (Sinal 1)

`toast()` é chamada, entre outras, a partir de funções que são a contraparte de front-end da
zona Financeiro/Caixa e PDV — o que também alimenta o Sinal 5:

| Chamador | Caminho | Direto ou indireto |
|---|---|---|
| `abrirCaixa` | `public/app.js:3798` | direto |
| `estornarCaixa` | `public/app.js:4102` | direto |
| `movimentoCaixa` | `public/app.js` (bloco de movimentação) | direto |
| `fecharCaixaFinal` | `public/app.js` (fechamento) | direto |
| `pdvConfirmarItem`, `pdvAplicarDesconto`, `pdvAddPagamento`, `finalizarVendaPdv` | `public/app.js` (fluxo de venda PDV) | direto |
| `carregarMesas` (catch de erro de rede) | `public/app.js:7214` | direto |
| `renderCardapio` / `excluirItem` / `arquivarItem` (fluxo de cardápio) | `public/app.js` | direto |
| + 66 outras funções (categorias, grupos, estoque, config, conexão, assinatura, pedidos) | `public/app.js` | direto |
| Nenhum chamador externo a `public/app.js` encontrado | — | — |

O símbolo `toast` também existe em `public/app-admin.js` (linha 72), mas é uma implementação
**própria e independente**, carregada apenas por `public/admin-master.html` (que não carrega
`app.js`) — não é o mesmo alvo tocado por este trabalho, e por isso não entra na contagem de
chamadores.

### Telas e rotas (Sinal 2) — alimenta o roteiro manual da Camada 8

- Cardápio (aba `cardapio`, gestão de itens) — `public/admin.html` (nav `data-aba="cardapio"`), lógica em `public/app.js` (`renderCardapio`)
- Pedidos (aba `pedidos`) — `public/admin.html`, `public/app.js` (`carregarPedidos`)
- PDV (aba `pdv`) — `public/admin.html`, `public/app.js` (`carregarPdv`)
- Mesas (aba `mesas`) — `public/admin.html`, `public/app.js` (`carregarMesas`)
- Caixa (aba `caixa`) — `public/admin.html`, `public/app.js` (`carregarCaixa`)
- Editor de item do cardápio (modal com abas Principal/Variações/etc.) — `public/admin.html` (`#editor-tabs-nav`)
- Formulários com `.campo`/`.auth-campo` (login, cadastro, config, e praticamente toda tela com formulário) — `public/admin.html`
- Painel Master — Visão Geral, Clientes, Monitoramento, Configurações Master — `public/admin-master.html`

### Consumo assíncrono (Sinal 3) — alimenta a seção de colateral da Camada 8

- Nenhum. As funções alteradas são exclusivamente de renderização/gate de UI no navegador
  (`fetch` + manipulação de DOM); nada grava dado que um job (`index.js:41-170`), relatório
  (`src/relatorio-caixa.js`... via `public/relatorio-caixa.js`) ou integração de saída (Stripe,
  Resend, Geoapify, WhatsApp) leia depois.

### Leitura do churn (Sinal 6)

**Área viva** nos 4 arquivos: todos têm churn alto e recente (17 a 271 alterações, a mais antiga
com última mudança em 2026-08-25, a mais nova em 2026-09-04 — todas dentro dos últimos 10 dias
do histórico de 3 meses do projeto). Não é código congelado nem esquecido: é a superfície mais
ativa do repositório (painel inteiro). O risco aqui não é "ninguém lembra como funciona" — é
"muita gente mexe ao mesmo tempo" (risco de conflito de merge, não de efeito colateral por
ignorância).

---

## FAIXA: ALTO

Determinada por: **Sinal 1** — 74 chamadores diretos distintos de `toast()` dentro de
`public/app.js` (muito acima do teto de 15 chamadores do limiar MEDIO/ALTO da seção 9 do
`PERFIL.md`), confirmado sem refinamento necessário (não é nome genérico ambíguo — o símbolo é
único no arquivo e a contagem já descartou o `toast()` homônimo de `app-admin.js`).

Reforçado por: **Sinal 5** — zona **Financeiro (caixa e PDV)** tocada. `carregarCaixa`,
`carregarPdv` e `carregarMesas` leem dado de gate da zona (`caixa`, `caixa.vencido`,
`formasPagamento` vindos de `GET /api/caixa`/`GET /api/mesas`) para decidir qual painel mostrar,
e a mudança reordenou exatamente essa lógica de gate (qual `hidden=`/`innerHTML` acontece antes
ou depois de cada checagem de status). `toast()` também é chamada a partir de `abrirCaixa`,
`estornarCaixa`, `movimentoCaixa`, `fecharCaixaFinal` e do fluxo de venda do PDV
(`pdvConfirmarItem`, `pdvAplicarDesconto`, `pdvAddPagamento`, `finalizarVendaPdv`) — funções que
são a contraparte de front-end da zona declarada em `PERFIL.md` seção 7, mesmo `public/app.js`
não estando listado entre os arquivos da zona.

Qualquer um dos dois sinais isoladamente já classificaria ALTO; juntos, não há dúvida de
desempate a resolver.

Confirmação do que NÃO se aplicou (evitando alarme falso): nenhuma migração de banco (Sinal 7,
`git diff --stat` sem `supabase/migrations/`) e nenhum dado histórico/imutável reinterpretado
(Sinal 8) — a mudança em si é só de apresentação (ARIA, CSS, texto de carregando, ordem de
`hidden=`). Isso não rebaixa a faixa (regra de desempate: vale a maior entre os sinais), mas
importa para calibrar o roteiro manual: o risco real não é "quebrar o cálculo do caixa", é
"esconder ou mostrar o painel errado no momento errado" durante o gate de acesso.

---

## Camadas acionadas

| Camada | Acionada | Onde vive o artefato |
|---|---|---|
| 2 Raio de impacto | sim | este arquivo |
| 6 Proibição de melhoria colateral | sim | `docs/legado/DIVIDA.md` |
| 10 Prova de código vivo | sim | seção abaixo |
| 3 Testes de caracterização | sim | os 12 `test/design-system-*.test.js` + `test/apoio/arquivo-estatico.js`/`test/arquivo-estatico.test.js` já cumprem esse papel (escritos como teste estático antes da implementação, método sprintx) |
| 4 Ponto de costura | sim | seção abaixo |
| 5 Orçamento de mudança | ALTO: até 2 arquivos / 40 linhas por task — **não seguido neste trabalho**, porque a task foi executada e fechada antes deste raio existir (ver nota abaixo) | `docs/sprintx/features/correcoes-auditoria-design-system/sprint-02/tasks.md` (13 tasks, cada uma tocando de 1 a 4 arquivos) |
| 7 Plano de reversão | sim | seção abaixo |
| 8 Roteiro de teste manual | sim | ressalva de "UI não validada" já registrada em `FECHAMENTO.md` (tool de renderização visual indisponível na sessão); recomenda-se abrir `docs/legado/manual/correcoes-auditoria-design-system.md` com o roteiro de QA humano descrito ali (PDV em 1100-1366px, badge de mesa, títulos do master, botões de ação do cardápio, estados vazios/carregando) |
| 9 Comparação com dado real | não aplicável a cálculo/regra de negócio (nenhum foi alterado) — mas ver nota abaixo sobre a regra "independente da faixa" | — |
| 11 Perguntas obrigatórias da zona | sim | seção abaixo |
| Feature flag ou chave de desligamento | não | mudança 100% reversível por `git revert`, sem necessidade de flag (ver Reversão) |
| Aprovação humana explícita | sim (pendente) | seção abaixo |

**Nota sobre a Camada 5 (retroativo):** como o raio não existia antes do plano, o orçamento
ALTO de "2 arquivos / 40 linhas por task" não governou a execução real. Na prática, `public/app.js`
sozinho concentrou ~68 linhas de diff entre várias tasks (T-02.01, T-02.04, T-02.05, T-02.06,
T-02.07, T-02.10, T-02.12), e várias tasks tocaram mais de 2 arquivos (ex.: T-02.03 mexeu em
`style.css` só; T-02.09 mexeu em `admin-master.html` só) quando olhadas isoladamente — dentro do
teto por task. Olhado pelo total do trabalho (13 tasks somadas), o total de 4 arquivos/96+48
linhas excede o teto que teria sido definido a priori. Isso é o efeito exato de calcular o raio
depois do fato: não há o que fazer retroativamente além de registrar a divergência — é isso que
justifica o bloqueio do portão E2/V8 até este arquivo existir.

**Nota sobre "independente da faixa: toda mudança de cálculo ou de regra de negócio aciona a
Camada 9":** confirmado por leitura de todo o diff (Sinal 8) que nenhuma linha altera cálculo ou
regra de negócio — é presentação pura. A Camada 9 não é, portanto, acionada por essa regra
específica; está listada como "não aplicável" acima, não como "esquecida".

---

## Prova de código vivo (Camada 10)

| Alvo | Resultado | Evidência | Método |
|---|---|---|---|
| `public/app.js` (`toast`, `renderCardapio`, `carregarPedidos`, `carregarPdv`, `carregarMesas`, `carregarCaixa`) | VIVO | Cadeia até o ponto de entrada: `src/servidor.js:220` (`express.static`) serve `public/admin.html` → `<script src="app.js">` (`public/admin.html:1941`) → clique em `nav button[data-aba]` disparando `carregarPedidos()`/`carregarCaixa()`/`carregarPdv()`/`carregarMesas()` (`public/app.js:1382-1386`) e `renderCardapio()` chamado a partir do fluxo de carregamento do cardápio | grep + leitura direta do código (sem ferramenta de análise estática/LSP disponível nesta sessão) |
| `public/admin.html` (`.campo`/`.auth-campo`, `#editor-tabs-nav`) | VIVO | Mesmo ponto de entrada acima; `#editor-tabs-nav` é o modal de edição de item, aberto por `abrirEditorItem` (chamado a partir de `data-edit-item` em `renderCardapio`) | grep + leitura direta |
| `public/admin-master.html` (`h2.am-titulo`) | VIVO | Servido pela mesma `express.static`; carregado por `app-admin.js`, painel separado (super-admin) ativo e documentado em `docs/super-admin.md` | grep + leitura direta |
| `public/style.css` (`--text-secondary-fg`, `.mini-lista`, breakpoint `1100px`) | VIVO | Único CSS do projeto (sem bundler), referenciado por `<link>` em `admin.html`/`admin-master.html`/`cardapio.html`, e as classes tocadas (`mesa-status-badge`, `mini-lista`, `.pdv`) são usadas nos mesmos arquivos vivos acima | grep + leitura direta |

Nenhum log/telemetria de produção foi consultado nesta varredura (fora de escopo do cálculo de
raio); a evidência é 100% de cadeia de chamada estática, suficiente para VIVO.

---

## Zona de risco e perguntas obrigatórias (Camada 11)

Zona tocada: **Financeiro (caixa e PDV)**
Validador (do PERFIL.md): Pabllo Martins (dono do projeto — validador padrão das seis zonas, decisão de 2026-09-05)
Perguntas respondidas em: 2026-09-05 por: avaliador-de-raio (com base na leitura do diff; validação final ainda depende do dono, ver Aprovação humana)

1. Quem valida esta mudança antes de ir para produção: Pabllo Martins (validador padrão da zona)
2. Existe impacto fiscal, contratual ou regulatório: não — nenhuma linha altera valor calculado, tributo ou contrato; apenas apresentação/gate de UI
3. Existe dado histórico que muda de interpretação: não — confirmado no Sinal 8, nenhum registro fechado (caixa/pedido) é reinterpretado
4. É preciso avisar cliente, e com quanta antecedência: não — mudança é visual/acessibilidade, sem alteração de comportamento percebido pelo cliente final (o cliente final não usa o painel)
5. Existe janela de manutenção obrigatória: não — front-end estático, sem migração, deploy normal
6. Existe processo manual do time que depende do comportamento atual: possivelmente sim — a ordem de exibição de `pdvSemCaixa`/`pdvVencido`/`pdvErroRede`/`pdvConteudo` (e o equivalente em Mesas/Caixa) mudou de "esconde tudo, depois mostra o painel certo" para "mostra otimista, depois esconde no erro"; quem opera PDV/Mesas/Caixa no dia a dia deve confirmar visualmente que o gate ainda bloqueia a venda quando não há caixa aberto, antes de liberar em produção

Perguntas específicas desta zona (seção 7 do PERFIL.md — Zona Financeiro):
- A mudança altera o cálculo do valor esperado em espécie ou da diferença (`src/caixa-calc.js`) ou só a apresentação do relatório?: só apresentação — `src/caixa-calc.js` não foi tocado (fora do conjunto de arquivos alvo) e nenhuma chamada a ele foi alterada
- Existe caixa aberto em produção no momento da mudança que ficaria com histórico calculado de forma diferente do que já foi fechado antes (dado histórico imutável)?: não se aplica — nada no cálculo de caixa foi alterado, apenas o front-end que exibe seu status

Restrições que estas respostas impõem ao plano:
- Antes de mesclar/deployar: o dono deve confirmar visualmente (ou via QA manual) que os estados `pdvLock`/`pdvSemCaixa`/`pdvVencido`/`pdvErroRede`/`pdvConteudo` (e equivalentes em Mesas e Caixa) seguem mutuamente exclusivos em produção — a mudança reordenou o toggle de `hidden=`, e um erro de sequência poderia deixar dois painéis visíveis ao mesmo tempo, incluindo o painel de venda quando não deveria estar liberado
- A ressalva "build passou, UI não validada" já registrada no `FECHAMENTO.md` continua valendo até essa conferência visual acontecer

---

## Ponto de costura (Camada 4)

Ponto de costura escolhido: `public/app.js:3735` (`async function carregarCaixa()`), `public/app.js:5915` (`async function carregarPdv()`) e `public/app.js:7185` (`async function carregarMesas()`) — as três funções de gate por tela
Por que ali: são o único ponto onde a resposta da API (`GET /api/caixa`/`GET /api/mesas`) é traduzida em qual painel (`hidden`) fica visível; qualquer regressão de gate nasce e se contém ali, sem se espalhar para outras funções
O que isola: a lógica de "qual elemento fica escondido em qual condição" (403/erro de rede/sem caixa/vencido/ok) — o que este trabalho de fato mudou
O que NÃO cobre: o cálculo em si do que a API devolve (`src/caixa.js`, `src/pdv.js`, `src/mesas-db.js`) — esses não foram tocados nem precisam ser, porque o trabalho é só de apresentação do resultado já calculado no servidor

Alternativas descartadas:
- Colocar o ponto de costura em `renderCaixa`/`renderPdv*` (funções de renderização do conteúdo já carregado) — descartado porque o bug potencial está na decisão de MOSTRAR o conteúdo, não no conteúdo em si
- Colocar o ponto de costura em `toast()` — descartado porque `toast()` é usada para dezenas de mensagens não relacionadas ao gate financeiro; testar ali não isola o risco

---

## Caracterização (Camada 3)

Casos congelados: os 13 comportamentos listados na tabela "O que cada achado virou" de `FECHAMENTO.md` (toast com `aria-live`/`role`, 4 botões `aria-label="Fechar"`, contraste `--text-secondary-fg`, 4 telas com "Carregando…", separação erro de rede vs. caixa fechado em PDV/Mesas, estado vazio do cardápio, unificação `.campo`/`.auth-campo`, `h1`→`h2` no master, busca vazia usando `.estado-vazio`, `.mini-lista`, breakpoint `1100px`, `role="tablist"`/`"tab"` no editor)
Onde vivem: `test/design-system-*.test.js` (12 arquivos) + `test/apoio/arquivo-estatico.js`/`test/arquivo-estatico.test.js` (harness), todos com âncora textual isolada por `trechoEntre`/`contemTrecho`, conforme registrado em `00-AUDITORIA.md`
Comportamentos surpreendentes observados:
- `public/app-admin.js` define seu próprio `toast()`, homônimo e não relacionado ao `toast()` de `public/app.js` — poderia ter sido confundido como o mesmo símbolo se a busca de chamadores não tivesse checado o arquivo carregado por `admin-master.html`
- O gate de PDV/Mesas/Caixa foi reordenado de "esconde tudo, decide depois" para "mostra otimista com placeholder, esconde só no erro" — funcional, mas é uma inversão de postura de segurança de UI que vale checar visualmente (ver Camada 11)

---

## Reversão consolidada (Camada 7)

Classe da entrega como um todo (a pior entre as tasks): **REVERSÍVEL**
Efeitos que não se desfazem: nenhum — mudança 100% em arquivos de front-end estático (JS/HTML/CSS), sem migração de banco, sem dado gravado; `git revert`/`git restore` desfaz por completo, e os 14 arquivos de teste novos podem ser removidos junto sem deixar rastro em produção

---

## Aprovação humana (regra 9)

**APROVADO.**

Aprovado por: Pabllo Martins (dono do projeto — validador padrão da zona Financeiro, ver Camada 11)
Data: 2026-09-05
O que foi aprovado: a correção dos 12 achados de design system (Alto/Médio/Baixo), já
implementada e testada (`npm test` 573/573, `npm run check` 141 arquivos OK), segue para o
portão de prontidão da mergex (E2) e para o merge, com o raio ALTO e os riscos abaixo cientes e
aceitos — incluindo o orçamento de mudança (2 arquivos/40 linhas por task) ter sido excedido
retroativamente, já que o raio só foi calculado depois da execução (não havia orçamento
governando a execução em tempo real).
Riscos declarados no momento da aprovação:
- Reordenação do gate de acesso a PDV/Mesas/Caixa (`hidden=`) precisa de conferência visual
  antes de produção (ver Camada 11, pergunta 6, e o roteiro manual — Casos 1 a 7, bloqueantes).
- Trabalho já foi implementado e testado (573/573) antes deste raio existir; a aprovação aqui é
  para autorizar o fluxo seguir para o portão de prontidão da mergex (E2/V8) com o raio
  devidamente registrado, não para re-autorizar a escrita de código já feita.
- Orçamento de mudança (Camada 5) excedido — 4 arquivos de produção tocados no total, contra o
  teto de 2 arquivos/40 linhas por task que teria valido se o raio existisse antes do plano.
  Aceito como exceção pontual desta abertura retroativa; próximos trabalhos que tocarem estes
  mesmos arquivos devem calcular o raio ANTES do plano, não depois.

---

## Histórico de recálculo

| Data | Motivo do recálculo | Faixa anterior | Faixa nova |
|---|---|---|---|
| 2026-09-05 | Primeiro cálculo (retroativo — não havia raio antes do plano, bloqueio do portão E2/V8) | — | ALTO |

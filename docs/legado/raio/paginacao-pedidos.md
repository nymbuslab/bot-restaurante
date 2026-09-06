# Raio de impacto — paginacao-pedidos

Trabalho: paginacao-pedidos — Paginação fixa da tela de Pedidos (10/página) vira "Carregar mais" (30 de cara, +20 por clique), client-side
Skill irmã: sprintx
Calculado em: 2026-09-06
Limiares aplicados: `docs/legado/PERFIL.md`, seção 9

---

## Conjunto de arquivos alvo

> Conjunto declarado nas tasks do plano (`sprint-01/tasks.md` T-01.01, `sprint-02/tasks.md` T-02.01 e T-02.02). Trava o escopo, não expandida nesta varredura.

- `public/paginacao-pedidos.js` (criado) — módulo dual-mode puro com a conta `contagemInicial`/`proximaContagem`/`temMais`
- `test/paginacao-pedidos.test.js` + `test/paginacao-pedidos-app.test.js` (criados) — testes do trabalho
- `public/app.js` — troca `PEDIDOS_POR_PAGINA`/`paginaPedidos` por contagem visível (`pedidosVisiveis`), remove paginação numerada (`paginacaoHtml`/`paginasVisiveis`/`irParaPagina`), adiciona botão "Carregar mais" em `renderListaPedidos`
- `public/admin.html` — tag `<script src="paginacao-pedidos.js">` antes de `app.js`
- `public/style.css` — regra `.ped-mais`

Sem alteração em `src/`, sem migração, sem env, sem rota.

---

## Sinais coletados

| # | Sinal | Valor | Método de coleta | Coletado ou assumido |
|---|---|---|---|---|
| 1 | Chamadores diretos e indiretos | **≤ 3 para cada símbolo tocado** | `grep` de `PEDIDOS_POR_PAGINA`, `paginaPedidos`, `paginacaoHtml`, `paginasVisiveis`, `irParaPagina`, `renderListaPedidos` em `public/*.js`: todos aparecem só dentro de `public/app.js`; `renderListaPedidos` é chamado por `renderPedidos` (app.js:5285) e `irParaPagina` (app.js:5245); `paginacaoHtml`/`paginasVisiveis`/`irParaPagina` têm 1 chamador interno cada. Nenhum chamador externo a `app.js` | Coletado |
| 2 | Telas e rotas que dependem | Aba Pedidos do painel (`public/admin.html`), data-aba `pedidos` | Leitura de `public/admin.html` (nav `data-aba="pedidos"`) e `public/app.js` (`renderPedidos`/`renderListaPedidos`) | Coletado |
| 3 | Jobs, crons, relatórios, integrações | Nenhum | Cruzamento com "Pontos de entrada" do `PERFIL.md` (jobs em `index.js:41-170`, todos server-side) e leitura direta: as funções tocadas só manipulam DOM sobre dado já carregado em `pedidosCache`; nada grava dado consumido depois | Coletado |
| 4 | Cobertura de teste na área | **ausente** (pré-existente) | Seção 5 do `PERFIL.md`: "`public/app.js`... não são exercitados por `node --test`"; `base/00-pedidos-renderizacao-e-paginacao.md`: "Nenhum teste automatizado cobre este código hoje" (sem ocorrência de `PEDIDOS_POR_PAGINA`/`renderListaPedidos`/`paginacaoHtml`/`paginasVisiveis` em `test/*.js`); os testes do plano são criados por ESTE trabalho | Coletado |
| 5 | Zona de risco tocada | **nenhuma** | Leitura integral da mudança (declarada nas tasks) cruzada com a seção 7 do `PERFIL.md`: os arquivos alvo não estão listados nas seis zonas (Financeiro, Stripe, Auth, LGPD, Cálculo contratual, Dado histórico); a mudança é confinada à paginação/contagem de exibição da lista de Pedidos, sem tocar gate de caixa/PDV/mesas, cálculo de valor ou registro fechado. Só o ponto de reset de `irParaPedidosAReceber` (app.js:4205) é tocado, e apenas a linha de reset de página → contagem visível, sem alterar o fluxo de navegação | Coletado |
| 6 | Churn e idade | `app.js` 272 alterações (última 2026-09-05, criado 2026-06-06); `admin.html` 146 (última 2026-09-05); `style.css` 242 (última 2026-09-05) | `git log --format=%ad --date=short -- <arquivo> \| Measure-Object -Line` + `git log -1 --format=%ad ...` + `git log -1 --diff-filter=A ...` | Coletado |
| 7 | Migração de banco envolvida | não | `git status`/diff do plano: nenhum arquivo em `supabase/migrations/`; os alvos são front-end puro, sem acesso a banco | Coletado |
| 8 | Dado histórico ou imutável afetado | não | Leitura integral das tasks: toda mudança é de apresentação/geração de HTML client-side (fatiar lista já em memória, remover botões de página, adicionar botão); nenhuma linha grava, recalcula valor ou reinterpreta registro fechado (caixa/pedido anonimizado) | Coletado |

---

## FAIXA: MEDIO

Determinada por: **Sinal 4** — cobertura de teste **ausente** na área (`public/app.js` não é exercitado por `node --test`; nenhum teste pré-existente cobre `renderListaPedidos`/paginação). O limiar `MEDIO = 4 a 15 chamadores, ou cobertura ausente, ou consumo por job/relatório` é disjuntivo: cobertura ausente basta.

Reforçado por: **Sinal 6** — área viva e de alto churn nos 3 arquivos (146 a 272 alterações em ~3 meses, última 2026-09-05), risco de conflito/regressão em superfície compartilhada (não classifica por si, mas calibra o roteiro manual).

Desempate com o precedente: o trabalho análogo anterior (`raio/correcoes-auditoria-design-system.md`) foi **ALTO**, mas por sinais que aqui NÃO ocorrem: lá o Sinal 1 achou 74 chamadores de `toast()` e o Sinal 5 apontou a zona Financeiro (reordenação do gate `hidden=` de PDV/Mesas/Caixa). Aqui nenhum símbolo tocado passa de 3 chamadores e nenhuma linha mexe em gate financeiro ou cálculo de valor — portanto não há sinal ALTO.

Confirmação do que NÃO se aplicou: nenhuma migração (Sinal 7), nenhum dado histórico reinterpretado (Sinal 8), nenhuma zona de risco (Sinal 5). A Camada 9 não é acionada: nenhuma mudança de cálculo ou de regra de negócio (a conta de "quantos mostrar" é decisão de exibição de UI sobre lista já carregada; preço/frete/caixa são intocados).

---

## Camadas acionadas

| Camada | Acionada | Onde vive o artefato |
|---|---|---|
| 2 Raio de impacto | sim | este arquivo |
| 6 Proibição de melhoria colateral | sim | `docs/legado/DIVIDA.md` (só se algo incomodar) |
| 10 Prova de código vivo | sim | seção abaixo |
| 3 Testes de caracterização | sim | `test/paginacao-pedidos-caracterizacao.test.js` (congela o comportamento atual ANTES da mudança, passa no código atual; após a implementação ele é superado pelos testes do próprio plano — ver seção de caracterização) |
| 4 Ponto de costura | sim | seção abaixo |
| 5 Orçamento de mudança | MEDIO: até 3 arquivos / 80 linhas por task | ver seção abaixo |
| 7 Plano de reversão | sim | seção abaixo |
| 8 Roteiro de teste manual | sim | `docs/legado/manual/paginacao-pedidos.md` (gerado na F6) |
| 9 Comparação com dado real | não | regra "independente da faixa" checada: nenhuma linha altera cálculo ou regra de negócio |
| 11 Perguntas obrigatórias da zona | não | nenhuma zona tocada (Sinal 5) |
| Feature flag ou chave de desligamento | não | mudança 100% reversível por `git revert` (ver Reversão) |
| Aprovação humana explícita | não | MEDIO não exige assinatura humana (só ALTO); o plano sprintx foi aprovado na F2/F5 (VEREDITO SIM) |

---

## Prova de código vivo (Camada 10)

| Alvo | Resultado | Evidência |
|---|---|---|
| `renderListaPedidos`/`PEDIDOS_POR_PAGINA`/`paginaPedidos`/`paginacaoHtml`/`paginasVisiveis`/`irParaPagina` (`public/app.js`) | VIVO | Cadeia até o ponto de entrada: `src/servidor.js:220` (`express.static`) serve `public/admin.html` → `<script src="app.js">` (admin.html:1941) → aba `pedidos` dispara `carregarPedidos()` (app.js:4876) → `renderPedidos()` (app.js:5256) → `renderListaPedidos()` (app.js:5294) → `paginacaoHtml`/`paginasVisiveis` (app.js:5227/5215). `irParaPedidosAReceber` (app.js:4183) é o atalho usado pelo bloqueio de fechamento de caixa. Confirmado por grep + leitura direta |
| `paginacao-pedidos.js` (novo) | será vivo ao ser incluído | `public/admin.html:1941` passará a carregar `paginacao-pedidos.js` antes de `app.js`; `renderListaPedidos` o usa (`PaginacaoPedidos.contagemInicial`/`temMais`/`proximaContagem`) |
| `public/admin.html` (ordem de `<script>`) | VIVO | Mesmo ponto de entrada da linha acima |
| `public/style.css` (`.ped-mais`) | será vivo | Único CSS do projeto (sem bundler), ligado via `<link>` em `admin.html`; a classe é referenciada no HTML gerado por `renderListaPedidos` |

Nenhum log/telemetria consultado; evidência 100% de cadeia de chamada estática, suficiente para VIVO.

---

## Ponto de costura (Camada 4)

Ponto de costura escolhido: **`public/app.js:5294` (`function renderListaPedidos`) + o par `PEDIDOS_POR_PAGINA`/`paginaPedidos` (app.js:4870-4871)**.
Por que ali: a paginação é 100% client-side e tem dois pontos de estado — a declaração da variável/constante (o que muda de "página 1 de 30 páginas de 10" para "contagem visível") e o fatiamento + bloco de controles dentro de `renderListaPedidos` (o único lugar que gera HTML de paginação). Toda a mudança nasce e se contém ali, sem tocar `renderPedidos` (filtros), `resumoPedidosHtml` ou o render de linhas/cards.
O que isola: a decisão de quantos pedidos exibir (fatiamento `lista.slice`) e o HTML de controles — exatamente o que este trabalho muda.
O que NÃO cobre: o filtro em `renderPedidos` (não tocado), o resumo `resumoPedidosHtml` (não tocado), a abertura de modal de detalhe e o selo de pagamento (`seloPagamento`/`canalTag`/`tagTipo`/`previaItens` — chamados pelo render, mas não alterados) e a busca/fetch no servidor (`GET /api/pedidos` não muda).

Alternativas descartadas:
- Medir altura da tela e calcular quantas linhas cabem (adaptativa) — descartado na F2 (D-01): não há container com altura própria para medir; exigiria resize/zoom e tratar desktop/mobile como casos distintos.
- Scroll infinito — descartado (D-04): menos previsível e mais difícil de testar que um clique.
- Dois mecanismos separados (desktop vs. celular) — descartado (D-07): tabela e cards leem a mesma fatia de dado; duplicar contraria o motivo de D-01.

---

## Orçamento de mudança por task (Camada 5, MEDIO: 3 arquivos / 80 linhas)

| Task | Arquivos | Orçamento declarado |
|---|---|---|
| T-01.01 | 2 criados (`paginacao-pedidos.js`, `paginacao-pedidos.test.js`) | ~50 linhas somadas — OK (arquivos novos, teto por task) |
| T-02.01 | 3 (`app.js`, `admin.html`, + teste `paginacao-pedidos-app.test.js` reutilizado) | diff em `app.js` ~28 linhas (remove 33, adiciona ~30); `admin.html` 1 linha; teste novo ~70 linhas. MEDIDO na execução contra o teto; estourou → quebrar/registrar em `00-BLOQUEIOS.md`, nunca em silêncio |
| T-02.02 | 3 (`app.js`, `style.css`, + mesmo teste) | diff em `app.js` ~15 linhas (bloco do botão); `style.css` ~10 linhas. MEDIDO na execução |

Observação de processo: o plano sprintx (F3-F5) foi planejado e auditado ANTES deste raio existir; as tasks do plano não declaravam orçamento. Este arquivo fecha a lacuna retroativamente e passa a governar a execução (mesmo caso do raio `correcoes-auditoria-design-system`, que foi calculado depois do plano; aqui o cálculo é anterior à F6).

---

## Plano de reversão (Camada 7)

Classe da entrega como um todo (a pior entre as tasks): **REVERSÍVEL**
Efeitos que o versionador não desfaz: **nenhum** — mudança 100% em front-end estático (JS/HTML/CSS) e testes; sem migração de banco, sem dado gravado, sem env var, sem rota nova. `git revert` do conjunto (ou `git checkout` dos 5 arquivos tocados) desfaz por completo; os 3 arquivos de teste podem ser removidos junto sem deixar rastro em produção. Sem flag a desligar, sem cache a invalidar (cache do cardápio é server-side e intocado). Risco residual: usuário que carregou a tela antes do deploy e usa o painel com a nova página é uma sessão de navegador → recarregar a aba basta.

---

## Histórico de recálculo

| Data | Motivo | Faixa anterior | Faixa nova |
|---|---|---|---|
| 2026-09-06 | Primeiro cálculo (antecipado à F6, antes de qualquer código) | — | MEDIO |
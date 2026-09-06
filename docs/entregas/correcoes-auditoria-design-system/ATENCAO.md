# Onde gastar atenção — correcoes-auditoria-design-system

Branch: `feature/correcoes-auditoria-design-system` → `main`
Data: 2026-09-05

**52 arquivos — 38 olho obrigatório, 1 leitura rápida, 13 dispensável**

(Recontagem após a própria E3 e a E5 gravarem `ATENCAO.md` e `QA-PACOTE.md` na pasta da entrega — os dois entram na mesma classificação dos demais documentos de processo, abaixo.)

A classificação é derivada de evidência registrada, nunca de sensação.
Tamanho de diff não é critério.

## OLHO OBRIGATÓRIO — ler linha a linha

### Os 4 arquivos que decidem se o gate financeiro continua seguro

| Arquivo | Mudança | Tamanho | Por quê |
|---|---|---|---|
| `public/app.js` | M | +49/-19 | **O8**: um dos 4 arquivos do conjunto-alvo do raio ALTO (`docs/legado/raio/correcoes-auditoria-design-system.md`). Reforçado por **O6**: `PERFIL.md` §5 registra que `app.js` "não é exercitado por `node --test`" — os 12 testes `design-system-*` criados por este trabalho são checagem estática de texto-fonte (`contemTrecho`/`trechoEntre`), não execução do JS no navegador; não há cobertura comportamental real antes nem depois. O diff reordena o gate `hidden=` de PDV/Mesas/Caixa (`carregarCaixa`/`carregarPdv`/`carregarMesas`) de "esconde tudo, decide depois" para "mostra otimista, esconde no erro" — o ponto exato que motivou o raio ALTO e que os Casos 1-7 (bloqueantes) do roteiro manual, ainda não executado, testam. |
| `public/admin.html` | M | +23/-9 | **O8**: mesmo conjunto-alvo do raio ALTO. Contém o markup novo dos blocos `pdvErroRede`/`mesasErroRede` acionados pelo JS acima — parte do mesmo gate financeiro sinalizado como risco. |
| `public/admin-master.html` | M | +4/-4 | **O8**: mesmo conjunto-alvo do raio ALTO. A mudança em si (`<h1>`→`<h2>` em 4 títulos, T-02.09) é cosmética e coberta por teste estático dedicado, mas o raio não distingue por tamanho/aparência — tamanho de diff não rebaixa faixa. |
| `public/style.css` | M | +20/-16 | **O8**: mesmo conjunto-alvo do raio ALTO (token de contraste, badge de mesa, breakpoint do PDV, unificação `.campo`/`.auth-campo`). |

Nota sobre O1: a zona "Financeiro (caixa e PDV)" do `PERFIL.md` §7 lista `src/caixa.js`, `src/caixa-calc.js`, `src/pdv.js`, `public/comprovante-caixa.js`, `public/relatorio-caixa.js`, `public/comanda.js` e migrações — nenhum dos 4 arquivos acima está nessa lista. O próprio raio reconhece isso explicitamente. A subida aqui é por **O8** (raio ALTO), não por O1.

### Os 32 documentos de processo (sprintx + legadox + mergex) — subida por regra de desempate

Nenhum destes é código executável, migração, contrato público, dado pessoal ou efeito irreversível (a Camada 7 do raio classifica a entrega inteira como **REVERSÍVEL**). Também não é teste que só acrescenta caso (D1, reservado a `*.test.js`), alteração mecânica coberta por regressão (D2), nem arquivo declarado gerado (D3 — `docs/stack/CONVENCOES.md` e `.gitattributes` não existem neste repositório, então não há como aplicar D3 a nenhum `.md`). Como nenhum critério O1-O9/L1-L3/D1-D3 bate, a regra de desempate ("arquivo que não bate em nenhum critério vai para OLHO OBRIGATÓRIO, com a razão declarada") os coloca aqui — não é uma afirmação de que escondem defeito de implementação: não há implementação para revisar linha a linha num `.md`.

| Arquivo | Mudança | Tamanho | Por quê |
|---|---|---|---|
| `.gitignore` | M | +3/-0 | Sem critério O/L/D aplicável. Desvio já registrado e aprovado (V9 do portão E2). |
| `PROGRESSO.md` | M | +2/-0 | Sem critério O/L/D aplicável. Desvio já registrado e aprovado (V9 do portão E2). |
| `docs/design-system/AUDIT.md` | A | +167 | Sem critério O/L/D aplicável. Documentação de auditoria de design, sem código. |
| `docs/design-system/DESIGN-SYSTEM.md` | A | +284 | Sem critério O/L/D aplicável. Cartografia do design system, sem código. |
| `docs/design-system/RESUMO.md` | A | +19 | Sem critério O/L/D aplicável. |
| `docs/entregas/correcoes-auditoria-design-system/ATENCAO.md` | A | (este arquivo) | Sem critério O/L/D aplicável. A própria classificação do E3. |
| `docs/entregas/correcoes-auditoria-design-system/ENTREGA.md` | A | +136 | Sem critério O/L/D aplicável. Registro da própria entrega. |
| `docs/entregas/correcoes-auditoria-design-system/QA-PACOTE.md` | A | +434 | Sem critério O/L/D aplicável. Pacote de QA (E5), roteiro de teste manual embutido. |
| `docs/legado/manual/correcoes-auditoria-design-system.md` | A | +463 | Sem critério O/L/D aplicável. Roteiro de teste manual — os Casos 1-7 (bloqueantes) ainda não foram executados por uma pessoa. |
| `docs/legado/raio/correcoes-auditoria-design-system.md` | A | +267 | Sem critério O/L/D aplicável. É o próprio cálculo de raio ALTO e a aprovação humana que sustentam esta classificação. |
| `docs/sprintx/features/.../00-AUDITORIA.md` | A | +62 | Sem critério O/L/D aplicável. Veredito da auditoria F5: SIM. |
| `docs/sprintx/features/.../00-BLOQUEIOS.md` | A | +15 | Sem critério O/L/D aplicável. Vazio (`bloqueios: []`). |
| `docs/sprintx/features/.../00-DECISOES.md` | A | +95 | Sem critério O/L/D aplicável. Decisões D-01 a D-09 da F2. |
| `docs/sprintx/features/.../FECHAMENTO.md` | A | +77 | Sem critério O/L/D aplicável. Ressalva de conferência visual não executada (T-02.03, T-02.09, T-02.10, T-02.11). |
| `docs/sprintx/features/.../ORQUESTRADOR.md` | A | +174 | Sem critério O/L/D aplicável. Mapa de execução da feature. |
| `docs/sprintx/features/.../PORTAO-E2.md` | A | +79 | Sem critério O/L/D aplicável. Histórico completo do portão (1ª rodada BLOQUEADA, 2ª PRONTO). |
| `docs/sprintx/features/.../base/00-INDICE.md` | A | +57 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/00-LACUNAS.md` | A | +21 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/00-toasts-e-botoes-fechar.md` | A | +38 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/01-contraste-cor.md` | A | +66 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/02-estados-carregamento-e-erro.md` | A | +109 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/03-cardapio-estados-vazios.md` | A | +80 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/04-campo-vs-auth-campo.md` | A | +73 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/05-heading-painel-master.md` | A | +63 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/06-button-mini-touch.md` | A | +64 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/07-pdv-breakpoint.md` | A | +74 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/08-abas-configuracoes-editor.md` | A | +67 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../base/09-padroes-de-teste-frontend.md` | A | +90 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../sprint-01/fases.md` | A | +49 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../sprint-01/sprint.md` | A | +44 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../sprint-01/tasks.md` | A | +50 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../sprint-02/fases.md` | A | +194 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../sprint-02/sprint.md` | A | +57 | Sem critério O/L/D aplicável. |
| `docs/sprintx/features/.../sprint-02/tasks.md` | A | +419 | Sem critério O/L/D aplicável. As 12 tasks, arquivos, testes e critérios de aceite de toda a feature. |

## LEITURA RÁPIDA — conferir intenção, não implementação

| Arquivo | Mudança | Tamanho | Por quê |
|---|---|---|---|
| `test/apoio/arquivo-estatico.js` | A | +22 | **L3**: código novo em arquivo novo, com os dois testes verdes. Task T-01.01, `teste_integracao`/`teste_funcional` definidos e verificados, `criterio_aceite` cumprido, suíte verde (546 passed). Helper puro (`contemTrecho`/`trechoEntre`), sem I/O, consumido só por testes — não atravessa contrato público nem zona de risco. |

## DISPENSÁVEL — a máquina já provou

Todos os 13 são status `A` (arquivo inteiramente novo); nenhum teste existente foi alterado ou removido.

| Arquivo | Mudança | Tamanho | Por quê |
|---|---|---|---|
| `test/arquivo-estatico.test.js` | A | +39 | **D1**: teste novo do helper de T-01.01, suíte verde. |
| `test/design-system-toast.test.js` | A | +26 | **D1**: T-02.01, suíte verde (548 passed). |
| `test/design-system-botoes-fechar.test.js` | A | +27 | **D1**: T-02.02, suíte verde (550 passed). |
| `test/design-system-contraste.test.js` | A | +46 | **D1**: T-02.03, suíte verde (555 passed). |
| `test/design-system-carregando.test.js` | A | +37 | **D1**: T-02.04, suíte verde (559 passed). |
| `test/design-system-erro-rede.test.js` | A | +65 | **D1**: T-02.05, suíte verde (562 passed). |
| `test/design-system-cardapio-vazio.test.js` | A | +28 | **D1**: T-02.06, suíte verde (563 passed). |
| `test/design-system-cardapio-busca-vazia.test.js` | A | +25 | **D1**: T-02.07, suíte verde (564 passed). |
| `test/design-system-campo-auth-campo.test.js` | A | +50 | **D1**: T-02.08, suíte verde (566 passed). |
| `test/design-system-heading-master.test.js` | A | +31 | **D1**: T-02.09, suíte verde (568 passed). |
| `test/design-system-mini-lista.test.js` | A | +31 | **D1**: T-02.10, suíte verde (571 passed). |
| `test/design-system-pdv-breakpoint.test.js` | A | +22 | **D1**: T-02.11, suíte verde (573 passed). |
| `test/design-system-editor-tabs.test.js` | A | +32 | **D1**: T-02.12, suíte verde (552 passed). |

## Síntese

A distribuição (36/50 em olho obrigatório) não significa "código arriscado demais" — separa duas coisas distintas. Os **4 arquivos de produção** merecem olho obrigatório por evidência concreta: são exatamente o conjunto-alvo do raio ALTO, e `app.js` reordena o gate de acesso a PDV/Mesas/Caixa sem cobertura de execução real (só checagem estática de texto), no ponto exato que o roteiro manual (ainda não executado) trata como bloqueante. Os outros **32 arquivos** são documentação de processo (sprintx + legadox + mergex) que a taxonomia olho/leitura/dispensável — desenhada para código — não tem onde encaixar: não são teste, não são geração automática declarada, não têm camada de código com cobertura. Pela regra de desempate do método, caem no topo por ausência de enquadramento, não por risco de implementação. É um sintoma de proporção (~30 documentos de planejamento/auditoria para 4 arquivos de código com 96 inserções/48 remoções ao todo), não de má fatia de código. Na prática: o revisor deve gastar a maior parte da atenção real nos 4 arquivos de produção e no roteiro manual pendente, e passar os olhos rápido sobre a documentação de processo, apesar de ela também estar listada aqui como olho obrigatório por regra de desempate.

## Fontes consultadas

- `docs/legado/PERFIL.md` — zonas de risco, cobertura de teste real, limiares do raio
- `docs/legado/raio/correcoes-auditoria-design-system.md` — cálculo de raio ALTO, conjunto de arquivos-alvo, sinais, aprovação humana
- `docs/legado/manual/correcoes-auditoria-design-system.md` — roteiro de teste manual (17 casos, 7 bloqueantes, ainda não executado)
- `docs/sprintx/features/correcoes-auditoria-design-system/sprint-01/tasks.md` e `sprint-02/tasks.md` — as 13 tasks, arquivos, testes e critérios de aceite
- `docs/sprintx/features/correcoes-auditoria-design-system/00-AUDITORIA.md`, `FECHAMENTO.md`, `PORTAO-E2.md` — veredito de auditoria, ressalvas de conferência visual, avisos V8/V9
- `docs/entregas/correcoes-auditoria-design-system/ENTREGA.md` — commits por task, lista completa de `arquivos_alterados`, desvios
- `git diff --name-status` e `git diff --numstat` (main...feature/correcoes-auditoria-design-system) — conteúdo real e tamanho do diff

## Fontes ausentes

- `docs/stack/CONVENCOES.md` — não existe. Sem ele não há como declarar nenhum `.md` do diff como "gerado" (D3); reforça, não enfraquece, a decisão de não aplicar D3.
- `.gitattributes` — não existe no repositório; descarta a via `linguist-generated` como justificativa de D3.
- Medição de cobertura de execução própria desta análise (`node --test --experimental-test-coverage`) não foi rodada nesta etapa; a afirmação de que `app.js`/`admin.html`/`admin-master.html` não são exercitados por `node --test` vem da medição já registrada em `PERFIL.md` (2026-09-05), tomada como fonte.
- Conferência visual humana do roteiro manual (Casos 1-7, bloqueantes): ainda não executada — sem ela, o risco real do gate financeiro em `app.js`/`admin.html` permanece só validado por teste estático de texto-fonte, não por execução no navegador.

---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: paginacao-pedidos
titulo: Paginacao fixa da tela de Pedidos vira Carregar mais
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f6
status: concluido
criado_em: 2026-09-06
atualizado_em: 2026-09-06
concluido_em: 2026-09-06
sprints: [sprint-01, sprint-02]
caminho_critico: [T-01.01, T-02.01, T-02.02]
modulo_afetado: [public, test]
arquivos_alterados: [public/admin.html, public/app.js, public/paginacao-pedidos.js, public/style.css, test/paginacao-pedidos-app.test.js, test/paginacao-pedidos.test.js]
palavras_chave: [pedidos, paginacao, carregar-mais, ui, painel, acessibilidade]
---

# Orquestrador — paginacao-pedidos

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

> Raio de impacto: **MEDIO** — docs/legado/raio/paginacao-pedidos.md (calculado na F6, antes de qualquer código, fechando a lacuna deixada na F3; governa orçamento/colateral/reversão da execução).

## 1. Objetivo

Corrigir a paginação fixa de 10 pedidos por página na tela de Pedidos (Bloqueio #1 da
auditoria de design system, `docs/design-system/AUDIT.md`), que deixa metade da tela vazia
em monitor grande. A lista passa a mostrar 30 pedidos de cara e um botão "Carregar mais"
soma 20 a cada clique, valendo igualmente para a tabela (desktop) e os cards (celular) —
os dois hoje compartilham o mesmo dado paginado (D-07).

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — decisões que governam o plano (D-01 a D-07, PENDENTE-01)
3. `base/00-INDICE.md` — e os 2 arquivos da base que ele lista
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/sprint.md` → `fases.md` → `tasks.md`
6. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução
7. `00-AUDITORIA.md` — achados MÉDIA/BAIXA que permanecem válidos (só existe após a F5)

## 3. Rota de execução

- Sprint 01: F-01.1 (única fase, sem paralelismo)
- Sprint 02: F-02.1 (única fase, sem paralelismo — as duas tasks tocam a mesma região de
  `public/app.js` em sequência)

**Caminho crítico:** T-01.01 → T-02.01 → T-02.02. As 3 tasks do plano inteiro formam uma
única cadeia sequencial — não há task paralelizável nesta feature.

## 4. Ferramentas

- **MCPs / SDKs:** nenhum além do padrão. Para a conferência visual (o botão aparece, some
  quando não há mais pedidos, funciona igual em desktop e celular), usar Playwright MCP se
  disponível; se não estiver, ver a exceção documentada na seção 7.
- **Testes:** `npm test` (roda `node --test test/*.test.js`, inclui
  `test/paginacao-pedidos.test.js` da sprint-01 e `test/paginacao-pedidos-app.test.js` da
  sprint-02). `npm run check` (varredura de sintaxe, `node scripts/check-syntax.js`).
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO.
- **Segredos:** nenhum segredo novo é necessário para este trabalho.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task (estático, via `contemTrecho`/
  `trechoEntre` de `test/apoio/arquivo-estatico.js` para as tasks que tocam `app.js`; real,
  via `node:test`, para T-01.01), vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma
  implementação errada (ex.: `PEDIDOS_POR_PAGINA` renomeado mas ainda fixo em 10, ou o botão
  presente mas nunca escondido)? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir
  `status: concluida`, incluindo a conferência visual manual quando a task envolve mudança
  puramente visual.

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem,
tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — todas as decisões já foram tomadas
   na F2 (`00-DECISOES.md`, D-01 a D-07).
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite`
   verificado. Não existe "concluído com ressalva".
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md`
   (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`. **Nesta
   feature, nenhuma task é `paralelizavel: true`** — um bloqueio trava a cadeia inteira, já
   que T-02.01 depende de T-01.01 e T-02.02 depende de T-02.01; registre o bloqueio e pare
   nessa task, não invente task paralela que o plano não declarou.
5. Só rode em paralelo o que o plano declarou paralelizável — nesta feature, nenhuma task o
   é.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e
   resultado da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.

## 7. Definição de pronto global

- As 3 tasks (1 da sprint-01 + 2 da sprint-02) estão com `status: concluida`.
- `npm test` termina com 0 failed (inclui `test/paginacao-pedidos.test.js` e
  `test/paginacao-pedidos-app.test.js`).
- `npm run check` termina sem erro de sintaxe.
- A mudança visual (botão "Carregar mais" aparecendo/sumindo corretamente, em desktop e em
  celular) foi conferida visualmente (Playwright MCP ou navegador), conforme decisão do
  usuário na F2.
  **Exceção documentada** (mesma do `CLAUDE.md` da raiz do projeto, "Definição de tarefa
  concluída", item 4): se a ferramenta de renderização visual não estiver disponível na
  sessão de execução, a task NÃO fica bloqueada — é concluída com a ressalva explícita
  "build passou, UI não validada" registrada no `FECHAMENTO.md` e no `status` da task em
  `tasks.md`. O teste estático continua obrigatório e verde; só a conferência visual
  adicional vira ressalva documentada quando a ferramenta não existe.
- `docs/sprintx/features/paginacao-pedidos/FECHAMENTO.md` gravado ao final.
- `PROGRESSO.md`: o item "(P1) Paginação fixa da tela de Pedidos" movido de "🔄 Em
  Andamento" para "✅ Concluído". A PENDENTE-01 (`00-DECISOES.md`) **já está registrada**
  em "📋 Próximos Passos" como "(P2) Sem teto de linhas no filtro de período customizado
  de Pedidos" desde a F2 — nada a fazer com ela no fechamento além de confirmar que
  continua lá.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em `sprint-01/tasks.md` e `sprint-02/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências
   (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio
   registrado seja resolvido.

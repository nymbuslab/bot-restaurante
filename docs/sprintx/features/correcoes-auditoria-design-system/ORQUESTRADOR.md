---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: correcoes-auditoria-design-system
titulo: Correcao dos achados de design system (Alto, Medio e Baixo)
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f6
status: concluido
criado_em: 2026-09-05
atualizado_em: 2026-09-05
concluido_em: 2026-09-05
sprints: [sprint-01, sprint-02]
caminho_critico: [T-01.01, T-02.01]
modulo_afetado: [public, test]
arquivos_alterados:
  - test/apoio/arquivo-estatico.js
  - test/arquivo-estatico.test.js
  - public/app.js
  - public/admin.html
  - public/admin-master.html
  - public/style.css
  - test/design-system-toast.test.js
  - test/design-system-botoes-fechar.test.js
  - test/design-system-editor-tabs.test.js
  - test/design-system-contraste.test.js
  - test/design-system-carregando.test.js
  - test/design-system-erro-rede.test.js
  - test/design-system-cardapio-vazio.test.js
  - test/design-system-cardapio-busca-vazia.test.js
  - test/design-system-campo-auth-campo.test.js
  - test/design-system-heading-master.test.js
  - test/design-system-mini-lista.test.js
  - test/design-system-pdv-breakpoint.test.js
palavras_chave: [acessibilidade, design-system, ui, aria, contraste, toast, cardapio, pdv]
---

# Orquestrador — correcoes-auditoria-design-system

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

Corrigir os 12 achados de severidade Alto (6), Médio (5) e Baixo (1) registrados em
`docs/design-system/AUDIT.md` (mais um 4º botão sem `aria-label` achado na ingestão, D-09) —
acessibilidade (toast, botões de fechar, abas do editor), contraste de cor, estados de
carregamento/erro/vazio, e consistência de padrões (formulário, heading, botão, breakpoint do
PDV). Os 2 Bloqueios da mesma auditoria (paginação de Pedidos e confirmação de exclusão sem
nome) ficam FORA deste trabalho.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — decisões que governam o plano (D-01 a D-09)
3. `base/00-INDICE.md` — e os 10 arquivos da base que ele lista
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/sprint.md` → `fases.md` → `tasks.md`
6. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução
7. `00-AUDITORIA.md` — achados MÉDIA/BAIXA que permanecem válidos (só existe após a F5)

## 3. Rota de execução

- Sprint 01: F-01.1 (única fase, sem paralelismo)
- Sprint 02: F-02.1 → F-02.2 → F-02.3 → F-02.4 → F-02.5 → F-02.6 (todas sequenciais — nenhuma
  fase roda em paralelo com outra, porque a maioria das 12 tasks toca `public/app.js`,
  `public/admin.html` ou `public/style.css`, arquivos compartilhados entre fases)

Dentro de cada fase, as tasks que a compõem também são sequenciais (todas `paralelizavel: false`
— ver a nota no topo de `sprint-02/tasks.md`).

**Caminho crítico (dependência formal):** T-01.01 → T-02.01. Nenhuma task da sprint-02 declara
`depende_de` (todas têm `depende_de: []`) — a precedência de `T-01.01` sobre a sprint-02 inteira
é ESTRUTURAL (regra do método: a sprint-01 entrega a capacidade de testar antes de qualquer task
de negócio rodar), não uma dependência funcional task a task; declarar `depende_de: [T-01.01]`
em cada uma das 12 tasks impediria qualquer uma de ser `paralelizavel: true` (contradição
"paralelizavel com depende_de não vazio"), o que bloquearia sem necessidade a T-02.09. T-02.01
foi escolhida como representante do caminho crítico dentro da sprint-02 pelo critério de
desempate — menor id — já que todas as 12 tasks têm o mesmo comprimento de cadeia (1, sem
dependência entre si). **Este campo não reflete a ordem real de execução**: como 11 das 12
tasks da sprint-02 foram declaradas sequenciais por decisão de plano (arquivos compartilhados,
não dependência funcional), a ordem efetiva de execução até a conclusão da feature percorre as
13 tasks completas, na ordem em que aparecem em cada `tasks.md`: T-01.01 → T-02.01 → T-02.02 →
T-02.03 → T-02.04 → T-02.05 → T-02.06 → T-02.07 → T-02.08 → T-02.09 → T-02.10 → T-02.11 →
T-02.12 (T-02.09 pode rodar a qualquer momento dessa sequência, por ser `paralelizavel: true` e
não conflitar com nenhum arquivo de outra task).

## 4. Ferramentas

- **MCPs / SDKs:** nenhum além do padrão. Para conferência visual das tasks T-02.03 (contraste),
  T-02.09 (letter-spacing do heading), T-02.10 (altura de botão) e T-02.11 (breakpoint do PDV),
  usar Playwright MCP se disponível (ver `docs/design-system/AUDIT.md` e `PROGRESSO.md` para o
  padrão já usado em entregas anteriores: 1366×768 e 390×844). Se não estiver disponível, ver a
  exceção documentada na seção 7 (Definição de pronto global).
- **Testes:** `npm test` (roda `node --test test/*.test.js`, inclui `test/arquivo-estatico.test.js`
  da sprint-01 e os 12 arquivos `test/design-system-*.test.js` que cada task da sprint-02 cria).
  `npm run check` (varredura de sintaxe, `node scripts/check-syntax.js`).
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO (projeto é JavaScript puro, sem TypeScript).
- **Segredos:** nenhum segredo novo é necessário para este trabalho.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task (o teste estático via
  `contemTrecho`, de `test/apoio/arquivo-estatico.js`), vê ambos falharem, implementa até
  passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma
  implementação errada (ex.: o atributo/valor certo mas no lugar errado, ou uma string
  parecida mas não idêntica)? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir
  `status: concluida`, incluindo a conferência visual manual quando a task envolve mudança
  puramente visual (D-01: contraste, breakpoint, altura de botão).

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem, tratando
cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — todas as decisões de design/UX já foram
   tomadas na F2 (`00-DECISOES.md`, D-01 a D-09).
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite`
   verificado. Não existe "concluído com ressalva".
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md`
   (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`, pular para a
   próxima paralelizável. Nunca parar e esperar. **Nesta feature, só `T-02.09` é
   `paralelizavel: true`** — um bloqueio em qualquer uma das outras 12 tasks (todas sequenciais
   por arquivo compartilhado) não tem outra task paralela para onde pular; nesse caso, registre
   o bloqueio e siga para a PRÓXIMA TASK NA ORDEM do `tasks.md` (que pode ficar temporariamente
   fora de ordem se a task seguinte também depender do que travou — registre isso também).
5. Só rode em paralelo o que o plano declarou paralelizável — nesta feature, só `T-02.09` foi
   declarada `paralelizavel: true` (não conflita com nenhum arquivo de outra task); as demais 12
   são sequenciais, task a task.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado
   da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.

## 7. Definição de pronto global

- As 13 tasks (1 da sprint-01 + 12 da sprint-02) estão com `status: concluida`.
- `npm test` termina com 0 failed (inclui `test/arquivo-estatico.test.js` da sprint-01 e os 12
  arquivos `test/design-system-*.test.js`, um por task da sprint-02).
- `npm run check` termina sem erro de sintaxe.
- As mudanças puramente visuais (T-02.03 contraste, T-02.09 letter-spacing do heading, T-02.10
  altura de botão, T-02.11 breakpoint do PDV) foram conferidas visualmente (Playwright MCP ou
  navegador) em pelo menos duas larguras de tela, conforme decisão do usuário na F2 (definição
  de pronto confirmada em `00-DECISOES.md`).
  **Exceção documentada (achado ALTA da F5, corrigido aqui):** se a ferramenta de renderização
  visual não estiver disponível na sessão de execução, a task NÃO fica bloqueada — segue a
  mesma regra que o `CLAUDE.md` da raiz do projeto já define para qualquer mudança de UI
  ("Definição de tarefa concluída", item 4): a task é concluída com a ressalva explícita "build
  passou, UI não validada" registrada no `FECHAMENTO.md` e no `status` da task em `tasks.md`.
  Isso NÃO é "concluído com ressalva" no sentido proibido pela regra de autonomia 3 (que veda
  fechar sem os testes automatizados passando) — o teste estático dessas 4 tasks continua
  obrigatório e verde; só a conferência visual adicional vira ressalva documentada quando a
  ferramenta não existe.
- `docs/sprintx/features/correcoes-auditoria-design-system/FECHAMENTO.md` gravado ao final.
- `PROGRESSO.md`: o item "(P1) Corrigir os 12 achados Alto/Médio/Baixo da auditoria de design
  system" movido de "📋 Próximos Passos" para "✅ Concluído".

> **Status final (2026-09-05):** as 13 tasks (1 da sprint-01 + 12 da sprint-02) estão
> `concluida`; `npm test` fecha em 573 passed, 0 failed; `npm run check` varre 141 arquivos sem
> erro de sintaxe. As conferências visuais foram documentadas com a ressalva prevista acima
> (tool de renderização indisponível na sessão), ver `FECHAMENTO.md`.

Branch do trabalho: feature/correcoes-auditoria-design-system (base: main) — aberta em 2026-09-05 pela mergex (retroativa: a F6 já havia sido executada direto em `main`, sem branch; a mergex abriu a branch carregando as mudanças já feitas e passou a organizá-las em commits por task/arquivo a partir daqui).

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em `sprint-01/tasks.md` e `sprint-02/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`)
   estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

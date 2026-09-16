---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: extrato-geral-estoque
titulo: Extrato geral do restaurante (estoque)
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f4
status: nao_iniciado
criado_em: 2026-09-16
atualizado_em: 2026-09-16
concluido_em: null
sprints: [sprint-01, sprint-02, sprint-03]
caminho_critico: [T-02.01, T-02.02, T-03.03, T-03.04]
modulo_afetado: [raiz, test, public]
arquivos_alterados: []
palavras_chave: [estoque, extrato, relatorios, movimentos, filtro-tipo, periodo, paginacao-cursor, plano-completo]
---

# Orquestrador — extrato-geral-estoque

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

Dar ao dono uma visão consolidada de TODOS os movimentos de estoque do restaurante (entrada,
perda, contagem, ajuste — e opcionalmente venda/devolução) numa tela só, com filtro por tipo
e por período, sem precisar abrir produto por produto. Vive numa aba "Relatórios" nova no
painel, reaproveitando a tabela `estoque_movimentos` e o padrão de paginação por cursor já
usado na gaveta de produto único.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — decisões que governam o plano (D-01 a D-09 + nota do portão de design)
3. `base/00-INDICE.md` — e os arquivos da base que ele lista
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/` e `sprint-03/`, na ordem
6. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução
7. `00-AUDITORIA.md` — achados MÉDIA/BAIXA que permanecem válidos (quando existir)

## 3. Rota de execução

- Sprint 01: F-01.1 (protótipo + aprovação do dono — portão obrigatório, ver Regra 8) ∥ Sprint 02
- Sprint 02: F-02.1 (T-02.01 → T-02.02, sequencial) — backend puro, não toca UI, roda em paralelo com a Sprint 01 (o portão de design só bloqueia código de UI)
- Sprint 03: F-03.1 (T-03.01 ∥ T-03.02, paralelas — ambas dependem de T-01.01 aprovada) → F-03.2 (T-03.03 → T-03.04 — T-03.03 também depende de T-02.02)

**Caminho crítico:** T-02.01 → T-02.02 → T-03.03 → T-03.04 (a Sprint 01 roda em paralelo e
alimenta T-03.01/T-03.02, que empatam em comprimento com T-02.02 mas não o superam — o portão
de design não é o gargalo do trabalho, o backend é).

## 4. Ferramentas

- **MCPs / SDKs:** `mcp__stitch` para o protótipo da Sprint 01 (obrigatório, ver Regra 8);
  nenhum outro MCP/SDK novo além do padrão do projeto.
- **Testes:** `npm run test:ci` (unitários, sem banco) e `npm run test:integracao` (HTTP real
  contra Postgres de testes — necessário para T-02.02).
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO.
- **Sintaxe:** `npm run check`.
- **Segredos:** nenhum segredo novo. Reusa `DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` já configurados (`.env` local / secrets do ambiente).

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task, vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem, tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — **exceto a Regra 8**.
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite` verificado. Não existe "concluído com ressalva".
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md` (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`, pular para a próxima paralelizável. Nunca parar e esperar.
5. Só rode em paralelo o que o plano declarou paralelizável; a execução nunca decide paralelismo.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.
8. **Exceção obrigatória: T-01.01 é um portão de design, não uma task de código.** Regra global
   do usuário (CLAUDE.md) proíbe escrever qualquer código de UI antes de protótipo aprovado —
   isso vale mesmo durante execução autônoma, e vence a regra 1 desta lista. Ao chegar em
   T-01.01, gerar o protótipo via `mcp__stitch`, mostrar o link ao dono e **PARAR**: não avançar
   para nenhuma task de Sprint 03 (UI) sem resposta explícita de aprovação — a Sprint 02
   (backend, sem UI) pode rodar em paralelo, sem esperar essa aprovação. Isso não é um
   bloqueio (`00-BLOQUEIOS.md`) nem uma dúvida de execução — é o único portão que a autonomia
   deste método não dispensa.

## 7. Definição de pronto global

- Dono abre a aba "Relatórios" e vê o extrato geral de estoque (D-04).
- Filtro por tipo permite múltipla seleção, com os 4 tipos operacionais marcados por padrão (D-01, D-05).
- Filtro por período tem presets (Hoje/7 dias) + customizado (D-06).
- Lista pagina por cursor sem repetir nem pular linha, sem teto de dias (D-07).
- Extrato geral não busca por produto (D-08) — quem quer um produto usa a gaveta já existente.
- Tenant sem Plano Completo vê a mesma tela de bloqueio já usada em Controle de estoque (D-09).
- `npm run test:ci` e `npm run test:integracao` verdes com os testes das 6 tasks de código
  (T-02.01, T-02.02, T-03.01 a T-03.04).

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Se `T-01.01` ainda não está `concluida`, essa é a próxima task — e continua sendo um portão de aprovação, não código.
5. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: estoque-e-custos
titulo: Estoque e custos (Compras, Insumos, Estoque, ficha tecnica e financeiro de fornecedores)
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: execucao
status: em_andamento
criado_em: 2026-09-15
atualizado_em: 2026-09-16
concluido_em: null
sprints:
  - { id: sprint-01, status: concluida }
  - { id: sprint-02, status: concluida }
  - { id: sprint-03, status: concluida }
  - { id: sprint-04, status: concluida }
  - { id: sprint-05, status: pendente }
  - { id: sprint-06, status: em_andamento }
  - { id: sprint-07, status: pendente }
  - { id: sprint-08, status: pendente }
caminho_critico: "T-01.01 -> T-01.02 -> T-01.03 -> T-02.01 -> T-02.02 -> T-02.03 -> T-02.04 -> T-03.01 -> T-03.02 -> T-03.03 -> T-04.01 -> T-04.02 -> T-05.01 -> T-05.02 -> T-05.03 -> T-05.04 -> T-06.01 -> T-06.02 -> T-06.03 -> T-06.04 -> T-07.01 -> T-07.02 -> T-07.03 -> T-07.04 -> T-08.01"
modulo_afetado: [equipe, catalogo, fornecedores, financeiro, estoque]
arquivos_alterados:
  - test/integracao/ajuda/estoque-custos.js
  - test/integracao/ajuda/ambiente.js
  - test/fixtures/estoque-custos.js
  - test/equipe-contratos.test.js
  - test/compras-calculos.test.js
  - test/financeiro-calculos.test.js
  - supabase/migrations/20260915090000_equipe_permissoes.sql
  - src/equipe-db.js
  - src/permissoes.js
  - src/empresas.js
  - src/servidor.js
  - test/permissoes-rotas.test.js
  - design/canvas/equipe-desktop.dc.html
  - design/canvas/equipe-mobile.dc.html
  - public/equipe.js
  - public/admin.html
  - public/app.js
  - public/style.css
  - src/auditoria-operacional.js
  - test/integracao/equipe.test.js
  - design/canvas/compras-custos-desktop.dc.html
  - design/canvas/compras-custos-mobile.dc.html
  - supabase/migrations/20260916100000_catalogo_alvos.sql
  - src/catalogo-alvos-db.js
  - src/store.js
  - test/integracao/catalogo-alvos.test.js
  - supabase/migrations/20260916110000_fornecedores.sql
  - src/fornecedores-db.js
  - test/integracao/fornecedores.test.js
  - supabase/migrations/20260916120000_financeiro.sql
  - src/financeiro-db.js
  - test/integracao/financeiro-contas.test.js
  - test/integracao/financeiro.test.js
palavras_chave: [compras, insumos, estoque, financeiro, fornecedores, equipe, custo-medio, catalogo-alvos, contas-financeiras]
---

# Orquestrador — estoque-e-custos

## 1. Objetivo

Entregar Gestão de equipe antes de Compras, seguida por fornecedores, estoque, custo médio e financeiro de fornecedores. Preservar o catálogo JSONB e os fluxos atuais por meio de registro-ponte, transações atômicas e flags por tenant. Preparar Insumos e ficha sem ativá-los nesta entrega.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`).
2. `00-DECISOES.md` e `02-DECISOES-PENDENTES.md`.
3. `base/00-INDICE.md` e todos os arquivos listados nele.
4. `sprint-01/` até `sprint-08/`, sempre `sprint.md`, `fases.md`, `tasks.md`.
5. `00-BLOQUEIOS.md`.
6. `00-AUDITORIA.md`.

## 3. Rota de execução

### Estado de retomada — 2026-09-16

Sprints 01/02/03 concluídas em homologação. Sprint 04 (T-04.01 a T-04.04)
EXECUTADA e CONCLUÍDA em 2026-09-16, mediante pedido explícito de retomada do
usuário — ver `sprint-04/tasks.md` para o detalhe de cada task (suíte, data,
divergências). Todas as 3 migrations planejadas da Sprint 04 foram renumeradas
de `202609150000` para `20260916(1|2)0000` na hora de implementar cada task
(colisão com `20260915100000_auditoria_operacional.sql`, já sinalizada em
`00-AUDITORIA.md`) e aplicadas tanto no banco de teste quanto em produção
(`npx supabase db push`). T-06.01 possui protótipo aprovado, mas isso não
conclui nem libera a Sprint 06 — Sprint 05 (Compras: documento, confirmação,
estoque/custo/financeiro atômicos) é a próxima elegível pelo caminho crítico e
ainda depende de novo pedido explícito do usuário para ser executada (mesma
regra de autonomia desta seção). Backup P0-B resolvido em 2026-09-16 (não
bloqueia mais migrations nem ativação em produção; ver `00-BLOQUEIOS.md`).

- Sprint 01: F-01.1 → F-01.2.
- Sprint 02: F-02.1 → F-02.2.
- Sprint 03: F-03.1 → F-03.2.
- Sprint 04: F-04.1 ∥ F-04.2; dentro de cada fase, tasks sequenciais.
- Sprint 05: F-05.1 → F-05.2.
- Sprint 06: F-06.1 → F-06.2.
- Sprint 07: F-07.1 → F-07.2.
- Sprint 08: F-08.1.

**Caminho crítico:** T-01.01 → T-01.02 → T-01.03 → T-02.01 → T-02.02 → T-02.03 → T-02.04 → T-03.01 → T-03.02 → T-03.03 → T-04.01 → T-04.02 → T-05.01 → T-05.02 → T-05.03 → T-05.04 → T-06.01 → T-06.02 → T-06.03 → T-06.04 → T-07.01 → T-07.02 → T-07.03 → T-07.04 → T-08.01.

## 4. Ferramentas

- **MCPs / SDKs:** Supabase CLI para migrations; ferramenta de design configurada no projeto para protótipos; Playwright para validação visual quando disponível.
- **Testes:** `npm run test:ci` e `npm run test:integracao`.
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO.
- **Sintaxe:** `npm run check`.
- **Segredos:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e variáveis Telegram ficam no `.env` local e nos secrets do ambiente; nunca registrar valores.

## 5. Agentes

- **Implementador** escreve os testes, confirma o vermelho e implementa o mínimo até o verde.
- **Revisor de testes** prova que os testes falhariam com tenant cruzado, duplicação ou cálculo errado.
- **Auditor de aceite** executa o critério binário antes de concluir a task.

**Agente único:** assume os três papéis nessa ordem, sem ultrapassar um portão incompleto.

## 6. Regras de autonomia

1. Não perguntar nem pedir autorização durante tasks executáveis.
2. Testes vêm antes do código.
3. Task só conclui com testes de integração e funcionais e critério verificado.
4. Dúvida ou pré-requisito ausente vira `B-NN | task | bloqueio | o que destravaria` em `00-BLOQUEIOS.md`; a task fica bloqueada e a próxima independente segue.
5. Paralelismo somente quando declarado.
6. Atualizar o status em cada `tasks.md`, com data e suíte ao concluir.
7. ~~Não aplicar migration nem ativar produção até resolver P0-B.~~ Resolvido em 2026-09-16.
8. Protótipo precisa de aprovação do usuário antes do código visual; sem aprovação, bloquear a task de implementação correspondente.

## 7. Definição de pronto global

- Equipe e PIN homologados e liberados separadamente no Plano Completo.
- Compras atualizam documento, estoque, custo e financeiro de forma atômica e idempotente.
- Pagamentos, transferências, devoluções, créditos, reembolsos e estornos preservam razão e autoria.
- Relatórios reconciliam com documentos e movimentos; alertas funcionam no painel e opcionalmente no Telegram.
- Suítes rápida e de integração terminam sem falhas; fluxos desktop e mobile são validados.
- Backup lógico e Storage são restaurados fora de produção antes das migrations; piloto passa antes da liberação gradual.
- A próxima fase de Insumos e ficha possui especificação compatível, sem baixa dupla.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo.
2. Leia os `status` em cada `tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Confira primeiro a pausa registrada na seção 3. Somente após pedido explícito
   de retomada, continue da primeira task pendente/em andamento com dependências
   concluídas; ignore bloqueadas até o bloqueio ser resolvido. O plano existente
   utiliza tanto `concluida` quanto `concluido` para tasks finalizadas.

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

### Estado de retomada — 2026-09-15

Sprints 01/02/03 concluídas em homologação. O usuário decidiu não executar a
Sprint 04 agora: execução pausada, sem task ativa. As regras de autonomia abaixo
não autorizam atravessar essa pausa; aguardar novo pedido explícito de retomada.
T-06.01 possui protótipo aprovado, mas isso não conclui nem libera a Sprint 06.
Antes de T-04.01, renumerar `20260915100000_catalogo_alvos.sql` no plano, porque
essa versão foi usada pela migration de auditoria operacional. Conferir versões
tanto nos arquivos existentes quanto nas migrations previstas em todas as tasks.
Backup P0-B resolvido em 2026-09-16 (não bloqueia mais migrations nem ativação em produção;
ver `00-BLOQUEIOS.md`). Retomada da Sprint 04 ainda depende de novo pedido explícito do usuário.

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

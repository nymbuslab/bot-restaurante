---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: estoque-e-custos
status: em_andamento
sprints_concluidas: [sprint-01, sprint-02, sprint-03, sprint-04]
sprints_pendentes: [sprint-05, sprint-06, sprint-07, sprint-08]
modulos_entregues: [equipe, catalogo-alvos, fornecedores, financeiro-fornecedores]
modulos_pendentes: [compras, insumos-e-ficha, painéis-e-alertas, custo-medio]
atualizado_em: 2026-09-16
---

# Fechamento (cumulativo) — estoque-e-custos

Este arquivo é **um por trabalho**: reflete o estado cumulativo do programa `estoque-e-custos`
até a sprint mais recente concluída, não só a última executada. Atualizar (não recriar) a cada
sprint que fechar.

## Estado até 2026-09-16 (Sprints 01 a 04 concluídas)

### Entregue e em homologação

- **Gestão de equipe** (Sprints 01-03): perfis (administrador, gerente, caixa, atendimento,
  cozinha, estoque_compras), PIN de 4 dígitos com bloqueio por tentativas, dispositivos
  autorizados, sessões com inatividade configurável, matriz de permissões por perfil com ajuste
  fino por funcionário, auditoria operacional transacional (retenção 5 anos). Telas
  `public/equipe.js` + `admin.html`. Gate `equipe_habilitada` por tenant, Plano Completo.
- **Registro-ponte do catálogo** (T-04.01): tabela `catalogo_alvos` (produto/variação por alvo
  tipado, D-02/D-26), sincronizada na mesma transação de `store.setCardapio`. Só aditiva —
  exclusão/renomeação no cardápio nunca apaga o alvo. Sem UI própria ainda (uso interno,
  consumido por fornecedores/identificadores).
- **Fornecedores e identificadores do catálogo** (T-04.02): CRUD de fornecedores (nasce só com
  nome — fluxo de criação inline preserva rascunho), código interno + GTIN por alvo (únicos por
  tenant), vínculo fornecedor-alvo com sugestão do fornecedor já conhecido. Rotas
  `/api/fornecedores*` e `/api/catalogo/identificadores*`, gate `fornecedores.gerenciar`. Sem UI
  própria ainda (só API).
- **Financeiro de fornecedores — contas e razão** (T-04.03/T-04.04): `contas_financeiras`
  separadas do caixa operacional do PDV (D-16), `financeiro_movimentos` como razão imutável
  (D-17). Implantação, pagamento avulso, transferência vinculada (débito+crédito atômicos, ordem
  de lock determinística), estorno (nova linha, nunca edita a original) e conciliação manual
  (D-18, metadata pura). Rotas `/api/financeiro/*`, gates `financeiro.ver`/`financeiro.gerenciar`.
  Sem UI própria ainda (só API) — compras (Sprint 05) é quem vai consumir isso de verdade.

### Ainda fora do escopo entregue (sprints seguintes do mesmo programa)

- **Compras** (Sprint 05): documento de compra, confirmação, baixa de estoque/custo/financeiro
  atômicos, devolução ao fornecedor.
- **Insumos e ficha técnica** (Sprints 06-07): protótipo aprovado (T-06.01), implementação e
  baixa dupla ainda pendentes.
- **Painéis e alertas, custo médio** (Sprint 08 e transversal): consolidação de compras,
  vencimentos, contas, estoque valorizado, histórico de custo.
- **UI do financeiro e de fornecedores**: as APIs de T-04.02/T-04.03/T-04.04 não têm tela própria
  ainda — nasceram como fundação para Compras (Sprint 05) consumir.

### Decisões e bloqueios relevantes

- D-27 mantém fora do escopo TODO o programa: Contas a Receber, OFX, Open Finance, receitas e
  despesas avulsas, recorrências.
- P0-B (backup + restauração ensaiada) resolvido em 2026-09-16 — não bloqueia mais migration nem
  ativação em produção (`00-BLOQUEIOS.md`).
- Nenhum bloqueio ativo ao fim da Sprint 04.

### Próxima elegível pelo caminho crítico

Sprint 05 (Compras), dependente de novo pedido explícito do usuário para execução (mesma regra de
autonomia do `ORQUESTRADOR.md`, seção 3).

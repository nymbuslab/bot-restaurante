# Estoque e custos

Este diretório é o índice da evolução que reúne **Compras**, **Insumos**, **Estoque** e
**Ficha técnica**. Ele existe para que a mudança seja feita sem misturar descoberta,
estabilização e implementação em um sistema que já atende clientes reais.

## Estado atual

- O estoque de produtos está em produção e continua funcionando como hoje.
- As fundações inertes de Insumos (fases 0 a 2) existem, mas ainda não alteram saldo em vendas.
- O cadastro e o protótipo antigos de Insumos não estão autorizados para implementação.
- A nova direção aprovada começa por Compras, que dará entrada em produtos e insumos e formará
  o custo de aquisição.
- Gestão de equipe, PIN, dispositivos, permissões e Atividades foram implementados e
  homologados antes de Compras. Ainda não foram liberados em produção.
- O P0-A, as decisões P1 e o planejamento SprintX estão concluídos: base técnica, 31 decisões
  consolidadas, 8 sprints, 28 tasks, orquestrador e auditoria com `VEREDITO: SIM`.
- Os protótipos desktop/mobile de Gestão de equipe e Compras/Financeiro foram aprovados pelo dono.
- Sprints 01, 02 e 03 concluídas: harness/contratos, autorização e ciclo de equipe.
  Última validação: CI 754/754, integração 92/92, sintaxe 183 arquivos e navegador desktop/mobile.
- Execução pausada por decisão do usuário em 2026-09-15. A Sprint 04 permanece
  planejada, não iniciada; só retomar após novo pedido explícito. Antes de criar
  T-04.01, renumerar sua migration planejada, pois `20260915100000` foi usado pela auditoria.
- O P0-B de backup/restauração foi resolvido em 2026-09-16 (`00-BLOQUEIOS.md`); migrations novas e
  ativação em produção não dependem mais dele.

## Ordem obrigatória

1. [Auditoria e baseline](00-AUDITORIA-BASELINE.md).
2. [Plano de estabilização P0/P1](01-PLANO-DE-ESTABILIZACAO.md).
3. [Decisões P1 aprovadas e gate operacional ainda aberto](02-DECISOES-PENDENTES.md).
4. [Checklist de rollout e rollback](03-CHECKLIST-ROLLOUT-E-ROLLBACK.md).
5. [Planejamento SprintX e ordem de execução](ORQUESTRADOR.md).
6. [Protótipos aprovados de Gestão de equipe](prototipos/gestao-equipe.md) e
   [Compras/Financeiro](prototipos/compras-financeiro.md).
7. Sprint 01: capacidade e contratos de teste.
8. Gestão de equipe, PIN, dispositivos, permissões e Atividades.
9. Registro-ponte, fornecedores e contas financeiras.
10. Compras, estoque, custo médio e financeiro de fornecedores.
11. Validação em ambiente de teste e implantação controlada.
12. Só depois, Insumos, ficha técnica e baixa por ingredientes em entrega própria.

## Documentos relacionados

- [Decisões históricas de Insumos](../insumos/00-DECISOES.md).
- [Bloqueios atuais de Insumos](../insumos/00-BLOQUEIOS.md).
- [Modelo de dados atual](../modelo-dados.md).
- [Controle de estoque atual](../planos-e-frete.md#4%C2%BA-benef%C3%ADcio-do-completo--controle-de-estoque-com-hist%C3%B3rico).
- [Roadmap geral](../../ROADMAP.md).
- [Progresso operacional](../../PROGRESSO.md).

## Regra de manutenção

Uma etapa só avança quando seu critério de saída estiver registrado como concluído no
`PROGRESSO.md`. Decisão revertida não é apagada: recebe estado **superada** e aponta para a nova
decisão. Código, migration e ativação em produção são etapas separadas.

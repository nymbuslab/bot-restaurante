# Estado e bloqueios de Insumos

A antiga fase 3 foi superada pelo conjunto Compras, Insumos, Estoque e Ficha técnica. As decisões de
produto estão fechadas; a implementação continua bloqueada até a nova arquitetura e o novo
protótipo descritos em [`docs/estoque-e-custos/`](../estoque-e-custos/README.md).

## P0

- Dependências e regressão: concluídas.
- Drift das migrations e sequência de rollout: conferidos.
- Backup/restauração: único bloqueio P0 ainda aberto antes da primeira migration.
- Fluxo vigente: `Compras → Insumos/Produtos → Estoque → Ficha técnica`.

## P1

- As 18 decisões funcionais foram aprovadas em 2026-09-14.
- Próximo passo: transformar as decisões em arquitetura, constraints, contratos e testes.
- Nenhuma baixa de insumo está ativa e o estoque atual permanece intacto.

O protótipo existente pode ser usado como referência visual, mas não está aprovado para
implementação porque não contempla Compras nem formação do custo.

# Índice da base de conhecimento

Feature: reimprimir comprovante de caixa a partir da grade de Movimentação. Modo de ingestão: INTERNO (código do próprio sistema).

| Arquivo | Resumo |
|---|---|
| [montagem-e-enfileiramento.md](montagem-e-enfileiramento.md) | Como o comprovante 80mm é montado e enfileirado hoje: `enfileirarComprovanteCaixa`, `dadosComprovanteCaixa`, `normalizarMovimentosComprovante`, `montarComprovanteCaixa`. Contém o risco mais alto da feature (cancelamento é um comprovante feito de vários movimentos). |
| [persistencia-do-movimento.md](persistencia-do-movimento.md) | Schema de `caixa_movimentos`, o que `GET /api/caixa` devolve por movimento, e a conclusão de que nenhuma coluna nova é necessária para remontar o comprovante. |
| [rotas-gates-e-front.md](rotas-gates-e-front.md) | Padrão da rota de reimpressão que já existe, gates de plano (`exigeCaixa`/`exigeImpressao`), e a coluna de ações da grade do caixa aberto onde o ícone entra. |
| [padroes-de-teste.md](padroes-de-teste.md) | As três baterias, os helpers de integração, o padrão de teste de front sem navegador, e o cuidado de não assumir ordem na fila de impressão. |

## Achados que a F2 precisa resolver

1. **D-01 (já levantada):** com o toggle daquele tipo DESLIGADO nas Configurações, o ícone aparece e a reimpressão funciona? Recomendação registrada: sim, porque o toggle governa a impressão automática e clicar é pedido explícito.
2. **Reagrupamento do cancelamento:** reimprimir a partir de um id de movimento tem que reagrupar os irmãos por `(caixa_id, pedido_id, tipo)` para o papel sair igual ao original. Confirmar que é isso mesmo que se espera.
3. **`estorno` entra?** É movimento e deduz, mas não tem toggle nem comprovante hoje.
4. **Qual gate:** `exigeCaixa`, `exigeImpressao`, ou os dois.

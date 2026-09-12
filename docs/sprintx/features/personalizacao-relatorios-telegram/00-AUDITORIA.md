# Auditoria — personalizacao-relatorios-telegram

Data: 2026-09-07 (rodada 2 — todos os achados endereçados)

Nenhum achado pendente.

## Histórico

- **Rodada 1** (2 ALTA, 3 MÉDIA, 1 BAIXA): dois problemas reais em torno da mudança de
  `ultimoEnvio` de objeto único para objeto por tipo (D-09) — T-03.03 não testava merge seguro
  (fixture nascia com o campo já `null`, incapaz de discriminar um `replace` de um `merge`); e
  nenhuma task gravava `ultimoEnvio.cancelamento` de fato, deixando o item 5 da Definição de
  Pronto global inalcançável. Mais três MÉDIA (T-01.07 sem testar "estorno", T-02.02 sem testar
  margem negativa, T-03.01/02 sem esclarecer se a margem é por movimento ou por pedido total) e
  uma BAIXA (caminho crítico do `ORQUESTRADOR.md` omitindo `F-03.3`). Todas corrigidas e
  confirmadas na rodada 2.
- **Rodada 2** (1 MÉDIA, 1 BAIXA, ambas endereçadas nesta gravação): o formato antigo de
  `ultimoEnvio` (flat, herdado da feature `relatorios-telegram`, já gravado em tenants como
  `nymbus-teste`) não tinha decisão nem teste cobrindo a leitura segura em meio à migração de
  formato — resolvido por **D-11** (tratar como todos os tipos `null`, sem migração ativa) mais
  teste em T-02.01 com fixture no formato antigo. E `T-04.01`/`T-04.02` estavam serializadas sem
  necessidade (não dependem uma da outra, não compartilham arquivo) — corrigido para
  `paralelizavel: true`, paralelas entre si.

## Checklist completo (rodada 2, confirmado)

1. Task sem teste — nenhuma.
2. Teste que passaria com implementação errada — nenhum; T-01.07 (estorno), T-02.02 (margem
   negativa), T-03.01/T-03.02 (margem por movimento, split payment, merge de
   `ultimoEnvio.cancelamento`) e T-03.03 (merge de `ultimoEnvio` com fixture pré-preenchida e
   não-nula) discriminam corretamente uma implementação que substitua em vez de mesclar.
3. Critério de aceite subjetivo — nenhum.
4. Dependência circular — nenhuma; grafo `depende_de` das quatro sprints é um DAG.
5. Paralelismo falso — nenhum; `F-01.1`/`F-01.2`/`F-01.3` e `F-02.2`/`F-02.3` tocam arquivos
   disjuntos; `T-04.01`/`T-04.02` agora paralelas de fato, sem dependência entre si nem arquivo
   compartilhado.
6. Sequencialidade desnecessária no caminho crítico — resolvida em `T-04.01`/`T-04.02`.
7. Task dependendo de decisão humana — só as duas exceções documentadas e intencionais:
   `T-02.03` (portão de design do `CLAUDE.md` do usuário) e `T-04.01`/`T-04.02` (validação
   manual com Telegram real, mesmo padrão da feature anterior).
8. Pré-requisito externo não declarado — nenhum novo; reaproveita `TELEGRAM_BOT_TOKEN`/
   `TELEGRAM_BOT_USERNAME` e o tenant `nymbus-teste`, já configurados em produção.
9. Base ignorada / contradição sem decisão D-NN — nenhuma; o formato legado de `ultimoEnvio`
   (achado da rodada 2) está reconciliado por D-11.
10. Escopo do alerta de cancelamento (D-06) — T-03.01/T-03.02 cobrem só P2 (`cancelarRecebido`)
    e P4 (`estornarRecebimento`), sem vazar para P1/P3/P5/P6.
11. Consistência do formato `ultimoEnvio` por tipo — chaves `fechamentoCaixa`/`estoque`/
    `cancelamento` usadas de forma idêntica em T-02.01, T-02.05, T-03.01, T-03.02, T-03.03,
    distintas de `tipos.cancelamentoAtivo` (sem confusão entre os dois nomes).

VEREDITO: SIM — o plano está pronto para execução autônoma.

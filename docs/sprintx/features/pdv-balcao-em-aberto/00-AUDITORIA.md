# Auditoria — pdv-balcao-em-aberto

Data: 2026-09-10 (3ª rodada)

| severidade | arquivo | problema | correção sugerida |
|---|---|---|---|
| MÉDIA | ORQUESTRADOR.md (seção 3) | Afirma que a cadeia via T-04.02→T-04.03 tem "5 tasks", mas o grafo real de `depende_de` dá 6 (T-01.01→T-02.01→T-02.02→T-02.03→T-04.02→T-04.03). Não muda a conclusão (6 < 7, T-04.03 continua não sendo o gargalo). | **Corrigido**: "5 tasks" → "6 tasks". |
| BAIXA | sprint-04/tasks.md (T-04.01) | `paralelizavel: false`, mas F-04.1/F-04.2 são declaradas paralelas entre si e T-04.01/T-04.02 não compartilham arquivo nem dependem uma da outra. | **Corrigido**: `paralelizavel: true` em ambos os blocos (frontmatter e corpo). |
| BAIXA | ORQUESTRADOR.md (`modulo_afetado`) | Sugestão do auditor: acrescentar `src`, já que T-02.01/02/03 alteram `src/servidor.js`/`src/pedidos.js`. | **Não aplicado, de propósito**: a regra de derivação de módulo (`references/03-plano.md`, Passo 2.1) manda ignorar o invólucro `src/` e, sem segmento de pasta além do arquivo, classificar como `raiz` — é exatamente o que `servidor.js`/`pedidos.js` são (arquivos direto sob `src/`, sem subpasta). `modulo_afetado: [raiz, public, test]` já está correto pela regra documentada; adicionar `src` violaria essa regra. |

Achados ALTA e MÉDIA das rodadas 1 e 2 foram verificados como corrigidos nesta rodada (comparação campo a campo entre frontmatter e corpo de todas as 10 tasks, e recontagem do caminho crítico).

VEREDITO: SIM — o plano está pronto para execução autônoma.

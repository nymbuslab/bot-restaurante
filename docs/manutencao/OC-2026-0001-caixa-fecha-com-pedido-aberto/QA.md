---
expx_schema: 1
expx_tool: runx
kind: qa
trabalho_id: OC-2026-0001
veredito: aprovado
executado_em: 2026-09-12
achados: []
atualizado_em: 2026-09-12
---

# QA — OC-2026-0001 caixa-fecha-com-pedido-aberto

> Escrito no E4, por quem NÃO implementou. Este estágio só aponta: nenhum arquivo de código, teste ou plano é alterado aqui. Agente `qa` não registrado (runx-hooks não instalado) — o QA é executado pela sessão principal, que não vê a execução como quem a implementou.

**Data:** 2026-09-12

## Verificações

| # | Item | Resultado |
|---|---|---|
| 1 | O teste de regressão falhava antes e passa agora | OK |
| 2 | Cada task tem os dois testes e eles testam o que dizem testar | OK |
| 3 | Nenhum teste passaria com a implementação errada | OK |
| 4 | A suíte inteira passa, incluindo o que não foi tocado | OK |
| 5 | O critério de aceite de cada task foi atendido de fato | OK |
| 6 | Os critérios de saída de cada fase e sprint foram atendidos | OK |
| 7 | Nada fora do escopo declarado foi alterado (diff conferido) | OK |
| 8 | O comportamento descrito na investigação é o comportamento real | OK |

Notas por item:

1. Antes do fix, a bateria de integração (rodada limpa, timeout 600s) falhava exatamente no teste invertido (`200 !== 400`), 66 pass / 1 fail; depois do fix, 67 pass / 0 fail. As falhas "Obs:" da primeira rodada truncada foram artefato do banco de teste sujo deixado pelo timeout de 120s — desapareceram na rodada limpa.
2. T-01.01 tem `teste_regressao`, `teste_integracao` e `teste_funcional` declarados; T-01.02 e T-01.03 têm os dois testes obrigatórios (integração + funcional). T-01.03 validado por `rg` nos docs + leitura dos trechos — ver abaixo.
3. O teste invertido só passa se a contagem do gate deixar de cortar por `criado_em`; com a implementação antiga ele recebe 200 (falhou de fato no vermelho). Nenhum outro teste da suíte passaria sozinho com a implementação errada — o resto da bateria ficou verde nos dois sentidos.
4. Rodadas próprias deste QA: `npm test` 714/714, `npm run check` OK (exit 0), `npm run test:ci` 714/714, `npm run test:integracao` 67/67.
5. T-01.01: teste invertido exige 400 (`/a receber/i`) e falha antes do fix — atendido. T-01.02: integração verde com o teste invertido — atendido. T-01.03: varredura nos docs não encontra mais a regra antiga (grep confirmou 0 ocorrências da regra antiga em CLAUDE.md/PRD.md/docs vivos) e PROGRESSO.md registra a ocorrência concluída — atendido.
6. Critérios de saída de fase e sprint (0 falhas nas 4 suítes + docs sem a regra antiga) — atendidos.
7. `git status` mostra apenas `src/caixa.js`, `test/integracao/caixa.test.js`, `docs/planos-e-frete.md`, `docs/arquitetura.md`, `docs/modelo-dados.md`, `PRD.md`, `CLAUDE.md`, `PROGRESSO.md` modificados e `docs/manutencao/` como novo — exatamente o escopo declarado em `01-CAUSA-RAIZ.md`/`tasks.md`.
8. A causa descrita na investigação (recorte `criado_em >= aberto_em` no `_contarAReceber` usado pelo gate) bate com o código em `src/caixa.js:34-42` e com o `src/caixa.js:749` na época do 01-CAUSA-RAIZ; hoje a linha virou uso de `_contarAReceberTotal`. Comportamento real da rota (400 com `/a receber/i`) confirmado pela bateria de integração.

## Conferência do diff contra o escopo

**Arquivos no diff e não autorizados** (ALTA): nenhum
**Arquivos autorizados e ausentes do diff** (MÉDIA): nenhum

## Achados

Nenhum achado.

## Saída da suíte

```
$ npm run test:integracao   (a partir de pasta vazia, .env.test)
  67 pass / 0 fail  —  inclui o teste invertido "pedido antigo a receber também bloqueia o fechamento do caixa"
  (runner: scripts/test-integracao.js; rodada limpa, timeout 600s)

$ npm test
  tests 714 · pass 714 · fail 0 · skipped 0

$ npm run check
  varredura de sintaxe (node --check) — exit 0, sem erros

$ npm run test:ci   (a partir de pasta vazia, sem .env)
  tests 714 · pass 714 · fail 0 · skipped 0
```

## Veredito

VEREDITO: APROVADO — a ocorrência está pronta para fechamento.
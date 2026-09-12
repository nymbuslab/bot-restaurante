---
expx_schema: 1
expx_tool: runx
kind: relatorio_tecnico
trabalho_id: OC-2026-0001
titulo: Caixa fecha com pedido em aberto
tipo_ocorrencia: bug
fechado_em: 2026-09-12
modulo_afetado: [caixa, pedidos]
arquivos_alterados: [src/caixa.js, test/integracao/caixa.test.js, docs/planos-e-frete.md, docs/arquitetura.md, docs/modelo-dados.md, PRD.md, CLAUDE.md, PROGRESSO.md]
palavras_chave: [caixa, fechamento, pedido-a-receber, comanda, turno, criado-em, bloqueio]
regressao_de: null
testes_adicionados: 0
---

# OC-2026-0001 — Caixa fecha com pedido em aberto

> Leitor: o próximo desenvolvedor que abrir este código. Aqui nome de arquivo, função, tabela e jargão são bem-vindos — é para isso que este arquivo existe. Caminhos sempre relativos.

**Fechada em:** 2026-09-12

## 1. Ocorrência e tipo

OC-2026-0001 · bug · módulo: caixa (com dependência de pedidos)

## 2. Sintoma relatado

O dono relatou que o caixa fechou mesmo com pedido em aberto; esperava bloqueio, "principalmente de dias anteriores". O relato literal está em `docs/manutencao/OC-2026-0001-caixa-fecha-com-pedido-aberto/00-OCORRENCIA.md`.

## 3. Base do que foi mapeado, em resumo

- **fechamento-de-caixa.md** — o fluxo de `src/caixa.js`: `fecharCaixa` roda o gate de "vendas a receber" antes de fechar o turno; `_contarAReceber` filtra `criado_em >= aberto_em`; o resumo exibe o recorte de turno + `_resumoAReceberAntigos`; tabela `pedidos` (coluna `recebido_em`).
- **testes-caixa.md** — cobertura da regra: o teste de integração que asseverava o comportamento antigo (`test/integracao/caixa.test.js:212`), os unitários stubados (`test/caixa-trava.test.js`, que devolve linhas vazias para qualquer query) e a vizinhança compartilhada com mesas (mesma bateria de turno).
- **documentacao-da-regra.md** — os 5 docs vivos que descreviam a regra antiga (`docs/planos-e-frete.md`, `docs/arquitetura.md`, `docs/modelo-dados.md`, `PRD.md`, `CLAUDE.md`) e a decisão aberta no `PROGRESSO.md:679`.

## 4. Causa raiz ou análise de impacto

`_contarAReceber(empId, abertoEm)` (`src/caixa.js:34-42`) aplica recorte temporal `criado_em >= $2` e `fecharCaixa` a chamava com `caixa.aberto_em` (linha 749). Pedido a receber de dia/turno anterior ao caixa ficava fora da contagem — o fechamento seguia (200) e a pendência permanecia invisível para o guarda. O recorte era decisão deliberada (comentário `src/caixa.js:44-46`, `PROGRESSO.md:679`), revertida agora pelo dono.

Prova: rodada de integração antes do fix falhou justamente no teste invertido (`200 !== 400`), com o resto da bateria verde.

**Regressão:** Não é regressão de trabalho anterior registrado. O comportamento foi deliberado e documentado em `PROGRESSO.md:679` (varredura de 2026-08-24); a suspeita de regressão foi descartada porque o install foi revertido explicitamente pelo dono, não quebrado por mudança posterior — `regressao_de: null` no frontmatter, com a evidência no `01-CAUSA-RAIZ.md`.

## 5. Solução aplicada

Aditivo, sem tocar na tela:

- Nova `_contarAReceberTotal(empId)` em `src/caixa.js` — mesma query de `_contarAReceber` **sem** o limite inferior de `criado_em` (conta pedido a receber de qualquer data).
- `fecharCaixa` passou a usar `_contarAReceberTotal` no gate (`const aReceber = await _contarAReceberTotal(empId)`), mantendo a mensagem e o status 400 existentes.
- `_contarAReceber` (com recorte) continua sendo usada pelo resumo da tela — aviso de "pedidos a receber antigos" preservado.
- Teste de integração `test/integracao/caixa.test.js` invertido (renomeado para "pedido antigo a receber também bloqueia o fechamento do caixa"): backdate de 2 dias no `criado_em` + caixa novo → espera 400 com `/a receber/i`.
- 5 docs vivos + `PROGRESSO.md` atualizados para a regra nova.

## 6. Decisão técnica e alternativas descartadas

```
D-01 | Gate de fechamento conta QUALQUER pedido a receber (_contarAReceberTotal); resumo da tela mantém o recorte de turno e o aviso de antigos | (1) remover o recorte de _contarAReceber compartilhada | mudaria a exibição do resumo e tocaria os testes que asseveram o resumo atual, fora do escopo; (2) manter como está | não resolve o relato
```

## 7. Sprints, fases e tasks executadas

| Task | Título | Status | Data |
|---|---|---|---|
| T-01.01 | Teste — antigo a receber bloqueia fechamento | concluida | 2026-09-12 |
| T-01.02 | Fix — fechamento conta qualquer pedido a receber | concluida | 2026-09-12 |
| T-01.03 | Docs — nova regra de fechamento | concluida | 2026-09-12 |

Sprint-01 / F-01.1, estritamente sequencial. Bloqueios em `BLOQUEIOS.md`: nenhum.

## 8. Arquivos alterados

- `src/caixa.js` — nova `_contarAReceberTotal` (gate do fechamento) e comentários da decisão reescritos com referência à OC-2026-0001.
- `test/integracao/caixa.test.js` — teste da trava invertido (antigo 200 → espera 400) e comentário adjacente atualizado.
- `docs/planos-e-frete.md`, `docs/arquitetura.md`, `docs/modelo-dados.md`, `PRD.md`, `CLAUDE.md` — regra nova (bloqueia de qualquer data; antigos também bloqueiam).
- `PROGRESSO.md` — entrada no ✅ Concluído (2026-09-12) e correlação na decisão da entrada 679.

## 9. Testes adicionados

Nenhum arquivo de teste novo (testes_adicionados: 0). A cobertura foi feita por inversão do teste existente:

- **Regressão:** `test/integracao/caixa.test.js` — o caso "pedido antigo a receber" foi invertido: hoje espera 400 com `/a receber/i`; falhava com a implementação antiga (200). Vermelho confirmado antes do fix.
- **Integração:** bateria completa `npm run test:integracao` (67 casos) — cobre caixa + mesas da mesma bateria, incluindo os casos de fechamento válido, mesa aberta e pedido do turno que não regrediram.
- **Funcional:** chamada REST do próprio caso de regressão (fechar com pedido antigo → 400; fechar válido → 200).

## 10. Risco residual

- A correção do gate só é exercitada pela bateria de integração (por HTTP contra Postgres real). Os unitários de caixa otam `_contarAReceber*` com dublê que devolve linhas vazias para qualquer query — se `fecharCaixa` fosse exercitado lá, a contagem seria 0 e não falsa bloqueio; é proteção resiliente, mas não prova a query.
- `_contarAReceber` e `_contarAReceberTotal` são queries quase idênticas (diferem só no recorte). Se uma evoluir com recorte novo de status/plano e a outra não, o resumo e o gate podem divergir. Comentários mútuos em ambas apontam o par.
- Nenhum achado MÉDIA/BAIXA em `QA.md`; `base/00-LACUNAS.md` sem lacunas registradas.

## 11. O que observar em produção

Deploy é externo ao runx — registrar aqui a data quando o dono informar. Depois de liberado, observar o primeiro fechamento com pendência de dias anteriores: o operador verá o caixa recusar o fechamento com a mensagem de "a receber" (caso real registrado em `PROGRESSO.md:679` era um pedido de 10/07, R$ 6,00, com caixa aberto de 22/08 — se ainda estiver pendente, será o primeiro a travar). Conferir que receber/cancelar esse pedido destrava o fechamento e que o resumo da tela segue mostrando o aviso de antigos.

## 12. Sugestões de novas ocorrências percebidas e não feitas

> Escopo travado (regra 8): tudo que foi visto e deliberadamente NÃO tocado. Sugestão, nunca implementação.

- Mensagem de bloqueio do fechamento dizer quantos pedidos e de quanto dinheiro estão pendentes — ajudaria o operador a achar a pendência de uma vez, em vez de caçar na aba Pedidos. Ficou fora de escopo (copy mantida).
- Aviso de antigos no resumo (e entrada "A receber" do filtro) ganhar um atalho para a lista de pedidos pendentes — hoje a pendência exige o operador abrir Pedidos e filtrar; na tela do resumo não há o que clicar.
- Unificar `_contarAReceber` e `_contarAReceberTotal` numa única assinatura com recorte opcional — elimina o par de queries quase idênticas descrito no risco residual; é refatoração, não mudança de comportamento.
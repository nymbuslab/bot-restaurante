---
expx_schema: 1
expx_tool: runx
kind: causa_raiz
trabalho_id: OC-2026-0001
modo: causa_raiz
comprovada: true
evidencia: codigo
arquivos_impactados: [src/caixa.js, test/integracao/caixa.test.js, docs/planos-e-frete.md, docs/arquitetura.md, docs/modelo-dados.md, PRD.md, CLAUDE.md, PROGRESSO.md]
palavras_chave: [caixa, fechamento, pedido-a-receber, comanda, turno, criado-em, bloqueio]
regressao_de: null
evidencia_regressao: null
decisoes: [D-01]
atualizado_em: 2026-09-12
---

# Causa raiz — OC-2026-0001

## STATUS: COMPROVADO

## Comportamento

O caixa fecha (200) mesmo com pedido a receber, inclusive de dias anteriores. O botão de fechamento não bloqueia.

## Contexto causal

O fechamento conta pedidos "a receber" por uma contagem `_contarAReceber(empId, abertoEm)` (linhas 34-42) que aplica um recorte **temporal**: `criado_em >= aberto_em` (só considera pedidos criados durante o turno do caixa). `fecharCaixa` chama essa contagem passando `caixa.aberto_em` (linha 749), então um pedido a receber de **dias anteriores** (ex.: Comanda esquecida) fica FORA da contagem e o fechamento acontece.

Esse recorte foi uma **decisão deliberada**, documentada no próprio código (comentário em `src/caixa.js:44-46`) e planejada durante a varredura de 2026-08-24 (`PROGRESSO.md:679`): evita que um pedido a receber esquecido trave para sempre o fechamento; a tela mostra um aviso ("pedidos a receber antigos") no resumo. Um teste de integração assevera esse comportamento (`test/integracao/caixa.test.js:212`, "pedido antigo a receber avisa, mas não bloqueia o fechamento de hoje").

Por isso **não é regressão** (`regressao_de: null`): é divergência entre o comportamento instalado e a regra esperada do produto ("não fecha com pedido em aberto"). O usuário relata o instalado como defeito e reverte a decisão de produto.

## Evidência

- Código: `src/caixa.js:34-42` (`WHERE ... criado_em >= $2` com `abertoEm`) + `src/caixa.js:749` (uso de `caixa.aberto_em` no gate do fechamento).
- Comentário da decisão: `src/caixa.js:44-46`.
- Teste que espelha o comportamento: `test/integracao/caixa.test.js:212-227`.
- Decisão registrada: `PROGRESSO.md:679` (varredura 2026-08-24; achado real de produção: pedido a receber de 10/07, R$ 6,00, caixa aberto 22/08).

## Raio de impacto

- Afeta: fechamento de caixa de TODOS os restaurantes (Plano Completo) com pedido a receber anterior ao turno.
- Não afeta: resumo da tela (mantém aviso de antigos), recebimento de pedidos, PDV, mesas (gate de mesas é separado), Gate de planos.

## Decisões

### D-01 | Fechamento bloqueia com QUALQUER pedido a receber; resumo mantém o recorte de turno

- **Contexto:** hoje o resumo e o guarda usam a mesma contagem com recorte de turno. Remover o recorte da função compartilhada mudaria a exibição do resumo (mostraria "X antigos" fundido) além de tocar os testes que asseveram o resumo atual.
- **Alternativas descartadas:** (1) remover o recorte de `_contarAReceber` compartilhada (mudaria a tela); (2) manter como está (não resolve o relato).
- **Decisão:** introduzir `_contarAReceberTotal(empId)` (sem limite inferior de `criado_em`) e usá-la APENAS no guarda de `fecharCaixa` (linha 749). Resumo da tela (`resumo`, linha 505) segue com `_contarAReceber` + `_resumoAReceberAntigos`.
- **Feito:** bull — código, teste de integração e 7 arquivos de doc atualizados.

## Como isso será testado

1. TESTE de regressão (adaptado do existente `test/integracao/caixa.test.js:212`): pedido a receber com `criado_em` ANTIGO (backdate de 2 dias) + caixa aberto novo → `POST /api/caixa/fechar` deve retornar 400 com `/a receber/i` (vermelho ANTES do fix — hoje retorna 200).
2. VIZINHANÇA: casos de fechamento válido, mesa aberta, pedido do turno — permanecem 400/200 conforme suíte existente.
3. Suíte completa: `npm test` + `npm run check` + `npm run test:ci` + `npm run test:integracao` (toca banco descartável).
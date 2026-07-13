# Fiado (conta a prazo) — Auditoria, mercado e plano de correção

**Data:** 2026-07-13 · **Origem:** relato do dono de "muita divergência" no fiado + pedido de auditoria
de regra de negócio, correção de bugs e pesquisa de concorrentes. Objetivo: feature correta e segura,
sem prejuízo ao lojista.

## Diagnóstico geral

O **núcleo do fiado está correto e competitivo**. A pesquisa de mercado confirma que o projeto já faz o
essencial que Saipos/Consumer fazem e está **acima do Cardápio Web** (que não tem limite nem vencimento):
venda a prazo não conta no faturamento do dia, recebimento é evento separado que entra no caixa, limite +
vencimento por cliente, baixa parcial em lote.

A "divergência" vem de **buracos específicos**, concentrados em **cancelamento** e **estorno** — é onde o
caixa descasa da dívida.

## Bugs confirmados na auditoria (read-only, com arquivo:linha)

### P0 — prejuízo real (dinheiro na mão descasando)

1. **Cancelar pedido a prazo não reconcilia o fiado.** `public/app.js:4035-4064` mostra "Cancelar" para
   qualquer pedido (inclusive a prazo). Em `cancelarRecebido` (`src/caixa.js:292-340`) e `cancelarPedido`
   (`src/pedidos.js`), ao cancelar um fiado o sistema deduz/marca cancelado mas **não devolve `valor_recebido`,
   não apaga `fiado_baixas`, não reabre a conta**. Resultado: caixa espera menos do que tem na gaveta (sobra
   no fechamento), dívida some do controle, log de baixa órfão. A correção de estorno de 12/07 cobriu só o
   `estornarRecebimento`, não o cancelamento.
2. **Recebimento de fiado no PDV (Balcão) e toda baixa parcial não podem ser estornados.**
   `estornavel` em `src/caixa.js:439-441` exclui `origem='pdv' && tipo_entrega='Balcão'` (que é exatamente
   como `venderAPrazo` grava, `src/fiado.js:138`) e exige `recebido_em != null` (exclui parcial). Logo erro de
   forma no fiado é irreversível, e a correção de estorno de 12/07 só é alcançada em **mesa quitada**.

### P1 — exposição de crédito / calote silencioso

3. **Venda a prazo com `vencimento` nulo nunca vence nem bloqueia.** `calcularVencimentoConvenio` retorna
   `null` sem convênio/faixa (`public/convenios.js:20-26`); as contagens de vencidas/atraso ignoram
   `vencimento IS NULL` (`src/fiado.js:52-53,263-265,301`).
4. **"Bloquear por limite" com limite 0 é no-op silencioso** (`src/fiado.js:38` só bloqueia com `limite > 0`;
   default do cliente é 0 = "não configurado").
5. **Baixa parcial acima da dívida é truncada sem aviso** (`src/fiado.js:433-466`; front sem clamp em
   `public/app.js:7240-7259`).
6. **Botão "Receber" ($) aparece em pedido a prazo na lista** (`public/app.js:3434-3436` não exclui `p.aPrazo`;
   o servidor rejeita em `src/caixa.js:121`, então dá erro em vez de esconder).

### P2 — bordas
- Exclusão de cliente com fiado **quitado** perde histórico (`cliente_id` vira NULL, some de "Recebidas").
- Troca de plano (Completo→Essencial) com fiado/caixa aberto sem tratamento explícito.

### Validação das 3 correções de 12/07
- Rótulo "Recebimento a prazo": **correto e completo**.
- `fecharMesaAPrazo` grava nome do cliente: **correto e completo**.
- `estornarRecebimento` desfaz a baixa: **lógica correta, mas alcance limitado** — só mesa quitada (ver P0-2);
  e não cobre o cancelamento (P0-1).

## Mercado (Goomer, Consumer, Cardápio Web, Saipos, Datacaixa)

- **Padrão anti-prejuízo nº 1:** venda a prazo fora do faturamento + recebimento separado que entra no caixa.
  **Já implementado.**
- **Melhor escudo (Saipos):** limite por cliente que bloqueia automático + **flag "permitir venda a prazo"**
  por cliente (suspende mau pagador sem apagar histórico). Temos o limite; falta a flag.
- **Diferenciais nossos (canal WhatsApp):** saldo devedor no cupom (Datacaixa) e **extrato + lembrete de
  vencimento pelo WhatsApp** — os concorrentes desktop não têm com a mesma fluidez.
- Posicionamento: núcleo P0 do mercado feito; acima do Cardápio Web; nível Saipos/Consumer.

Fontes completas no relatório de pesquisa (centrais de ajuda Consumer, Cardápio Web, Saipos, Datacaixa).

## Plano por fases

### Fase A — Blindar o dinheiro (P0) [decisões tomadas com o dono]
- **Cancelamento de fiado:** **bloquear o "Cancelar" em pedidos a prazo** pela aba Pedidos (esconder o botão
  de linha e o do modal quando `p.aPrazo`; barrar no servidor por garantia). O desfazer acontece só pela aba
  Receber. Tratar também `cancelarPedido` para não deixar cancelar fiado com `valor_recebido > 0` por outra via.
- **Desfazer recebimento:** **botão "desfazer último recebimento" na aba Receber** (funciona para parcial e
  integral, PDV e mesa) — reusa a lógica de `estornarRecebimento` (devolve `valor_recebido`, apaga a
  `fiado_baixas` daquela baixa, deduz do caixa no Completo, reabre a conta). Nova rota dedicada.
- Esconder o botão "Receber" de linha em pedido a prazo (P0 pega junto com o item 6 do P1 por afinidade).
- Smoke test contra o banco: cancelar bloqueado; desfazer parcial e integral reconciliando caixa + dívida.

### Fase B — Guardrails (P1)
- Exigir convênio/vencimento válido ao vender a prazo (ou tratar `vencimento IS NULL` como pendente explícito).
- Na UI de cliente, exigir limite > 0 ao ligar "bloquear por limite".
- Validar/avisar valor parcial que excede a dívida selecionada.

### Fase C — Bordas (P2)
- Semântica de exclusão de cliente com fiado quitado (manter histórico acessível).
- Troca de plano com fiado/caixa aberto.

### Fase D — Diferencial competitivo
- Flag "permitir venda a prazo" por cliente (suspender mau pagador).
- Saldo devedor impresso no cupom da venda a prazo.
- Extrato e lembrete de vencimento pelo WhatsApp (vantagem nativa do canal).

## Ordem recomendada
Fase A primeiro (é o que causa prejuízo). B e C são proteção; D é crescimento. Cada fase valida com smoke
test contra o banco (fluxo financeiro não é coberto por teste unitário).

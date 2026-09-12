---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: personalizacao-relatorios-telegram
titulo: Personalizacao dos Relatorios Telegram
tipo_trabalho: feature
fechado_em: 2026-09-08
modulo_afetado: [raiz, test, design, public]
arquivos_alterados: [public/relatorio-caixa.js, test/relatorio-caixa.test.js, src/caixa-calc.js, test/caixa-calc.test.js, src/telegram.js, test/telegram.test.js, src/servidor.js, test/telegram-admin-rotas.test.js, design/canvas/personalizacao-relatorios-telegram.dc.html, public/app-admin.js, public/style.css, test/telegram-admin-ui.test.js, src/caixa.js, test/telegram-cancelamento.test.js, test/telegram-fechamento-caixa.test.js]
palavras_chave: [telegram, relatorios, caixa, estoque, cancelamento, admin-master, personalizacao, toggles, margem]
resumo: O dono escolhe por checkbox, no admin-master, quais relatorios cada restaurante recebe no Telegram (fechamento de caixa, estoque, alerta de cancelamento com margem). Fechamento de caixa ficou detalhado (operador, data/hora, quantidade+valor por forma, diferenca por forma). Estoque saiu em duas secoes (zerado/minimo). Alerta novo de cancelamento cobre so pedido pago cancelado e estorno de recebimento, com margem minima em R$ configuravel por tenant.
decisao_principal: D-06 - alerta de cancelamento cobre so os 2 pontos onde dinheiro ja recebido e revertido (cancelarRecebido, estornarRecebimento), nao os outros 4 pontos de cancelamento do sistema, por exigirem calculo novo e risco de dependencia circular pedidos.js<->empresas.js sem valor pronto proporcional.
risco_residual: Nenhum novo. Validacao ponta a ponta (sprint-04) feita via script direto contra as funcoes de src/caixa.js (mesmas que a rota HTTP chama) no tenant nymbus-teste, em vez de clicar na UI do admin-master - cobre a logica de negocio e a entrega real ao Telegram (ultimoEnvio com status sucesso em todos os casos), mas nao substitui um humano olhando o app admin-master de verdade nem a leitura visual das mensagens no celular (formatacao/emoji) - recomendado o dono dar uma conferida visual na proxima vez que mexer nessa tela.
testes_adicionados: ver historico por task em sprint-01/02/03 (suite final 702 passed, 0 failed)
---

# Fechamento — personalizacao-relatorios-telegram

## O que foi entregue

O modal "Gerenciar" do admin-master ganhou duas abas: **Assinatura** (o que já existia) e
**Relatórios Telegram**, com três checkboxes (fechamento de caixa, estoque, alerta de
cancelamento) e um campo de margem mínima em R$ (habilitado só quando o alerta de cancelamento
está marcado). Desmarcar um checkbox realmente para de mandar aquele tipo de mensagem.

O fechamento de caixa no Telegram deixou de ser um resumo simples e passou a trazer operador,
data/hora de abertura e fechamento, quantidade e valor por forma de pagamento, e a diferença por
forma (sobrou/faltou/conferiu) — reaproveitando a mesma fórmula (`estadoCaixa`) que já é usada no
cupom físico de 80mm, então os dois nunca podem divergir.

O alerta de estoque baixo saiu de uma lista única para duas seções distintas — "Estoque zerado" e
"Estoque mínimo" — usando as mesmas flags (`esgotado`/`baixo`) que a tela de Controle de estoque
já calculava.

Um tipo de alerta novo: **cancelamento/estorno de venda**. Dispara só quando o restaurante liga o
toggle e configura uma margem mínima em R$; cobre os dois pontos do sistema onde dinheiro já
recebido é revertido (cancelar um pedido pago/PDV, estornar um recebimento por engano) — a
comparação com a margem é feita por movimento/forma de pagamento, não pela soma do pedido, então
uma venda paga em duas formas pode alertar só para a forma que passa do mínimo.

## Decisão principal

**D-06** — O alerta de cancelamento cobre só os 2 pontos onde dinheiro já recebido é revertido
(`caixa.cancelarRecebido`, `caixa.estornarRecebimento`). O sistema tem mais 4 pontos de
cancelamento (pedido cancelado antes de pagar, etc.), mapeados na descoberta (F2) e descartados
por exigirem cálculo de valor novo e correrem risco de dependência circular entre `pedidos.js` e
`empresas.js` — sem valor proporcional ao risco para esta rodada.

## Risco residual

Nenhum item novo pendente. A validação ponta a ponta (sprint-04) foi feita programaticamente —
script chamando direto as funções de `src/caixa.js` (as mesmas que a rota HTTP usa) contra o
tenant de teste `nymbus-teste`, criando vendas, cancelamentos, estornos e dois fechamentos de
caixa reais. Confirmado por evidência (`config.telegram.ultimoEnvio`, sempre `status: "sucesso"`):
margem respeitada (R$20 disparou, R$5 não, tanto para cancelamento quanto para estorno) e o
toggle de estoque realmente impede o reenvio quando desligado. O que essa validação **não**
substitui: um humano clicando de fato nas duas abas do admin-master, e conferindo no próprio
celular se as mensagens ficaram legíveis/bem formatadas — vale a pena o dono dar uma olhada da
próxima vez que abrir a ficha do tenant de teste.

## Onde isto mexeu

- **Módulos:** raiz, test, design, public
- **Arquivos:** `public/relatorio-caixa.js`, `test/relatorio-caixa.test.js`, `src/caixa-calc.js`,
  `test/caixa-calc.test.js`, `src/telegram.js`, `test/telegram.test.js`, `src/servidor.js`,
  `test/telegram-admin-rotas.test.js`, `design/canvas/personalizacao-relatorios-telegram.dc.html`,
  `public/app-admin.js`, `public/style.css`, `test/telegram-admin-ui.test.js`, `src/caixa.js`,
  `test/telegram-cancelamento.test.js`, `test/telegram-fechamento-caixa.test.js`
- **Suíte final:** 702 passed, 0 failed (`npm test`); `npm run check` OK (152 arquivos)

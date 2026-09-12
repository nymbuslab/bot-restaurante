---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: personalizacao-relatorios-telegram
atualizado_em: 2026-09-07
decisoes:
  - id: D-01
    decisao: Fechamento de caixa no Telegram passa a mostrar quantidade de vendas E valor por forma de pagamento (nao so valor)
    alternativa_descartada: So o valor total por forma (ja pronto, sem calculo novo)
    status: fechada
    bloqueante: false
    motivo: Usuario quer ver o volume de vendas por forma, nao so o total em R$; exige contar ocorrencias em caixa_movimentos por forma (calculo novo, nao existe hoje em lugar nenhum)
  - id: D-02
    decisao: Modal Gerenciar do admin-master ganha duas abas - Assinatura (o que ja existe: resumo, acoes, historico) e Relatorios Telegram (vinculo + checkboxes de tipo)
    alternativa_descartada: Bloco unico em scroll continuo (formato atual)
    status: fechada
    bloqueante: false
    motivo: Pedido explicito do usuario; separa configuracao de negocio (assinatura) de configuracao de notificacao (Telegram)
  - id: D-03
    decisao: Os dois relatorios ja existentes (fechamento de caixa e estoque) nascem LIGADOS por padrao para tenants que ja tem o Telegram vinculado
    alternativa_descartada: Nascer desligados ate o operador marcar
    status: fechada
    bloqueante: false
    motivo: Preserva o comportamento atual - ninguem que ja recebe para de receber sem acao explicita
  - id: D-04
    decisao: Diferenca de caixa (sobrou/faltou) no Telegram vem por forma de pagamento, nao so o total global
    alternativa_descartada: Texto unico com a diferenca global (comportamento atual do cupom)
    status: fechada
    bloqueante: false
    motivo: Pedido explicito do usuario, mais util pra identificar QUAL forma teve problema
  - id: D-05
    decisao: Alerta de cancelamento dispara NA HORA que o cancelamento/estorno acontece (mensagem propria e imediata), nao so resumido no fechamento do fim do dia
    alternativa_descartada: So aparecer como linha dentro do relatorio de fechamento
    status: fechada
    bloqueante: false
    motivo: E um alerta de verdade (deteccao rapida de erro/fraude), nao um resumo periodico
  - id: D-06
    decisao: Escopo do alerta de cancelamento cobre so os pontos onde dinheiro JA RECEBIDO e revertido - cancelar pedido pago/PDV (P2, caixa.cancelarRecebido) e estornar recebimento (P4, caixa.estornarRecebimento). NAO cobre cancelamento de pedido/item antes de pagar nem cancelamento de mesa/item de mesa (P1, P3, P5, P6)
    alternativa_descartada: Cobrir os 6 pontos de cancelamento identificados na base (pontos-de-cancelamento.md), incluindo cancelamentos antes do pagamento
    status: fechada
    bloqueante: false
    motivo: So P2 e P4 ja tem o valor em R$ pronto e vivem no mesmo arquivo que ja fala com o Telegram (baixo risco); os outros 4 exigiriam calcular valor novo e mexer em modulos que hoje nao importam empresas/telegram, com risco de dependencia circular documentado (pedidos.js <-> empresas.js). Tambem sao cancelamentos ANTES de pagar - nenhum dinheiro chegou a entrar no caixa, cenario menos critico que o do pedido pago revertido
  - id: D-07
    decisao: Margem minima em R$ do alerta de cancelamento e configurada pelo admin-master (dev), por cliente, num campo de texto ao lado do checkbox
    alternativa_descartada: Valor fixo no codigo, igual pra todo mundo
    status: fechada
    bloqueante: false
    motivo: Cada restaurante tem um ticket medio diferente; admin-master ja e o unico lugar com acesso a configuracao Telegram (D-06 da feature anterior)
  - id: D-08
    decisao: Fechamento de caixa no Telegram reaproveita a MESMA formula de diferenca/estado (CONFERIDO/SOBROU/FALTOU) que ja existe em public/relatorio-caixa.js, nao uma logica propria
    alternativa_descartada: Formula e formato proprios, independentes do cupom impresso
    status: fechada
    bloqueante: false
    motivo: Evita o Telegram e o cupom impresso mostrarem numeros diferentes pro mesmo fechamento por arredondamento ou regra divergente
  - id: D-09
    decisao: Cada tipo de relatorio (fechamento, estoque, cancelamento) tem seu PROPRIO status de ultimo envio, exibido separado no admin-master
    alternativa_descartada: Um status unico agregado refletindo a ultima tentativa de qualquer tipo
    status: fechada
    bloqueante: false
    motivo: Mais preciso - se um tipo falhar e outro funcionar, o operador ve exatamente qual travou
  - id: D-10
    decisao: Definicao de pronto desta rodada - checkboxes funcionais (ligar/desligar realmente muda o que e enviado) + fechamento de caixa detalhado chegando de verdade + estoque em duas secoes chegando de verdade + alerta de cancelamento respeitando a margem, tudo validado com Telegram real
    alternativa_descartada: Aceitar suite automatizada verde como suficiente, sem validacao real
    status: fechada
    bloqueante: false
    motivo: Escolha explicita do usuario, mesmo padrao de rigor da feature anterior (relatorios-telegram, D-13)
  - id: D-11
    decisao: Ao ler config.telegram.ultimoEnvio no formato antigo (flat - { em, status, erro? } - herdado da feature relatorios-telegram, ex. tenant nymbus-teste), tratar como se nenhum tipo tivesse ultimoEnvio ainda (todos null); nao migrar ativamente o dado antigo
    alternativa_descartada: Escrever uma migracao que converte o valor flat existente para o novo formato por tipo
    status: fechada
    bloqueante: false
    motivo: E cosmetico e autocurativo - o proximo envio real de cada tipo (fechamento, estoque ou cancelamento) sobrescreve com a chave nova; nao vale o esforco de migracao pra um indicador de status que se atualiza sozinho a cada envio
---

# Decisões — personalizacao-relatorios-telegram

## Decisões

```
D-01 | Fechamento mostra quantidade E valor por forma | So valor (ja pronto) | Usuario quer volume de vendas visivel
D-02 | Modal Gerenciar ganha 2 abas (Assinatura / Relatorios Telegram) | Bloco unico em scroll | Pedido explicito do usuario
D-03 | Fechamento e estoque nascem LIGADOS por padrao | Nascer desligados | Preserva comportamento atual
D-04 | Diferenca de caixa por forma de pagamento | So diferenca global | Pedido explicito, mais util pra achar o problema
D-05 | Alerta de cancelamento dispara na hora (tempo real) | So resumido no fechamento do fim do dia | E alerta de verdade, deteccao rapida
D-06 | Alerta de cancelamento cobre so pedido pago/PDV cancelado + estorno (P2+P4) | Cobrir os 6 pontos, inclusive antes de pagar | So P2/P4 tem valor pronto e baixo risco; outros 4 tem risco de ciclo de dependencia
D-07 | Margem minima configuravel por cliente, no admin-master | Valor fixo no codigo | Ticket medio varia por restaurante
D-08 | Reaproveita a formula de diferenca/estado do cupom impresso | Formula propria | Evita numeros divergentes entre Telegram e cupom
D-09 | Status de ultimo envio separado por tipo de relatorio | Status unico agregado | Mais preciso pra saber o que travou
D-10 | Definicao de pronto exige validacao real (Telegram de verdade) dos 3 conteudos + checkboxes funcionais | Suite automatizada verde basta | Mesmo padrao de rigor da feature anterior
D-11 | Formato antigo de ultimoEnvio (flat, ja gravado em tenants como nymbus-teste) e tratado como todos os tipos null, sem migracao ativa | Migrar o dado antigo para o novo formato por tipo | E autocurativo - proximo envio real de cada tipo sobrescreve sozinho
```

## Pendências

Nenhuma pendência.

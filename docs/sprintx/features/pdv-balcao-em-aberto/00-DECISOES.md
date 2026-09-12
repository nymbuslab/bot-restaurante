---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: pdv-balcao-em-aberto
atualizado_em: 2026-09-08
decisoes:
  - id: D-01
    decisao: Kanban de pedidos (Em aberto/Preparando/Entregue) descartado
    alternativa_descartada: Quadro kanban com cards de status de preparo
    motivo: Conflita com fronteira ja registrada no CLAUDE.md do projeto (ciclo do pedido e de sistema externo, nao vira KDS)
    status: fechada
    bloqueante: false
  - id: D-02
    decisao: Identificador do pedido em aberto e o numero sequencial que ja existe (pedidos.numero)
    alternativa_descartada: Inventar campo novo (senha, codigo de comanda)
    motivo: Numero ja e visivel em toda a UI e na comanda impressa; nao precisa de campo novo
    status: fechada
    bloqueante: false
  - id: D-03
    decisao: Reabertura para acrescentar itens acontece a partir do pedido ja listado na aba Pedidos
    alternativa_descartada: Nova tela/aba dedicada "Balcao em aberto"
    motivo: Reaproveita o modal abrirModalPedido, que ja existe e ja e parcialmente editavel (podeModificar)
    status: fechada
    bloqueante: false
  - id: D-04
    decisao: Acrescimo em pedido ja impresso reimprime so os itens da rodada nova para a cozinha
    alternativa_descartada: Reimprimir a comanda inteira, ou nao reimprimir o acrescimo
    motivo: Mesmo padrao que Mesas ja usam (itensDeCozinha + Comanda.montarCozinha por rodada); evita cozinha repreparar o que ja saiu e evita perder o item novo
    status: fechada
    bloqueante: false
  - id: D-05
    decisao: Pedido em aberto e UMA linha em pedidos com UPDATE incremental (append em itens, soma em total) a cada rodada
    alternativa_descartada: Uma linha nova por rodada, amarradas por um campo de agrupamento novo (equivalente a mesa_id)
    motivo: E exatamente o padrao que mesasDb.lancarItens ja usa e ja roda em producao (src/mesas-db.js:533-589); dispensa qualquer coluna nova e reusa a guarda recebido_em IS NULL AND status <> cancelado que cancelarPedido/cancelarItemPedido ja usam
    status: fechada
    bloqueante: false
  - id: D-06
    decisao: Novo tipo de venda no PDV se chama "Comanda", ao lado de Balcao/Entrega/Retirada
    alternativa_descartada: "Em aberto", "Balcao (aberto)", ou renomear o Balcao atual para "Venda direta"
    motivo: Resposta do dono na entrevista F2 (P-01/P-01b)
    status: fechada
    bloqueante: false
  - id: D-07
    decisao: "Acrescentar item" no modal de detalhe do pedido vale para QUALQUER pedido a receber (recebido_em IS NULL, status <> cancelado), nao so pedidos do tipo Comanda
    alternativa_descartada: Restringir "acrescentar item" so a pedidos abertos como Comanda
    motivo: Resposta do dono (P-02) - mesma guarda que "cancelar item" ja usa hoje para qualquer pedido a receber, inclusive vindo do WhatsApp/cardapio web
    status: fechada
    bloqueante: false
  - id: D-08
    decisao: "Cancelar um item com cozinha:true ganha um SEGUNDO aviso especifico (\"ja foi enviado a cozinha\"), somado ao dialogo confirmarComOpcao que ja existe hoje para qualquer item"
    alternativa_descartada: Manter so o dialogo generico atual (confirmarComOpcao, sem mencionar cozinha) tambem para itens ja enviados a cozinha
    motivo: "Correcao na F5 (achado ALTA): a premissa original (P-03) de que cancelar item hoje nao avisa nada estava ERRADA - public/app.js:5541-5553 ja chama confirmarComOpcao (com opcao de devolver ao estoque) para QUALQUER item. O que o dono pediu (risco de cancelar item ja em preparo) exige um aviso ESPECIFICO de cozinha, nao um aviso generico que ja existia"
    status: fechada
    bloqueante: false
  - id: D-14
    decisao: Comanda nunca imprime cupom automaticamente (nem na abertura nem nas rodadas seguintes), so a via de cozinha - mesmo tratamento que Retirada ja recebe na regra de cupom (tipoEntrega !== "Retirada") em /api/pdv/vender
    alternativa_descartada: Comanda imprime cupom de venda na abertura, igual Balcao/Entrega hoje
    motivo: "Achado da auditoria F5 (achado ALTA): sem essa decisao, uma Comanda recem-aberta e nao paga imprimiria cupom de venda, contradizendo o conceito de pedido em aberto. Consistente com Mesa, que tambem nao emite cupom por rodada (base/02-mesas-sessao-aberta.md). Dono confirmou."
    status: fechada
    bloqueante: false
  - id: D-09
    decisao: Pedido em aberto (Comanda) nao tem limite de tempo aberto, mesmo padrao que mesa hoje
    alternativa_descartada: Alertar operador apos X minutos/horas parado
    motivo: Resposta do dono (P-04)
    status: fechada
    bloqueante: false
  - id: D-10
    decisao: "Fechar/cobrar a Comanda usa o modal \"Receber pagamento\" (abrirPedReceber, public/app.js:5041-5139) ja existente, o mesmo que Entrega/Retirada ja usam hoje dentro do modal de detalhe do pedido"
    alternativa_descartada: Reusar a tela cheia do PDV (Finalizar venda / renderPdvPagar), como pensado inicialmente na P-05
    motivo: "Descoberta na F3 (rule 11): abrirPedReceber ja fica plugado no mesmo modal onde \"Acrescentar item\" vai morar, ja suporta split/troco, e o botao \"Receber pagamento\" ja aparece automaticamente pra qualquer pedido nao-mesa/nao-recebido (public/app.js:5606-5627) - fechar uma Comanda nao exige NENHUM codigo novo de fechamento, so passa a existir porque a Comanda satisfaz as mesmas condicoes que Entrega/Retirada ja satisfazem. Dono confirmou a correcao explicitamente."
    status: fechada
    bloqueante: false
  - id: D-11
    decisao: Sem limite de quantidade de itens ou de rodadas numa Comanda, mesmo padrao que mesa
    alternativa_descartada: Teto configuravel de itens/rodadas
    motivo: Resposta do dono, consistente com D-09; nenhum limite equivalente foi encontrado no codigo de mesas na F1
    status: fechada
    bloqueante: false
  - id: D-12
    decisao: Sem metrica ou indicacao nova em relatorio/dashboard para pedidos com multiplas rodadas
    alternativa_descartada: Destacar numero de rodadas ou tempo em aberto em algum relatorio
    motivo: Resposta do dono (P-07) - conta como qualquer pedido hoje, sem metrica extra
    status: fechada
    bloqueante: false
  - id: D-13
    decisao: "Definicao de pronto: (1) abrir Comanda e acrescentar itens com total atualizado na tela, (2) cozinha recebe via impressa so com os itens do acrescimo, (3) fechar a Comanda e cobrar pela tela existente, (4) cancelar item ja impresso mostra o aviso de D-08"
    alternativa_descartada: Criterio de aceite generico sem os 4 casos explicitos
    motivo: Resposta do dono (P-06) - guia os testes funcionais da F3
    status: fechada
    bloqueante: false
---

# Decisões — pdv-balcao-em-aberto

## Decisões

```
D-01 | Kanban de pedidos descartado | Quadro kanban com cards de status de preparo | Conflita com a fronteira "não vira KDS" já registrada no CLAUDE.md
D-02 | Identificador do pedido em aberto é o `numero` sequencial já existente | Inventar campo novo (senha, código de comanda) | Já é visível em toda a UI e na comanda impressa
D-03 | Reabertura acontece a partir do pedido já listado na aba Pedidos | Nova tela/aba dedicada "Balcão em aberto" | Reaproveita o modal `abrirModalPedido`, que já é parcialmente editável
D-04 | Acréscimo em pedido já impresso reimprime só os itens da rodada nova | Reimprimir a comanda inteira, ou não reimprimir | Mesmo padrão que Mesas já usam (rodada por rodada)
D-05 | Pedido em aberto é UMA linha em `pedidos`, com UPDATE incremental por rodada | Uma linha nova por rodada, com campo de agrupamento novo | É o padrão que `mesasDb.lancarItens` já usa em produção; dispensa coluna nova
D-06 | Novo tipo de venda se chama "Comanda" | "Em aberto", "Balcão (aberto)", ou renomear o Balcão atual | Resposta do dono (P-01/P-01b)
D-07 | "Acrescentar item" vale para QUALQUER pedido a receber, não só Comanda | Restringir só ao tipo Comanda | Resposta do dono (P-02) — mesma guarda que "cancelar item" já usa
D-08 | Cancelar item com cozinha:true ganha um SEGUNDO aviso específico ("já foi enviado à cozinha"), somado ao diálogo confirmarComOpcao que já existe hoje para qualquer item | Manter só o diálogo genérico atual também para itens já enviados à cozinha | Correção na F5: a premissa original (cancelar hoje não avisa nada) estava errada — já existe confirmarComOpcao para qualquer item; o pedido do dono exige um aviso específico de cozinha
D-09 | Comanda não tem limite de tempo aberta | Alertar após X minutos/horas parado | Resposta do dono (P-04)
D-10 | Fechar/cobrar a Comanda usa o modal "Receber pagamento" já existente (mesmo de Entrega/Retirada) — sem código novo de fechamento | Reusar a tela cheia "Finalizar venda" do PDV, como pensado na P-05 | Descoberta na F3: o botão "Receber pagamento" já aparece automaticamente pra qualquer pedido não-mesa/não-recebido; dono confirmou a correção
D-11 | Sem limite de itens/rodadas por Comanda | Teto configurável | Resposta do dono, consistente com D-09
D-12 | Sem métrica nova em relatório/dashboard para pedidos com múltiplas rodadas | Destacar nº de rodadas ou tempo aberto | Resposta do dono (P-07)
D-13 | Definição de pronto: abrir+acrescentar, cozinha só recebe o acréscimo, fechar/cobrar, aviso ao cancelar item já impresso | Critério de aceite genérico | Resposta do dono (P-06)
D-14 | Comanda nunca imprime cupom automaticamente (abertura nem rodadas), só a via de cozinha — mesmo tratamento que Retirada | Comanda imprime cupom na abertura, igual Balcão/Entrega | Achado da auditoria F5: cupom antes do fechamento contradiz "em aberto"; consistente com Mesa, que também não emite cupom por rodada; dono confirmou
```

## Pendências

Nenhuma pendência. Os sete eixos da F2 foram cobertos e a única lacuna da F1 (limite de itens/rodadas) foi fechada por D-11.

Eixos não decididos por não terem decisão de negócio pendente (herdados de padrão existente, sem necessidade de perguntar):
- **Ambiente e segredos**: nenhuma variável de ambiente nova prevista — reusa a mesma infraestrutura de PDV/impressão já existente.
- **Quem usa / gate de plano**: a feature vive dentro do PDV, que já é gated por `exigePdv`/Plano Completo — sem gate novo a decidir.

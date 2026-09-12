---
expx_schema: 1
expx_tool: sprintx
kind: base_indice
trabalho_id: pdv-balcao-em-aberto
atualizado_em: 2026-09-07
areas:
  - arquivo: 01-pdv-fluxo-atual.md
    titulo: PDV fluxo atual (grade, carrinho, Cobrar)
    lacunas: 1
  - arquivo: 02-mesas-sessao-aberta.md
    titulo: Mesas sessao aberta (padrao de referencia)
    lacunas: 0
  - arquivo: 03-pedidos-modelo-e-rotas.md
    titulo: Pedidos modelo e rotas existentes
    lacunas: 0
  - arquivo: 04-impressao-cozinha.md
    titulo: Impressao cozinha (fila, flag cozinha, vias)
    lacunas: 0
  - arquivo: 05-padroes-de-teste.md
    titulo: Padroes de teste do projeto
    lacunas: 0
---

# Índice da base — pdv-balcao-em-aberto

> Feature: novo tipo de venda no PDV que fica "em aberto" (como mesa), rápido de abrir,
> onde o atendente chama o pedido de volta pelo `numero` já existente e acrescenta itens
> antes de fechar/cobrar. Contexto completo de UX já levantado com o dono em conversa
> anterior (ver `00-DECISOES.md` na F2).

| Arquivo | Área | Resumo |
|---|---|---|
| `01-pdv-fluxo-atual.md` | PDV — grade, carrinho, Cobrar | Como `pdvCobrar`/`renderPdvPagar`/`POST /api/pdv/vender` funcionam hoje, e onde o novo tipo de venda provavelmente se encaixa. |
| `02-mesas-sessao-aberta.md` | Mesas — sessão aberta | O padrão de referência mais próximo: abrir, lançar rodada, imprimir só a rodada. Custo de UI (~5-6 cliques) documentado. |
| `03-pedidos-modelo-e-rotas.md` | Pedidos — schema e rotas | Schema de `pedidos`, `numero` sequencial, rotas de cancelar/reimprimir existentes, e a descoberta de que o modal de detalhe já é parcialmente editável (`podeModificar`). |
| `04-impressao-cozinha.md` | Impressão — fila e vias | Como a via de cozinha é montada e enfileirada por rodada, e a regra de cupom por tipo de venda. |
| `05-padroes-de-teste.md` | Padrões de teste | Runner, testes de integração análogos (mesas, PDV, cozinha-observação) e o padrão de arnês para testar trechos de `app.js`. |

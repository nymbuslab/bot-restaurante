# Tasks — Sprint 06

```yaml
id: T-06.01
titulo: Protótipo de Compras e Financeiro
objetivo: Desenhar todos os estados de fornecedores, compras, revisão, parcelas, contas e extratos em desktop e mobile.
arquivos:
  cria: [design/canvas/compras-custos-desktop.dc.html, design/canvas/compras-custos-mobile.dc.html]
  altera: []
teste_integracao: Cada ação desenhada possui contrato de API e estado de erro correspondente.
teste_funcional: Fluxos preservam contexto, foco, Escape e alvos mínimos de 44 px.
criterio_aceite: O usuário aprova os protótipos antes de T-06.02.
depende_de: [T-05.04]
paralelizavel: false
status: concluido
evidencia: docs/estoque-e-custos/prototipos/compras-financeiro.md
aprovado_em: 2026-09-14
```

```yaml
id: T-06.02
titulo: Interface de cadastros e compra
objetivo: Implementar fornecedores, rascunho, conciliação de itens, revisão, parcelas e confirmação.
arquivos:
  cria: [public/compras.js, public/financeiro.js]
  altera: [public/admin.html, public/app.js, public/style.css]
teste_integracao: A interface confirma contra as APIs reais e recupera retry idempotente após timeout.
teste_funcional: Usuário cria fornecedor inline, compra 4 pacotes de 5 kg e vê saldo e custo projetados antes de confirmar.
criterio_aceite: Desktop e mobile correspondem ao protótipo aprovado e exibem loading, vazio, erro e sucesso.
depende_de: [T-06.01]
paralelizavel: false
status: pendente
```

```yaml
id: T-06.03
titulo: Parcelas e pagamentos
objetivo: Implementar baixa parcial, juros, descontos, estorno e conciliação manual.
arquivos:
  cria: [test/integracao/contas-pagar.test.js]
  altera: [src/financeiro-db.js, src/servidor.js, public/financeiro.js]
teste_integracao: Pagamento atualiza título, conta e auditoria em um commit e o estorno recompõe os três.
teste_funcional: Duas baixas parciais fecham a parcela e juros e descontos aparecem separados no extrato.
criterio_aceite: Saldo pago mais saldo aberto fecha exatamente o valor da parcela ajustada.
depende_de: [T-06.02]
paralelizavel: false
status: pendente
```

```yaml
id: T-06.04
titulo: Estorno, devolução e ajuste de custo
objetivo: Corrigir compras confirmadas somente por operações compensatórias vinculadas.
arquivos:
  cria: [test/integracao/compras-correcoes.test.js]
  altera: [src/compras-db.js, src/estoque-custos.js, src/financeiro-db.js, src/servidor.js, public/compras.js]
teste_integracao: Movimento posterior bloqueia estorno integral e falha em uma linha reverte toda a correção.
teste_funcional: Devolver 3 kg a custo 6 retira 3 kg e 18 reais e permite crédito, abatimento ou reembolso.
criterio_aceite: Nenhuma correção apaga ou edita documento, movimento ou custo histórico.
depende_de: [T-06.03]
paralelizavel: false
status: pendente
```

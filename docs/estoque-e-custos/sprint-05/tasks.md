# Tasks — Sprint 05

```yaml
id: T-05.01
titulo: Schema e serviço de compras
objetivo: Criar documentos, linhas, snapshots, rateios, parcelas e controle de versão.
arquivos:
  cria: [supabase/migrations/20260915130000_compras.sql, src/compras-db.js]
  altera: []
teste_integracao: Rascunho salva linhas sem alterar saldo, custo ou conta financeira.
teste_funcional: Versão antiga e edição de compra confirmada retornam conflito.
criterio_aceite: Estados e transições aceitam apenas rascunho, confirmada, cancelada e estornada.
depende_de: [T-04.02, T-04.04]
paralelizavel: false
status: pendente
```

```yaml
id: T-05.02
titulo: Motor de conversão e rateio
objetivo: Calcular quantidade-base, custo líquido e parcelas com precisão aprovada.
arquivos:
  cria: [src/compras-calculos.js]
  altera: [test/compras-calculos.test.js, test/financeiro-calculos.test.js]
teste_integracao: A revisão persistida usa exatamente os totais produzidos pelo motor puro.
teste_funcional: Quatro pacotes de 5 kg geram 20 kg e 10 de frete rateiam 6 e 4 sobre linhas 60/40.
criterio_aceite: A soma dos rateios em centavos é igual ao total geral para todos os vetores de teste.
depende_de: [T-05.01]
paralelizavel: false
status: pendente
```

```yaml
id: T-05.03
titulo: Serviço transacional de estoque e custo
objetivo: Atualizar JSONB, trilha relacional e custo médio sob uma ordem única de travas.
arquivos:
  cria: [src/estoque-custos.js]
  altera: [src/store.js, src/estoque-db.js]
teste_integracao: Compra mista atualiza apenas alvos selecionados e rollback elimina todos os efeitos de uma linha inválida.
teste_funcional: Saldo 10 a custo 5 mais entrada 20 por 120 resulta em saldo 30 e custo 5.666667.
criterio_aceite: Produto-pai não muda quando a compra aponta para uma variação.
depende_de: [T-05.02]
paralelizavel: false
status: pendente
```

```yaml
id: T-05.04
titulo: Confirmação idempotente e rotas
objetivo: Confirmar compra, parcelas e pagamento à vista em uma transação versionada e idempotente.
arquivos:
  cria: [test/integracao/compras.test.js]
  altera: [src/compras-db.js, src/financeiro-db.js, src/servidor.js]
teste_integracao: Duas confirmações concorrentes com a mesma chave geram uma única série de movimentos.
teste_funcional: Reusar a chave com conteúdo diferente retorna 409 e não altera saldos.
criterio_aceite: Documento, estoque, custo, parcelas e pagamento são confirmados juntos ou permanecem inalterados.
depende_de: [T-05.03]
paralelizavel: false
status: pendente
```

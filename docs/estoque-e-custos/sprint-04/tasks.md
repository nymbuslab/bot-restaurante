# Tasks — Sprint 04

```yaml
id: T-04.01
titulo: Registro-ponte do catálogo
objetivo: Criar alvos tipados e sincronizá-los na mesma transação do salvamento do cardápio.
arquivos:
  cria: [supabase/migrations/20260915100000_catalogo_alvos.sql, src/catalogo-alvos-db.js]
  altera: [src/store.js]
teste_integracao: Dois tenants podem reutilizar IDs locais sem colisão e não podem cruzar alvos.
teste_funcional: Produto com variações cria somente alvos de variação para estoque próprio.
criterio_aceite: Salvar cardápio atualiza o registro-ponte sem alterar o JSONB devolvido pelas APIs existentes.
depende_de: [T-03.03]
paralelizavel: true
status: pendente
```

```yaml
id: T-04.02
titulo: Fornecedores e identificadores
objetivo: Implementar fornecedores, código interno, GTIN e vínculo fornecedor-alvo.
arquivos:
  cria: [supabase/migrations/20260915110000_fornecedores.sql, src/fornecedores-db.js, test/integracao/fornecedores.test.js]
  altera: [src/servidor.js]
teste_integracao: CNPJ, código interno e GTIN são únicos por tenant e FKs compostas recusam cruzamento.
teste_funcional: Criar fornecedor inline preserva o rascunho recebido e vínculo conhecido é sugerido depois.
criterio_aceite: CRUD, arquivamento e vínculos respondem com os códigos HTTP documentados.
depende_de: [T-04.01]
paralelizavel: false
status: pendente
```

```yaml
id: T-04.03
titulo: Contas financeiras e razão
objetivo: Criar contas e movimentos imutáveis com saldo atualizado atomicamente.
arquivos:
  cria: [supabase/migrations/20260915120000_financeiro.sql, src/financeiro-db.js]
  altera: []
teste_integracao: Implantação e movimento atualizam saldo e razão no mesmo commit e isolam tenant.
teste_funcional: Conta arquivada mantém extrato e recusa novo movimento.
criterio_aceite: Saldo de cada conta equivale ao saldo inicial mais todos os movimentos confirmados.
depende_de: [T-03.03]
paralelizavel: true
status: pendente
```

```yaml
id: T-04.04
titulo: Transferências e conciliação manual
objetivo: Implementar transferência vinculada, estorno e marcação manual de conciliação.
arquivos:
  cria: [test/integracao/financeiro.test.js]
  altera: [src/financeiro-db.js, src/servidor.js]
teste_integracao: Falha no crédito reverte também o débito e nenhuma conta fica parcialmente atualizada.
teste_funcional: Transferir 100 reduz a origem em 100, aumenta o destino em 100 e compartilha um vínculo.
criterio_aceite: Transferência, estorno e conciliação registram ator e não permitem edição do movimento.
depende_de: [T-04.03]
paralelizavel: false
status: pendente
```

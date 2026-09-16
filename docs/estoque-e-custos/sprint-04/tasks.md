---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: estoque-e-custos
atualizado_em: 2026-09-16
tasks:
  - id: T-04.01
    titulo: Registro-ponte do catalogo
    fase: F-04.1
    status: concluida
    objetivo: Criar alvos tipados e sincroniza-los na mesma transacao do salvamento do cardapio.
    arquivos:
      cria: [supabase/migrations/20260916100000_catalogo_alvos.sql, src/catalogo-alvos-db.js, test/integracao/catalogo-alvos.test.js]
      altera: [src/store.js]
    teste_integracao: Dois tenants podem reutilizar IDs locais sem colisao e nao podem cruzar alvos.
    teste_funcional: Produto com variacoes cria somente alvos de variacao para estoque proprio.
    criterio_aceite: Salvar cardapio atualiza o registro-ponte sem alterar o JSONB devolvido pelas APIs existentes.
    depende_de: [T-03.03]
    paralelizavel: true
    concluida_em: 2026-09-16
    suite: verde
  - id: T-04.02
    titulo: Fornecedores e identificadores
    fase: F-04.1
    status: concluida
    objetivo: Implementar fornecedores, codigo interno, GTIN e vinculo fornecedor-alvo.
    arquivos:
      cria: [supabase/migrations/20260916110000_fornecedores.sql, src/fornecedores-db.js, test/integracao/fornecedores.test.js]
      altera: [src/servidor.js, src/permissoes.js]
    teste_integracao: CNPJ, codigo interno e GTIN sao unicos por tenant e FKs compostas recusam cruzamento.
    teste_funcional: Criar fornecedor inline preserva o rascunho recebido e vinculo conhecido e sugerido depois.
    criterio_aceite: CRUD, arquivamento e vinculos respondem com os codigos HTTP documentados.
    depende_de: [T-04.01]
    paralelizavel: false
    concluida_em: 2026-09-16
    suite: verde
  - id: T-04.03
    titulo: Contas financeiras e razao
    fase: F-04.2
    status: concluida
    objetivo: Criar contas e movimentos imutaveis com saldo atualizado atomicamente.
    arquivos:
      cria: [supabase/migrations/20260916120000_financeiro.sql, src/financeiro-db.js, test/integracao/financeiro-contas.test.js]
      altera: []
    teste_integracao: Implantacao e movimento atualizam saldo e razao no mesmo commit e isolam tenant.
    teste_funcional: Conta arquivada mantem extrato e recusa novo movimento.
    criterio_aceite: Saldo de cada conta equivale ao saldo inicial mais todos os movimentos confirmados.
    depende_de: [T-03.03]
    paralelizavel: true
    concluida_em: 2026-09-16
    suite: verde
  - id: T-04.04
    titulo: Transferencias e conciliacao manual
    fase: F-04.2
    status: concluida
    objetivo: Implementar transferencia vinculada, estorno e marcacao manual de conciliacao.
    arquivos:
      cria: [test/integracao/financeiro.test.js]
      altera: [src/financeiro-db.js, src/servidor.js]
    teste_integracao: Falha no credito reverte tambem o debito e nenhuma conta fica parcialmente atualizada.
    teste_funcional: Transferir 100 reduz a origem em 100, aumenta o destino em 100 e compartilha um vinculo.
    criterio_aceite: Transferencia, estorno e conciliacao registram ator e nao permitem edicao do movimento.
    depende_de: [T-04.03]
    paralelizavel: false
    concluida_em: 2026-09-16
    suite: verde
---

# Tasks — Sprint 04

```yaml
id: T-04.01
titulo: Registro-ponte do catálogo
objetivo: Criar alvos tipados e sincronizá-los na mesma transação do salvamento do cardápio.
arquivos:
  cria: [supabase/migrations/20260916100000_catalogo_alvos.sql, src/catalogo-alvos-db.js, test/integracao/catalogo-alvos.test.js]
  altera: [src/store.js]
teste_integracao: Dois tenants podem reutilizar IDs locais sem colisão e não podem cruzar alvos.
teste_funcional: Produto com variações cria somente alvos de variação para estoque próprio.
criterio_aceite: Salvar cardápio atualiza o registro-ponte sem alterar o JSONB devolvido pelas APIs existentes.
depende_de: [T-03.03]
paralelizavel: true
status: concluida
# 2026-09-16 · suite: 4 passed, 0 failed (test:integracao/catalogo-alvos.test.js) + npm run test:ci 784 passed
# real: 1,5 h
# Divergência: migration renomeada de 20260915100000_catalogo_alvos.sql para
# 20260916100000_catalogo_alvos.sql (colisão com 20260915100000_auditoria_operacional.sql,
# já sinalizada em 00-AUDITORIA.md). Teste de integração não estava listado em
# arquivos.cria no plano original; criado em test/integracao/catalogo-alvos.test.js.
```

```yaml
id: T-04.02
titulo: Fornecedores e identificadores
objetivo: Implementar fornecedores, código interno, GTIN e vínculo fornecedor-alvo.
arquivos:
  cria: [supabase/migrations/20260916110000_fornecedores.sql, src/fornecedores-db.js, test/integracao/fornecedores.test.js]
  altera: [src/servidor.js, src/permissoes.js]
teste_integracao: CNPJ, código interno e GTIN são únicos por tenant e FKs compostas recusam cruzamento.
teste_funcional: Criar fornecedor inline preserva o rascunho recebido e vínculo conhecido é sugerido depois.
criterio_aceite: CRUD, arquivamento e vínculos respondem com os códigos HTTP documentados.
depende_de: [T-04.01]
paralelizavel: false
status: concluida
# 2026-09-16 · suite: 11 passed, 0 failed (test:integracao/fornecedores.test.js) + npm run test:ci 784 passed
# real: 2,5 h
# Divergência: migration renomeada de 20260915110000 para 20260916110000 (mesmo
# motivo de T-04.01). Adicionadas as permissões "fornecedores.gerenciar",
# "financeiro.ver" e "financeiro.gerenciar" em src/permissoes.js (não estavam no
# catálogo de perfis; decisão de implementação para poder usar exigePermissao nas
# rotas novas, atribuídas a administrador/gerente/estoque_compras, seguindo o
# padrão já usado por compras.criar/custos.ver).
```

```yaml
id: T-04.03
titulo: Contas financeiras e razão
objetivo: Criar contas e movimentos imutáveis com saldo atualizado atomicamente.
arquivos:
  cria: [supabase/migrations/20260916120000_financeiro.sql, src/financeiro-db.js, test/integracao/financeiro-contas.test.js]
  altera: []
teste_integracao: Implantação e movimento atualizam saldo e razão no mesmo commit e isolam tenant.
teste_funcional: Conta arquivada mantém extrato e recusa novo movimento.
criterio_aceite: Saldo de cada conta equivale ao saldo inicial mais todos os movimentos confirmados.
depende_de: [T-03.03]
paralelizavel: true
status: concluida
# 2026-09-16 · suite: 5 passed, 0 failed (test:integracao/financeiro-contas.test.js) + npm run test:ci 784 passed
# real: 2 h
# Divergência: migration renomeada de 20260915120000 para 20260916120000 (mesmo
# motivo de T-04.01/T-04.02). Teste de integração não estava listado no plano;
# criado como test/integracao/financeiro-contas.test.js (nome distinto de
# financeiro.test.js para não colidir com o arquivo que T-04.04 cria). A
# migration já contempla as colunas de transferência/estorno/conciliação que
# T-04.04 vai usar (vinculo_id, estorno_de, conciliado*), porque T-04.04 não
# tem migration própria no plano. BUG financeiro pego pelo teste antes de
# fechar a task: criarConta gravava saldoInicial na coluna E TAMBÉM lançava a
# implantação em cima dele, duplicando o saldo — corrigido gravando a conta
# com saldo zero e deixando o valor inicial entrar só pelo movimento.
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
status: concluida
# 2026-09-16 · suite: 8 passed, 0 failed (test:integracao/financeiro.test.js) + npm run test:ci 784 passed
# real: 2,5 h
# Divergência: rotas HTTP de contas/movimentos (POST/GET /api/financeiro/contas,
# .../movimentos) também foram criadas aqui, junto com transferência/estorno/
# conciliação — T-04.03 não tinha altera:[src/servidor.js] no plano, então não
# havia superfície HTTP nenhuma para contas antes desta task; sem isso não dava
# para testar transferência/estorno por HTTP como o teste_integracao pede.
# Divergência: rodar a suíte de integração INTEIRA (23 arquivos) revelou
# contenção de conexão no Session pooler do projeto de teste (--test-concurrency=3
# não aguentava mais o volume dos 4 arquivos novos desta sprint) — registrado e
# resolvido como B-01 em 00-BLOQUEIOS.md (baixado para --test-concurrency=2 em
# scripts/test-integracao.js; suíte completa: 124 passed, 0 failed).
```

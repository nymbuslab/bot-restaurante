# Tasks — Sprint 01

```yaml
id: T-01.01
titulo: Harness de banco seguro
objetivo: Estender o ambiente descartável com utilitários dos novos domínios sem aceitar DATABASE_URL de produção.
arquivos:
  cria: [test/integracao/ajuda/estoque-custos.js]
  altera: [test/integracao/ajuda/ambiente.js]
teste_integracao: O harness cria e remove dados de dois tenants no projeto descartável.
teste_funcional: Uma URL sem marcador de teste é recusada antes da primeira query.
criterio_aceite: O helper exporta fixtures isoladas e o teste de proteção termina com zero writes.
depende_de: []
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 723/723; npm run test:integracao 69/69; npm run check 161 arquivos
```

```yaml
id: T-01.02
titulo: Fixtures de identidade e documentos
objetivo: Definir builders determinísticos para atores, alvos, compras, parcelas e contas.
arquivos:
  cria: [test/fixtures/estoque-custos.js]
  altera: []
teste_integracao: Os builders alimentam dois tenants sem reutilizar identificadores.
teste_funcional: A mesma seed gera o mesmo documento e a mesma chave idempotente.
criterio_aceite: As fixtures cobrem dono, funcionário, produto, variação, fornecedor, compra e conta.
depende_de: [T-01.01]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 725/725; npm run test:integracao 70/70; npm run check 163 arquivos
```

```yaml
id: T-01.03
titulo: Contratos de autorização
objetivo: Criar testes de contrato para PIN, dispositivo, sessão, perfis e permissões.
arquivos:
  cria: [test/equipe-contratos.test.js]
  altera: []
teste_integracao: Cada rota protegida diferencia dono, funcionário autorizado, funcionário sem permissão e outro tenant.
teste_funcional: Cinco PINs inválidos bloqueiam quinze minutos e a inatividade padrão encerra a sessão.
criterio_aceite: Os casos de autenticação e escalada estão enumerados com entradas e códigos HTTP esperados.
depende_de: [T-01.02]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 729/729; npm run test:integracao 70/70; npm run check 164 arquivos
```

```yaml
id: T-01.04
titulo: Contratos financeiros e de estoque
objetivo: Criar testes vetoriais para conversão, rateio, média móvel, parcelas e transferências.
arquivos:
  cria: [test/compras-calculos.test.js, test/financeiro-calculos.test.js]
  altera: []
teste_integracao: Uma confirmação simulada exige resultado atômico para documento, estoque, custo e parcelas.
teste_funcional: Os vetores aprovados produzem 20 kg, custo 5.666667 e rateio total sem centavo residual.
criterio_aceite: Todos os exemplos D-P1-01 e D-P1-04 possuem asserções numéricas exatas.
depende_de: [T-01.02]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 738/738; npm run test:integracao 70/70; npm run check 166 arquivos
```

# Tasks — Sprint 02

```yaml
id: T-02.01
titulo: Schema aditivo de equipe
objetivo: Criar tabelas, constraints, índices, RLS e flags sem ativar o recurso.
arquivos:
  cria: [supabase/migrations/20260915090000_equipe_permissoes.sql]
  altera: []
teste_integracao: A migration aceita dois tenants e rejeita referência cruzada por FK composta.
teste_funcional: PIN em texto puro não existe em nenhuma coluna e perfis inválidos são recusados.
criterio_aceite: A migration é aditiva, idempotente e deixa todas as flags desligadas.
depende_de: [T-01.03]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 741/741; npm run test:integracao 73/73; npm run check 168 arquivos
```

```yaml
id: T-02.02
titulo: Serviço de equipe e PIN
objetivo: Implementar cadastro, hash, bloqueio, dispositivo, sessão opaca e resolução de permissões.
arquivos:
  cria: [src/equipe-db.js, src/permissoes.js]
  altera: [src/empresas.js]
teste_integracao: Funcionário só inicia sessão em dispositivo válido do próprio tenant e revogação encerra o acesso.
teste_funcional: Perfis mais ajustes produzem a permissão efetiva sem autoelevação.
criterio_aceite: Cinco erros bloqueiam quinze minutos e tokens são persistidos somente por hash.
depende_de: [T-02.01]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 744/744; npm run test:integracao 76/76; npm run check 172 arquivos
```

```yaml
id: T-02.03
titulo: Principal autenticado unificado
objetivo: Fazer o middleware resolver dono ou funcionário e expor ator, tenant e permissões.
arquivos:
  cria: []
  altera: [src/servidor.js]
teste_integracao: Dono mantém acesso atual e funcionário recebe 401, 402 ou 403 conforme sessão, plano e permissão.
teste_funcional: Sessão sem atividade além do limite retorna 401 sem renovar o prazo.
criterio_aceite: Toda requisição protegida possui `req.ator` e `req.empresaId` resolvidos no servidor.
depende_de: [T-02.02]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 747/747; npm run test:integracao 80/80; npm run check 174 arquivos
```

```yaml
id: T-02.04
titulo: Matriz de permissões das rotas atuais
objetivo: Mapear e aplicar permissões a pedidos, PDV, mesas, caixa, catálogo, estoque, clientes, relatórios e configuração.
arquivos:
  cria: [test/permissoes-rotas.test.js]
  altera: [src/servidor.js]
teste_integracao: Cada grupo de rota recusa chamada direta de um perfil sem a permissão correspondente.
teste_funcional: Dono continua autorizado e ações exclusivas de conta recusam qualquer funcionário.
criterio_aceite: Nenhuma rota mutável do painel fica sem autenticação e regra de permissão explícita.
depende_de: [T-02.03]
paralelizavel: false
status: concluida
concluida_em: 2026-09-14
suite: npm run test:ci 750/750; npm run test:integracao 81/81; npm run check 175 arquivos
```

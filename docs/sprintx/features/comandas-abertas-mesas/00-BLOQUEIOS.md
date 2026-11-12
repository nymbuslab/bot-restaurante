---
expx_schema: 1
expx_tool: sprintx
kind: bloqueios
trabalho_id: comandas-abertas-mesas
atualizado_em: 2026-11-12
bloqueios:
  - id: B-01
    task: T-02.01
    aberto_em: 2026-11-12
    resolvido_em: null
    descricao: Sem .env.test apontando para um projeto Supabase descartavel, npm run test:integracao nao executa no ambiente local
  - id: B-02
    task: T-02.02
    aberto_em: 2026-11-12
    resolvido_em: null
    descricao: Depende de T-02.01 e do mesmo .env.test descartavel para rodar a bateria de integracao
  - id: B-03
    task: T-02.03
    aberto_em: 2026-11-12
    resolvido_em: null
    descricao: Depende de T-02.02 e do mesmo .env.test descartavel para rodar a bateria de integracao
---

# Bloqueios

> Criado vazio na F1 e preenchido na execução (F6). Um bloqueio nunca vira pergunta ao usuário: registre aqui, marque a task `bloqueada` e siga para a próxima paralelizável.

B-01 | T-02.01 | O ambiente local não tem `.env.test` apontando para um projeto Supabase separado e descartável (só existem `.env` e `.env.test.example`), e não há Docker para subir um banco local. Por isso `npm run test:integracao` recusa rodar (`ambiente.js` aborta sem `BANCO_DE_TESTE=1` + projeto diferente do `.env`). A lista e o detalhe de comandas foram implementados em `src/pedidos.js` e `src/servidor.js` e cobertos por testes unitários com `db.query` trocado por stub (`test/comandas-pedidos.test.js`); o caso HTTP real de `test/integracao/comandas-abertas.test.js` já está escrito, mas nunca foi executado. | Criar um projeto Supabase separado, copiar `.env.test.example` para `.env.test` com `BANCO_DE_TESTE=1` e as credenciais do projeto novo, e rodar `npm run test:integracao`.

B-02 | T-02.02 | Mesmo bloqueio de ambiente do B-01, agravado pela dependência de T-02.01: o acréscimo por `POST /api/comandas/:id/itens` reusa `acrescentarItensPedido`, já coberto por testes unitários com stub, mas o caso de integração que prova caixa aberto/fechado/vencido contra banco real não executou. | Resolver B-01 e então rodar `npm run test:integracao` com o caso de acréscimo já escrito em `test/integracao/comandas-abertas.test.js`.

B-03 | T-02.03 | Mesmo bloqueio de ambiente do B-01 e dependente de T-02.02: a pré-conta (`POST /api/comandas/:id/imprimir-pre-conta`) tem teste unitário de composição da via, mas o caso de integração que confere a fila de impressão (só `comanda-pre-conta`, sem via de cozinha) não executou. | Resolver B-01 e então rodar `npm run test:integracao` com o caso de pré-conta já escrito em `test/integracao/comandas-abertas.test.js`.

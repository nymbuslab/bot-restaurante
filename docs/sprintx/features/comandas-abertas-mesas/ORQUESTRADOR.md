---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: comandas-abertas-mesas
titulo: Comandas abertas em Mesas e Comandas
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f6
status: bloqueado
criado_em: 2026-11-12
atualizado_em: 2026-11-12
concluido_em: 2026-11-12
sprints: [sprint-01, sprint-02, sprint-03]
caminho_critico: [T-01.01, T-02.01, T-02.02, T-02.03, T-03.01, T-03.02, T-03.03]
modulo_afetado: [pedidos, servidor, public, test, documentacao]
arquivos_alterados: [src/pedidos.js, src/servidor.js, public/admin.html, public/app.js, public/equipe.js, public/style.css, test/fixtures/comandas.js, test/comandas-fixtures.test.js, test/comandas-pedidos.test.js, test/comanda-preconta.test.js, test/comandas-mesas-ui.test.js, test/pdv-comanda-modo.test.js, test/integracao/comandas-abertas.test.js, CLAUDE.md]
palavras_chave: [comanda, pdv, mesas, caixa, permissao, pre-conta, responsivo]
---

# Orquestrador - comandas-abertas-mesas

## 1. Objetivo

Mostrar todas as comandas abertas do PDV na tela Mesas / Comandas, permitir seu acompanhamento e operacao e levar o usuario diretamente ao registro criado. `pedidos` permanece como fonte unica, sem migration.

## 2. Mapa e ordem de leitura

1. `ORQUESTRADOR.md`
2. `00-DECISOES.md`
3. `base/00-INDICE.md` e os arquivos listados nele
4. `sprint-01/sprint.md`, `fases.md`, `tasks.md`
5. `sprint-02/sprint.md`, `fases.md`, `tasks.md`
6. `sprint-03/sprint.md`, `fases.md`, `tasks.md`
7. `00-BLOQUEIOS.md`
8. `00-AUDITORIA.md`

## 3. Rota de execucao

- Sprint 01: F-01.1
- Sprint 02: F-02.1 -> F-02.2
- Sprint 03: F-03.1 -> F-03.2

**Caminho critico:** T-01.01 -> T-02.01 -> T-02.02 -> T-02.03 -> T-03.01 -> T-03.02 -> T-03.03.

## 4. Ferramentas

- **MCPs / SDKs:** Stitch apenas para o prototipo aprovado; nenhuma API externa nova.
- **Testes:** `npm test`, `npm run test:integracao`, `npm run test:ci`
- **Lint:** NAO EXISTE NO PROJETO
- **Typecheck / sintaxe:** `npm run check`
- **Segredos:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ficam em `.env`; os testes de integracao usam `.env.test`. Nunca registrar valores.

## 5. Agentes

- **Implementador:** escreve primeiro os testes da task, observa a falha e implementa ate passar.
- **Revisor de testes:** confirma que o teste falharia com implementacao incorreta.
- **Auditor de aceite:** verifica o criterio de aceite antes de concluir.

**Agente unico:** assume os tres papeis em sequencia dentro de cada task.

## 6. Regras de autonomia

1. Nao perguntar nem pedir nova autorizacao durante a execucao aprovada.
2. Teste antes do codigo.
3. Task so conclui com testes e criterio de aceite verificados.
4. Duvida nova vira bloqueio em `00-BLOQUEIOS.md`; seguir para a proxima task executavel.
5. Executar apenas o paralelismo declarado.
6. Atualizar `tasks.md` a cada transicao.
7. Nao avancar com criterio de saida pendente.

## 7. Definicao de pronto global

- Todas as comandas abertas aparecem, sem filtro de data, mais antigas primeiro.
- Menu, secao, cards e detalhe respeitam permissoes por acao.
- Caixa fechado ou vencido mantem a comanda visivel e bloqueia somente acrescimo e recebimento.
- Pre-conta nao gera via de cozinha.
- Criacao no PDV abre o registro sem repetir o POST em caso de falha de navegacao.
- Recebimento e cancelamento removem o card aberto e preservam o historico.
- Testes, build de sintaxe e validacao visual desktop e mobile passam.

## 8. Como retomar uma sessao interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependencias estejam `concluida`.

## 9. Estado da entrega

**4 de 7 tasks concluidas.** Sprints 01 e 03 fechadas (`concluido`); Sprint 02 `bloqueado`.

| Sprint | Tasks | Estado |
|---|---|---|
| sprint-01 | T-01.01 | concluida |
| sprint-02 | T-02.01, T-02.02, T-02.03 | bloqueadas (B-01, B-02, B-03) |
| sprint-03 | T-03.01, T-03.02, T-03.03 | concluidas |

**Suite:** `npm test` com 806 passed e 0 failed; `npm run check` OK em 205 arquivos.

**Integracao:** `test/integracao/comandas-abertas.test.js` tem 11 casos escritos e nunca executados, porque nao ha `.env.test` de um projeto Supabase descartavel neste ambiente. Os tres endpoints de comanda estao implementados e cobertos por testes unitarios; desbloquear e rodar `npm run test:integracao`.

**Ressalva de UI:** a interface nao foi validada em navegador real (desktop e mobile) nesta sessao. A cobertura executavel e a suite de DOM falso em `test/comandas-mesas-ui.test.js`.

---
expx_schema: 1
expx_tool: runx
kind: orquestrador
trabalho_id: OC-2026-0001
titulo: Caixa fecha com pedido em aberto
tipo_trabalho: ocorrencia
tipo_ocorrencia: bug
estagio: e5
status: concluido
criado_em: 2026-09-12
atualizado_em: 2026-09-12
concluido_em: 2026-09-12
sprints: [sprint-01]
caminho_critico: [T-01.01, T-01.02, T-01.03]
---

# Orquestrador — OC-2026-0001 Caixa fecha com pedido em aberto

## 1. Objetivo

O caixa não pode fechar com pedido a receber, inclusive de dias anteriores. Hoje o fechamento só conta pedidos criados dentro do turno; vou tornar a contagem total (sem recorte de data) apenas no gate de fechamento, deixando o resumo da tela intacto, com teste de regressão invertido e docs atualizados.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-OCORRENCIA.md` — o chamado como chegou
3. `01-CAUSA-RAIZ.md` — causa comprovada (recorte de `criado_em` no `_contarAReceber`) e decisão D-01
4. `base/00-INDICE.md` — e os arquivos da base que ele lista
5. `sprint-01/tasks.md` — plano condensado (1 sprint, 1 fase)
6. `BLOQUEIOS.md` — bloqueios registrados durante a execução
7. `QA.md` — achados MÉDIA/BAIXA que permanecem válidos

## 3. Rota de execução

- Sprint 01: F-01.1 (T-01.01 → T-01.02 → T-01.03) — estritamente sequencial.

**Caminho crítico:** T-01.01 → T-01.02 → T-01.03

## 4. Ferramentas

- **Testes:** `npm test`, `npm run test:ci`, `npm run test:integracao` (requer `.env.test` com Postgres descartável)
- **Lint:** NÃO EXISTE NO PROJETO (só `npm run check`, varredura de sintaxe)
- **Typecheck:** NÃO EXISTE NO PROJETO
- **MCPs / SDKs:** nenhum além do padrão
- **Segredos:** credenciais do Supabase (`.env` local, fora do git) e `.env.test` (env descartável do runner integração). Nunca escrever valor.

## 5. Papéis dentro de cada task

- **Implementador** — escreve o teste primeiro, vê falhar, implementa o mínimo até passar.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Sim — a contagem precisa mudar para o 400 acontecer.
- **Auditor de aceite** — verifica o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência, cada um como portão. Aprovação final no E4 QA.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada.
2. O teste vem antes do código. O teste de regressão `T-01.01` deve falhar ANTES do fix — se passar, pare e volte ao E1.
3. Task só é `concluida` com teste passando, suíte inteira verde e `criterio_aceite` verificado.
4. Escopo travado: só os arquivos de `01-CAUSA-RAIZ.md` e `tasks.md`. Nada de refactor de brinde.
5. Dúvida nova: registrar em `BLOQUEIOS.md` e pular para a próxima paralelizável; nunca parar e esperar.
6. Só rode em paralelo o que o plano declarou. Entre sprints, sequencial.
7. Atualize `status` em `tasks.md` a cada transição; ao concluir, data e resultado da suíte.
8. Critério de saída de fase não atendido = não avança.

## 7. Definição de pronto da ocorrência

- [x] O caixa não fecha (400) com pedido a receber de QUALQUER data, incluindo dias anteriores.
- [x] O teste de regressão falhava antes e passa agora.
- [x] A suíte inteira passa com `npm test`, `npm run check`, `npm run test:ci` e `npm run test:integracao`.
- [x] O resumo da tela não mudou (aviso de antigos ainda exibido).
- [x] Nenhum arquivo fora do escopo declarado foi alterado.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em `sprint-01/tasks.md`.
3. Leia `BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências estão todas `concluida`.
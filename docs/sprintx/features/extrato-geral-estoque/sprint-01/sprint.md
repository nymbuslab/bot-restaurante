---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: extrato-geral-estoque
sprint_id: sprint-01
titulo: Protótipo aprovado
status: concluido
criterio_saida: Protótipo Stitch da aba Relatórios existe e o dono aprovou explicitamente
fases: [F-01.1]
riscos: []
atualizado_em: 2026-09-16
---

# Sprint 01 — Protótipo aprovado

## Objetivo

Entregar o pré-requisito não-negociável antes de qualquer código de UI: um protótipo (Google
Stitch) da aba "Relatórios" nova, aprovado explicitamente pelo dono. Esta feature tem tela
nova (D-02), e a regra global do projeto proíbe escrever código de interface antes desse
portão — mesmo durante execução autônoma (nota em `00-DECISOES.md`).

Esta sprint não segue o padrão usual de "capacidade de testar" (config/client/harness) porque
nenhuma capacidade de teste NOVA é necessária: o backend (Sprint 02) e o front-end (Sprint 03)
reaproveitam integralmente convenções de teste já validadas no projeto (mock de `db.query` como
em `test/estoque-db.test.js`; front dual-mode como em `public/busca.js`/`public/paginacao-pedidos.js`).
O pré-requisito real desta feature é o protótipo, não infraestrutura de teste.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Protótipo e aprovação | F-02.1 |

Detalhe da fase em `fases.md`; task em `tasks.md`.

## Critério de saída

Protótipo Stitch gerado, semeado com os tokens reais de `public/style.css`, e aprovação
explícita do dono registrada em prosa na task — sem isso, nenhuma task de UI (Sprint 03) pode
começar.

## Riscos conhecidos

- O protótipo pode revelar que a navegação proposta (D-02: aba "Relatórios" nova) não agrada
  visualmente o dono mesmo já aprovada em decisão de produto — se isso acontecer, volta para
  F2/F3 antes de prosseguir (não é reversão silenciosa de decisão).

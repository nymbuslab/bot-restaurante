---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-02
titulo: API interna de comandas abertas
status: bloqueado
criterio_saida: Endpoints dedicados listam detalham acrescentam e imprimem comandas com gates corretos
fases: [F-02.1, F-02.2]
riscos: [Reuso das rotas gerais pode vazar permissoes mais amplas que o contrato de comanda]
atualizado_em: 2026-11-12
---

# Sprint 02 - API interna de comandas abertas

## Objetivo

Expor comandas abertas por endpoints dedicados mantendo `pedidos` como fonte unica e reutilizando caixa, estoque e impressao existentes.

## Fases

| Fase | Titulo | Roda em paralelo com |
|---|---|---|
| F-02.1 | Consulta operacional | nenhuma |
| F-02.2 | Acoes da comanda | nenhuma |

## Criterio de saida

Endpoints dedicados listam, detalham, acrescentam e imprimem comandas com gates corretos.

## Riscos conhecidos

- Reuso das rotas gerais pode vazar permissoes mais amplas que o contrato de comanda.

## Estado da execucao

`bloqueado`: os tres endpoints foram implementados e cobertos por testes unitarios, mas as tres tasks ficaram `bloqueada` porque `npm run test:integracao` nao executa neste ambiente (falta `.env.test` de um projeto Supabase descartavel). Ver `00-BLOQUEIOS.md` (B-01, B-02, B-03). O arquivo `test/integracao/comandas-abertas.test.js` esta escrito: desbloquear e so rodar a bateria.

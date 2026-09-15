# Sprint 03 — Experiência e homologação de equipe

## Objetivo

Entregar as telas aprovadas de Equipe, troca por PIN, dispositivos e Atividades, com rollout separado.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-03.1 | Protótipo e acessibilidade | nenhuma |
| F-03.2 | Interface e homologação | nenhuma |

Detalhe em `fases.md`; tasks em `tasks.md`.

## Critério de saída

O ciclo de equipe passa em desktop e mobile no tenant de teste, com gate desligável.

## Resultado verificado — 2026-09-15

3/3 tasks concluídas. Playwright validou cadastro, dispositivo, PIN e revogação
com rotas e banco reais em desktop/mobile, além de Atividades, detalhes/Escape,
paginação, vazio e erro/retry. Integração comprovou flag desligada, tenant separado,
autoria sem segredos e rollback da edição quando a auditoria falha.
CI 754/754, integração 92/92, sintaxe 183 arquivos. Produção não foi alterada;
backup P0-B, revisão de retenção/base legal e piloto permanecem pré-requisitos.

## Riscos conhecidos

- UI nova exige aprovação visual antes do código (`00-DECISOES.md`).

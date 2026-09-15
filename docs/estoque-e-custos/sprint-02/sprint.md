# Sprint 02 — Equipe e autorização

## Objetivo

Entregar persistência, autenticação por PIN, dispositivos e autorização server-side, ainda com interface protegida por gate.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Schema e serviços de identidade | nenhuma |
| F-02.2 | Middleware e cobertura das rotas | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

Todas as rotas autenticadas resolvem um principal e recusam permissões ausentes sem alterar o acesso atual do dono.

## Riscos conhecidos

- O sistema atual possui somente um `user_id` por empresa (`base/05-AUTH-PLANOS-E-PERMISSOES.md`).

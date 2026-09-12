---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-02
titulo: Rotas e UI - abas e checkboxes de tipo de relatorio
status: nao_iniciado
criterio_saida: Operador ve as duas abas (Assinatura / Relatorios Telegram) no modal Gerenciar, marca/desmarca os tres tipos de relatorio e a margem, e isso e persistido de verdade
fases: [F-02.1, F-02.2, F-02.3, F-02.4]
riscos: [T-02.03 e portao de design obrigatorio - execucao autonoma para ali e espera aprovacao explicita, mesma excecao documentada na feature relatorios-telegram]
atualizado_em: 2026-09-07
---

# Sprint 02 — Rotas e UI: abas e checkboxes de tipo de relatório

## Objetivo

Expor e gravar as preferências de tipo de relatório (`config.telegram.tipos`, D-01/D-03/D-06/D-07)
via API, e reestruturar o modal "Gerenciar" do admin-master em duas abas — Assinatura (o que já
existe) e Relatórios Telegram (vínculo + checkboxes de tipo + margem de cancelamento) — conforme
D-02.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Rota GET estendida (status por tipo) | nenhuma |
| F-02.2 | Rota de salvar tipos/margem | F-02.3 |
| F-02.3 | Protótipo visual (portão obrigatório) | F-02.2 |
| F-02.4 | Implementar abas e checkboxes | nenhuma |

## Critério de saída

Com o protótipo aprovado, o operador consegue marcar/desmarcar cada tipo de relatório e definir
a margem de cancelamento na aba Relatórios Telegram, e o `GET` seguinte reflete exatamente o que
foi salvo.

## Riscos conhecidos

- T-02.03 é o portão de design do `CLAUDE.md` global do usuário: a execução autônoma para ali e
  espera aprovação explícita antes de qualquer código de interface (T-02.04/T-02.05) — mesma
  exceção já documentada e usada na feature `relatorios-telegram`.

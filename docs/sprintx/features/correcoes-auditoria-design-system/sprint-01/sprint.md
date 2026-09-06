---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: correcoes-auditoria-design-system
sprint_id: sprint-01
titulo: Harness de teste estatico de arquivo
status: concluida
criterio_saida: node --test test/arquivo-estatico.test.js termina com 0 failed
fases: [F-01.1]
riscos: []
atualizado_em: 2026-09-05
---

# Sprint 01 — Harness de teste estático de arquivo

## Objetivo

Criar a capacidade de testar as 12 correções da sprint-02: dois helpers reutilizáveis em
`test/apoio/arquivo-estatico.js` — `contemTrecho`, que confirma por leitura direta do
arquivo-fonte (`fs.readFileSync`) se um trecho de texto está presente (a forma de teste
escolhida na F2, decisão D-01, para mudanças de HTML/CSS/atributo sem lógica pura isolável em
`public/app.js`), e `trechoEntre`, que isola um trecho do arquivo por dois marcadores — usado
pelas tasks que precisam escopar a busca ao corpo de uma função ou a um elemento específico, sem
colidir com texto igual em outro lugar do arquivo (ajuste feito na reauditoria da F5). Segue o
mesmo padrão de `test/apoio/pdv-modal-harness.js`, já usado no projeto para harness de teste de
front-end.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Harness de teste estático | nenhuma |

Detalhe da fase em `fases.md`; task em `tasks.md`.

## Critério de saída

`node --test test/arquivo-estatico.test.js` termina com 0 failed, e `test/apoio/arquivo-estatico.js`
exporta uma função reutilizável pelas tasks da sprint-02.

## Riscos conhecidos

- Nenhum risco registrado.

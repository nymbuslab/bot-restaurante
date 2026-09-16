# Retenção e auditoria

## Contrato de entrada

- Jobs de higiene são iniciados no boot e repetidos a cada vinte e quatro horas. Fonte:
  `../../../index.js:43-130`.
- Pedidos antigos são anonimizados sem apagar o registro financeiro ou operacional. Fonte:
  `../../../src/pedidos.js:222-249`.

## Contrato de saída

- Dados pessoais de pedidos são anonimizados após doze meses. Fonte: `../../../index.js:45-57`.
- Auditoria é removida após vinte e quatro meses. Fontes: `../../../index.js:75-86` e
  `../../../src/auditoria.js:7-18`.
- Movimentos de estoque são apagados após doze meses, porque atualmente não são a fonte do saldo.
  Fontes: `../../../index.js:117-130` e `../../../src/estoque-db.js:118-130`.

## Limites e cotas

- Retenção nova aprovada para compras, custos, movimentos vinculados e documentos: cinco anos.
  Fonte: `../02-DECISOES-PENDENTES.md:624-657`.
- Tamanho máximo de XML, anexos e armazenamento por empresa: **NÃO DOCUMENTADO**.

## Erros conhecidos e tratamento

- Jobs de retenção são best-effort: registram erro e não derrubam o processo. Fonte:
  `../../../index.js:45-130`.
- Backup do banco não restaura objetos do Storage; a cópia separada exigida pelo P0-B (resolvido em
  2026-09-16) existe em `scripts/backup.js`. Fonte: `../00-AUDITORIA-BASELINE.md:84-91`.

## Riscos

- O job atual apagaria trilha necessária a compras e custos se os novos movimentos forem incluídos
  sem uma exceção ou política nova.
- Cinco anos de retenção exigem índices e paginação que não dependam de carregar todo o histórico.
- Não há backup restaurável comprovado; migrations continuam bloqueadas.

## Fonte

- `../../../index.js:43-130`
- `../../../src/pedidos.js:222-249`
- `../../../src/auditoria.js:1-34`
- `../../../src/estoque-db.js:118-130`
- `../00-AUDITORIA-BASELINE.md:84-100`

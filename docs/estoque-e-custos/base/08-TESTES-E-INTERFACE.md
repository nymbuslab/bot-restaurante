# Testes e interface atual

## Contrato de entrada

- A suíte rápida roda arquivos `test/*.test.js`; a integração possui comando separado e ambiente
  descartável. Fonte: `../../../package.json:6-18`.
- O editor de produto atual possui abas e campos de custo manual, preço, unidade, saldo, mínimo,
  cozinha, grupos e variações. Fonte: `../../../public/app.js:2496-2679`.
- A tela de estoque oferece busca, filtros, gaveta, entrada, perda, contagem, mínimo e extrato. Fonte:
  `../../../public/app.js:718-820` e `../../../public/app.js:902-1055`.

## Contrato de saída

- O baseline auditado aprovou setecentos e vinte e três testes rápidos e sessenta e sete testes de
  integração após o P0-A. Fonte: `../00-AUDITORIA-BASELINE.md:52-71`.
- O motor inerte de Insumos possui testes de normalização, conversão, agregação, itens por peso,
  opções e IDs órfãos. Fonte: `../../../test/insumos.test.js:1-170`.

## Limites e cotas

- Os testes de integração só podem usar projeto descartável; o guard do banco rejeita ambiente real
  durante `node --test`. Fonte: `../../../src/db.js:1-45`.
- Cobertura automatizada de Compras, fornecedores, custo médio e ficha operacional: **NÃO EXISTE**.

## Erros conhecidos e tratamento

- O frontend trata `403` de Estoque como bloqueio de plano e oferece estados de erro e vazio. Fonte:
  `../../../public/app.js:739-807`.
- A gaveta devolve foco, fecha por Escape e antecipa o resultado do lançamento. Fonte:
  `../../../public/app.js:902-965` e `../../../public/app.js:1039-1055`.

## Riscos

- O protótipo novo deve preservar padrões existentes de gaveta, foco, teclado, estados e navegação,
  sem ativar o motor inerte por acidente.
- Casos financeiros precisam de matriz numérica focada, suíte geral e integração transacional antes
  da conclusão.
- Testes devem provar ausência de baixa dupla e isolamento entre empresas, inclusive em corrida e
  retry.

## Fonte

- `../../../package.json:6-18`
- `../../../public/app.js:718-820`
- `../../../public/app.js:902-1055`
- `../../../public/app.js:2496-2690`
- `../../../test/insumos.test.js:1-170`
- `../../../test/integracao/isolamento.test.js:1-120`

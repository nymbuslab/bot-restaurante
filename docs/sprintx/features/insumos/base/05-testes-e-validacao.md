# Testes e validação de Insumos

## Contrato de entrada

A suíte rápida usa `node:test`. `test/insumos.test.js` importa o módulo dual-mode e cobre chaves de movimento, normalização, conversão, formatação e cálculo agregado. Testes estáticos existentes usam helpers como `trechoEntre` e `contemTrecho` para isolar contratos de HTML, CSS e JavaScript (`test/paginacao-pedidos-app.test.js`).

A integração cria empresa descartável, libera o plano pelo mesmo caminho do produto, autentica, prepara cardápio/configuração e apaga tudo ao final (`test/integracao/ajuda/tenant.js`).

## Contrato de saída

Os testes rápidos falham por asserção e o runner de integração propaga o status do processo Node (`scripts/test-integracao.js`). O helper de tenant registra falhas de limpeza no stderr sem esconder o resíduo (`test/integracao/ajuda/tenant.js`).

## Limites e cotas

- `npm test` executa `test/*.test.js` (`package.json:12`).
- `npm run check` executa a checagem de sintaxe (`package.json:13`).
- `npm run test:ci` reproduz a suíte sem segredos (`package.json:17`).
- `npm run test:integracao` usa o banco descartável configurado para integração (`package.json:18`; `scripts/test-integracao.js`).
- O runner de integração limita a concorrência a 3 arquivos para respeitar o pool do banco (`scripts/test-integracao.js:100-103`).

## Erros conhecidos e tratamento

O runner se recusa a executar localmente sem `.env.test` e remove credenciais potencialmente herdadas antes de aplicar o ambiente de teste (`scripts/test-integracao.js:31-75`). O helper exige ids numéricos de produto por causa da projeção relacional em `itens_venda` (`test/integracao/ajuda/tenant.js:51-61`).

## Riscos para a nossa implementação

Testes apenas textuais podem provar que seletores existem sem provar a interação. Testes apenas puros não alcançam restrição única, isolamento por empresa nem resposta HTTP. A Fase 3 precisa combinar teste funcional do módulo/DOM com integração real de CRUD e gate de plano antes de avançar.

## Fonte

`test/insumos.test.js`, `test/paginacao-pedidos-app.test.js`, `test/integracao/ajuda/tenant.js`, `scripts/test-integracao.js` e `package.json` — acessados em 2026-09-13

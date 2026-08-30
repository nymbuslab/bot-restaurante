# Fila de impressao

## Contrato de entrada

`impressaoFila.enfileirar(dir, tipo, vias, client)` recebe o tenant, um tipo de ate 40 caracteres e um array de strings. Fonte: `src/impressao-fila.js` - acessado em 2026-08-29.

## Contrato de saida

Retorna o `id` da fila ou `null` quando todas as vias vierem vazias. A rota do agente retorna `id`, `tipo`, `vias` e `criadoEm`. Fonte: `src/impressao-fila.js`, `src/servidor.js` - acessado em 2026-08-29.

## Limites e cotas

Polling do agente busca ate 50 trabalhos por vez; reserva expira em 30 segundos. Fonte: `src/impressao-fila.js` - acessado em 2026-08-29.

## Erros conhecidos e tratamento

Falhas de enfileiramento de PDV, mesas e fechamento sao tratadas no servidor com `console.error` sem desfazer a acao principal. Fonte: `src/servidor.js` - acessado em 2026-08-29.

## Riscos para a nossa implementacao

Criar regra no agente duplicaria logica de negocio. O servidor deve renderizar o texto e enfileirar apenas quando a configuracao permitir.

## Fonte

`src/impressao-fila.js`, `src/servidor.js` - acessado em 2026-08-29.

# Configuracoes

## Contrato de entrada

`PUT /api/config` recebe o objeto de configuracao inteiro. `validarConfig` valida objeto simples e tamanho maximo. Fonte: `src/servidor.js`, `src/validacao.js` - acessado em 2026-08-29.

## Contrato de saida

`GET /api/config` devolve a configuracao salva, com formas de pagamento normalizadas. `PUT /api/config` devolve `{ ok: true, avisoFrete }`. Fonte: `src/servidor.js` - acessado em 2026-08-29.

## Limites e cotas

`config` tem limite de 256 KB. Fonte: `src/validacao.js` - acessado em 2026-08-29.

## Erros conhecidos e tratamento

O servidor normaliza frete, pagamentos, mensagens e URLs de imagem antes de salvar. Fonte: `src/servidor.js` - acessado em 2026-08-29.

## Riscos para a nossa implementacao

`config.impressao` ja existe como namespace historico, mas a configuracao fisica da impressora pertence ao app agente. A nova configuracao deve ficar em `config.impressao.caixa`, sem reintroduzir porta, corte ou serial no painel.

## Fonte

`src/servidor.js`, `src/validacao.js`, `public/admin.html`, `public/app.js` - acessado em 2026-08-29.

# Backend e persistência de Mesas

## Contrato de entrada

`GET /api/mesas` exige autenticação, permissão `mesas.operar` e Plano Completo. As ações usam `mesa.id`: abrir, lançar pedido, solicitar/fechar conta, imprimir, receber parcial, pagar, cancelar item/mesa e transferir (`src/servidor.js:3384-3760`).

## Contrato de saída

A listagem devolve `{ mesas, taxaServico, alertaParadaMin }`. Cada mesa traz id, nome, status, taxa, pessoas, total consumido, datas e último pedido da sessão. O detalhe agrega os pedidos vinculados por `mesa_id`, resumo, total recebido, falta e valor por pessoa (`src/servidor.js:3360-3406`; `src/mesas-db.js:56-111`).

## Limites e cotas

- Configuração cria até 50 mesas por chamada e limita cada nome a 20 caracteres (`src/mesas-db.js:113-134`).
- Pessoas são normalizadas entre 1 e 99 (`src/mesas-db.js:145-165`).
- Alerta de mesa parada é normalizado entre 0 e 600 minutos (`src/servidor.js:3420`).

## Erros conhecidos e tratamento

Mesa livre não aceita lançamento; mesa em fechamento precisa ser reaberta; caixa vencido bloqueia abertura e novos itens; pagamento parcial impede cancelamentos que deixariam divergência. As operações críticas travam linhas e usam transação (`src/servidor.js:3470-3528`; `src/mesas-db.js:378-455`).

## Riscos para a nossa implementação

Mesa tem uma sessão delimitada por `aberta_em`, taxa, pessoas e movimentos de caixa ligados por `mesa_id`. A Comanda avulsa não possui esses dados. Converter automaticamente um pedido existente em mesa mudaria regras financeiras e de sessão, além de exigir uma entidade artificial.

## Fonte

`src/servidor.js:3360-3760`, `src/mesas-db.js:1-260`, `supabase/migrations/20260628130000_mesas.sql`, `supabase/migrations/20260701120000_mesas_pessoas.sql` — acessado em 2026-11-11

# Config por empresa (`empresas.config` jsonb) — padrão de armazenamento

## Contrato de entrada

Schema: `supabase/migrations/20260612115133_init_schema.sql:18` — `config jsonb not null default '{}'::jsonb`. Documentado também em `docs/modelo-dados.md:152-165` (campos da tabela `empresas`: `id, user_id, slug, nome, email, ativo, plano, config, cardapio, criado_em, ...`).

Acesso via `src/store.js` (cache em memória por `tenantDir`/slug + persistência no Postgres):
- `ensure(dir)` — carrega `config`/`cardapio` do banco pro cache (`src/store.js:25-34`)
- `getConfig(dir)` — leitura síncrona do cache (`src/store.js:36-40`)
- `setConfig(dir, dados)` — `UPDATE empresas SET config = $1 WHERE slug = $2` + atualiza cache (`src/store.js:48-54`)

Rota self-service do dono (única rota de leitura/gravação de `config` existente hoje):
- `GET /api/config` — `src/servidor.js:1707-1719`
- `PUT /api/config` — `src/servidor.js:1771-1809` (valida com `validarConfig`, normaliza com `normalizarConfigServidor`)

## Contrato de saída

Chaves reais já guardadas dentro de `config` hoje (exemplos verificados):

| Chave | Onde | Conteúdo |
|---|---|---|
| `config.restaurante` | `src/servidor.js:1763-1767`, `public/app.js:3512-3529` | nome, telefone, endereço estruturado, capa, logo, horário |
| `config.atendimento.taxaEntrega` | `src/servidor.js:1731-1733` | frete fixo (R$) |
| `config.frete.raio.faixas` / `coordEmpresa` / `enderecoBase` | `src/servidor.js:1734-1737,1783-1802`; `docs/modelo-dados.md:172-174` | faixas km→valor + cache geocodificação Geoapify |
| `config.frete.bairro.faixas` | `src/servidor.js:1739-1743` | lista bairro→valor |
| `config.pagamentos` | `src/servidor.js:1711-1715,1730` | array de formas de pagamento ligadas |
| `config.mensagens.*` | `src/servidor.js:1744-1748` | textos do bot (limite 4096 chars) |
| `config.impressao.caixa.{suprimento,sangria,cancelamento}` | `src/servidor.js:1749-1762`; `docs/modelo-dados.md:376` | toggles de comprovante avulso |

## Limites e cotas

`config.mensagens.*` tem limite de 4096 caracteres por campo (`src/servidor.js:1744-1748`) — não confirmado se é regra geral do `validarConfig` ou específica desse campo. Demais chaves sem limite documentado.

## Erros conhecidos e tratamento

NÃO DOCUMENTADO nesta ingestão (não foi lido `validarConfig`/`normalizarConfigServidor` linha a linha).

## Riscos para a nossa implementação

- **Não há precedente de segredo/token por tenant guardado em `config` jsonb.** Verificado especificamente: Geoapify usa chave única da PLATAFORMA em env (`src/frete.js:14` — `GEOAPIFY_API_KEY`), sem chave por tenant; Stripe guarda `stripe_customer_id`/`stripe_subscription_id` em COLUNAS dedicadas da tabela `empresas` (`src/empresas.js:255-256,264-270,298-299`), não em `config`. Se o Telegram usar um único bot da plataforma, só o `chat_id` (não-secreto) fica em `config.telegram.chatId`, análogo a `config.atendimento.taxaEntrega` — encaixa no padrão existente. Se cada tenant precisasse de token de bot PRÓPRIO, seria o primeiro caso desse tipo no projeto (decisão a levar pra F2).
- Nenhuma migração de coluna é necessária para guardar `config.telegram.*` — é jsonb livre, mesmo padrão de `config.impressao`.
- Se o campo for editado pelo admin-master (operador, fora do dono), a rota nova (ver `admin-master-cadastro-tenant.md`) precisa usar `store.ensure(tenantDir)` antes de `getConfig`/`setConfig`, pois o cache em memória é por processo — só populado quando algo já tocou aquele tenant.

## Fonte

`supabase/migrations/20260612115133_init_schema.sql:18`, `docs/modelo-dados.md:152-165,172-174,376`, `src/store.js:25-54`, `src/servidor.js:1707-1809`, `src/frete.js:14`, `src/empresas.js:255-256,264-270,298-299` — acessado em 2026-09-06

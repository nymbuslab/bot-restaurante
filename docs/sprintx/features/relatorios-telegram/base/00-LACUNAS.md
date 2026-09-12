# Lacunas

1. **Rate limit / erro `retry_after` do `sendMessage`** — procurado em https://core.telegram.org/bots/api#sendmessage e https://core.telegram.org/bots/faq; a doc confirma que existe rate limit (1 msg/s por chat) e o campo genérico `ResponseParameters`, mas não expõe o texto literal do formato de `retry_after` na consulta feita. (`telegram-bot-api.md`)
2. **Erros nomeados do Telegram** ("chat not found", "bot was blocked by the user") — não confirmados literalmente na página consultada da API oficial; são erros conhecidos do ecossistema mas não citados com o texto exato nesta ingestão. (`telegram-bot-api.md`)
3. **Limite de payload/timeout do `sendMessage`** — não documentado na página consultada. (`telegram-bot-api.md`)
4. **JS de troca de aba do admin-master** (`data-aba` → `.ativa`) — não localizado linha a linha em `app-admin.js` nesta ingestão; só a convenção HTML foi confirmada. (`admin-master-cadastro-tenant.md`)
5. **Rota `GET/PUT /api/admin/plataforma`** — citada em `docs/super-admin.md:83`, mas não lida linha a linha no código nesta ingestão (só usada como referência de padrão de UI "formulário + salvar" no admin-master). (`admin-master-cadastro-tenant.md`)
6. **Decisão de produto: config exclusiva do admin-master ou também editável pelo dono** — não é lacuna de código, é pergunta em aberto para a F2 (registrada aqui porque nasceu da leitura da área). (`admin-master-cadastro-tenant.md`)
7. **`validarConfig`/`normalizarConfigServidor`** — não lidos linha a linha; não se sabe se há validação genérica de tamanho de string aplicável a uma futura `config.telegram.*`. (`config-empresa-jsonb.md`)
8. **Limites do provedor Resend** — fora do escopo desta ingestão (citado só como referência de padrão de canal, não como parte da feature). (`canal-notificacao-email.md`)
9. **Concorrência entre jobs em `index.js`** — não documentado se há algum limite/lock entre os jobs existentes. (`jobs-agendados.md`)
10. **Erros de `caixa.js`/`dashboard-calc.js`/`GET /api/estoque`** — tratamento de erro dessas rotas/funções não foi lido linha a linha nesta ingestão. (`fontes-dados-relatorio.md`)

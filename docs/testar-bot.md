# Testando o bot

> **Como testar:**
> - **Unitário (lógica pura):** `npm test` — runner nativo `node:test` (sem dependência), cobre
>   `test/` (validação de payload, magic bytes do upload, sessão/segurança, geração de slug,
>   planos, frete, estoque e pagamentos). Usa **env dummy** → roda sem segredos, inclusive no CI
>   (`.github/workflows/test.yml`). `npm run check` faz a varredura de sintaxe.
> - **Na condição do CI:** `npm run test:ci` roda a suíte de uma pasta vazia, para o `dotenv`
>   não repor o `.env` local — é o que o runner do GitHub vê. O `npm test` sozinho **engana**:
>   com o `.env` presente, um teste que precise de credencial passa aqui e quebra lá. O hook de
>   `pre-push` (`.githooks/`, ligado com `git config core.hooksPath .githooks`) roda isso antes
>   de deixar subir. Detalhe no [README](../README.md#-testes-e-ci).
> - **Contra banco de verdade:** `npm run test:integracao` sobe o servidor numa porta livre e
>   faz requisição HTTP real contra um Postgres separado (`.env.test`, modelo em
>   `.env.test.example`). É a única bateria que grava em banco, e ela **aborta** se o destino
>   for o mesmo projeto do `.env`. Precisa de um projeto Supabase descartável e Stripe test-mode
>   configurados. Ela cobre isolamento, recálculo do cardápio web, Caixa, PDV, Mesas, simulador
>   do bot e assinatura Stripe com webhook assinado.
>   No GitHub Actions ela roda na `main` e manualmente via `workflow_dispatch`, usando os secrets
>   `INTEGRACAO_DATABASE_URL`, `INTEGRACAO_SUPABASE_URL`, `INTEGRACAO_SUPABASE_ANON_KEY`,
>   `INTEGRACAO_SUPABASE_SERVICE_ROLE_KEY` e os cinco `INTEGRACAO_STRIPE_*`.
> - **Integração/fluxo do bot:** o **simulador** abaixo (`testar-bot.js` ou a aba Simulador).

O arquivo `testar-bot.js` na raiz simula uma conversa completa no terminal,
sem precisar de WhatsApp, QR ou celular. Usa os dados do primeiro tenant.

```bash
node testar-bot.js
```

**Comandos especiais dentro do simulador:**

| Comando   | O que faz                                      |
|-----------|------------------------------------------------|
| `/reset`  | Reinicia a sessão (simula um novo cliente)     |
| `/status` | Exibe o estado interno da sessão em JSON       |
| `/quit`   | Encerra o simulador                            |

**Fluxo de pedido completo para testar:**

```
oi          → menu
1           → categorias
1           → itens da 1ª categoria
<id>        → escolhe item (ex: 10)
0           → sem opcionais (se houver)
0           → sem observação
1           → quantidade 1
2           → finalizar pedido
2           → não quero bebida (se aparecer)
João        → nome
1           → entrega
Rua X, 10  → endereço
1           → forma de pagamento
1           → confirmar
```

O pedido confirmado é gravado na tabela `pedidos` (Postgres/Supabase) e aparece
no painel na aba **Pedidos**.

Também há um **simulador no painel** (aba Simulador) que ignora o horário de
funcionamento — ver [horário em features.md](features.md).

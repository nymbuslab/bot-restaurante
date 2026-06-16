# Testando o bot

> **Dois níveis de teste:**
> - **Unitário (lógica pura):** `npm test` — runner nativo `node:test` (sem dependência), cobre
>   `test/` (validação de payload, magic bytes do upload, hash master bcrypt + migração do SHA-256
>   legado, geração de slug). Usa **env dummy** → roda sem segredos, inclusive no CI
>   (`.github/workflows/test.yml`). `npm run check` faz a varredura de sintaxe.
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

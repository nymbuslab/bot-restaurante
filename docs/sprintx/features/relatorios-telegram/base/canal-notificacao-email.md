# Padrão de canal de notificação existente — `src/email.js`

## Contrato de entrada

`enviar({to, subject, html})` (`src/email.js:19-37`) — parâmetros: destinatário, assunto, corpo HTML. Chamado internamente pelas 6 funções de disparo exportadas (`src/email.js:111-114`): `boasVindas`, `resetSenha`, `assinaturaConfirmada`, `avisoSeguranca`, `cancelamento`, `contaExcluida`.

Provedor: Resend, via `fetch` HTTP direto — sem SDK (`src/email.js:22-26`).

## Contrato de saída

`enviar()` **nunca lança exceção** — sempre resolve `{ ok: boolean, motivo?: string }` (`src/email.js:19-37`), seguro para uso fire-and-forget.

## Limites e cotas

NÃO DOCUMENTADO nesta ingestão (limites do provedor Resend não foram consultados — fora do escopo desta feature).

## Erros conhecidos e tratamento

**Fallback no-op quando não configurado:** `CONFIGURADO = Boolean(RESEND_API_KEY)` (`src/email.js:12`). Se `false`: loga warning no boot (`src/email.js:14-16`) e `enviar()` retorna `{ ok: false, motivo: "nao_configurado" }` sem lançar (`src/email.js:19-20`).

**Chamada no restante do sistema — sempre fire-and-forget com `.catch`:**

| Evento | Chamada | Local |
|---|---|---|
| Cadastro de novo restaurante | `mail.boasVindas(email, empresa.nome).catch(...)` | `src/servidor.js:330` |
| Assinatura confirmada | `mail.assinaturaConfirmada(emp.email, emp.nome, planoNome).catch(...)` | `src/servidor.js:633` |
| Esqueci senha | `await mail.resetSenha(email_, link).catch(...)` | `src/servidor.js:795` |
| Master troca e-mail/senha | `mail.avisoSeguranca(novoEmail \|\| alvo, oQue).catch(...)` | `src/servidor.js:1427` |
| Dono troca senha/e-mail | `mail.avisoSeguranca(...).catch(...)` | `src/servidor.js:1831,1843` |
| Conta excluída | `mail.contaExcluida(contato.email, contato.nome).catch(...)` | `src/servidor.js:1912` |
| Assinatura cancelada (webhook Stripe) | `mail.cancelamento(emp.email, emp.nome).catch(...)` | `src/stripe.js:377` |

Todas as chamadas são disparadas sem `await` (exceto reset de senha) e sempre com `.catch((e) => console.error(...))` — nunca derrubam a rota que disparou o e-mail.

## Riscos para a nossa implementação

- Este é o modelo a copiar 1:1 para um módulo `src/telegram.js`: `CONFIGURADO = Boolean(TELEGRAM_BOT_TOKEN)`, função `enviar(chatId, texto)` que nunca lança e retorna `{ ok, motivo? }`, chamadas fire-and-forget com `.catch` nos pontos de disparo.
- Diferença relevante: e-mail é 1:N genérico (qualquer destinatário), Telegram aqui é 1:1 por tenant (um `chat_id` por empresa) — a função de envio precisa do `chat_id` da empresa, não de um e-mail fixo; isso já está coberto por `config.telegram.chatId` (ver `config-empresa-jsonb.md`).
- Templates de e-mail usam HTML (`layout()`, `botao()`, `esc()` — `src/email.js:40-62`); Telegram usa `parse_mode` (`MarkdownV2`/`HTML`/`Markdown`, ver `telegram-bot-api.md`) — o formatador de texto do relatório precisa ser novo, não reaproveitável do e-mail nem do `relatorio-caixa.js` (que é formatação para papel térmico 48 colunas).

## Fonte

`src/email.js:1-115`, `src/servidor.js:26,330,633,795,1427,1831,1843,1912`, `src/stripe.js:18,377` — acessado em 2026-09-06

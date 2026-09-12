# Telegram Bot API — envio de mensagens (sendMessage) e obtenção de chat_id

## Contrato de entrada

**Autenticação:** cada bot recebe um token único no formato `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`. Toda chamada é uma URL HTTPS: `https://api.telegram.org/bot<token>/METODO`. Métodos aceitos: GET e POST; parâmetros via query string, `application/x-www-form-urlencoded` ou `application/json` (upload de arquivo exige `multipart/form-data`, não aplicável aqui). — Fonte: https://core.telegram.org/bots/api

**`sendMessage`** — parâmetros:

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `chat_id` | Integer ou String | Sim | Identificador do chat de destino |
| `text` | String | Sim | "Text of the message to be sent, 1-4096 characters after entities parsing" |
| `parse_mode` | String | Não | `MarkdownV2`, `HTML` ou `Markdown` |
| `link_preview_options` | LinkPreviewOptions | Não | Controla preview de link |
| `reply_markup` | InlineKeyboardMarkup/ReplyKeyboardMarkup | Não | Teclado/botões (não aplicável ao caso de uso de relatório) |

— Fonte: https://core.telegram.org/bots/api#sendmessage

**Obtenção do `chat_id` do dono do restaurante** — duas formas documentadas, mutuamente exclusivas ("You will not be able to receive updates using getUpdates for as long as an outgoing webhook is set up."):

- **`getUpdates` (polling):** "Use this method to receive incoming updates using long polling. Returns an Array of Update objects." Parâmetros relevantes: `offset` (Integer, opcional — id do primeiro update a devolver), `limit` (1-100, opcional), `timeout` (segundos de long polling, default 0 = short polling).
- **`setWebhook`:** "Use this method to specify a URL and receive incoming updates via an outgoing webhook. Whenever there is an update for the bot, we will send an HTTPS POST request to the specified URL, containing a JSON-serialized Update." Exige `url` (HTTPS). Portas suportadas para webhook: 443, 80, 88, 8443.

Em ambos os casos, o `Update` recebido traz `message.chat.id` (Integer) quando o usuário manda qualquer mensagem ao bot (ex.: `/start`). — Fonte: https://core.telegram.org/bots/api (seções Update/Message/Chat, getUpdates, setWebhook)

## Contrato de saída

Toda resposta é um JSON com `ok: Boolean`; se `true`, o resultado vem em `result`. — Fonte: https://core.telegram.org/bots/api

## Limites e cotas

- Texto do `sendMessage`: 1 a 4096 caracteres após o parsing de entidades. — Fonte: https://core.telegram.org/bots/api#sendmessage
- Rate limit por chat individual: "In a single chat, avoid sending more than one message per second." — Fonte: https://core.telegram.org/bots/faq
- Rate limit em grupo: "In a group, bots are not be able to send more than 20 messages per minute." (não aplicável ao caso de uso — cada empresa recebe no seu chat privado, não em grupo)
- Rate limit de broadcast: "bots are not able to broadcast more than about 30 messages per second, unless they enable paid broadcasts." Recomendação da doc para envio em massa: espalhar por 8-12h em vez de mandar tudo de uma vez. — Fonte: https://core.telegram.org/bots/faq
- Limite de payload/timeout do `sendMessage` em si: NÃO DOCUMENTADO no trecho consultado.

## Erros conhecidos e tratamento

- Resposta de erro: `ok: false` + `description` (texto) + `error_code` (Integer, "subject to change in the future") — genérico, sem lista fechada de códigos na página consultada.
- Campo opcional `parameters` (`ResponseParameters`) "can help to automatically handle the error" — inclui tipicamente `retry_after` em erro de limite de taxa (429), mas o texto exato desse campo NÃO foi capturado na consulta feita; tratar como NÃO DOCUMENTADO nesta base e validar no momento da implementação (a chamada real devolve o campo).
- Casos de negócio esperados mas NÃO DOCUMENTADOS explicitamente na consulta feita: "chat not found" (chat_id inválido/usuário nunca iniciou conversa) e "bot was blocked by the user" — são erros conhecidos do ecossistema Telegram, mas não foram confirmados literalmente na doc consultada nesta ingestão; tratar como risco a validar em teste manual (F6), não como fato documentado.

## Riscos para a nossa implementação

- Sem webhook público dedicado, a única forma de capturar o `chat_id` de cada dono é via `getUpdates` — exige que o dono mande `/start` (ou qualquer mensagem) ao bot da plataforma antes de a configuração funcionar; é um passo manual que o admin-master precisa orientar (ex.: campo "peça para o dono mandar /start pro bot @NomeDoBot e cole aqui o chat_id", ou o backend faz polling periódico de `getUpdates` para resolver automaticamente — decisão de descoberta).
- Um único bot da plataforma (um token só) atende todos os tenants, cada um com seu próprio `chat_id` — compatível com o achado da ingestão interna de que não há precedente de segredo por tenant em `config` jsonb (ver `config-empresa-jsonb.md`).
- Erro "chat not found"/"bot blocked" não documentado explicitamente aqui precisa de tratamento defensivo (não deve derrubar o job de relatório nem quebrar outros tenants) — replicar o padrão fire-and-forget + log de `src/email.js` (ver `canal-notificacao-email.md`).
- Rate limit de 1 msg/s por chat é folgado para o caso de uso (relatório diário, não bulk) — risco baixo. Se o job disparar relatório para muitos tenants em sequência rápida, cuidado com o limite de broadcast (~30/s) somado de todos os chats.

## Fonte

https://core.telegram.org/bots/api, https://core.telegram.org/bots/api#sendmessage, https://core.telegram.org/bots/faq — acessado em 2026-09-06

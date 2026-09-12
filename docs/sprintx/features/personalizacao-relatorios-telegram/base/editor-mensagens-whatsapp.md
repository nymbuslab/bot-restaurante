# Precedente de UI citado pelo dono — editor de "Mensagens Automáticas" do bot WhatsApp

## Contrato de entrada

Localizado em `public/admin.html` (painel do RESTAURANTE, não admin-master) — sub-aba
`id="cfg-sub-bot"` (:620). Seção com `<h3>Mensagens Automáticas</h3>` (:637), subtítulo
explicando a sintaxe de variáveis `{ }` (:639) e lista `<ul class="cfg-vars">` das variáveis
disponíveis (:640-647). Grid `<div class="cfg-msgs-grid">` (:648) com 8 cards
`<div class="card cfg-msg">`, cada um `<label>` + `<textarea>` (:649-656) — TEXTO LIVRE
multi-linha, não checkbox. Ex.: `cfgBoasVindas`, `cfgFechado`, `cfgConfirmado`,
`cfgMsgProntoEntrega`. Cada card pode ter `<span class="cfg-msg-hint">` com as variáveis aceitas.

Persistência em `public/app.js`: lido de `c.mensagens.*` (:3349-3356), gravado em
`configAtual.mensagens.*` (:3552-3560) — objeto `config.mensagens` plano por chave.

## Contrato de saída

Não aplicável.

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Não aplicável.

## Riscos para a nossa implementação

O padrão citado pelo dono ("estilo checkbox, parecido com o editor de mensagens do bot do
WhatsApp") é uma referência de LAYOUT (cabeçalho + subtítulo + grid de cards), não de mecanismo
de dado — o editor real usa `<textarea>` (texto livre), não checkbox. NÃO FOI ENCONTRADO nenhum
precedente de checkbox dentro de `.cfg-secao`/`.cfg-msgs-grid` no projeto hoje; o único checkbox
próximo é o toggle `cfgAberto` de status do atendimento (:629), que usa `.switch`/
`.cfg-status-toggle`, uma classe DIFERENTE de `.cfg-msg`. Para os toggles de tipo de relatório, o
padrão visual equivalente seria a MESMA estrutura de cabeçalho/seção, com `<input
type="checkbox">` em vez de `<textarea>` — é decisão de design (F2/protótipo), não algo que já
existe pronto para copiar 1:1.

## Fonte

`public/admin.html:619-659`, `public/app.js:3349-3356,3552-3560` — acessado em 2026-09-07

# UI atual do bloco Telegram no admin-master

## Contrato de entrada

`renderBlocoTelegram(st, slug)` (`public/app-admin.js:846-897`) renderiza dentro de
`#am-t-telegram` (:847), 4 estados mutuamente exclusivos:

1. **Sem plano** (`!st.temPlano`, :850-855) — card com aviso `.am-tg-alerta`.
2. **Vinculado** (`st.vinculado`, :856-867) — selo `.am-tg-selo` (bolinha verde), descrição,
   botões "Enviar mensagem de teste" e "Trocar vínculo".
3. **Link gerado, aguardando** (`st.link`, :868-882) — input readonly + "Copiar" + "Gerar novo link".
4. **Não vinculado** (else, :883-891) — aviso `.am-tg-neutro` + "Gerar link de vinculação".

Estado buscado via `carregarTelegram` → `GET /api/admin/tenants/:slug/telegram`
(`public/app-admin.js:830-838`, rota em `src/servidor.js:1685-1702`), que devolve hoje
`{ vinculado, temPlano, link, ultimoEnvio }` (:1697) — NÃO devolve nenhuma preferência de tipo
de relatório.

## Contrato de saída

HTML injetado via `innerHTML` no elemento `#am-t-telegram`.

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Não aplicável.

## Riscos para a nossa implementação

O ponto de inserção mais natural para os checkboxes de tipo de relatório é dentro do bloco
"Vinculado" (`public/app-admin.js:857-867`) — só faz sentido escolher quais relatórios chegam
quando o Telegram já está vinculado. Isso é observação estrutural, não decisão de plano.

CSS `.am-tg-*` em `public/style.css:3956-3980`: `.am-tg-card`, `.am-tg-topo`, `.am-tg-selo`,
`.am-tg-desc`, `.am-tg-aviso` (com variantes `.am-tg-neutro`/`.am-tg-alerta`/`.am-tg-erro`),
`.am-tg-link-linha`, `.am-tg-acoes`. NÃO existe nenhuma classe `.am-tg-checkbox` ou equivalente
— precisaria ser criada, seguindo os mesmos tokens de `public/style.css` já usados nas outras
classes `.am-tg-*`.

## Fonte

`public/app-admin.js:830-897`, `src/servidor.js:1685-1702`, `public/style.css:3956-3980` —
acessado em 2026-09-07

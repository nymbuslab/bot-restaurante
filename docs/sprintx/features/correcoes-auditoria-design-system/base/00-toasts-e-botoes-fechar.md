# Toasts e botões de fechar (acessibilidade — Alto #1 e Alto #2 do AUDIT.md)

## Contrato de entrada

- **Toast (Alto #1):** disparado por `toast(msg, tipo = "sucesso")` em `public/app.js:105-119`. `tipo` é `"sucesso"` (default) ou `"erro"`. Chamado em dezenas de pontos do `app.js` para avisar sucesso/erro de ações (salvar, excluir, cancelar, estornar, etc).
- **Botão de fechar (Alto #2):** três botões usam o glifo de texto `✕` como conteúdo, sem `aria-label`:
  - `public/admin.html:1685` — `<button class="secundario mini" id="pedido-fechar">✕</button>` (fecha o modal de detalhe do pedido)
  - `public/admin.html:1725` — `<button class="secundario mini" id="qr-fechar">✕</button>` (fecha o modal de QR Code do cardápio)
  - `public/admin.html:1746` — `<button class="secundario mini" id="editor-fechar">✕</button>` (fecha o editor de item do cardápio)
  - `public/admin.html:1869` — `<button class="secundario mini" id="cartao-fechar" type="button">✕</button>` (fecha o modal de adicionar cartão, Stripe)

## Contrato de saída

- **Toast:** cria `<div class="toast {{tipo}}">` com ícone (`ICO_ALERTA`/`ICO_CHECK`) + texto, anexado a `#toast-container` (`public/admin.html:1563`, um único `<div>` vazio, sem `role` nem `aria-live`). Some sozinho após 3800ms com animação `saindo`.
- **Botão de fechar:** hoje sem `aria-label` nesses 4 casos. Padrão JÁ CORRETO existe no mesmo projeto — `public/admin-master.html:293`: `<button class="secundario mini" id="am-t-fechar" aria-label="Fechar">✕</button>`, mesmo glifo, mesma classe `secundario mini`, com `aria-label="Fechar"`.

## Limites e cotas

NÃO DOCUMENTADO (não se aplica — não é um recurso de rede).

## Erros conhecidos e tratamento

- Nenhum erro de execução conhecido. O problema é de acessibilidade: leitor de tela não anuncia o conteúdo dinâmico do toast (sem `aria-live`/`role`) e não tem nome acessível para os 4 botões de fechar sem `aria-label` (lê o caractere `✕` cru ou "multiplication sign", dependendo do leitor).
- Histórico relevante no mesmo componente: `public/app.js` já teve um bug de alinhamento vertical do ícone do toast (corrigido em 2026-08-30, ver `PROGRESSO.md` linha 77 — "o ícone do toast passou a acompanhar a **primeira linha** do texto"), e um SVG de botão (`.caixa-reimprimir svg`) que renderizava com largura 0 por encolher como item de flex dentro de um `button` `inline-flex` (mesmo arquivo, `PROGRESSO.md` linha 73). Nenhum dos dois é sobre `aria-label`/`aria-live`, mas confirma que alterações nesses botões pedem checagem visual (ícone/alinhamento), não só funcional.

## Riscos para a nossa implementação

- Adicionar `aria-live="polite"`/`role="status"` ao `#toast-container` não muda o visual (CSS não depende do atributo); risco de regressão visual é baixo.
- `role="alert"` teria precedência de interrupção maior que `role="status"`; a auditoria sugere `aria-live="assertive"` só para `tipo="erro"` — como o container é único e compartilhado por sucesso/erro, a forma mais simples e correta é colocar `aria-live="polite"` no container (que já cobre sucesso) e, opcionalmente, `role="alert"` apenas no elemento do toast quando `tipo === "erro"` (`el.setAttribute` dentro da função `toast()`, `app.js:108`).
- Adicionar `aria-label="Fechar"` nos 4 botões é cópia direta e comprovada do padrão já em produção em `admin-master.html:293` — risco mínimo.

## Fonte

- `public/app.js:105-119` (função `toast`) — lido em 2026-09-05.
- `public/admin.html:1563,1685,1725,1746,1869` — lido em 2026-09-05.
- `public/admin-master.html:288-294` (padrão correto de referência) — lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achados Alto #1 e Alto #2) — lido em 2026-09-05.
- `PROGRESSO.md:73,77` (histórico de bugs visuais no mesmo componente de toast/ícone) — lido em 2026-09-05.

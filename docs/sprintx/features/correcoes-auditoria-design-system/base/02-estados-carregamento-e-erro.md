# Estados de carregamento e erro vs. "caixa fechado" (Alto #4 e Alto #5 do AUDIT.md)

## Contrato de entrada

**Alto #4 — sem estado de carregando**, quatro telas chamam a API e só populam ao final,
sem indicador no meio:

- **Pedidos** — `carregarPedidos()`, `public/app.js:4853-4872`: `await api("GET", url)` sem
  nenhum `innerHTML`/spinner antes da resposta.
- **PDV** — `carregarPdv()`, `public/app.js:5893-5901+`: zera `hidden` de 4 blocos
  (`pdvLock`, `pdvSemCaixa`, `pdvVencido`, `pdvConteudo`, `pdvFab`) e só then decide qual mostrar.
- **Mesas** — `carregarMesas()`, `public/app.js:7157-7184`: mesmo padrão (zera `hidden` de
  `mesasLock`/`mesasSemCaixa`/`mesasVencido`/`mesasConteudo`).
- **Caixa** — `carregarCaixa()`, `public/app.js:3712-3723`: zera `hidden` de `caixaLock`/
  `caixaConteudo`.

Padrão de carregamento **já existente** no mesmo arquivo, mas usado só em duas telas:
- `painelCarregando(txt)`, `public/app.js:2066-2069` — usado na aba Conexão (retorna HTML com
  `.qr-spinner` + texto).
- Inline `cont.innerHTML = '<p class="dash-vazio">Carregando…</p>'`, `public/app.js:1082`
  (extrato de estoque).
- Painel master também tem o padrão: `admin-master.html:296` (`<div class="estado-vazio"><p
  class="sub">Carregando…</p></div>`) e `admin-master.html:164` (`<p class="sub"
  id="am-contagem">Carregando…</p>`).

**Alto #5 — erro de rede confundido com "caixa fechado"**:

- **PDV**, `public/app.js:5895-5901`:
  ```
  const r = await api("GET", "/api/caixa");
  if (!r) return; // 401 já redirecionou
  if (r.status === 403) { $("pdvLock").hidden = false; return; }
  if (!r.ok) { $("pdvSemCaixa").hidden = false; return; }        // <- qualquer erro HTTP != 403 cai aqui
  const data = await r.json();
  ...
  if (!data.caixa) { $("pdvSemCaixa").hidden = false; return; }  // <- ausência real de caixa
  ```
- **Mesas**, `public/app.js:7168-7179` (mesmo padrão, com uma pequena diferença: Mesas
  já mostra um toast de erro além de cair no estado de "sem caixa" — `if (!rMesas.ok) {
  toast("Erro ao carregar mesas.", "erro"); $("mesasSemCaixa").hidden = false; return; }`,
  linha 7179 — mas ainda assim mostra a MESMA tela de "abra o caixa").
- Texto da tela "sem caixa" mostrado nos dois casos (rede OU caixa fechado):
  - PDV: `public/admin.html:949-954` — `<h3>Abra o caixa para vender</h3>`
  - Mesas: `public/admin.html:1037-1042` — `<h3>Abra o caixa para usar Mesas</h3>`

## Contrato de saída

- Hoje: tela em branco (sem indicador) durante o fetch, e tela "Abra o caixa" tanto para
  ausência real de caixa quanto para erro de rede/servidor (exceto Mesas, que ao menos emite um
  toast antes de mostrar a tela errada).
- Esperado (a decidir exatamente como na F2): mostrar algum indicador de carregamento nas 4 telas
  durante o fetch, e diferenciar "erro de requisição" (`!r.ok` com status ≠ 403) de "ausência real
  de caixa" (`r.ok && !data.caixa`) nas 3 telas que fazem essa checagem (PDV, Mesas, Caixa — Caixa
  já tem uma mensagem de erro separada, ver abaixo).

**Caixa já resolve parcialmente o Alto #5** — vale de referência: `public/app.js:3717-3722`:
```
const r = await api("GET", "/api/caixa");
if (!r) return;
if (r.status === 403) { $("caixaLock").hidden = false; return; }
$("caixaConteudo").hidden = false;
if (!r.ok) { $("caixaConteudo").innerHTML = "<p class='sub'>Falha ao carregar o caixa.</p>"; return; }
renderCaixa(await r.json());
```
Ou seja, a tela de Caixa JÁ tem uma mensagem de erro genérica separada da renderização normal —
mas não é literalmente "o mesmo bug" do PDV/Mesas porque Caixa não tem uma tela dedicada de "sem
caixa" (o próprio `renderCaixa` decide o que mostrar quando `caixa` é nulo, fora do escopo lido
aqui). Confirmar na F3 se `renderCaixa(null-ish)` já cobre bem esse caso ou se também precisa de
ajuste — a auditoria não apontou Caixa como afetado por este achado, só PDV e Mesas.

## Limites e cotas

NÃO DOCUMENTADO (não há rate limit relevante para este achado — é UI de tratamento de resposta,
não uma nova chamada de rede).

## Erros conhecidos e tratamento

- `api()` (helper de fetch do painel) já trata 401 redirecionando (`if (!r) return`,
  comentário em `app.js:5896,7168,3718`: "401 já redirecionou") — não precisa reproduzir esse
  tratamento, só o caso de erro genérico (`!r.ok`, ex. 500/timeout) vs. dado de negócio ausente.
- Não achei, nas linhas lidas, um helper genérico de "estado de erro" reutilizável entre telas
  (cada tela decide seu próprio HTML de erro/vazio inline). Se a F3 decidir criar um helper
  compartilhado, ele ainda não existe — não inventar um nome/assinatura aqui, é decisão de
  design da fase de plano, não desta base.

## Riscos para a nossa implementação

- Mudar a condição de exibição de `pdvSemCaixa`/`mesasSemCaixa` significa introduzir uma NOVA
  tela ou reaproveitar o `.estado-vazio` genérico (`style.css:2326-2349`) para o caso de erro —
  precisa de um texto claro (algo como "Não foi possível carregar. Tente de novo.") e,
  possivelmente, um botão de retry. Isso é decisão de conteúdo/UX que deve ser confirmada com o
  dono na F2 (texto exato, se tem botão "tentar de novo" ou só orientação).
  **NÃO DOCUMENTADO**: qual comportamento é vontade do dono aqui — vai para pergunta obrigatória
  da F2.
- Adicionar indicador de carregamento nas 4 telas é aditivo (não remove nada existente), risco
  baixo — mas cada tela tem uma estrutura de `hidden` própria, então a implementação não é um
  único helper genérico plugável sem tocar 4 lugares.

## Fonte

- `public/app.js:1078-1089` (`estCarregarExtrato`, padrão de "Carregando…" já usado),
  `2066-2069` (`painelCarregando`), `3712-3723` (`carregarCaixa`), `4853-4872`
  (`carregarPedidos`), `5893-5904` (`carregarPdv`), `7157-7184` (`carregarMesas`) — lido em
  2026-09-05.
- `public/admin.html:945-954` (`pdvSemCaixa`), `1033-1042` (`mesasSemCaixa`) — lido em
  2026-09-05.
- `public/admin-master.html:164,296` (padrão "Carregando…" já usado no painel master) — lido em
  2026-09-05.
- `docs/design-system/AUDIT.md` (achados Alto #4 e Alto #5) — lido em 2026-09-05.

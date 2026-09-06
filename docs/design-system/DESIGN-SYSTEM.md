---
exx_schema: 1
expx_tool: designx
kind: design_system
origem: cartografia_automatica
consistente: false
data: 2026-09-05
---

# Design System — bot-restaurante (cartografia automática)

Espelho do vocabulário visual REAL em uso no código. Não é plano de ação; não corrige nada
do que descreve. Toda afirmação aponta `arquivo:linha`. Escopo: `public/style.css` (design
system principal, ~6.460 linhas), `public/cardapio.css` (página pública do cardápio),
os 10 HTML de `public/` e os `.js` de `public/` que renderizam UI via template string.

Existe `docs/design-system.md` já documentado no repo; ele foi usado como referência de
contexto, mas toda tabela abaixo foi conferida contra o código — onde o código diverge do
que está escrito lá, isso está registrado em "Drift detectado".

## 1. Tokens encontrados

Todos declarados em `:root`, `public/style.css:3-63`. Total: **42 custom properties**.

### Cor (27 tokens)

| Token | Valor | Onde aparece (declaração) | Consistente? |
| --- | --- | --- | --- |
| `--bg-primary` | `#0F1117` | `style.css:4` | sim — único fundo de página em todo o painel |
| `--bg-surface` | `#1A1D27` | `style.css:5` | sim |
| `--bg-elevated` | `#222533` | `style.css:6` | sim |
| `--bg-overlay` | `#2A2E3F` | `style.css:7` | sim |
| `--border` | `#2E3247` | `style.css:9` | sim |
| `--border-subtle` | `#242738` | `style.css:10` | sim |
| `--text-primary` | `#F0F2FA` | `style.css:12` | sim |
| `--text-secondary` | `#8B92B3` | `style.css:13` | sim |
| `--text-disabled` | `#4A5068` | `style.css:14` | sim |
| `--accent` | `#6344BC` | `style.css:16` | sim, mas ver drift #5 (cor extra no gradiente do login) |
| `--accent-hover` | `#7150D0` | `style.css:17` | sim |
| `--accent-fg` | `#A589EA` | `style.css:18` | sim |
| `--accent-subtle` | `rgba(99,68,188,0.16)` | `style.css:19` | sim |
| `--accent-rgb` | `99, 68, 188` | `style.css:20` | único token com variante `-rgb` — ver drift #3 |
| `--secondary` | `#73D2E6` | `style.css:22` | sim |
| `--secondary-hover` | `#5BC2D8` | `style.css:23` | sim |
| `--secondary-subtle` | `rgba(115,210,230,0.14)` | `style.css:24` | sim |
| `--success` | `#22C55E` | `style.css:26` | **não** — duplicado como hex/rgba fora do token em vários pontos (drift #3, #4) |
| `--success-subtle` | `rgba(34,197,94,0.12)` | `style.css:27` | sim |
| `--error` | `#EF4444` | `style.css:28` | **não** — mesmo problema (drift #3, #4) |
| `--error-subtle` | `rgba(239,68,68,0.12)` | `style.css:29` | sim |
| `--error-hover` | `#DC2626` | `style.css:30` | sim (token isolado, 1 papel: hover de botão destrutivo) |
| `--error-fg` | `#F87171` | `style.css:34` | sim |
| `--warning` | `#EAB308` | `style.css:41` | sim |
| `--warning-subtle` | `rgba(234,179,8,0.12)` | `style.css:42` | sim |
| `--info` | `#3B82F6` | `style.css:43` | sim |
| `--info-subtle` | `rgba(59,130,246,0.12)` | `style.css:44` | sim |

### Sombra (3 tokens)

| Token | Valor | Onde | Consistente? |
| --- | --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.4)` | `style.css:46` | usado em 32 dos 62 `box-shadow:` do arquivo — o restante é valor solto (ver seção 7) |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)` | `style.css:47` | idem |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.6)` | `style.css:48` | idem |

### Raio de borda (4 tokens)

| Token | Valor |
| --- | --- |
| `--radius-sm` | `6px` (`style.css:50`) |
| `--radius` | `10px` (`style.css:51`) |
| `--radius-lg` | `14px` (`style.css:52`) |
| `--radius-xl` | `18px` (`style.css:53`) |

### Espaçamento (7 tokens)

| Token | Valor |
| --- | --- |
| `--space-1` | `4px` (`style.css:56`) |
| `--space-2` | `8px` (`style.css:57`) |
| `--space-3` | `12px` (`style.css:58`) |
| `--space-4` | `16px` (`style.css:59`) |
| `--space-5` | `20px` (`style.css:60`) |
| `--space-6` | `24px` (`style.css:61`) |
| `--space-8` | `32px` (`style.css:62`) |

Uso real: `var(--space-N)` aparece **50 vezes** em `style.css`. Comparado a **899 declarações**
de `margin`/`padding`/`gap` com valor em px puro no mesmo arquivo — ver drift #2.

### Tipografia (1 token)

| Token | Valor | Onde | Nota |
| --- | --- | --- | --- |
| `--fonte-mono` | `ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Code", Consolas, Menlo, monospace` | `style.css:40` | exceção documentada em código (`style.css:35-39`): `.cupom-print`/`.cupom-preview` não usam este token, ficam em `"Courier New"` |

### Variável CSS fora do `:root` (não é token global)

- `--mesa-sz: 110px` — `style.css:5818`, escopo local (provável seletor específico do módulo de
  mesas), não listada em `:root`. Não é um "token" no sentido do design system, é variável de
  componente.

## 2. Cores em uso (fora dos tokens)

| Cor | Tipo | Ocorrências (grep) | Deveria ser token? |
| --- | --- | --- | --- |
| `#fff` / `#000` | hex | dezenas, em preenchimento de marca/impressão/QR (ex. `style.css:5162`, `index.html:59`) | não — exceção documentada em `docs/design-system.md` linha 270, confirmada no código |
| `#25D366` | hex | 1 — `style.css:2192` (`.canal-whats svg`) | não — verde oficial do WhatsApp, cor de marca externa, uso único |
| `rgba(34,197,94,…)` / `#22c55e` | rgba/hex | ≥ 15 ocorrências (`style.css:333,619,1523,2121,2388,3770,5527,5671,5675,5696-5697,6243`) | **sim** — é o mesmo valor de `--success`, deveria usar o token (ver drift #3/#4) |
| `rgba(239,68,68,…)` / `#ef4444` | rgba/hex | ≥ 15 ocorrências (`style.css:625,1524,1664,1668,2394,3771,3787,3808,4561,4902,5132,5138,5143,5145,5891-5892,6046,6245`) | **sim** — mesmo valor de `--error` (ver drift #3/#4) |
| `#5C7FD0` | hex | 1 — `style.css:171` (stop do meio no gradiente de marca do login) | não documentado como token nem como exceção explícita — cor "órfã", só existe ali |
| `#6344BC` / `#222533` / `#F0F2FA` / `#8B92B3` / `#EF4444` | hex literal (espelha token) | `app.js:1991-1992`, `checkout.js:82-86` | não — são temas de widget externo (Stripe Elements), fora do CSS, precisam ser literais |
| `#0b57d0` / `#8b5cf6` | hex | `admin.html:823,827` (`style="background:#..."`) — cores de aviso do Windows (SmartScreen), citadas em texto explicativo sobre a UI do próprio Windows, não da marca | não — não é UI do produto, é ilustração de tela de terceiro |

## 3. Tipografia

- Fonte única: **Plus Jakarta Sans** (`style.css:1`, carregada via `@import` do Google Fonts e
  também via `<link>` em cada HTML, ex. `login.html:10`), fallback `-apple-system, sans-serif`
  (`style.css:118`).
- Base do body: `font-size: 14px; line-height: 1.5` (`style.css:117-125`).
- `h1`: 15px/700/tracking -0.3px (`style.css:127`). `h2`: 15px/700 (`style.css:128`). `h3`:
  11px/700/uppercase/tracking 0.5px, cor `--text-secondary`, com borda inferior (`style.css:129-138`).
- `.sub`: 13px, cor `--text-secondary` (`style.css:139`).
- Escala de `font-size` em px: confirmada fechada. Comando de auditoria
  (`grep -nE "font-size:" | grep -vE "font-size:\s*[0-9]+px"`) devolve **2 linhas** em
  `style.css` (não 3, ver drift #7): `font-size: 0;` em `.toggle` (`style.css:1157`, truque de
  layout) e `font-size: 2.5mm;` em `.cupom-print` (`style.css:4916`, amarra ao papel térmico).
  Em `public/cardapio.css` **0 linhas** fogem do padrão `Npx` (78 ocorrências, todas em px).
- Numerais tabulares: uma única regra agregando todas as classes de coluna numérica
  (`style.css:95-115`, ~50 classes listadas), `font-variant-numeric: tabular-nums`.
- Nenhum uso de `rem`/`em` em `font-size` encontrado no CSS (todas as ocorrências relevantes
  são `px`, exceto as 2 exceções de `.cupom-print`/`.toggle` citadas acima).

## 4. Componentes (classe CSS + onde é usado)

| Componente | Classe | Reutilizável? | Evidência |
| --- | --- | --- | --- |
| Botão primário | `button` (base) | sim, genérico | `style.css:955-970` |
| Botão secundário | `button.secundario` | sim, genérico | `style.css:972-982` |
| Botão destrutivo | `button.perigo` | sim, genérico | `style.css:983-994` |
| Botão compacto | `button.mini` | sim, modificador | `style.css:995` |
| Card | `.card` | sim, genérico | `style.css:1004-1013`, usado 10× em `admin.html` |
| Campo de formulário | `.campo` (+ `.campo-nota`, `.campo-opcional`, `.campo-ajuda`, `.campo-prefixo`) | sim, genérico | `style.css:1014-1026`, `4937-4945`, `6080` |
| Linha de campos | `.linha` | sim, genérico | `style.css:1027-1028` |
| Barra de salvar sticky | `.barra-salvar` | sim, genérico | `style.css:1031` |
| Tag de status | `.tag` + `.tag-entrega`/`.tag-retirada`/`.tag-local` | sim, semântico | `style.css:2110-2122` |
| Selo de pagamento/estoque | `.selo-pag` + `.selo-pago`/`.selo-areceber`/`.selo-cancelado`/`.selo-esgotado`/`.selo-baixo` | sim, semântico único (1 família, 5 modificadores) | `style.css:5115-5122` |
| Badge de atendimento | `.badge-atendimento` (+ `.aberto`/`.fechado`) | específico (header do painel) | `style.css:601-628` |
| Contador de nav | `.nav-badge` | específico (aba do menu) | `style.css:696-709`, `852` |
| Dot de status | `.bolinha` (+ `.on`/`.off`/`.wait`) | sim, genérico | `style.css:1487-1497` |
| Estado vazio | `.estado-vazio` | sim, genérico | `style.css:2326-2349` |
| Toast | `.toast` (+ `.sucesso`/`.erro`) | sim, genérico, disparado por `toast()` em `app.js:105` | `style.css:2363-2409` |
| Modal | `.modal-overlay` + `.modal-caixa` | sim, padrão único reaproveitado | `style.css:2409-2564`, ex. `abrirModalPedido` em `app.js:5402` |
| Simulador de chat | `.sim-wrapper`, `.sim-bubble-bot`, `.sim-bubble-user` | específico (aba Simulador) | `style.css:2703-2870` |
| Toggle/switch | `.switch > input[type=checkbox]` | sim, genérico (status/flags) | referenciado em `docs/design-system.md:219`, classe presente em `admin.html` |
| Pill removível | `.pag-pill` + `.pag-add` | específico (formas de pagamento) | `public/pagamentos.js` |
| Faixa de métrica | `.metrica-card` | sim, genérico (dashboards) | usado em cardápio/pedidos/dashboard |
| Controle segmentado | `.filtro-chip` / `.editor-tab` / `.pdv-cat` (família "selecionado preenchido") | sim, mesmo padrão em 31 ocorrências em `admin.html` | `admin.html` (31 ocorrências combinadas) |
| Sidebar com grupos acordeão | `.sidebar` + `.nav-grupo-wrap` + `.nav-sub` | específico do painel, reaproveitado pelo master | `admin.html:15-177`, `admin-master.html:83` |
| Navegação mobile | `.mobile-bar` (bottom bar) + gaveta off-canvas (`.aberta`, `.drawer-backdrop`) | específico do painel | `admin.html:1890` |
| Shell de autenticação | `.tela-auth`, `.auth-layout`, `.auth-marca`, `.auth-card`, `.auth-campo`, `.auth-btn` | reutilizado por login/cadastro/redefinir-senha | `login.html:13-79`, `cadastro.html:13-14` |
| Shell de checkout | `.co-wrap`, `.co-card`, `.co-plano-opt` | específico (única tela) | `checkout.html:15-42` |
| Componentes do painel master | `.am-hero-card`, `.am-status`, `.am-dash-topo` | específico (painel master) | `style.css:3770-3948` |
| Cardápio público | `.cd-topo`, `.cd-card`, `.cd-add`, `.cd-estado` | específico (única tela pública, CSS próprio) | `cardapio.css` inteiro, `cardapio.html:14-35` |
| PDV | `.pdv-tile`, `.pdv-modal-fechar`, `.pdv-stepper`, `.pdv-cart-fechar` | específico (aba PDV) | `style.css:5205-5468`, `admin.html:977` |
| Mesas | `.mesa-card`, `.mesa-painel`, `.mesa-painel-fechar` | específico (aba Mesas) | `admin.html:1083`, `style.css:5778-6250` |
| Tabela nativa | `<table>` estilizado implicitamente (sem classe base própria; classes específicas por tela: `.tabela-horarios`, `.cfg-faixas-tabela`) | parcialmente reutilizável — 2 variantes de nome para o mesmo papel | `admin.html:556,716,739` |
| Input base | seletor implícito `input, textarea, select` (sem classe) | sim, genérico | citado em `docs/design-system.md:178`, confirmado no CSS |

Não há diretório `src/components/ui/` nem `src/components/` — o projeto não usa componentização
de framework; "componente" aqui é classe CSS + fragmento HTML/JS repetido.

## 5. Padrões de tela

- **Painel administrativo** (`admin.html`) — shell fixo `.sidebar` (com grupos acordeão) +
  `.conteudo`, `.mobile-bar` para mobile; dentro dele, múltiplas sub-telas por aba
  (`data-aba`): dashboards com `.metrica-card`, listas com `<table>`, formulários com `.campo`,
  detalhe de pedido em modal (`.modal-overlay`), PDV como grade de produtos + carrinho lateral,
  Mesas como grade de cards + painel lateral, Caixa como tela dedicada.
- **Painel master** (`admin-master.html`) — reaproveita a mesma classe `.sidebar`
  (`admin-master.html:83`) do painel de empresa, com componentes próprios prefixados `.am-`.
- **Autenticação** (`login.html`, `cadastro.html`, `redefinir-senha.html`) — mesmo shell
  `.tela-auth > .auth-layout` (painel de marca à esquerda + card de formulário à direita).
- **Checkout** (`checkout.html`) — card único centralizado (`.co-wrap > .co-card`), sem
  sidebar, com seleção de plano em tiles (`.co-plano-opt`).
- **Cardápio público** (`cardapio.html` + `cardapio.css`) — página isolada, não usa
  `style.css`; grid de produtos com filtro/busca (`.cardapio-busca`) e carrinho.
- **Landing e páginas legais** (`index.html`, `termos.html`, `privacidade.html`) — classes
  `.lp-*`, sem sidebar, layout de marketing (hero, seções, chat simulado).
- Não há padrão de "hub page" separado do dashboard — o dashboard do painel (`admin.html`)
  cumpre esse papel dentro da mesma shell de abas.
- Formulários usam sempre `.campo`/`.linha`, nunca um componente de formulário genérico
  fora do painel (checkout e cadastro reimplementam campos com `.auth-campo`/`.co-*` em vez de
  `.campo`).

## 6. Ícones

- Regra do projeto (`CLAUDE.md`/memória): nunca emoji na UI, sempre SVG. **Comentários no
  próprio código confirmam a intenção**: `cardapio.js:15`, `app-admin.js:69,166`, `app.js:17`
  ("nunca emoji, sempre SVG").
- Busca por emoji real (faixa Unicode de emoji/símbolos) em `.html`/`.js` de `public/`: **0
  ocorrências** de emoji verdadeiro. As únicas correspondências na faixa de símbolos são o
  caractere de pontuação `✕` (ver drift #6), não emoji.
- Ícones são SVG inline (`stroke="currentColor"`, sem biblioteca externa tipo Lucide/Feather
  instalada via `package.json` — nenhuma dependência de ícones encontrada).
- **Drift**: nem todo botão de fechar usa SVG — ver drift #6.

## 7. Bordas vs sombras

- `border: 1px solid var(--border...)`: **114 ocorrências** em `style.css`.
- `box-shadow:`: **62 ocorrências**, das quais **32** usam os tokens `var(--shadow-*)` e
  **30** são valores soltos (`rgba(...)` compostos na própria regra, ex. `style.css:2629`,
  `3304`, `5276`, `5565`).
- Predominância clara de **borda** sobre sombra — visual denso de painel/SaaS, não
  card/landing. Sombra token aparece sobretudo em modal (`--shadow-lg`), card de login e
  toast (`--shadow-md`), conforme `docs/design-system.md:79`, confirmado no código.

## 8. Dark mode

- Não existe alternância de tema: **0 ocorrências** de `dark:` em qualquer `.tsx`/`.js`, e
  **0 ocorrências** de segunda paleta `light`/`dark` em `style.css` — o tema é escuro fixo
  (`--bg-primary: #0F1117` como único fundo, sem media query `prefers-color-scheme` nem
  toggle de tema em nenhum HTML).

## 9. Framework visual

- Sem Tailwind, sem CSS-in-JS, sem CSS Modules — **CSS puro** em 2 arquivos
  (`public/style.css` para o painel/autenticação/landing, `public/cardapio.css` para a
  página pública do cardápio). Confirmado pela ausência de `tailwind.config.*`,
  `postcss.config.*` na raiz e pela ausência de `tailwindcss`/`styled-components`/`emotion`
  no `package.json`.
- Fonte carregada via Google Fonts (`@import` em `style.css:1` + `<link>` duplicado em cada
  HTML, ex. `admin.html:10`).

## Drift detectado (7 itens)

1. **Breakpoints fora do "oficial" documentado.** `docs/design-system.md` afirma dois
   breakpoints oficiais (1024px e 640px). O código tem **35 declarações `@media (max-width:…)`**
   em `style.css`, das quais só 16 usam 1024px (4×) ou 640px (12×). As demais **19** usam
   valores só encontrados uma vez ali: `1100px` (×2, `style.css:876,5778`), `760px` (×4,
   `2250,3887,4855,5019`), `520px` (`2545`), `560px` (×7, `3892,4576,4626,4726,5088,5816`),
   `920px` (`4241`), `900px` (`4716`), `480px` (×2, `4740,6214`), `980px` (×2, `5461,5586`),
   `860px` (`5464`), `720px` (×2, `5587,6250`), `768px` (`5781`).

2. **Espaçamento majoritariamente fora da escala `--space-1..8`.** O token de espaçamento
   (`4/8/12/16/20/24/32px`) é usado em apenas **50** declarações via `var(--space-N)`, contra
   **899** declarações de `margin`/`padding`/`gap` com valor em px solto no mesmo arquivo —
   incluindo valores que nem são múltiplos de 4 (`1px`, `2px`, `3px`, `5px`, `6px`, `7px`,
   `9px`, `11px`, `13px`, `15px`, `18px`, `22px`, `26px`, `28px`, `38px`, `48px`, `92px`), ex.
   `style.css:83,185,215,270,278,287,297,309,382,439,495,528,585,604,727,814,866`. A escala
   parece valer só para UI escrita depois da padronização, não para o arquivo inteiro.

3. **Cores semânticas duplicadas fora do token.** `--success` (`#22C55E`) e `--error`
   (`#EF4444`) não têm variantes `-rgb` (diferente de `--accent-rgb`, `style.css:20`), então
   o valor `rgba(34,197,94,…)` foi hardcoded pelo menos **15 vezes** (`style.css:333, 619,
   1523, 2121, 2388, 3770, 5527, 5671, 5675, 5696-5697, 6243`) e `rgba(239,68,68,…)` outras
   **15+ vezes** (`style.css:625, 1524, 1664, 1668, 2394, 3771, 3787, 3808, 4561, 4902, 5132,
   5138, 5143, 5145, 5891-5892, 6046, 6245`), em vez de usar `var(--success-subtle)` /
   `var(--error-subtle)` já existentes ou um `--success-rgb`/`--error-rgb`.

4. **Hex literal duplicando o valor do token, sem `var()`.** `#22c55e` aparece cru em
   `style.css:5527` (`.dash-dot.aberto`), `5675` e `5696` — mesmo valor de `--success` mas
   sem referenciar a variável. `#ef4444` aparece cru em `style.css:5138`. Um `grep` por
   `#22C55E` não encontra esses 3 casos (estão em minúsculo), o que dificulta até auditoria
   manual.

5. **Cor de gradiente não documentada como token nem exceção.** O gradiente de marca do
   login (`style.css:171`) usa três cores: `linear-gradient(135deg, var(--accent) 0%,
   #5C7FD0 50%, var(--secondary) 100%)`. `#5C7FD0` não é `--accent`, não é `--secondary`, não
   está em `:root` e não está listado nas exceções de cor do `docs/design-system.md` — é uma
   cor "órfã", usada uma única vez.

6. **Botão de fechar com duas implementações para a mesma função.** A maioria dos botões de
   fechar usa SVG (ex. `admin.html:977` `.pdv-cart-fechar`, `admin.html:1702` `.upsell-x`),
   mas **5 ocorrências** usam o caractere de texto `✕` cru: `admin.html:1685`
   (`#pedido-fechar`), `admin.html:1725` (`#qr-fechar`), `admin.html:1746`
   (`#editor-fechar`), `admin.html:1869` (`#cartao-fechar`), `admin-master.html:293`
   (`#am-t-fechar`). Não são emoji, mas quebram a consistência de "ícone = SVG" que o
   restante do botão de fechar segue.

7. **Comentário do código não bate com o valor real.** `style.css:4910-4921` documenta que
   `.cupom-print` usa `font-size: 2.5mm` para amarrar a métrica ao papel térmico de 80mm.
   `style.css:5157-5162` (`.cupom-preview`) tem um comentário dizendo que segue "mesmo motivo
   do `.cupom-print`, espelha o papel", mas na prática usa `font-size: 10px` — um valor da
   escala normal de interface, não `2.5mm`. O comentário descreve uma intenção que o valor
   atual não cumpre.

# Design System (`public/style.css`)

Marca: **Nymbus Lab**. Tema escuro fixo. Fonte: **Plus Jakarta Sans** (Google Fonts), fallback `-apple-system`.
Base: 14px / line-height 1.5.

> Referência completa de UI por tela (o que manter e o que NÃO construir): **`design/UI.md`**.

## Tokens de cor (variáveis CSS)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg-primary` | `#0F1117` | fundo da página |
| `--bg-surface` | `#1A1D27` | cards, header, nav |
| `--bg-elevated` | `#222533` | inputs, cabeçalho de categoria, hover de linha |
| `--bg-overlay` | `#2A2E3F` | modal, input do simulador |
| `--border` | `#2E3247` | bordas padrão |
| `--border-subtle` | `#242738` | divisórias internas |
| `--text-primary` | `#F0F2FA` | texto principal |
| `--text-secondary` | `#8B92B3` | labels, subtítulos |
| `--text-disabled` | `#4A5068` | placeholders, desabilitado |
| `--accent` | `#6344BC` | roxo — PREENCHIMENTO: botão primário, aba ativa, foco (texto branco em cima) |
| `--accent-hover` | `#7150D0` | hover do botão primário |
| `--accent-fg` | `#A589EA` | roxo CLARO — TEXTO/ÍCONE roxo sobre fundo escuro (preserva contraste) |
| `--accent-subtle` | `rgba(99,68,188,0.16)` | fundo de destaque suave |
| `--secondary` | `#73D2E6` | ciano — acento secundário, links, gradiente de marca |
| `--secondary-hover` | `#5BC2D8` | hover do ciano (texto escuro em cima) |
| `--secondary-subtle` | `rgba(115,210,230,0.14)` | fundo ciano suave |
| `--success` | `#22C55E` | verde — status aberto, tag retirada |
| `--error` | `#EF4444` | vermelho — status fechado, erros |
| `--warning` | `#EAB308` | amarelo — observação no pedido |
| `--info` | `#3B82F6` | azul — tag entrega |

Cada cor semântica tem variante `*-subtle` com `rgba(..., 0.12)` para fundos.

> **Contraste:** `--accent` (#6344BC) só como **preenchimento** (texto branco). Como
> **texto/ícone sobre fundo escuro**, usar sempre `--accent-fg` (#A589EA) — o roxo cheio
> perde contraste no escuro. No `style.css`, os 3 pontos que usam `--accent` como cor de
> texto passam a `--accent-fg`: `nav button.ativo`, `.btn-ver-pedido` e a pill do simulador.
>
> **Tags de status são semânticas, nunca de marca:** Entrega = `--info` (azul),
> Retirada = `--success` (verde). Sem laranja em lugar nenhum.

## Tokens de forma e sombra

| Token | Valor |
| --- | --- |
| `--radius-sm` | `6px` |
| `--radius` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-xl` | `18px` |
| `--shadow-sm` | sombra discreta (cards) |
| `--shadow-md` | sombra média (login card, toast) |
| `--shadow-lg` | sombra forte (modal) |

## Componentes

| Classe | Descrição |
| --- | --- |
| `button` | botão primário roxo (padrão) |
| `button.secundario` | botão outline neutro |
| `button.perigo` | botão destructivo (vermelho, sem fundo) |
| `button.mini` | botão menor (padding reduzido) |
| `card` | container surface com borda e sombra |
| `campo` | wrapper de campo de formulário com label uppercase |
| `linha` | flex row para campos lado a lado |
| `barra-salvar` | barra sticky inferior para ações de salvar |
| `tag` | pill de status inline (`tag-entrega` = azul/info · `tag-retirada` = verde/success) |
| `badge-atendimento` | pill do header (`.aberto` verde / `.fechado` vermelho) |
| `nav-badge` | contador roxo na aba do nav |
| `bolinha` | dot de status (`.on` verde / `.off` vermelho / `.wait` amarelo) |
| `estado-vazio` | bloco centralizado para listas sem itens |
| `toast` | notificação flutuante (`.sucesso` / `.erro`) |
| `.aviso` / `.erro` | texto de feedback inline (verde / vermelho) |
| `modal-overlay` + `modal-caixa` | modal de confirmação com animação |
| `sim-wrapper` | container do simulador de chat |
| `sim-bubble-bot` / `sim-bubble-user` | balões do chat (bot esquerda / usuário direita roxo) |

## Tipografia

- `h1` — 15 px, 700, tracking -0.3px (header do painel)
- `h2` — 15 px, 700 (títulos de seção)
- `h3` — 11 px, 700, uppercase, tracking 0.5px, cor secondary (rótulos de seção)
- `.sub` — 13 px, cor secondary (subtítulos)
- Labels de campo — 11 px, 700, uppercase, tracking 0.5px

## Regras ao criar nova UI

- Sempre usar as variáveis CSS — nunca valores hexadecimais fixos no HTML/JS inline.
- Inputs sempre com classe implícita (seletor `input, textarea, select` já estilizado).
- Novos modais seguem o padrão `modal-overlay > modal-caixa` com animação já definida.
- Placeholders usam texto genérico descritivo — sem nomes reais de restaurantes ou pessoas.
- Roxo cheio (`--accent`) só em preenchimento; texto/ícone roxo sobre escuro usa `--accent-fg`.
- Sem laranja: a marca é roxo (`--accent`) + ciano (`--secondary`); status em cores semânticas.
- Antes de redesenhar uma tela, consultar `design/UI.md` (referência visual + o que NÃO construir).

## Padrões de layout reutilizáveis (redesign Nymbus Lab)

Padrões consolidados no redesign do painel. Reaproveitar nas próximas telas — não reinventar.

### Cabeçalhos

- **Título de tela:** 20px / 700 / tracking -0.3px (`.cardapio-titulo`, `.cfg-titulo`, `.sim-titulo`, `.conexao-titulo`). Seguido de `.sub` (subtítulo).
- **Cabeçalho de seção:** ícone `--accent-fg` (18–20px) + `h3` 16px/700 (`.cfg-secao-cabeca`). Diferente do `h3` legado (11px uppercase) — usar este nas telas redesenhadas.
- **Cabeçalho de ação:** título à esquerda + botões à direita, `flex-wrap`, empilha no mobile (`.cardapio-topo`, `.sim-topo`).

### Componentes do redesign

- **Faixa de métricas:** `.metrica-card` (label + ícone no topo, número grande embaixo). Grids: cardápio `repeat(3,1fr)`, pedidos `1.6fr 1fr 1fr` (1º card domina).
- **Switch (toggle):** `.switch > input[type=checkbox]` — 40×22px, roxo quando on. Para status/flags (atendimento, fechado por dia). Não confundir com `.toggle .itDisp` (toggle do cardápio).
- **Pills removíveis:** `.pag-pill` (texto + ×) + botão tracejado `.pag-add` "Adicionar" com input inline. Para listas editáveis (formas de pagamento).
- **Moldura gradiente:** `padding:4px; background: linear-gradient(135deg, var(--accent), var(--secondary))` envolvendo conteúdo (QR da Conexão).
- **Painel lateral de leitura:** card com título uppercase + linhas label/valor (`.sim-ctx-*`) — para dados de contexto reais.

### Grid responsivo de cards

- **3 col > 1024px · 2 col ≤ 1024px · 1 col ≤ 640px** (cardápio). No mobile, esconder a foto e empilhar.

### Espaçamentos

- Entre seções: **22–26px** de `margin-bottom`. Gap de grid: **16px**. Padding de card: **16–24px**. Gap interno de form: o do `.campo`.
- Barra de salvar sticky: `.barra-salvar` (pode levar "Descartar" + "Salvar" e um aviso, ver `.cfg-barra`).

### Breakpoints oficiais

- **1024px** (tablet — cards caem para 2 col) e **640px** (mobile — sidebar vira bottom-nav, grids 1 col, tabelas viram cards por linha com `data-label`).
- No mobile, a `.sidebar` é `position:fixed; bottom:0; top:auto` (o `top:auto` é obrigatório — sem ele a barra estica pela tela toda).

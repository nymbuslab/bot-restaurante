# Hierarquia de heading duplicada no painel master (Médio #2 do AUDIT.md)

## Contrato de entrada

- **`public/admin.html`** (painel de empresa) — padrão correto de referência:
  - `admin.html:180`: `<h1 id="headerNome">Olá!</h1>` — nome da marca, dentro do `<header>`
    persistente (fica visível o tempo todo, não é escondido ao trocar de aba).
  - Cada aba usa `<h2>` para o título da seção, ex. `admin.html:199`
    (`<div class="tela-topo"><h2>Visão geral</h2>...`), e outras abas seguem o mesmo padrão
    (linhas 272 e 302 citadas pela auditoria, não relidas individualmente nesta base — mesmo
    padrão estrutural do `tela-topo`).
- **`public/admin-master.html`** (painel master) — padrão divergente:
  - `admin-master.html:124`: `<h1>Painel Master</h1>` — também dentro do `<header>` persistente
    (`admin-master.html:122-129`), mesmo papel que `headerNome` cumpre no `admin.html`.
  - CADA aba usa OUTRO `<h1 class="am-titulo">` para o título da seção — 4 ocorrências lidas:
    - `admin-master.html:137`: `<h1 class="am-titulo">Visão Geral</h1>` (aba Dashboard)
    - `admin-master.html:163`: `<h1 class="am-titulo">Clientes</h1>` (aba Clientes)
    - `admin-master.html:189`: `<h1 class="am-titulo">Monitoramento</h1>` (aba Monitoramento)
    - `admin-master.html:215`: `<h1 class="am-titulo">Configurações Master</h1>` (aba Config)
  - O `<header>` (com o primeiro `<h1>Painel Master</h1>`) NÃO é escondido quando a aba muda —
    é markup fixo fora do `<main>`/`<section class="aba">` que alterna `class="ativa"`. Logo, a
    qualquer momento existem DOIS `<h1>` simultâneos no DOM: "Painel Master" (header) + o título
    da aba ativa (ex. "Visão Geral").

## Contrato de saída

- Hoje: 2 `<h1>` na página do painel master a qualquer momento; leitor de tela e navegação por
  landmark/heading (usada por tecnologia assistiva para pular entre seções) veem dois "nível 1"
  concorrentes, quebrando a hierarquia esperada (1 `<h1>` por página).
- Esperado: as 4 ocorrências de `<h1 class="am-titulo">` viram `<h2 class="am-titulo">`,
  alinhando com o padrão já correto do `admin.html` (nome/marca fixo em `<h1>`, título de cada
  aba em `<h2>`).

## Limites e cotas

NÃO DOCUMENTADO (não se aplica).

## Erros conhecidos e tratamento

- Nenhum erro funcional. É puramente semântico/acessibilidade (ordem de headings).

## Riscos para a nossa implementação

- Trocar a TAG de `<h1>` para `<h2>` pode ter efeito visual se `.am-titulo` herdar algum estilo
  de tag (`h1 { ... }` no CSS global, `style.css:127`: `h1 { font-size: 15px; font-weight: 700;
  letter-spacing: -0.3px; }` vs. `h2 { font-size: 15px; font-weight: 700; }`,
  `style.css:128`) — as duas regras de tag têm o MESMO `font-size`/`font-weight`; a única
  diferença é `letter-spacing: -0.3px` exclusiva do `h1` (`style.css:127`). Trocar para `<h2>`
  perde esse tracking a menos que `.am-titulo` já sobrescreva isso com sua própria regra
  (`.am-titulo` não foi lida em detalhe nesta base — conferir na F3 antes de trocar a tag, para
  não introduzir uma mudança visual não intencional).
- É mudança de 4 pontos no mesmo arquivo (`admin-master.html`), sem tocar `app-admin.js` nem
  `style.css` A PRINCÍPIO — mas exige confirmar que nenhum seletor JS usa `h1.am-titulo`
  especificamente (por tag) em vez de `.am-titulo` (por classe) antes de trocar.

## Fonte

- `public/admin.html:178-199` (padrão de referência: `<h1 id="headerNome">` + `<h2>` por aba) —
  lido em 2026-09-05.
- `public/admin-master.html:120-217` (header persistente + as 4 ocorrências de
  `<h1 class="am-titulo">`) — lido em 2026-09-05.
- `public/style.css:127-128` (regras de tag `h1`/`h2` globais) — lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achado Médio #2) — lido em 2026-09-05.

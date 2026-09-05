---
exx_schema: 1
expx_tool: designx
kind: design_audit
origem: auditoria_automatica
veredito: REPROVADO
data: 2026-09-05
---

# Design system audit — auditoria geral do painel

Auditoria contra `docs/design-system/DESIGN-SYSTEM.md` (cartografia automática, `consistente: false`,
7 itens de drift já catalogados: breakpoints órfãos, espaçamento fora de escala, `--success`/`--error`
hardcoded, hex duplicando token, cor órfã do gradiente de login, botão ✕ sem SVG em 5 lugares,
comentário divergente do `.cupom-preview`). Os achados abaixo são adicionais — focados em boas
práticas de UI/acessibilidade, consistência de padrões e consequência real dos breakpoints órfãos —
e não repetem os 7 já registrados, exceto quando citados como contexto.

## Bloqueios (2)

1. `public/app.js:4847` (`const PEDIDOS_POR_PAGINA = 10;`) usado em `public/app.js:5291-5295` —
   paginação **fixa** da tela de Pedidos, a tabela mais usada do painel. Em qualquer monitor maior
   que um notebook, a tabela mostra 10 linhas e deixa metade da tela vazia enquanto o resto da
   lista exige clicar "próxima página".
   → Trocar por paginação adaptativa (calcular quantas linhas cabem na altura disponível, ou usar
   scroll infinito/"carregar mais").
   Por que importa: em monitor grande a tela fica pela metade; o operador do caixa/balcão perde
   tempo clicando "próxima" numa lista que caberia inteira.

2. Confirmação de exclusão sem o nome do item nas ações destrutivas mais comuns: `public/app.js:2258`
   (`confirmar("Excluir item?", "Esta ação não pode ser desfeita.", "Excluir")`), `public/app.js:344`
   ("Excluir categoria?"), `public/app.js:480` ("Excluir grupo?"), `public/app.js:7976` ("Remover
   esta mesa?"). O próprio código prova que sabe fazer certo: `public/app.js:1198` interpola o nome
   do produto na confirmação de "parar de controlar estoque", e `public/app.js:2204-2207`
   (`modalItemComVendas`) mostra o nome do item **só quando ele já tem vendas** — o caminho mais
   comum (item novo, sem venda ainda) é justamente o que sai sem nome.
   → Passar `item.nome`/`categoria.nome`/`grupo.nome`/`mesa.nome` para o título ou corpo do
   `confirmar(...)` em todos os fluxos de exclusão, replicando o padrão já usado em `app.js:1198`.
   Por que importa: numa lista de itens/categorias/mesas é fácil clicar no ícone de excluir da
   linha errada; sem o nome no diálogo, o usuário confirma "às cegas" e só descobre o erro depois
   de já ter apagado.

## Alto (6)

1. `public/app.js:105-119` (função `toast`) + `public/admin.html:1563`
   (`<div id="toast-container">`) — nenhum toast tem `role="status"`/`role="alert"` nem
   `aria-live`, e o container também não. Usuário de leitor de tela não é avisado de nada disparado
   por toast: erro ao carregar pedidos, sucesso ao salvar caixa, estorno, exclusão etc.
   → Adicionar `aria-live="polite"` (ou `"assertive"` para `tipo="erro"`) no `#toast-container`, ou
   `role="status"`/`role="alert"` em cada `.toast` criado.

2. `public/admin.html:1725` (`#qr-fechar`), `1746` (`#editor-fechar`), `1869` (`#cartao-fechar`) —
   os três usam o glifo `✕` (já citado no drift #6 do DS) **sem `aria-label`**, diferente de
   `public/admin-master.html:293` (`#am-t-fechar`, mesmo glifo, mas com `aria-label="Fechar"`).
   Leitor de tela anuncia esses três botões sem nome acessível (ou lê "multiplication sign").
   → Copiar o padrão já certo do `admin-master.html:293`: `aria-label="Fechar"` nos três.

3. `public/style.css:13` (`--text-secondary: #8B92B3`) sobre `public/style.css:7`
   (`--bg-overlay: #2A2E3F`) dá contraste ≈ 4,39:1, abaixo do mínimo AA de 4,5:1 para texto normal.
   Caso concreto: `public/style.css:5988`
   `.mesa-status-badge.s-livre { background: var(--bg-overlay); color: var(--text-secondary); }`
   (texto 10px/700 uppercase — não é "texto grande", então precisa dos 4,5:1). O mesmo par de
   tokens é a base de `.modal-caixa`/`.np-modal` (`style.css:2452-2467`), que hospedam texto
   secundário (`.sub`, `.campo-ajuda`) por cima.
   → Escurecer levemente `--bg-overlay` ou usar um tom de `--text-secondary` mais claro só quando
   sobre essa superfície (ex.: `#9AA1BF`, que já fecha ~4,6:1).

4. Ausência de estado de "carregando" nas 4 telas mais usadas do painel — todas escondem tudo e só
   populam ao final do fetch, sem spinner/skeleton no meio: Pedidos `public/app.js:4853-4868`
   (nenhum indicador enquanto `await api(...)` roda), PDV `public/app.js:5894-5895`, Mesas
   `public/app.js:7159-7168`, Caixa `public/app.js:3715-3717`. Numa conexão lenta ou num cold start
   do backend, o usuário vê a área de conteúdo em branco sem sinal de que algo está acontecendo.
   → Mostrar um estado `Carregando…` (o app já tem esse padrão pronto em `painelCarregando()`,
   `app.js:2067`, e em `app.js:1082`) antes do fetch, nas 4 telas.

5. Erro de rede/servidor é mostrado como se fosse o estado de negócio "sem caixa aberto":
   `public/app.js:5898` (`if (!r.ok) { $("pdvSemCaixa").hidden = false; return; }`) e
   `public/app.js:7179` (mesmo padrão em Mesas) caem na mesma tela que aparece quando o caixa está
   genuinamente fechado — cujo texto é literalmente "Abra o caixa para vender"
   (`public/admin.html:951`) / "Abra o caixa para usar Mesas" (`public/admin.html:1039`). Se o
   `/api/caixa` falhar por qualquer outro motivo (500, timeout), o operador é instruído a "abrir o
   caixa" quando o problema é de conexão/servidor.
   → Distinguir os dois casos: `!r.ok` mostra um estado de erro genérico ("Não foi possível
   carregar. Tente de novo.") e só a ausência real de caixa (`!data.caixa`) mostra a tela "Abra o
   caixa".

6. `public/app.js:2294-2386` (`renderCardapio`) não tem estado vazio real para tenant novo: se
   `cardapioAtual.categorias` está vazio, o `if (termo && totalMostrado === 0)` (linha 2382) nunca
   dispara porque `termo` é `""` (falsy) — o `#cardapioContainer` fica um `<div>` em branco, sem
   ícone, sem texto, sem call-to-action. A única orientação existe reativamente, só se o usuário
   clicar "Novo Item" (`public/app.js:3186-3189`, um toast de erro: "Crie uma categoria antes de
   adicionar itens."). Isso bate direto no fluxo de onboarding documentado no `CLAUDE.md` ("tenant
   nasce limpo, cardápio vazio") — é a primeira tela que todo restaurante novo vê.
   → Adicionar um `.estado-vazio` (o componente já existe e é usado em Pedidos/Faturas) com CTA
   "Criar sua primeira categoria" quando `categorias.length === 0`.

## Medio (5)

1. `.campo` (`public/style.css:1014-1026`) e `.auth-campo` (`public/style.css:224-236`) implementam
   o mesmo papel — label 11px/700/`--text-secondary`/uppercase/letter-spacing 0.5px — com CSS
   duplicado sob nomes diferentes. `.auth-campo` não fica só no shell de auth: é reaproveitado em
   `public/style.css:3796` (modal de caixa do master) e `4042` (wizard), então já não é "um
   componente por tela", são dois primitivos de formulário concorrentes no mesmo painel.
   → Unificar sob `.campo` (ou fazer `.auth-campo` herdar de `.campo` via seletor combinado) para
   eliminar a manutenção duplicada.

2. Hierarquia de heading inconsistente entre os dois painéis que compartilham o mesmo shell
   `.sidebar`: `public/admin.html:180` usa `<h1 id="headerNome">` só para o nome da marca
   (persistente) e cada aba usa `<h2>` (ex. `admin.html:199`, `272`, `302`); já
   `public/admin-master.html:124` também usa `<h1>Painel Master</h1>` persistente, mas cada aba
   usa **outro `<h1>`** (`admin-master.html:137`, `163`, `189`, `215`, classe `.am-titulo`) em vez
   de `<h2>`. Como o header persistente não é escondido ao trocar de aba, existem dois `<h1>`
   simultâneos na página no painel master.
   → Trocar as 4 ocorrências de `<h1 class="am-titulo">` por `<h2>`, alinhando com o padrão já
   correto do `admin.html`.

3. O estado vazio de busca no Cardápio usa markup próprio: `public/app.js:2382-2384`
   (`<p class="cardapio-vazio-busca">Nenhum item encontrado...`) em vez do componente padrão
   `.estado-vazio` (`public/style.css:2326-2349`) usado em Pedidos e Faturas — mesmo papel, visual
   diferente (sem ícone, sem `<span class="sub">`).
   → Reaproveitar `.estado-vazio` também aqui.

4. `button.mini` (`public/style.css:995`: `padding: 6px 12px; font-size: 12px`) resulta em ~30px
   de altura, abaixo da densidade documentada (~36px) do botão base (`style.css:955-959`). É a
   classe usada nas ações de linha de tabela (`data-edit-item`, `data-del-item` em
   `app.js:2360-2368`; `.pedido-acoes button.mini`, `style.css:3147`), que também aparecem no
   layout mobile (cards de pedido).
   → Se o alvo é mobile/toque, subir o padding vertical de `.mini` para bater ~32-36px, ou reservar
   `.mini` só para contextos claramente desktop/mouse.

5. Consequência concreta do drift #1 (breakpoints órfãos) no PDV: `.pdv` é
   `grid-template-columns: 140px 1fr 360px` (`style.css:5176`) e vira `116px 1fr 320px, gap: 14px`
   a partir de `@media (max-width: 980px)` (`style.css:5462`), só colapsando para 2 colunas em
   `@media (max-width: 860px)` (`style.css:5465`). Nessa faixa de 861–980px, a sidebar já está em
   200px (`style.css:877`, breakpoint 1100px) — sobra ~617-736px de conteúdo, menos ~464px de
   colunas fixas (116+320+gap 28px) = ~150-270px para a grade de produtos. O `.pdv-grid` usa
   `repeat(auto-fill, minmax(150px, 1fr))` (`style.css:5199`), exatamente no limite: nessa janela
   (comum em notebook com o painel não maximizado) a grade de produtos vira funcionalmente
   **1 coluna espremida** ao lado do carrinho de 320px, em vez do grid multi-coluna pretendido.
   → Alinhar o breakpoint do `.pdv` com o da sidebar (1100px, não 980px) ou reduzir a coluna fixa
   do carrinho nessa faixa.

## Baixo (1)

1. `public/admin.html:307` (`.cfg-subnav role="tablist"`) e `public/admin.html:1750-1753`
   (`.editor-tabs`/`.editor-tab`) implementam sub-seções via abas dentro de Configurações e do
   editor de item, em vez de rail lateral. Ressalva: o DS já documenta essa família
   (`.editor-tab`/`.filtro-chip`/`.pdv-cat`) como padrão estabelecido e reaproveitado 31 vezes
   (seção 4 do DS), e aqui o uso é para alternar seções **dentro de um modal/formulário** (não
   navegação entre telas do app, que já usa `.sidebar` como rail corretamente). Não reclassificado
   como bloqueio por isso; fica registrado para o caso de esse padrão crescer para navegação de
   tela inteira.

## Limpo

Foco de teclado (`:focus-visible` global em `style.css:75`, com halo próprio em inputs via
`box-shadow`), `role="dialog"`/`aria-modal`/`aria-label` em todos os modais verificados, `alt` em
imagens (inclusive as decorativas do cardápio público, que corretamente usam `alt=""` porque o nome
do produto já é texto visível ao lado), ausência real de emoji, e a hierarquia h1→h2→h3 dentro do
`admin.html` isoladamente.

## Veredito: REPROVADO

Fix de maior impacto: resolver o Bloqueio #2 (nome do item/categoria/mesa nas confirmações de
exclusão) — é uma mudança pequena e localizada (passar uma string a mais para `confirmar(...)` em
4 pontos, seguindo o padrão que `app.js:1198` já usa certo) e remove o risco mais direto de dano ao
usuário (apagar o item errado sem perceber) com o menor esforço de toda a lista.

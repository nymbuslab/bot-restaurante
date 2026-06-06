# Implementação do Painel — Dark UI
**Dev:** Isabela Costa | **Data:** 05/06/2026

## Arquivos Modificados

- `public/style.css` — redesign completo com design system dark
- `public/admin.html` — badge de status no header, toast container, modal de confirmação
- `public/app.js` — sistema de toast, modal async, badge de atendimento, auto-refresh de pedidos, botões sem onclick inline

## Mudanças Implementadas

### style.css
- Paleta dark completa (14 tokens de cor, sombras, radius)
- Header: fundo `--bg-surface` no lugar do verde, sem fundo colorido
- Nav: acento laranja nos botões ativos, sem fundo amarelo
- Cards, inputs, tabelas: fundo `--bg-surface`/`--bg-elevated`
- Cabeçalhos de tabela e categorias do cardápio: fundo `--bg-elevated` (removido amarelo)
- Botão primário: laranja `--accent` no lugar do verde
- `.tag-entrega` / `.tag-retirada`: cores semânticas (azul/verde)
- Sistema de toast `.toast.sucesso` / `.toast.erro` com animação
- Modal de confirmação `.modal-overlay` / `.modal-caixa` com animação
- `.badge-atendimento` no header (aberto/fechado)
- Scrollbar customizada para dark
- Spinner: `border-top-color: var(--accent)`

### admin.html
- Header dividido em `.header-esquerda` e `.header-direita`
- Badge `#badgeAtendimento` junto ao nome no header
- Removidos `onclick=""` inline dos botões de status
- Adicionado `#toast-container` ao final do body
- Adicionado `#modal-overlay` com estrutura completa

### app.js
- `toast(msg, tipo)` — novo sistema de toast com animação
- `flash()` — mantida compatibilidade, agora chama `toast()` também
- `confirmar(titulo, msg, txtBtn)` — modal async substitui `window.confirm()`
- `atualizarBadgeAtendimento(aberto)` — atualiza badge no header em tempo real
- `atualizarStatus()` — botões migrados de `onclick` inline para `addEventListener`
- `preencherConfig()` — chama `atualizarBadgeAtendimento()` ao carregar
- `cfgAberto` — listener atualiza badge em tempo real ao mudar checkbox
- `$("btnSalvarCardapio")` e `$("btnSalvarConfig")` — usam `toast()` no lugar de `flash()`
- Tabela de pedidos — usa tags coloridas `tag-entrega`/`tag-retirada`
- Auto-refresh de pedidos: `setInterval(15s)` ativo enquanto aba estiver visível
- Exclusão de categoria: usa `confirmar()` no lugar de `window.confirm()`
- Desconexão e reset do bot: usam `confirmar()` no lugar de `window.confirm()`

## IDs e Classes preservados
Todos os IDs e classes referenciados no app.js original foram mantidos:
`statusBox`, `cardapioContainer`, `pedidosContainer`, `pagamentosContainer`,
`btnSair`, `btnAddCategoria`, `btnSalvarCardapio`, `btnSalvarConfig`,
`btnAddPagamento`, `btnAtualizarPedidos`, `avisoCardapio`, `avisoConfig`,
`cfgNome`, `cfgTelefone`, `cfgHorario`, `cfgEndereco`, `cfgAberto`,
`cfgTempo`, `cfgTaxaEntrega`, `cfgBoasVindas`, `cfgFechado`, `cfgAtendente`, `cfgConfirmado`,
`.aba`, `.aba.ativa`, `.catNome`, `.itNome`, `.itPreco`, `.itDesc`, `.itComp`, `.itOpc`, `.itDisp`,
`[data-del-cat]`, `[data-del-item]`, `[data-add-item]`, `[data-pg]`, `[data-del-pg]`

# Design System — Bot Restaurante (Dark Premium)
**Designer:** Thiago Novaes | **Data:** 05/06/2026

---

## Tokens de Cor (CSS Variables)

```css
:root {
  /* Backgrounds */
  --bg-primary: #0F1117;       /* fundo da página */
  --bg-surface: #1A1D27;       /* cards, painel, nav */
  --bg-elevated: #222533;      /* inputs, hover de linha, dropdown */
  --bg-overlay: #2A2E3F;       /* modais, tooltips */

  /* Bordas */
  --border: #2E3247;            /* borda padrão */
  --border-subtle: #242738;     /* separadores internos */

  /* Textos */
  --text-primary: #F0F2FA;      /* texto principal */
  --text-secondary: #8B92B3;    /* subtextos, labels */
  --text-disabled: #4A5068;     /* desabilitado */
  --text-inverse: #0F1117;      /* texto sobre fundo claro */

  /* Acento — laranja quente (restaurante) */
  --accent: #F97316;            /* laranja — cor principal de ação */
  --accent-hover: #EA6A0A;      /* hover do acento */
  --accent-subtle: rgba(249,115,22,0.12);   /* fundo sutil com acento */
  --accent-rgb: 249, 115, 22;

  /* Status */
  --success: #22C55E;
  --success-subtle: rgba(34,197,94,0.12);
  --error: #EF4444;
  --error-subtle: rgba(239,68,68,0.12);
  --warning: #EAB308;
  --warning-subtle: rgba(234,179,8,0.12);
  --info: #3B82F6;
  --info-subtle: rgba(59,130,246,0.12);

  /* Sombras */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.6);

  /* Geometria */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
}
```

---

## Tipografia

```css
/* Font: Plus Jakarta Sans (já carregada) — manter */
/* Escala */
--text-xs:   11px;   /* labels uppercase, badges */
--text-sm:   12px;   /* metadata, timestamps */
--text-base: 14px;   /* corpo de texto */
--text-md:   15px;   /* subtítulos, nav */
--text-lg:   17px;   /* títulos de seção */
--text-xl:   20px;   /* títulos de página */

/* Pesos usados: 400, 500, 600, 700 */
/* Letter-spacing: uppercase labels → 0.5px; títulos → -0.3px */
```

---

## Componentes

### Header

**Estrutura:** barra fixa no topo, altura 56px, background `--bg-surface`, borda inferior `--border`.

```
┌─────────────────────────────────────────────────────────────────┐
│ 🍴 Bot Restaurante          [● ABERTO]              [Sair →]    │
│   text-md, 700               badge verde/vermelho    botão ghost │
└─────────────────────────────────────────────────────────────────┘
```

- Logo/nome: `--text-primary`, font-size `--text-md`, weight 700
- Badge de status `ABERTO/FECHADO`: pill com `--success`/`--error`, background sutil, 11px uppercase
- Botão Sair: ghost, borda `--border`, texto `--text-secondary`
- **Sem fundo verde** — o header usa `--bg-surface` para integrar com o tema dark

### Sidebar / Navegação

**Estrutura:** nav horizontal sticky abaixo do header, background `--bg-surface`, borda inferior `--border`.

```
┌──────────────────────────────────────────────────────────────────┐
│  [📱 Conexão]  [📋 Cardápio]  [⚙️ Config]  [📦 Pedidos  [3]]   │
│     ativo: underline laranja + texto --accent                     │
└──────────────────────────────────────────────────────────────────┘
```

- Botão inativo: `--text-secondary`, sem fundo
- Botão ativo: `--accent`, border-bottom 2px `--accent`
- Badge de pedidos: pill laranja `--accent` com count
- SVG icons: opacidade 0.6 inativo / 1.0 ativo

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
}
.card h3 {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 12px;
  margin-bottom: 16px;
}
```

### Inputs e Formulários

```css
input, textarea, select {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
}
input:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}
/* Labels */
.campo label {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### Botões

```css
/* Primário — acento laranja */
button {
  background: var(--accent);
  color: #fff;
  border: none;
}
button:hover { background: var(--accent-hover); }

/* Secundário — ghost */
button.secundario {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
}
button.secundario:hover {
  background: var(--bg-elevated);
  border-color: var(--text-secondary);
}

/* Perigo */
button.perigo {
  background: transparent;
  border: 1px solid transparent;
  color: var(--error);
}
button.perigo:hover {
  background: var(--error-subtle);
  border-color: var(--error);
}
```

### Tabela de Pedidos

```
┌─────────────────────────────────────────────────────────────────┐
│  #   │  Cliente         │  Itens    │  Total  │  Tipo  │  Quando │
│  bg: --bg-elevated, text: --text-secondary, uppercase 11px       │
├──────┼──────────────────┼───────────┼─────────┼────────┼─────────┤
│  42  │  João Silva      │  2x Marm  │  R$42   │  🛵    │  14:32  │
│      │  (11)99999       │  1x Frango│         │Entrega │         │
│  bg: --bg-surface; hover: --bg-elevated                          │
└─────────────────────────────────────────────────────────────────┘
```

```css
table {
  background: var(--bg-surface);
  border: 1px solid var(--border);
}
th {
  background: var(--bg-elevated);   /* substitui amarelo */
  color: var(--text-secondary);
}
tbody tr:hover td {
  background: var(--bg-elevated);
}
/* Tag entrega/retirada */
.tag-entrega { background: var(--info-subtle); color: var(--info); }
.tag-retirada { background: var(--success-subtle); color: var(--success); }
```

### Categorias do Cardápio

```css
.categoria-cabeca {
  background: var(--bg-elevated);   /* substitui amarelo */
  border-bottom: 1px solid var(--border);
}
.item-linha:hover {
  background: var(--bg-elevated);
}
```

### Status Box (Conexão)

Mantém a estrutura atual com `.bolinha` colorida, mas fundo `--bg-surface` e ícones de status em cores do design system:
- `.on` → `--success`
- `.off` → `--error`
- `.wait` → `--warning`

### Toast/Notificação

**Novo componente** substituindo o `flash()` atual:

```
┌────────────────────────────────────────┐
│ ✓  Cardápio salvo! Já está valendo.    │ ← posição: fixed, bottom: 24px, right: 24px
│    background: --success-subtle         │   border: 1px solid --success
│    border-radius: --radius              │   padding: 12px 16px
└────────────────────────────────────────┘
```

Animação: `slideInUp 0.2s ease` na entrada, `fadeOut 0.3s ease` na saída (após 4s).

### Modal de Confirmação

Substituir `window.confirm()` nativo:

```
┌─────────────────────────────────────┐
│           Excluir categoria?        │
│                                     │
│  Esta ação não pode ser desfeita.   │
│                                     │
│  [Cancelar]          [Excluir →]   │
└─────────────────────────────────────┘
```
- Overlay: `rgba(0,0,0,0.7)`
- Dialog: `--bg-overlay`, `--radius-xl`, `--shadow-lg`
- Botão confirmar: `button.perigo` com fundo `--error`

### Barra de Salvar (sticky)

```css
.barra-salvar {
  background: rgba(15, 17, 23, 0.92);   /* --bg-primary com alpha */
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}
```

---

## Layout Geral

```
┌──────── 100vw ────────────────────────────────────┐
│  HEADER (56px, sticky, z:100)                      │
│  🍴 Bot Restaurante  [● ABERTO]  [Sair]            │
├────────────────────────────────────────────────────┤
│  NAV (48px, sticky top:56px, z:99)                 │
│  [Conexão] [Cardápio] [Config] [Pedidos 3]         │
├────────────────────────────────────────────────────┤
│                                                    │
│  MAIN (max-width: 900px, margin: 0 auto)           │
│  padding: 28px 24px 80px                           │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  Conteúdo da aba ativa                     │   │
│  │  Cards em coluna única (formulários)       │   │
│  │  Ou tabela fullwidth (pedidos)             │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
├────────────────────────────────────────────────────┤
│  BARRA SALVAR (sticky bottom:0, apenas nas abas   │
│  com formulário)                                   │
└────────────────────────────────────────────────────┘
```

---

## Scrollbar Personalizada

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: var(--text-disabled); }
```

---

## Notas para Isabela Costa

1. **Manter todos os IDs e classes usados no `app.js`** — verificar antes de renomear qualquer classe.
2. O `flash()` existente deve ser **substituído** por um sistema de toast com `div#toast-container` fixed no canto inferior direito.
3. Adicionar badge de pedidos no nav requer uma contagem via API — Isabela deve avaliar se isso está no escopo do step ou deixar para próxima iteração.
4. O modal de confirmação substitui `window.confirm()` em `app.js:90` e `app.js:183` — mudança leve no JS também.
5. **Auto-refresh de pedidos**: `setInterval(carregarPedidos, 15000)` quando a aba pedidos está ativa — adicionar junto com o novo polling.

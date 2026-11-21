---
name: Nymbus Pedidos
description: Console de gestão para restaurante — escuro, denso, feito para operar sob pressão, não para admirar
colors:
  bg-primary: "#0F1117"
  bg-surface: "#1A1D27"
  bg-elevated: "#222533"
  bg-overlay: "#2A2E3F"
  border: "#2E3247"
  border-subtle: "#242738"
  text-primary: "#F0F2FA"
  text-secondary: "#8B92B3"
  text-secondary-fg: "#9AA1BF"
  text-disabled: "#4A5068"
  accent: "#6344BC"
  accent-hover: "#7150D0"
  accent-fg: "#A589EA"
  accent-subtle: "rgba(99,68,188,0.16)"
  secondary: "#73D2E6"
  secondary-hover: "#5BC2D8"
  secondary-subtle: "rgba(115,210,230,0.14)"
  success: "#22C55E"
  success-subtle: "rgba(34,197,94,0.12)"
  error: "#EF4444"
  error-hover: "#DC2626"
  error-fg: "#F87171"
  error-subtle: "rgba(239,68,68,0.12)"
  warning: "#EAB308"
  warning-subtle: "rgba(234,179,8,0.12)"
  info: "#3B82F6"
  info-subtle: "rgba(59,130,246,0.12)"
  white: "#FFFFFF"
  black: "#000000"
  whatsapp-green: "#25D366"
  backdrop: "rgba(0,0,0,0.6)"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  title:
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.5px"
  thermal-print:
    fontFamily: "'Courier New', monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  pill: "999px"
  badge: "20px"
  tag: "4px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.bg-surface}"
    rounded: "{rounded.md}"
    padding: "20px 22px"
  input:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
---

# Design System: Nymbus Pedidos

## Overview

**Creative North Star: "The Night Shift Console"**

Nymbus Pedidos é o painel que o dono e a equipe do restaurante abrem no pico do almoço e do jantar, com pressa e as mãos ocupadas. O tema é escuro fixo — nunca alternável — porque a tela fica aberta a noite inteira ao lado do fogão e do balcão, e uma interface clara nesse cenário cansa a vista e compete com o ambiente da cozinha. Densidade é uma escolha, não um descuido: cada tela cabe o que a operação precisa decidir em segundos (pedidos, caixa, mesas), sem rolagem desnecessária nem espaço vazio decorativo.

A marca aparece em dois acentos — roxo para ação, ciano para destaque secundário — e em nada mais. Não há gradiente de fundo, não há glow decorativo, não há emoji. Cor é sinal funcional antes de ser identidade: verde é "aberto"/sucesso, vermelho é "fechado"/erro, amarelo é aviso, azul é entrega. O roxo da marca nunca disputa com esses sinais semânticos.

A rejeição confirmada ao longo do projeto: nenhum brilho (`box-shadow` colorido sem offset), nenhuma faixa lateral grossa em card, nenhum emoji substituindo ícone, nenhum travessão como conector de frase na UI.

**Key Characteristics:**
- Escuro fixo, sem modo claro — a tela compete com a luz da cozinha/salão, não com o sol
- Densidade deliberada: tabelas e cards cabem o necessário para decidir rápido
- Dois acentos de marca (roxo + ciano), zero cor decorativa fora deles
- Cor sempre semântica primeiro: verde/vermelho/amarelo/azul nunca mudam de significado entre telas
- Sombra é sinal de elevação real (card, modal), nunca efeito gratuito

## Colors

Paleta deliberadamente contida: um acento de marca para ação, um secundário para destaque, quatro cores semânticas fixas. Nenhuma delas é intercambiável com outra.

### Primary
- **Deep Operator Purple** (`#6344BC`): preenchimento de botão primário, aba ativa, foco — sempre com texto branco por cima. É cor de **ação**, não de decoração; nunca aparece como texto/ícone solto sobre fundo escuro porque perde contraste ali (ver regra abaixo).
- **Deep Operator Purple, hover** (`#7150D0`): escurecimento do preenchimento primário no hover.
- **Deep Operator Purple, texto** (`#A589EA`): a mesma família, mas clara — é a ÚNICA forma correta de usar o roxo como cor de texto/ícone sobre fundo escuro. O roxo cheio (`#6344BC`) como texto cai para 4,0:1 em letras pequenas; esta variante sobe para 5,27:1+.

### Secondary
- **Service Cyan** (`#73D2E6`): acento secundário — links, gradiente de marca (ao lado do roxo). Nunca usado como substituto do roxo em botão de ação primária.

### Semantic (fixas — nunca reaproveitadas como cor de marca)
- **Success Green** (`#22C55E`): status aberto, confirmação, tag retirada.
- **Error Red** (`#EF4444`): preenchimento de erro, ícone grande de alerta. Como texto pequeno sobre fundo escuro, usar a variante clara **Error Red, texto** (`#F87171`) — o vermelho cheio em texto pequeno cai para 4,0:1, abaixo de AA.
- **Error Red, hover** (`#DC2626`): versão mais escura, usada em preenchimento de confirmação destrutiva (contraste melhor com texto branco do que o vermelho base).
- **Warning Yellow** (`#EAB308`): observação/aviso inline.
- **Info Blue** (`#3B82F6`): tag de entrega.

### Neutral
- **Void** (`#0F1117`): fundo da página, a camada mais funda.
- **Surface** (`#1A1D27`): cards, header, nav — a camada de conteúdo.
- **Elevated** (`#222533`): inputs, cabeçalho de categoria, hover de linha — um degrau acima da surface.
- **Overlay** (`#2A2E3F`): modal, input do simulador — a camada mais alta, reservada a conteúdo flutuante.
- **Border** (`#2E3247`) / **Border Subtle** (`#242738`): divisórias, nunca usadas para criar hierarquia de cor.
- **Text Primary** (`#F0F2FA`), **Text Secondary** (`#8B92B3`), **Text Secondary (sobre overlay)** (`#9AA1BF`), **Text Disabled** (`#4A5068`): escala de ênfase do texto, do mais lido ao mais apagado.
- **White** (`#FFFFFF`) / **Black** (`#000000`): únicas cores fora da paleta com uso sancionado — impressão térmica, QR code, preenchimento de marca e texto sobre preenchimento sólido (nunca decoração solta).
- **Backdrop** (`rgba(0,0,0,0.6)`): escurecimento por trás de modal/overlay.
- **WhatsApp Green** (`#25D366`): exceção única e deliberada — é a cor oficial do WhatsApp, usada só para identificar o canal, nunca como acento do produto.

### Named Rules
**The Fill-vs-Ink Rule.** Toda cor de marca ou semântica tem duas formas: uma cheia (preenchimento, com texto branco por cima) e uma clara (`-fg`, para quando a MESMA cor precisa ser o texto sobre fundo escuro). Nunca usar a forma cheia como cor de texto pequeno — ela foi calibrada para contraste como fundo, não como tinta.

**The No Orange Rule.** A marca é roxo + ciano. Laranja nunca aparece, nem como variação de aviso — amarelo já cobre esse papel.

## Typography

**Body Font:** Plus Jakarta Sans (com fallback `-apple-system, sans-serif`)

Fonte única em todo o produto — sem segunda família para títulos ou números. A mesma fonte que escreve o parágrafo escreve o rótulo e o título; a hierarquia vem de tamanho e peso, nunca de trocar de família.

**Character:** Geométrica, legível em alta densidade, numerais levemente estreitos — por isso toda coluna de número (valor, total, preço, quantidade) usa `font-variant-numeric: tabular-nums`, senão a coluna "dança" linha a linha.

### Hierarchy
- **Display** (700, 48px, line-height 1.1): número de métrica em destaque, headline da landing. Fora da operação diária — aparece só onde o número É o conteúdo.
- **Headline** (700, 20px, tracking -0.3px): título de tela no painel redesenhado (`.cardapio-titulo`, `.cfg-titulo`).
- **Title** (700, 16px): cabeçalho de seção redesenhado, com ícone `accent-fg` ao lado.
- **Body** (400, 14px, line-height 1.5): texto corrido, valor de célula, conteúdo padrão.
- **Label** (700, 11px, tracking 0.5px, uppercase): rótulo de campo, selo, badge, cabeçalho de tabela — a MENOR unidade de texto funcional do sistema; nada no produto vai abaixo de 11px.

### Escala fechada
A tipografia não usa uma progressão livre: existem exatamente 14 valores permitidos — 10/11/12/13/14/15/16px para interface (rótulo, botão, linha de tabela) e 18/20/24/32/40/48/56px para destaque (métrica, total, headline). Um tamanho novo em tela sai dessa lista; se o texto "precisa" de um valor fora dela, o problema é o layout, não a escala.

**Limite conhecido deste arquivo:** o frontmatter acima só representa 6 papéis (os 5 canônicos do Stitch + a exceção de impressão), não os 14 valores. A fonte de verdade da escala completa é `docs/design-system.md`; ferramentas que comparam `font-size` literal contra este frontmatter vão sinalizar os outros 8 valores (12/13/15/18/24/32/40/56px) como "fora do token" mesmo sendo válidos. Não é bug do produto.

**Thermal Print** (`'Courier New', monospace`, 12px): exceção proposital e única — `.cupom-print`/`.cupom-preview` espelham a métrica do papel térmico 80mm (48 colunas), nunca usar `--fonte-mono` nem Plus Jakarta Sans aqui.

### Named Rules
**The Eleven-Pixel Floor Rule.** Nenhum texto funcional (rótulo, botão, badge, célula de tabela) fica abaixo de 11px. Texto menor que isso falha em tela de alta densidade e sob pressa — exatamente o cenário de uso do produto.

## Layout

Grid de 3 colunas acima de 1024px, 2 colunas até 1024px, 1 coluna até 640px — aplicado a cards de métrica e grades de cardápio. Abaixo de 640px, a sidebar vira gaveta off-canvas e uma barra fixa inferior com 4 atalhos assume a navegação primária; tabelas viram cards por linha com rótulo embutido em vez de colunas.

Espaçamento em escala fechada de 7 degraus (4/8/12/16/20/24/32px) — qualquer `margin`/`padding` solto fora dessa lista é sinal de que faltou usar o token. Entre seções do painel, 22–26px; gap de grid, 16px; padding de card, 16–24px.

## Elevation & Depth

Sistema de três sombras neutras (`--shadow-sm/md/lg`), nunca coloridas. Sombra marca elevação REAL — um card está um degrau acima do fundo, um modal está acima de tudo — nunca é efeito decorativo. Não existe glow (halo colorido sem offset); essa era uma inconsistência pontual já corrigida, não um recurso do sistema.

### Shadow Vocabulary
- **sm** (`0 1px 2px rgba(0,0,0,0.4)`): elevação de card no nível base.
- **md** (`0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)`): card de login, toast.
- **lg** (`0 8px 32px rgba(0,0,0,0.6)`): modal — a camada mais alta do sistema.

### Named Rules
**The Real Elevation Only Rule.** Sombra existe para dizer "isto está mais perto de você", nunca para decorar um elemento plano. Se a elevação não é real, a sombra não deveria estar lá.

## Shapes

Quatro raios em escala fechada (6/10/14/18px), do controle pequeno ao container maior — nunca um valor intermediário. Pills de status e selo usam raio total (`border-radius: 999px` / `20px` conforme a altura). Tag pequena (etiqueta de item arquivado/destaque) usa `4px`, mais quadrada que a escala principal — aparece 3x com a mesma intenção, por isso é token, não exceção isolada. Bordas são sempre 1px sólida na cor `--border`; nunca borda lateral grossa colorida como acento decorativo de card (esse padrão foi identificado e removido do produto).

**The Half-Height Pill Rule.** Qualquer elemento cujo raio seja igual à metade da própria altura/largura é um pill geométrico (toggle, badge, barra de progresso, input arredondado) — nesses casos o valor correto é sempre `999px`, nunca um número calculado à mão que trava se o elemento mudar de tamanho.

## Components

Componentes nascem precisos e sem floreio: borda definida, sombra só onde indica elevação real, zero decoração que não carregue significado.

### Buttons
- **Shape:** raio pequeno (6px) em todos os tamanhos.
- **Primary:** preenchimento `accent` roxo, texto branco, 9px/16px de padding. Hover escurece para `accent-hover`.
- **Secondary:** fundo transparente, texto `text-primary`, borda `border`. Hover eleva para `bg-elevated`.
- **Danger (`.perigo`):** fundo transparente, texto `error`, sem borda em repouso. Hover preenche com `error-subtle` + borda `error`. Usado em TODA ação destrutiva, sem exceção, inclusive no painel master.
- **Mini:** mesma família, padding reduzido (6–9px) para linha de tabela/lista.

### Cards
- **Corner Style:** 10px.
- **Background:** `bg-surface`, borda `border` 1px.
- **Shadow Strategy:** `shadow-sm` sempre — é o degrau de elevação padrão do sistema.
- **Internal Padding:** 20px/22px.

### Inputs / Fields
- **Style:** fundo `bg-elevated`, borda `border` 1px, raio 6px, texto 14px.
- **Focus:** borda muda para `accent` + anel `box-shadow: 0 0 0 3px accent-subtle`. Nunca `outline: none` sem esse substituto.
- **Placeholder:** `text-secondary`, nunca `text-disabled` (contraste insuficiente, ~1,9:1).

### Navigation
- Item de nav: pill suave que preenche com `accent-subtle` + texto `accent-fg` quando ativo (nunca preenchimento sólido roxo — essa é a única exceção documentada ao padrão "preenchido = selecionado"). Indicador de ativo: barra de 3px que cresce à esquerda do item.
- Mobile (≤640px): sidebar recolhe para gaveta off-canvas; barra fixa inferior com 4 atalhos + botão Menu assume a navegação primária. Texto da barra inferior nunca abaixo de 11px (o piso do sistema).

### Status Pills (componente de assinatura)
Pill única por contexto (`selo-pag`, `tag`, `badge-atendimento`) com modificador de cor — nunca uma pill nova por tela para o mesmo significado. Cor sempre semântica: aberto/retirada = verde, fechado/cancelado = vermelho (na variante clara `error-fg`), entrega = azul. Texto pequeno em pill vermelha usa sempre `error-fg`, nunca `error` cheio.

## Do's and Don'ts

### Do:
- **Do** usar sempre as variáveis CSS — nunca hex fixo no HTML/JS inline.
- **Do** manter tamanho de fonte dentro da escala fechada de 14 valores.
- **Do** usar `accent-fg`/`error-fg` (nunca `accent`/`error` cheios) quando a cor de marca/semântica é TEXTO ou ÍCONE sobre fundo escuro.
- **Do** tratar sombra como sinal de elevação real, nunca decoração.
- **Do** manter o piso de 11px em todo texto funcional (rótulo, botão, badge, célula).

### Don't:
- **Don't** usar laranja em lugar nenhum — a marca é roxo + ciano, status é sempre semântico.
- **Don't** adicionar glow colorido (`box-shadow` sem offset) a qualquer elemento.
- **Don't** usar borda lateral grossa colorida como acento decorativo de card.
- **Don't** usar emoji na interface — ícones vêm de biblioteca SVG, um traço e peso consistentes.
- **Don't** criar uma pill de status nova por tela — reaproveitar `selo-pag`/`tag`/`badge-atendimento` com modificador de cor.

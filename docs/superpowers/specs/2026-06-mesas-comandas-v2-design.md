# Mesas e Comandas — Design (v2)

> Status: aprovado (brainstorming 2026-06-28). v1 completa com split, transferência,
> reabertura, QR code e layout responsivo mobile/desktop.

## Objetivo

Interface do módulo **Controle de Mesas** para vendas no salão: o operador visualiza
o mapa de mesas, abre mesas, lança pedidos (que imprimem na cozinha), e fecha a conta
com divisão por pessoa. Funciona em desktop e smartphone, otimizado para toque.

## Fluxo do usuário

```
Configurar mesas
  ↓
Mapa de mesas (grid de círculos)
  ↓ (clica numa mesa livre)
Abrir mesa
  ↓ (clica numa mesa ocupada)
Painel lateral da mesa
  ├── Aba "Itens" → ver rodadas, cancelar itens
  ├── Aba "Lançar" → grade de produtos → adicionar ao carrinho → confirmar pedido
  ├── [Solicitar Conta] → status "pediu_conta", bloqueia lançamentos
  ├── [Transferir] → escolher mesa destino → mover itens
  └── [Fechar Conta] → split → pagamento → fechar mesa
```

## Wireframes

### 1. Mapa de Mesas (Desktop)

```
┌──────────────────────────────────────────────────────┐
│  Mesas                              [⚙️ Configurar]  │
│                                                      │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                │
│  │ 01  │  │ 02  │  │ 03  │  │ 04  │                │
│  │     │  │     │  │     │  │     │                │
│  │R$0  │  │R$45 │  │R$0  │  │R$92 │                │
│  └─────┘  └─────┘  └─────┘  └─────┘                │
│  (cinza)  (verde)   (cinza)  (laranja)              │
│                                                      │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                │
│  │ 05  │  │ 06  │  │ 07  │  │ 08  │                │
│  │     │  │     │  │     │  │     │                │
│  │R$0  │  │R$120│  │R$0  │  │R$35 │                │
│  └─────┘  └─────┘  └─────┘  └─────┘                │
│  (cinza)  (roxa)   (cinza)  (verde)                 │
└──────────────────────────────────────────────────────┘
```

- **Grid responsivo:** 4 colunas no desktop, 3 no tablet, 2 no mobile
- **Círculo:** ~100px no desktop, ~80px no mobile
- **Número:** grande no centro
- **Status:** cor de fundo
- **Total:** abaixo do número (se ocupada), em R$
- **Selo "QR"** no canto (se QR já foi gerado)
- **Selo "!"** no canto (se pediu_conta)

### 2. Painel Lateral — Aba "Itens" (Desktop)

```
┌───────────────────────────────────┬──────────────────┐
│  Mapa de Mesas (encolhido)       │  Mesa 04          │
│                                   │  [🔄 Transf.] [❌]│
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐            │  Status: Pediu    │
│  │01│ │02│ │03│ │04│◄─── ativa   │  conta            │
│  └──┘ └──┘ └──┘ └──┘            │  Total: R$ 92,00  │
│                                   │                   │
│                                   │  ─ Itens ─────── │
│                                   │                   │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐            │  Rodada #1 (14h)  │
│  │05│ │06│ │07│ │08│            │  2x X-Burger   40 │
│  └──┘ └──┘ └──┘ └──┘            │  1x Batata F   15 │
│                                   │  2x Cerveja      │
│                                   │  ──────────────  │
│                                   │  Total: R$ 92 │  │
│                                   │                   │
│                                   │  [🧾 Sol. Conta] │
│                                   │  [💳 Fechar     ] │
│                                   │  [📋 Lançar]     │
└───────────────────────────────────┴──────────────────┘
```

- **Layout split:** grid de mesas à esquerda (25%), painel à direita (75%)
- **Mobile:** painel ocupa tela cheia, botão voltar no topo

### 3. Painel Lateral — Aba "Lançar" (reuso PDV)

```
┌───────────────────────────────────┬──────────────────────────────┐
│  Mapa de Mesas (encolhido)       │  Mesa 04  [📋 Itens│📝 Lançar]│
│                                   │                              │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐            │  [Todas] [Hamburg] [Bebidas] │
│  │01│ │02│ │03│ │04│◄───         │                              │
│  └──┘ └──┘ └──┘ └──┘            │  ┌──────┐ ┌──────┐ ┌──────┐ │
│                                   │  │X-Burg│ │X-Egg │ │X-Baco│ │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐            │  │R$20  │ │R$22  │ │R$25  │ │
│  │05│ │06│ │07│ │08│            │  └──────┘ └──────┘ └──────┘ │
│  └──┘ └──┘ └──┘ └──┘            │                              │
│                                   │  ┌──────────────────────┐   │
│                                   │  │ Carrinho (2 itens)   │   │
│                                   │  │ 2x X-Burger    R$40 │   │
│                                   │  │ 1x Cerveja     R$12 │   │
│                                   │  │ Total: R$ 52,00     │   │
│                                   │  │ [🛒 Lançar Pedido ] │   │
│                                   │  └──────────────────────┘   │
└───────────────────────────────────┴──────────────────────────────┘
```

- Mesma grade de produtos do PDV (`pdvGrid`) com busca e categorias
- Carrinho recolhível no canto inferior direito
- Ao clicar "Lançar Pedido": cria o pedido, imprime cozinha, limpa carrinho

### 4. Modal de Split

```
┌─────────────────────────────────────┐
│  Fechamento — Mesa 04              │
│                                     │
│  Total: R$ 92,00                   │
│  Desconto: [0,00]  [%] [R$]        │
│                                     │
│  ○ Dividir igualmente               │
│  │  Quantas pessoas? [2]            │
│  │  Pessoa 1: R$ 46,00             │
│  │  Pessoa 2: R$ 46,00             │
│                                     │
│  ● Dividir por produto              │
│  │  2x X-Burger    R$40 → [Pessoa 1]│
│  │  1x Batata F    R$15 → [Pessoa 1]│
│  │  2x Cerveja     R$37 → [Pessoa 2]│
│  │                                  │
│  │  Pessoa 1: R$ 55,00             │
│  │  Pessoa 2: R$ 37,00             │
│                                     │
│  [↩ Voltar]  [💳 Ir para Pagamento] │
└─────────────────────────────────────┘
```

- **Split igualitário:** input "Quantas pessoas?", calcula automaticamente
- **Split por produto:** cada item vira linha com dropdown (Pessoa 1/2/3...)
- Botão "+ Adicionar pessoa"
- Resumo por pessoa atualizado em tempo real
- Campo de desconto opcional (R$ ou %) no total da mesa

### 5. Modal de Pagamento

```
┌─────────────────────────────────────┐
│  Pagamento — Mesa 04               │
│                                     │
│  Total: R$ 92,00                   │
│  Desconto: − R$ 5,00               │
│  ───────────────────────────        │
│                                     │
│  Pessoa 1 — R$ 55,00               │
│  Forma: [Dinheiro ▼]               │
│  Valor recebido: [R$ 60,00]        │
│  Troco: R$ 5,00                    │
│                                     │
│  Pessoa 2 — R$ 37,00               │
│  Forma: [Cartão ▼]                 │
│  Valor recebido: [R$ 37,00]        │
│                                     │
│  [+ Adicionar forma]               │
│                                     │
│  ───────────────────────────        │
│  Total recebido: R$ 92,00          │
│                                     │
│  [↩ Voltar]  [✅ Finalizar e Fechar]│
└─────────────────────────────────────┘
```

- Reusa o modal de pagamento do PDV com adaptações
- Uma seção por pessoa (se split)
- Múltiplas formas por pessoa (botão "+")
- Troco calculado automaticamente no dinheiro
- Botão "Finalizar e Fechar" → transação de fechamento

### 6. Modal de Transferência

```
┌─────────────────────────────────────┐
│  Transferir itens — Mesa 04        │
│                                     │
│  Selecionar destino:               │
│                                     │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐             │
│  │01│ │02│ │03│ │05│             │
│  │  ●│ │  │ │  │ │  │             │
│  └──┘ └──┘ └──┘ └──┘             │
│  (ocup)                            │
│                                     │
│  Transferir todos os itens         │
│  [×] 2x X-Burger                  │
│  [×] 1x Batata Frita              │
│  [ ] 2x Cerveja (deixar)           │
│                                     │
│  [Cancelar]  [✅ Transferir]       │
└─────────────────────────────────────┘
```

- Mini-mapa mostra só as mesas ocupadas como destino
- Checkbox por item (desmarcado = fica na mesa atual)
- Botão "Transferir" move itens selecionados

### 7. QR Code

```
┌─────────────────────────────────────┐
│  QR Code — Mesa 04                 │
│                                     │
│       ┌───────────────┐            │
│       │   ██ ▄▄▄ ██   │            │
│       │   QR CODE     │            │
│       │   ─────────   │            │
│       └───────────────┘            │
│                                     │
│  Link: /c/restaurante?mesa=4       │
│                                     │
│  [📥 Baixar PNG]  [🖨️ Imprimir]   │
│  [↩ Fechar]                        │
└─────────────────────────────────────┘
```

- Gera QR code via `QRCode.toDataURL` (lib já instalada)
- Link aponta para o cardápio web com parâmetro da mesa
- Token HMAC assina o link (expira em 6h, renovável)

### 8. Mobile — Mapa de Mesas

```
┌──────────────────┐
│  ← Mesas   [⚙️] │
│                  │
│  ┌──┐ ┌──┐      │
│  │01│ │02│      │
│  │R$0│ │R$45│   │
│  └──┘ └──┘      │
│                  │
│  ┌──┐ ┌──┐      │
│  │03│ │04│      │
│  │R$0│ │R$92│   │
│  └──┘ └──┘      │
│                  │
│  ┌──┐ ┌──┐      │
│  │05│ │06│      │
│  │R$0│ │R$120│  │
│  └──┘ └──┘      │
│                  │
│  ┌──┐ ┌──┐      │
│  │07│ │08│      │
│  │R$0│ │R$35│   │
│  └──┘ └──┘      │
└──────────────────┘
```

- 2 colunas no mobile
- Toque longo ou menu de contexto para ações rápidas (se ocupada)
- FAB (botão flutuante) "+" no canto inferior direito = abrir nova mesa

### 9. Mobile — Painel da Mesa

```
┌──────────────────┐
│  ← Mesa 04       │
│  Total: R$ 92,00 │
│                  │
│  [📋 Itens│📝 Lan│
│  ─────────────── │
│                  │
│  Rodada #1 (14h) │
│  2x X-Burger     │
│  1x Batata Frita │
│  2x Cerveja      │
│                  │
│  ─────────────── │
│  Total: R$ 92,00 │
│                  │
│ ┌────────────────┐│
│ │ [🧾 Sol. Conta]││
│ │ [💳 Fechar    ]││
│ └────────────────┘│
└──────────────────┘
```

- Tela cheia (sem split de layout)
- Botão voltar no topo
- Abas "Itens" / "Lançar" como tabs horizontais
- Botões de ação no final, fixos (sticky bottom)

## Paleta de cores

| Elemento | Cor | CSS |
|----------|-----|-----|
| Mesa livre | Cinza claro | `#e0e0e0` ou `#f5f5f5` |
| Mesa ocupada | Verde | `#4caf50` |
| Mesa fechando | Roxa | `#9c27b0` |
| Mesa pediu_conta | Laranja | `#ff9800` |
| Texto número mesa | Branco | `#fff` |
| Sombra mesa | Elevação 2 | `box-shadow: 0 2px 8px rgba(0,0,0,.15)` |
| Hover/ativo | Escurecer 10% | `filter: brightness(.9)` |

## Responsividade

| Breakpoint | Colunas grid | Tamanho círculo | Layout painel |
|------------|-------------|-----------------|---------------|
| ≥ 1024px | 4-6 | 110px | Split (25%+75%) |
| 768-1023px | 3-4 | 90px | Split ou full |
| < 768px | 2-3 | 80px | Full screen |

## Acessibilidade

- Botões navegáveis por teclado (`Tab`, `Enter`, `Escape`)
- `aria-label` nos botões de ação
- Cores de status com suporte textual (não só cor)
- Modal focus trap (já implementada nos modais existentes)
- Rolagem suave no grid (`scroll-behavior: smooth`)

## Componentes reutilizados do PDV

| Componente | Reuso |
|-----------|-------|
| Grade de produtos (`pdvGrid`) | Aba "Lançar" |
| Busca de produtos (`pdvBusca`) | Aba "Lançar" |
| Modal de item (`pdvItemModal`) | Ao clicar em produto |
| Carrinho (`pdvCarrinho`) | Rodadas pendentes |
| Modal de pagamento (`pdvPagarOverlay`) | Fechamento |
| Stepper de quantidade | Modal de item |
| Seletor de opcionais/composição | Modal de item |

## Novos componentes

| Componente | Descrição |
|-----------|-----------|
| `mesaCard` | Círculo com número, status, total |
| `mesaGrid` | Grid responsivo de cards |
| `mesaPainel` | Painel lateral de detalhes da mesa |
| `mesaSplitModal` | Modal de divisão de conta |
| `mesaTransferModal` | Modal de transferência entre mesas |
| `mesaQrModal` | Modal de QR code |
| `mesaConfigModal` | Modal de configuração do layout |

## Notas de implementação

- **CSP:** QR code é gerado inline (data URL) — já permitido (`img-src: data:`)
- **Ícones:** usar SVGs inline (padrão do projeto)
- **Server-side rendering:** não — tudo client-side com API REST
- **Cache:** estado das mesas é sempre fresco (GET /api/mesas a cada visita à aba)
- **Som:** usar mesmo sistema de notificação sonora dos pedidos para novos lançamentos


# Cardápio Digital — Nymbus Pedidos

App de cardápio para bares/restaurantes. Cliente navega categorias, adiciona itens ao carrinho, preenche dados no checkout e finaliza enviando o pedido para o WhatsApp do restaurante via link `wa.me`.

## Escopo

- Frontend puro (sem backend)
- Dados do cardápio em mock estático
- Tema escuro fixo, design system Nymbus (roxo `#6344BC` + ciano `#73D2E6`, sem laranja)
- Tipografia Plus Jakarta Sans

## Estrutura de rotas

```text
src/routes/
  __root.tsx        (já existe — atualiza meta + carrega fonte via <link>)
  index.tsx         /          Cardápio + carrinho lateral
  checkout.tsx      /checkout  Formulário do cliente + resumo
  pedido-enviado.tsx /pedido-enviado  Confirmação pós-envio
```

## Telas

**1. Cardápio (`/`)**
- Header fixo: logo "Nymbus Pedidos", botão carrinho com badge de itens
- Barra de categorias horizontais com scroll (Entradas, Pratos, Bebidas, Sobremesas)
- Grid de produtos: imagem, nome, descrição curta, preço, botão "+ Adicionar"
- Drawer/Sheet de carrinho (shadcn `Sheet`): lista de itens com +/-/remover, subtotal, botão "Ir para checkout"

**2. Checkout (`/checkout`)**
- Resumo do pedido (itens, quantidades, total)
- Formulário (validação com zod + react-hook-form):
  - Nome (obrigatório)
  - Telefone (obrigatório, máscara BR)
  - Endereço completo (obrigatório, textarea)
  - Forma de pagamento (RadioGroup: Dinheiro / Pix / Cartão na entrega)
  - Troco para (condicional se Dinheiro)
  - Observações (textarea opcional)
- Botão "Enviar pedido pelo WhatsApp"
- Ao submeter: monta mensagem formatada, abre `https://wa.me/<numero>?text=<mensagem>` e navega para `/pedido-enviado`

**3. Pedido enviado (`/pedido-enviado`)**
- Confirmação com ícone, mensagem "Seu pedido foi enviado!" e botão "Voltar ao cardápio"
- Limpa o carrinho

## Estado

- `useCart` (Zustand com persistência em localStorage): `items`, `addItem`, `removeItem`, `updateQty`, `clear`, `total`
- Número do WhatsApp do restaurante: constante em `src/lib/config.ts` (placeholder editável)

## Mensagem do WhatsApp (formato)

```text
*Novo Pedido — Nymbus*

👤 Cliente: {nome}
📞 Telefone: {telefone}
📍 Endereço: {endereco}

🍽 Itens:
• 2x Hambúrguer Artesanal — R$ 60,00
• 1x Coca-Cola 350ml — R$ 7,00

💰 Total: R$ 67,00
💳 Pagamento: Dinheiro (troco p/ R$ 100)
📝 Obs: sem cebola
```

## Design system

- `src/styles.css`: substitui tokens do template pelos tokens Nymbus listados pelo usuário (mapeados em `@theme inline` para Tailwind v4: `--color-background`, `--color-card`, `--color-primary` = `--accent`, `--color-secondary` = ciano, `--color-border`, etc.)
- Plus Jakarta Sans via `<link>` no `__root.tsx` head (preconnect + stylesheet Google Fonts) e `--font-sans` em `@theme`
- Sem dark mode toggle — `html` sempre com classe `dark` (ou tokens dark direto no `:root`)
- Componentes shadcn já presentes: `button`, `card`, `sheet`, `input`, `textarea`, `radio-group`, `label`, `form`, `badge`, `sonner` (toasts)

## Mock de dados

`src/data/menu.ts`: 4 categorias, ~12 produtos com imagens (placeholder via `https://images.unsplash.com/...` ou geração de 1-2 imagens-hero apenas; produtos usam placeholders neutros)

## Detalhes técnicos

- `bun add zustand react-hook-form @hookform/resolvers zod`
- Formatação de moeda: helper `formatBRL` em `src/lib/format.ts`
- Máscara de telefone: função simples sem dependência extra
- Validação no submit; toasts de erro via `sonner`
- SEO: cada rota com `head()` próprio (title/description em PT-BR)

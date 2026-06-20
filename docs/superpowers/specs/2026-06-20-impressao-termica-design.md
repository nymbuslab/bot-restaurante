# Impressão de pedido em impressora térmica (80mm) — Design

**Data:** 2026-06-20
**Plano:** exclusivo do **Plano Completo**
**Status:** design aprovado, aguardando plano de implementação

## Problema

A cozinha precisa receber cada pedido **impresso em papel** para montar os pratos. Hoje o
pedido cai no painel (aba Pedidos + modal de "novo pedido"), mas não há como imprimir. A feature
deve ser **compatível com as impressoras térmicas 80mm não-fiscais do mercado** (Elgin i7/i8,
Epson T20x e similares — qualquer 80mm que suporte cupom de ~48 colunas) e ficar **disponível
apenas no Plano Completo**.

## Contexto da arquitetura (por que o caminho escolhido)

O app é **web stateless** — um navegador **não fala direto** com a impressora USB. Pesquisa de
mercado (iFood Gestor de Pedidos, POS/ERP web) mostra **3 caminhos** para a ponte navegador→térmica:

1. **Impressão pelo navegador** (HTML 80mm + `window.print()`, driver do SO rasteriza). Zero
   instalação, compatível com qualquer impressora com driver, casa com a CSP estrita e o front
   vanilla. É o modelo do iFood (sem PC dedicado, roda no painel que a atendente já usa).
2. **Agente local (QZ Tray / ESC/POS cru):** silencioso e com corte fino, mas exige instalar
   programa no PC + certificado + licença comercial.
3. **Serviço de impressão na nuvem (PrintNode/PushPrinter):** servidor dispara, imprime sem painel
   aberto, mas tem custo mensal por impressora + dependência de terceiro.

**Decisão (v1): caminho 1 — impressão pelo navegador.** Melhor encaixe no stack (stateless, CSP
estrita, front sem framework, restaurantes pequenos, sem custo extra por impressora). Caminhos 2 e
3 ficam anotados como evolução futura.

### Premissas confirmadas com o usuário

- **Sem PC dedicado na cozinha** por enquanto: a **atendente** vê o pedido no painel, **imprime** e
  leva o papel à cozinha. KDS (tela de cozinha) fica para depois.
- **Disparo manual:** botão **"Imprimir comanda"** por pedido (não auto-impressão no v1).
- **Duas vias por clique:** via **cozinha** (sem preços) + via **cupom** (completa).
- **Corte entre as vias é configurável** (toggle), padrão **vias juntas**.

## Escopo

### Dentro do v1

- Botão **"Imprimir comanda"** no **detalhe do pedido** (aba Pedidos) e no **modal de novo pedido**.
- Visível **somente no Plano Completo** (`planoAtual === "completo"`); Essencial vê **cadeado** com
  "disponível no Plano Completo" (padrão visual do frete por raio).
- Impressão de **2 vias** num documento 80mm:
  - **Via cozinha:** nº do pedido, hora, tipo (Entrega/Retirada), itens com quantidade,
    opcionais e observações. **Sem preços.**
  - **Via cupom:** nº, hora, cliente, telefone, tipo, endereço, itens com preço, subtotal, taxa de
    entrega, **total**, forma de pagamento.
  - Separador `✂- - -` entre as vias.
- **Toggle de corte** (Configurações → nova **sub-aba "Impressora"**, ao lado de Empresa/Bot/Entrega; bloqueada no Essencial):
  *"Cortar entre a via da cozinha e o cupom"* — padrão **desligado**.
  - Desligado → **1 trabalho de impressão**, vias juntas no mesmo papel; guilhotina corta só no fim.
  - Ligado → **2 trabalhos** em sequência (via cozinha, depois via cupom); a guilhotina corta
    automaticamente **entre** as vias (2 cupons separados).
- Persistência do toggle em `config.impressao.cortarEntreVias` (jsonb, via `PUT /api/config`).

### Fora do v1 (anotado como futuro)

- ESC/POS via QZ Tray (corte fino/silencioso, impressão sem painel aberto).
- Auto-impressão ao chegar o pedido (depende de Chrome em `--kiosk-printing`).
- Largura 58mm; escolher quais vias imprimir; tela de cozinha (KDS).

## Como funciona (fluxo)

1. Atendente vê o pedido (aba Pedidos **ou** modal de novo pedido) e clica **"Imprimir comanda"**.
2. `public/impressao.js` monta o HTML das vias (80mm, fonte monoespaçada) dentro de um container
   oculto `#area-impressao` no `admin.html`.
3. `window.print()` é chamado. Um CSS de impressão esconde o resto do painel e imprime só o cupom.

   ```css
   @media print {
     body > *:not(#area-impressao) { display: none !important; }
     #area-impressao { display: block; }
   }
   @page { size: 80mm auto; margin: 0; }
   ```

4. Na 1ª vez a atendente escolhe a térmica como impressora; o navegador lembra.
5. Se `cortarEntreVias` estiver ligado: imprime a via cozinha, e ao retornar imprime a via cupom
   (2 trabalhos → 2 cortes da guilhotina).

**Nada muda no backend de pedidos.** O pedido já está em memória no front (mesmo objeto usado pela
notificação de pedido novo). O único dado novo é o toggle em `config.impressao`, salvo pela rota
`PUT /api/config` já existente.

## Componentes

### Novo: `public/comanda.js` (pura, dual-mode — testável)

- `montarComanda(pedido, config)` → **função pura** que devolve `{ cozinha, cupom }` (strings de
  texto monoespaçado, linhas separadas por `\n`). Sem efeito colateral → testável isolada.
- Helpers de formatação 80mm (~48 colunas): linha separadora, alinhamento de valores à direita,
  quebra de itens com opcionais/observação, cabeçalho com `config.restaurante.nome`, `fmtBR(n)`.
- **Dual-mode** para rodar no browser *e* ser requerível no `node --test`: IIFE que expõe
  `window.Comanda` no navegador e `module.exports` quando `module` existe. O teste
  `test/comanda.test.js` faz `require("../public/comanda.js")`. Mantém **uma única fonte** da lógica
  (DRY) usada pela impressão e pelo teste.

### Novo: `public/impressao.js` (orquestração de impressão — browser)

- `Impressao.imprimir(pedido, config)` → injeta o texto das vias (em `<pre>`) no container oculto
  `#area-impressao` e chama `window.print()`; respeita `config.impressao.cortarEntreVias` (1 trabalho
  com as 2 vias × 2 trabalhos encadeados por `onafterprint`). Browser-only → validado por Playwright.

### Alterado: `public/admin.html`

- Container oculto `#area-impressao` para o conteúdo de impressão.
- Botão "Imprimir comanda" no modal de detalhe do pedido e no modal de novo pedido.
- Nova **sub-aba "Impressora"** na `.cfg-subnav` (botão `data-sub="impressora"` + painel
  `cfg-sub-impressora`) com o toggle (bloqueada no Essencial). O handler de sub-abas existente
  (genérico, em `app.js:1685`) já cobre a nova aba sem mudança.
- `<script src>` de `comanda.js` e `impressao.js` (JS externo — CSP estrita, sem inline).

### Alterado: `public/app.js`

- Liga os botões "Imprimir comanda" (via `addEventListener`, sem handler inline — CSP).
- Gating: mostra/oculta botão e seção conforme `planoAtual === "completo"`.
- Lê/grava `config.impressao.cortarEntreVias` no fluxo de salvar config.

### Alterado: `public/style.css`

- Regras `@media print` + `@page` do cupom 80mm; estilos da seção Impressão e do cadeado.

### Sem mudança

- Backend de pedidos (`src/pedidos.js`), `src/servidor.js` (salvo se decidirmos um gate redundante —
  não necessário, pois impressão é ação local).
- Schema do banco (sem migração; `config.impressao` é jsonb flexível).

## Layout das vias (referência)

```text
        *PIZZARIA DO JOÃO*
         COMANDA - COZINHA
================================
Pedido #123        20/06 14:35
Tipo: ENTREGA
--------------------------------
2x Burger X
   + Bacon
   + 2x Queijo Extra
   Obs: sem cebola

1x Refrigerante
--------------------------------
Obs. geral: entrega rápida
================================

   ✂- - - - - - - - - - - - - -

         PIZZARIA DO JOÃO
          CUPOM DO PEDIDO
================================
Pedido #123        20/06 14:35
Cliente: João Silva
Tel: (11) 98765-4321
Tipo: ENTREGA
End: Rua X, 42, apto 101
--------------------------------
2x Burger X              50,00
   + Bacon / 2x Queijo Extra
1x Refrigerante           5,00
--------------------------------
Subtotal:                55,00
Taxa entrega:             5,50
TOTAL:                   60,50
Pagamento: Pix
================================
```

## Tratamento de erros / casos de borda

- **Pedido sem opcionais/observação:** item em 1 linha; sem linha "Obs".
- **Retirada (sem endereço):** via cupom omite a linha de endereço; via cozinha mostra `Tipo: RETIRADA`.
- **Taxa de entrega 0:** linha de taxa **omitida** na via cupom (total continua exibido).
- **Acentuação:** o conteúdo é HTML rasterizado pelo driver, então acentos saem corretos (não há
  limitação de code page ESC/POS no caminho navegador).
- **Plano rebaixado (Completo → Essencial):** botão e seção somem no próximo carregamento do painel
  (gate por `planoAtual`).
- **Navegador sem impressora / cancelar diálogo:** sem efeito colateral; nenhum estado é gravado na
  impressão (a ação é puramente local).

## Testes

- **`node:test` (lógica pura):** `montarComanda` cobrindo — item com opcionais + quantidade,
  observação por item, observação geral, retirada × entrega, cálculo/exibição do total, taxa 0,
  acentuação. Segue o padrão de `test/`.
- **Visual (Playwright):** abrir o painel, disparar a impressão para **PDF** e conferir conteúdo e
  quebra em 80mm para os dois modos do toggle (vias juntas × 2 cupons). Sem hardware.
- `npm run check` (sintaxe) + suíte existente verdes.

## Documentação (parte da entrega)

- **`PROGRESSO.md`** — mover o item para ✅ Concluído ao fim.
- **`ROADMAP.md`** — o item *"Impressão (cupom de venda + comanda de cozinha)"* (Fase 3 / "duros")
  passa a **entregue parcialmente** pelo caminho navegador; ESC/POS (corte fino/silencioso, sem
  painel aberto) permanece como futuro.
- **`CLAUDE.md`** — citar impressão térmica como benefício do Plano Completo + novo `public/impressao.js`
  na árvore de arquivos e o campo `config.impressao`.
- **`docs/planos-e-frete.md`** — incluir impressão como segundo benefício do Completo (ao lado do
  frete por raio); documentar o gating (`planoAtual`/`temImpressao` se criado), o toggle de corte e
  o passo a passo do *kiosk-printing* (opcional) para impressão silenciosa.
- **`CHANGELOG.md`** — marco em linguagem observável.

## Decisões travadas

- **Caminho navegador** (não ESC/POS) no v1.
- **Disparo manual** por pedido (não auto).
- **2 vias** (cozinha sem preços + cupom completo) num clique.
- **Corte entre vias configurável**, padrão **vias juntas** (1 trabalho).
- **Gate no front** por plano (ação local; sem recurso de servidor a proteger).
- **Sem migração** de banco; toggle em `config.impressao` (jsonb).

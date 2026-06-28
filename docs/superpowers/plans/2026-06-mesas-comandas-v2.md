# Mesas e Comandas — Plano de Implementação (v2)

> Status: aprovado (brainstorming 2026-06-28). v1 completa com split, transferência,
> reabertura e QR code para o cliente.

## Objetivo

Módulo de **Controle de Mesas e Comandas** para vendas presenciais, complementando o PDV
e o cardápio web. Cada mesa agrega múltiplos pedidos (rodadas), que são lançados ao longo
do atendimento e consolidados no fechamento com split de conta.

## Decisões de design

- **Baseada no CardapioWeb** (principal concorrente): grid de círculos com cores de status,
  split por produto ou igualitário, transferência entre mesas, QR code na mesa.
- **Pedido por rodada:** cada lançamento vira um `pedido` independente com `mesa_id`,
  baixa de estoque na hora (mesma lógica do PDV). O fechamento consolida todos os pedidos
  da mesa.
- **Split só no fechamento:** itens não são atribuídos a pessoas no lançamento —
  a divisão acontece na hora de fechar a conta.
- **Reuso máximo:** grade de produtos, carrinho, modais de item, lógica de pagamento
  e impressão são reaproveitados do PDV.
- **Gate:** Plano Completo (`exigePdv` tem o mesmo gate — reusa `temPdv`). Exige caixa
  do dia aberto (mesma regra do PDV).
- **Grid visual:** círculos numerados organizados em grid (quantidade de colunas
  configurável), igual ao CardapioWeb.

## Modelo de dados

### Nova tabela `mesas`

```sql
CREATE TABLE mesas (
  id              SERIAL PRIMARY KEY,
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome            VARCHAR(20) NOT NULL,       -- "01", "Mesa 1", etc
  status          VARCHAR(20) NOT NULL DEFAULT 'livre',
                  -- livre | ocupada | fechando | pediu_conta
  total_consumido DECIMAL(10,2) DEFAULT 0,
  qr_code_token   TEXT,                       -- HMAC p/ link do cardápio web
  aberta_em       TIMESTAMPTZ,
  fechada_em      TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  ordem           INTEGER DEFAULT 0,          -- ordenação no grid
  UNIQUE(empresa_id, nome)
);

-- Pedido vinculado à mesa
ALTER TABLE pedidos ADD COLUMN mesa_id INTEGER REFERENCES mesas(id);
CREATE INDEX idx_pedidos_mesa ON pedidos(mesa_id);
```

### Núcleo do pedido de mesa

O pedido na mesa segue a mesma estrutura do PDV/cardápio web:
- `itens: [{ id, nome, preco, qtd, unidade, opcionais, composicao, variacoes, observacao }]`
- `status: 'novo'` (não recebido — `recebido_em` fica nulo até o fechamento)
- `mesa_id` aponta para a mesa
- `tipo_entrega: 'Balcão'` (padrão para mesa)
- Baixa de estoque atômica na criação (igual ao PDV)

### Cores de status (CardapioWeb)

| Status | Cor | Hex |
|--------|-----|-----|
| livre | Cinza | `#9e9e9e` |
| ocupada | Verde | `#4caf50` |
| fechando | Roxa | `#9c27b0` |
| pediu_conta | Laranja | `#ff9800` |

## Backend

### `src/mesas.js` — Lógica pura

Testável isolado em `test/mesas.test.js`:

```js
calcularTotalMesa(pedidos)
  // → soma de todos os `total` dos pedidos da mesa

dividirIgualitario(total, numPessoas)
  // → [{ pessoa: 1, valor }, { pessoa: 2, valor }, ...]
  // Distribui centavos corretamente (sem perder 1 centavo)

dividirPorProduto(pedidos, atribuicoes)
  // atribuicoes: [{ pedidoId, itemIndex, pessoa }]
  // → [{ pessoa, itens: [...], subtotal }, ...]

resumoFechamento(mesa, pedidos, split)
  // → { total, desconto, valorPorPessoa, totalPorForma, pagamentos }
```

### `src/mesas-db.js` — CRUD com Postgres

Isolado por `empresa_id` (padrão `pedidos.js`/`caixa.js`):

```
listar(dir)              → todas as mesas do tenant (c/ status, total, qtd pedidos)
criarEmLote(dir, nomes)  → insere N mesas de uma vez
remover(dir, mesaId)     → remove (só se livre)

abrir(dir, mesaId)            → status='ocupada', aberta_em=now()
atualizarStatus(dir, mesaId, s)  → ocupada/fechando/pediu_conta/livre
cancelar(dir, mesaId)         → status='livre', deleta pedidos pendentes

vincularPedido(dir, mesaId, pedidoId) → atualiza total_consumido
pedidosDaMesa(dir, mesaId)    → pedidos ordenados por id (mais antigo 1º)

transferir(dir, origemId, destinoId, pedidoId)
  → move pedido entre mesas, recalcula totais

receberFechamento(dir, mesaId, { desconto, pagamentos, split })
  → TRANSAÇÃO:
    1. Revalida mesa em 'fechando'
    2. Cria movimentos no caixa (1 por forma)
    3. Marca todos os pedidos como recebidos
    4. Fecha mesa (status='livre', total=0, fechada_em=now())
    5. Registra detalhe do fechamento (split + valores)

reabrir(dir, mesaId)
  → TRANSAÇÃO: reverte recebido_em dos pedidos, status='ocupada'

gerarQrToken(dir, mesaId)
  → HMAC-SHA256: { slug, mesaId, exp } → qr_code_token
```

### Rotas REST (`src/servidor.js`)

Gate: `exigeMesas(req, res)` — mesmo padrão de `exigePdv` (Plano Completo).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/mesas` | Lista mesas com status + total + contagem |
| POST | `/api/mesas/config` | Cria/remove em lote |
| POST | `/api/mesas/:id/abrir` | Abre mesa |
| POST | `/api/mesas/:id/pedido` | Lança itens (cria pedido + baixa estoque + imprime cozinha) |
| POST | `/api/mesas/:id/solicitar-conta` | Status → pediu_conta (bloqueia lançamentos) |
| POST | `/api/mesas/:id/fechar-conta` | Calcula split, devolve resumo p/ confirmação |
| POST | `/api/mesas/:id/pagar` | Recebe pagamento + fecha mesa |
| POST | `/api/mesas/:id/cancelar-pedido/:pedidoId` | Cancela 1 pedido/rodada |
| DELETE | `/api/mesas/:id` | Remove mesa (só se livre) |
| POST | `/api/mesas/:id/transferir/:destinoId` | Transfere itens |
| POST | `/api/mesas/:id/reabrir` | Reabre mesa fechada |
| GET | `/api/mesas/:id/qr` | QR code (data URL) |

**POST /api/mesas/:id/pedido** — fluxo:
1. Valida mesa ocupada e não está `fechando`
2. `pdv.recalcularVenda(cardapio, itens)` — recalcula preços
3. `store.baixarEstoqueTx(client, dir, itens)` — baixa atômica
4. Cria `pedidos` com `mesa_id`, `recebido_em = null`
5. `mesas-db.vincularPedido(dir, mesaId, pedidoId)` — atualiza total_consumido
6. Imprime comanda de cozinha (via agente ou modal)
7. Retorna o pedido

**POST /api/mesas/:id/pagar** — fluxo:
1. Valida mesa em `fechando` (passou pelo split)
2. `mesas-db.receberFechamento(dir, mesaId, dados)` — transação:
   - Cria `caixa_movimentos` (1 por forma, ligados ao caixa do dia)
   - UPDATE `pedidos SET recebido_em = now()` para todos da mesa
   - UPDATE `mesas SET status='livre', total_consumido=0, fechada_em=now()`
3. Imprime cupom fiscal
4. Retorna resumo do fechamento

### Impressão

- **Via cozinha:** ao lançar itens — `Comanda.montarCozinha(pedido, config)` → imprime
  automaticamente (se agente conectado) ou abre modal de impressão (navegador).
- **Cupom:** ao fechar a mesa — `Comanda.montarCupom(pedidoFinal, config)` com dados
  consolidados da mesa (nome da mesa, itens agrupados, split, total por pessoa).

Reusa `public/comanda.js` e `public/impressao.js` (nada novo).

## Frontend

### Aba "Mesas" na sidebar

Nova aba entre "PDV" e "Caixa":

```html
<button data-aba="mesas">Mesas</button>
<section class="aba" id="aba-mesas">
  <!-- Gate: lock / sem-caixa / vencido -->
  <div id="mesasConteudo" hidden>
    <div class="mesas-topo">
      <h2>Mesas</h2>
      <button id="mesasConfigBtn">⚙️ Configurar</button>
    </div>
    <div class="mesas-grid" id="mesasGrid">
      <!-- Cada mesa = .mesa-card -->
    </div>
  </div>
</section>
```

### Mapa de mesas (grid visual)

Cada mesa renderiza como um círculo/card com:
- Número central (`01`, `02`, ...)
- Cor de fundo conforme status (cinza/verde/roxa/laranja)
- Total consumido (se ocupada)
- Ícone de QR (se ocupada)

Ao clicar:
- **Livre:** abre modal de confirmação "Abrir mesa?" ou abre direto
- **Ocupada:** abre painel lateral de detalhes

### Painel lateral da mesa

Substitui a view principal (como o carrinho do PDV expande):

**Aba "Itens"** — lista todos os pedidos/rodadas:
```
Rodada #1 (14:32)
  🍔 2x X-Burger
  🥤 1x Refrigerante

Rodada #2 (15:10)
  🍟 1x Batata Frita
  🍺 2x Cerveja
───
Total: R$ 72,50
```

**Aba "Lançar"** — mesma grade de produtos do PDV (`pdvGrid`), com busca e categorias.
Ao adicionar item, abre o modal de item (reuso do `pdvItemModal`) e ao confirmar,
lança como novo pedido vinculado à mesa.

**Ações no topo:**
- Solicitar Conta (status → pediu_conta, bloqueia lançamentos)
- Transferir (abre seletor de mesa destino)
- Cancelar Mesa (libera tudo)

### Modal de Split e Fechamento

**Etapa 1 — Escolher split:**
- Split igualitário: input "Quantas pessoas?" → calcula por pessoa
- Split por produto: para cada item, dropdown de pessoa (Pessoa 1, Pessoa 2, ...)
  + botão "Adicionar pessoa"

**Etapa 2 — Confirmação:**
```
Pessoa 1: R$ 36,25
Pessoa 2: R$ 36,25
───
Total:    R$ 72,50
Desconto: R$ 0,00
```

**Etapa 3 — Pagamento por pessoa (opcional):**
- Cada pessoa pode pagar com forma diferente
- Se não especificar, o total vai como 1 pagamento único

### Modal de Pagamento (reuso)

Reusa o modal de pagamento do PDV (`pdvPagarOverlay`):
- Múltiplas formas de pagamento por pessoa
- Desconto (R$ ou %) no total da mesa
- Troco (dinheiro)
- Botão "Finalizar e fechar mesa"

### Configurar mesas

Modal de engrenagem:
- Grid de inputs para nome por mesa
- Botão "Adicionar mesa" / "Remover" (X)
- Slider de número de colunas (2 a 6)
- Botão "Salvar layout"

### QR Code

Modal que gera o QR via `QRCode.toDataURL` (lib já instalada) com o link:
```
/c/:slug?mesa=<ID>&token=<HMAC>
```
- QR para download (PNG) e impressão
- Ao escanear: cliente cai no cardápio web já vinculado à mesa

## Cardápio Web — Integração

- `cardapio.html` aceita `?mesa=ID&token=TOKEN` na URL
- Payload do `POST /api/c/:slug/pedido` inclui `mesa_id`
- Servidor associa o pedido à mesa:
  - Se mesa `livre` → abre automaticamente (`status='ocupada'`)
  - Se mesa `ocupada` → só vincula o pedido
  - Se mesa `fechando`/`pediu_conta` → rejeita
- Botão "Pedir minha conta" no cardápio web → `POST /api/c/:slug/pedir-conta`
  → servidor muda mesa para `pediu_conta` e avisa o painel

## Testes

`test/mesas.test.js`:

```js
// Lógica pura (src/mesas.js)
calcularTotalMesa — soma correta com pedidos
dividirIgualitario — 3 pessoas, centavos distribuem
dividirIgualitario — 1 pessoa = total
dividirPorProduto — 2 pessoas, itens diferentes
dividirPorProduto — item não atribuído vai pra "conta única"

// Validação de regras (src/mesas-db.js mockado)
abrir mesa já aberta → erro
lançar pedido em mesa fechando → erro
fechar mesa sem pedidos → erro (ou permite)
transferir pedido entre mesas
receber fechamento com pagamento zerado → erro
reabrir mesa fechada → ok
```

## Ordem de implementação

1. **Documentos:** plan `docs/superpowers/plans/` + design spec `docs/superpowers/specs/`
2. **Migration:** `20260628120000_mesas.sql` (sobrescreve a revert anterior)
3. **Módulo puro:** `src/mesas.js` + `test/mesas.test.js`
4. **Módulo DB:** `src/mesas-db.js`
5. **Rotas REST:** `src/servidor.js` (gate + todas as rotas)
6. **Frontend — aba + grid:** `admin.html` + `app.js` + `style.css`
7. **Frontend — lançar pedido:** reuso PDV grid + carrinho
8. **Frontend — split + fechamento + pagamento:** modais dedicados
9. **Frontend — transferir, reabrir, cancelar:** ações no painel
10. **QR code:** backend (HMAC) + frontend (gerar QR + cardápio web)
11. **Aplicar migration** no Supabase + validar testes

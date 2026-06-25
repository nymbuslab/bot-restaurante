# PDV — Entrega e frete na venda no local

**Data:** 2026-06-24
**Status:** aprovado (implementação)
**Contexto:** complementa `2026-06-24-pdv-vendas-local-design.md`.

## Problema

Cliente chega no balcão, faz o pedido, mas quer **entrega**. Hoje o PDV grava
toda venda como `Balcão` (sem endereço, frete 0). É preciso capturar, na hora de
finalizar, o **tipo da venda** (Balcão/Retirada/Entrega), o **endereço** e o
**frete** quando for entrega.

## Decisões (produto)

- **Tipos de venda:** `Balcão` (padrão) × `Entrega` × `Retirada`.
- **Frete:** **calculado** (fixo da config ou por raio via CEP) + **lixeira para
  zerar** (cortesia). O operador **não digita** o valor à mão.
- **Local:** dentro do modal **Finalizar venda** (o frete afeta o total).

## Reaproveitamento (nada novo de infra)

- `pedidos` já tem `tipo_entrega`, `endereco`, `taxa_entrega` (e `telefone`).
  **Sem migração.**
- `src/frete.js` já calcula frete **fixo** e **por raio** (Geoapify + cache).
- `public/endereco-cep.js` (`window.EnderecoCep`) já faz CEP→endereço + compor.
- `public/comanda.js` já imprime tipo + endereço + taxa → reimpressão em Pedidos
  sai correta sem mexer.

## Frontend (`public/admin.html` + `app.js` + `style.css`)

No modal **Finalizar venda** (`renderPdvPagar`):

1. **Seletor de tipo** no topo: `Balcão | Entrega | Retirada` (segmento estilo
   `.pdv-desc-tipo`). Estado em `pdvTipoEntrega` (default `"Balcão"`).
2. **Entrega** → bloco "Endereço de entrega" com botão que abre um overlay
   (`#pdvEntregaOverlay`) com o formulário: CEP (autopreenche via `EnderecoCep`),
   número, complemento, telefone, bairro, cidade, UF.
   - Frete **fixo**: aplica `taxaFixa` da config assim que escolhe Entrega
     (endereço só compõe o pedido).
   - Frete **raio**: com CEP+número, botão **Calcular frete** chama
     `POST /api/pdv/frete`. "Fora da área" → aviso, segue como cortesia (0).
   - Resumo do endereço fica visível no bloco; botão para editar reabre o overlay.
3. **Retirada** → sem endereço/frete; telefone opcional.
4. **RESUMO**: linha **Frete** (com lixeira para zerar) quando Entrega e frete>0.
   `Total = Subtotal − Desconto + Frete`. Pago/Falta/Troco e o campo de
   pagamento recalculam pelo novo total.

Estado novo: `pdvTipoEntrega`, `pdvEntrega` (`{ endereco, enderecoCampos,
telefone, taxaEntrega }` | null).

## Backend

### `POST /api/pdv/frete` (autenticada, `exigeAuth` + `exigePdv`)
Mesmo cálculo do cardápio, usando `req.tenantDir`:
- `freteDeConfig(config)`; se `modo==="raio"`: `geocodificar` + `calcularFreteRaio`.
- Body `{ cep, numero }`. Retorna `{ entrega_disponivel, distancia_km,
  valor_frete, foraDaArea, endereco }`. Modo `fixo`: retorna `valor_frete = taxaFixa`.

### `POST /api/pdv/vender`
Aceita `tipoEntrega`, `endereco`, `enderecoCampos`, `telefone`, `taxaEntrega`.
- Valida `tipoEntrega ∈ {Balcão, Retirada, Entrega}`.
- **Frete server-side (anti-fraude):** se `Entrega`, recalcula o frete pela config
  (fixo) ou por raio (geocode dos campos). Aceita do cliente **apenas** `0`
  (cortesia) **ou** o valor calculado; qualquer outro número é substituído pelo
  calculado. `Balcão`/`Retirada` → frete 0, endereço vazio.
- `total = subtotal − desconto + freteEfetivo`; `validarPagamentos(total, …)`.
- Chama `caixa.venderLocal(dir, { …, tipoEntrega, endereco, telefone, taxaEntrega })`.

### `src/pdv.js`
Puro. `recalcularVenda` segue retornando `{ itens, subtotal }`. O total com frete é
montado na rota (`aplicarDesconto(subtotal).total + frete`). Opcional helper
`totalComFrete(total, frete)` se ajudar a testar.

### `src/caixa.js` — `venderLocal`
Passa a gravar `tipo_entrega`, `endereco`, `telefone`, `taxa_entrega` recebidos
(hoje fixa `'Balcão'/''/0`). `total` já vem com frete. Retorna esses campos.

## Gating
- PDV inteiro é Plano Completo. Frete **por raio** exige Completo (já garantido).
- Sem config de frete (taxaFixa 0, sem raio) → Entrega registra endereço com
  frete 0.

## Fora de escopo
- Edição manual do valor do frete (decidido: só calculado + zerar).
- Roteirização/entregadores, status de entrega (sistema externo cuida do ciclo).

## Testes
- `src/pdv.js`/cálculo de total com frete (`test/pdv.test.js`).
- Validação visual do fluxo no painel (stub + Playwright): Entrega fixo, Entrega
  raio, lixeira zera, Retirada, Balcão.

# Composição selecionável (com regras por subgrupo)

**Data:** 2026-06-25
**Status:** Aprovado (design) — pronto para plano de implementação

## Problema

Hoje a **composição** de um item do cardápio é um campo de **texto** (subgrupos +
ingredientes) que é apenas **exibido** ao cliente — ele não escolhe nada. Restaurantes de
marmitex precisam que o cliente **selecione** os ingredientes dentro de cada subgrupo,
respeitando regras (ex.: "escolha 1 proteína", "até 3 acompanhamentos", "salada é
obrigatória"). Os **opcionais** (extras pagos) já são selecionáveis e somam preço — isso
continua igual.

## Escopo

**Muda:**
- Cadastro: cada subgrupo da composição ganha controles **obrigatório / mín / máx**.
- Dado: `composicao` deixa de ser texto e vira **estrutura** (array de subgrupos com regras).
- Cardápio web, PDV e comanda: a composição passa a ser **selecionável** pelo cliente.
- Servidor: passa a **validar** as escolhas de composição (fonte de verdade).

**NÃO muda:**
- Layout do modal de item no painel (apenas a adição dos 3 controles por subgrupo).
- Bloco **Opcionais**: mesmo lugar, mesma lógica (texto `Nome | preço`, pago, com steppers
  de quantidade no cardápio/PDV). Sem alteração.
- Bot/WhatsApp: o pedido é feito no cardápio web; o bot só manda o link.
- Planos: composição é parte do cardápio, disponível em **todos os planos** (sem gate).

**Premissa:** o banco de produção está **vazio** (sem tenants/itens) → **sem migração de
dados**; troca limpa do formato de `composicao`, removendo o caminho de texto antigo.

## Regras de seleção (composição)

- Cada subgrupo tem: `nome`, `obrigatorio` (bool), `min`, `max`, `itens` (lista de nomes,
  **sem preço** — composição é grátis).
- **máx = 1** → escolha única (radio). **máx > 1** → múltipla (checkbox), travando ao
  atingir o máx.
- Se `obrigatorio = true`, o `min` efetivo é no mínimo 1.
- Composição **não altera o preço** do item. Preço continua vindo só dos opcionais.

## Modelo de dados

### Item do cardápio (`empresas.cardapio`)

`composicao` passa de string para array estruturado:

```jsonc
"composicao": [
  { "nome": "Principais", "obrigatorio": true, "min": 1, "max": 3,
    "itens": ["Arroz", "Feijão", "Sem Feijão"] },
  { "nome": "Proteínas", "obrigatorio": true, "min": 1, "max": 1,
    "itens": ["Frango", "Carne"] }
]
```

`opcionais`: **inalterado** (string `"Nome | preço\nNome | preço"`).

### Linha do pedido (`pedidos.itens` jsonb)

A linha passa a guardar as escolhas de composição, além dos opcionais (que continuam
como hoje):

```jsonc
{
  "id": 10, "nome": "Marmitex P", "preco": 18.00, "qtd": 1,
  "composicao": [ { "grupo": "Principais", "itens": ["Arroz", "Feijão"] },
                  { "grupo": "Proteínas",  "itens": ["Frango"] } ],
  "opcionais": [ { "nome": "Bacon", "preco": 3.50, "qtd": 1 } ],
  "observacao": ""
}
```

## Componentes e mudanças por arquivo

### Cadastro — `public/admin.html` + `public/app.js`
- No construtor de composição (`renderEditorComposicao`), cada subgrupo ganha uma linha
  compacta: checkbox **Obrigatório** + inputs numéricos **mín** e **máx**. Layout atual
  preservado; apenas a adição desses controles.
- Estado `editorComposicao` passa de `[{nome, itens}]` para
  `[{nome, obrigatorio, min, max, itens}]`.
- `parsearComposicao`/`serializarComposicao` (texto) são substituídos por leitura/escrita
  direta do array estruturado no item (sem serializar para texto).
- Bloco e funções de **opcionais** permanecem intactos.

### Projeção pública — `src/cardapio-web.js` (`projetarCardapio`)
- Expor `composicao` estruturada via whitelist: `{nome, obrigatorio, min, max, itens:[string]}`.
- `opcionais` continua projetado como hoje (`parseOpcionais` → `[{nome, preco}]`).

### Cardápio web — `public/cardapio.js` (+ `cardapio.css`)
- Substituir o `formatComp` (exibição estática) por render **selecionável** dos subgrupos:
  radio (máx=1) ou checkbox (máx>1), com trava no máx e aviso "Escolha X" nos obrigatórios.
- Botão **Adicionar** desabilitado enquanto algum subgrupo obrigatório não atinge o `min`.
- Opcionais continuam com steppers de quantidade (inalterado).
- A linha do carrinho passa a carregar as escolhas de composição.

### PDV — `public/app.js` (modal de item do PDV)
- Mesmo render selecionável da composição e mesma trava de obrigatório/mín/máx.
- Opcionais inalterados. A linha do carrinho do PDV carrega as escolhas de composição.

### Servidor: recálculo + validação — `src/cardapio-web.js` + `src/pdv.js`
- `recalcularItens` (web) e `recalcularVenda` (PDV) passam a **validar** as escolhas de
  composição contra as regras do item-base: obrigatório cumprido, dentro de mín/máx, e cada
  item escolhido existe no subgrupo. Violação → erro (rejeita o pedido/venda).
- Preço **não** muda por composição; continua somando só os opcionais válidos.
- A validação pura (sem I/O) vai para um helper testável — `src/grupos.js` (novo módulo
  pequeno) — consumido por web e PDV.

### Pedido + comanda — `src/pedidos.js` + `public/comanda.js`
- `pedidos.salvarPedido` persiste a `composicao` escolhida na linha (já é jsonb).
- `comanda.js`: a **via da cozinha** imprime as escolhas de composição agrupadas por
  subgrupo (ex.: `Principais: Arroz, Feijão` / `Proteínas: Frango`) — é o que a cozinha
  precisa pra montar o prato. O **cupom** mostra os opcionais como hoje (com preço);
  composição é grátis, então não soma valor no cupom.

### Validação de payload — `src/validacao.js`
- Ajustar/garantir que `validarCardapio` aceita a `composicao` estruturada dentro do limite
  de tamanho existente. Sem novos limites rígidos além dos atuais.

## Tratamento de erros

- **Cliente (cardápio web/PDV):** botão Adicionar bloqueado até regras satisfeitas; trava de
  seleção no máx; mensagens claras por subgrupo obrigatório.
- **Servidor:** revalida tudo (não confia no cliente). Escolha inválida (item inexistente no
  subgrupo, abaixo do mín, acima do máx, obrigatório vazio) → resposta de erro, pedido/venda
  não é salvo.

## Testes

- **Novo** `test/grupos.test.js`: validação pura da composição
  - obrigatório sem escolha → erro
  - abaixo do `min` → erro
  - acima do `max` → erro
  - item escolhido fora do subgrupo → erro
  - seleção válida → ok; preço não é afetado pela composição
- Ajustar `test/cardapio-web.test.js` e `test/pdv.test.js` ao novo formato de `composicao`
  e ao payload de escolhas.

## Documentação

- Atualizar `docs/modelo-dados.md`: novo formato de `composicao` (estrutura + regras), o
  payload de escolhas no pedido, e a nota de que opcionais seguem inalterados.
- Atualizar a menção a composição no `CLAUDE.md` apenas se ficar desatualizada.

## Fora de escopo (YAGNI)

- Unificar composição e opcionais num único conceito (decidido manter separados).
- Quantidade por item na composição (cada item é marcado uma vez).
- Preço por ingrediente da composição (composição é grátis; extras pagos = opcionais).
- Migração de dados (banco vazio).

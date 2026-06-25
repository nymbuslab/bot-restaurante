# Grupos de opções no item (substitui Composição + Opcionais)

Data: 2026-06-25 · Status: aprovado (design)

## Objetivo

Permitir que o item do cardápio tenha **grupos de opções** que o cliente escolhe ao
pedir (ex.: marmitex → Proteínas, Guarnição, Salada). Substitui os campos atuais
`composicao` (texto fixo) e `opcionais` (texto "Nome | preço") por um único modelo de
grupos, com regras por grupo e opções que podem ser **grátis ou cobradas**.

Decisões aprovadas:
- **Sistema único de grupos** (remove `composicao` e `opcionais`).
- **Opção grátis ou cobrada** (`preco`, 0 = grátis).
- **Grupos por item** (não há biblioteca reutilizável nesta versão).
- **Aplica no cardápio web e no PDV** (cliente e operador montam igual).
- **Sem migração** (banco zerado no go-live).

## Modelo de dados (dentro do `cardapio` JSONB da `empresas`)

Cada item troca `composicao`/`opcionais` por `grupos`:

```json
{
  "id": 10, "nome": "Marmitex P", "preco": 18.00, "desc": "...",
  "disponivel": true, "unidade": "un", "estoque": 30,
  "grupos": [
    { "nome": "Proteínas", "min": 1, "max": 1,
      "opcoes": [ {"nome": "Frango", "preco": 0}, {"nome": "Picanha", "preco": 5.0} ] },
    { "nome": "Principais", "min": 0, "max": 3,
      "opcoes": [ {"nome": "Arroz", "preco": 0}, {"nome": "Feijão", "preco": 0}, {"nome": "Sem Feijão", "preco": 0} ] },
    { "nome": "Salada", "min": 1, "max": 1,
      "opcoes": [ {"nome": "Salada 1", "preco": 0}, {"nome": "Sem Salada", "preco": 0} ] }
  ]
}
```

Regras do grupo:
- `min` (inteiro ≥ 0): mínimo de opções a escolher. `min ≥ 1` = **obrigatório**.
- `max` (inteiro ≥ 1): máximo. `max = 1` → escolha **única** (radio); `max > 1` → **múltipla** (checkbox).
- `opcoes[]`: `{ nome, preco }` (`preco` numérico ≥ 0; 0 = grátis).
- "Sem Feijão"/"Sem Salada" são apenas opções de preço 0; exclusividade se resolve com `max = 1`.

Estoque permanece **no nível do item** (não por opção) nesta versão.

## Linha do pedido (NÃO muda a forma)

As escolhas do cliente são gravadas na linha como a lista `opcionais` que **já existe**:

```js
{ id, nome, preco, qtd, opcionais: [ { nome, preco, qtd, grupo } ], observacao }
```

- Cada opção escolhida vira um item de `opcionais` com `qtd: 1` e `grupo` (nome do grupo,
  para a comanda agrupar). Preço da linha = `(preco + Σ opcionais.preco × qtd) × qtd` —
  **idêntico ao cálculo de hoje**, então comanda, totais e caixa quase não mudam.

## Recálculo no servidor (fonte de verdade — anti-fraude)

`recalcularItens` (cardápio web, `src/cardapio-web.js`) e `recalcularVenda` (PDV, `src/pdv.js`):
1. Para cada item do payload, casa cada opção escolhida contra os `grupos` do item no cardápio.
2. **Rejeita** opção inexistente; **valida min/max por grupo** (ex.: obrigatório não atendido,
   excedeu o máximo) → erro amigável.
3. Usa os **preços do cardápio** (ignora o que o cliente enviou).
4. Monta a linha com `opcionais` (nome+preço+grupo) e o preço recalculado.

## Projeção pública (`projetarCardapio`)

Expõe `grupos` (nome, min, max, opcoes [nome, preco]) na whitelist — sem vazar campos internos.

## UI

- **Editor (painel, `public/app.js` + `admin.html`)**: bloco "Grupos de opções" no modal do item —
  adicionar/remover grupo (nome, obrigatório?, mín, máx) e, dentro, adicionar/remover opções
  (nome + preço com máscara `dinheiro.js`). Substitui os builders de composição/opcionais.
- **Cardápio web (`public/cardapio.{html,js,css}`)**: cada grupo vira uma seção; radio se `max=1`,
  checkbox senão; "+R$ X" nas pagas; total ao vivo; bloqueia adicionar enquanto grupos obrigatórios
  não estão completos (mín/máx).
- **PDV (`public/app.js`, modal de item)**: mesma lógica de escolha do cardápio.

## Comanda (`public/comanda.js`)

Imprime as escolhas **agrupadas por grupo** (ex.: "Proteínas: Picanha"). Via cozinha mostra as
escolhas; cupom mostra com os preços das opções cobradas.

## Validação (`src/validacao.js`)

`validarCardapio` ganha limites para grupos/opções (ex.: máx N grupos por item, máx N opções por
grupo) para não inflar o jsonb.

## Fora de escopo (futuro)
- Biblioteca de grupos reutilizáveis entre itens.
- Estoque por opção.
- Exclusividade avançada além de `max`.

## Etapas de implementação
1. Modelo + validação + recálculo puro (cardápio web e PDV) + testes.
2. Editor do item no painel.
3. Cardápio web (render + regras + preço + add ao carrinho).
4. PDV (modal de item com grupos).
5. Comanda (escolhas agrupadas).
6. Remover `composicao`/`opcionais` antigos + docs (CLAUDE.md, modelo-dados) + CHANGELOG/PROGRESSO.

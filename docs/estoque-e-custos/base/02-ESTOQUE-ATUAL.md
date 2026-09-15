# Estoque atual de produtos e variações

## Contrato de entrada

- Entrada manual, perda e contagem chegam por `POST /api/estoque/movimentos`; quantidade de entrada
  e perda deve ser maior que zero, enquanto contagem substitui o saldo. Fonte:
  `../../../src/servidor.js:2163-2219`.
- A primeira contagem liga o controle, inclusive com saldo zero; entrada e perda exigem controle já
  ativo. Fonte: `../../../src/store.js:151-163` e `../../../src/store.js:226-252`.
- Mínimo e desligamento possuem rotas próprias e não são movimentos de saldo. Fonte:
  `../../../src/servidor.js:2221-2288`.

## Contrato de saída

- `GET /api/estoque` retorna uma linha por produto e por variação, mais contadores de controlados,
  esgotados e baixos. Fonte: `../../../src/servidor.js:2121-2144`.
- `GET /api/estoque/movimentos` retorna extrato paginado e resumo dos últimos trinta dias. Fonte:
  `../../../src/servidor.js:2146-2160`.
- O saldo vigente é o campo `estoque` no JSONB do catálogo; `estoque_movimentos` é somente trilha.
  Fontes: `../../../public/estoque.js:14-25` e
  `../../../supabase/migrations/20260813120000_estoque_movimentos.sql:16-19`.

## Limites e cotas

- Produto suporta unidade ou quilograma; variação é sempre unidade. Fonte:
  `../../../public/estoque.js:27-31` e `../../../public/estoque.js:55-65`.
- Quilogramas são arredondados para três casas na lógica de estoque; unidades são inteiras. Fonte:
  `../../../public/estoque.js:27-31`.
- Extrato aceita no máximo cem linhas e usa trinta por padrão no adaptador; a interface pede vinte.
  Fontes: `../../../src/estoque-db.js:71-89` e `../../../public/app.js:1087-1088`.

## Erros conhecidos e tratamento

- Venda sem saldo é recusada antes da baixa e revalidada sob trava; o chamador converte a corrida em
  conflito. Fontes: `../../../public/estoque.js:94-115` e `../../../src/store.js:92-117`.
- Alterar saldo no editor gera movimento de ajuste; desligar controle descarta o saldo sem movimento.
  Fonte: `../../../public/estoque.js:432-478`.
- A tela mostra previamente se entrada soma, perda subtrai ou contagem substitui. Fonte:
  `../../../public/app.js:916-924` e `../../../public/app.js:1039-1055`.

## Riscos

- Compra mista terá de coordenar saldo JSONB de produto com saldo relacional de insumo.
- A trilha atual não guarda custo, valor total, linha de compra, fornecedor ou chave idempotente.
- A tabela permite `item_id` textual sem FK; reutilizá-la para múltiplos tipos de alvo aumenta risco
  de colisão e consultas ambíguas. Fonte:
  `../../../supabase/migrations/20260813120000_estoque_movimentos.sql:23-38`.

## Fonte

- `../../../public/estoque.js:1-517`
- `../../../src/store.js:92-268`
- `../../../src/estoque-db.js:1-138`
- `../../../src/servidor.js:2121-2288`

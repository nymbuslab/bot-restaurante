# Insumos e ficha técnica inertes

## Contrato de entrada

- A migration cria insumo com nome, unidade, saldo, mínimo, custo, arquivamento e vínculo obrigatório
  à empresa. Fonte: `../../../supabase/migrations/20260816210000_insumos.sql:28-39`.
- O motor puro normaliza unidades `un`, `kg` e `l`, converte `g` e `ml` na digitação e aceita saldo
  negativo. Fonte: `../../../public/insumos.js:24-60`.
- Ficha normalizada soma insumo repetido e descarta linha inválida ou não positiva. Fonte:
  `../../../public/insumos.js:62-85`.

## Contrato de saída

- O motor calcula consumo agregado dos itens já recalculados e devolve deltas negativos por insumo.
  Fonte: `../../../public/insumos.js:94-147`.
- O código pressupõe ficha em `item.ficha` e em `grupo.opcoes[].ficha`. Fonte:
  `../../../public/insumos.js:8-11`.
- Não existe saída operacional: `src/insumos-db.js`, rotas e tela ativa estão ausentes. Fonte:
  `../00-AUDITORIA-BASELINE.md:41-47`.

## Limites e cotas

- A migration aceita somente `un`, `kg` e `l`; mínimo não pode ser negativo. Fonte:
  `../../../supabase/migrations/20260816210000_insumos.sql:38-39`.
- Quantidade usa três casas e custo atual usa quatro; a decisão futura exige seis casas para custo.
  Fontes: `../../../public/insumos.js:37-39`,
  `../../../supabase/migrations/20260816210000_insumos.sql:34-35` e
  `../02-DECISOES-PENDENTES.md:58-83`.
- O plano anterior propunha até trinta linhas por ficha, mas ainda não existe enforcement
  operacional. Fonte: **NÃO DOCUMENTADO NO CÓDIGO ATUAL**.

## Erros conhecidos e tratamento

- Insumo órfão na ficha não quebra o cálculo puro; o comentário transfere o descarte ao banco, mas
  o adaptador de banco não existe. Fontes: `../../../test/insumos.test.js:144-147` e
  `../../../public/insumos.js:98-100`.
- O namespace `ins_<id>` proposto reutiliza `estoque_movimentos.item_id`, sem FK e sem tipo de alvo.
  Fonte: `../../../public/insumos.js:24-27`.

## Riscos

- A fundação inerte antecede as dezoito decisões atuais; não deve ser ativada sem revisão.
- Reusar `estoque_movimentos` por prefixo não atende custo histórico, integridade referencial nem
  consultas tipadas.
- A ficha no catálogo público precisa ser removida por projeção explícita antes de qualquer ativação.
- O índice de nome é parcial e não cobre arquivados, divergindo da regra aprovada.

## Fonte

- `../../../public/insumos.js:1-157`
- `../../../test/insumos.test.js:1-170`
- `../../../supabase/migrations/20260816210000_insumos.sql:1-67`
- `../02-DECISOES-PENDENTES.md:6-9`

-- Normaliza as grafias antigas de `caixa_movimentos.forma_pagamento`.
--
-- Antes de as formas virarem vocabulário fechado (14/07/2026), o campo era texto
-- livre. O histórico ficou com grafias que convivem: "Pix" e "PIX", "Cartão
-- Crédito" e "Cartão de Crédito", e um registro cuja forma é o resumo inteiro do
-- pagamento ("Pix R$ 12,00"). Qualquer soma por forma que cruze essa data conta a
-- mesma coisa em duas linhas.
--
-- NÃO é urgente e não muda nenhuma tela do dia a dia: o caixa agrupa por dia, e
-- os 68 caixas fechados guardam o relatório como TEXTO em `caixas.detalhe_fechamento`,
-- então reabrir um caixa antigo mostra o relatório congelado e não recalcula.
-- Nenhuma contabilidade fechada é reescrita aqui.
--
-- "Cartão (na entrega)" (39 registros) fica COMO ESTÁ, de propósito: pode ter sido
-- crédito ou débito e não há como saber. Escolher um seria inventar informação num
-- registro financeiro, e um relatório errado é pior que um relatório com nome antigo.
UPDATE caixa_movimentos SET forma_pagamento = 'PIX'
 WHERE forma_pagamento IS NOT NULL
   AND forma_pagamento <> 'PIX'
   AND forma_pagamento ILIKE '%pix%';

UPDATE caixa_movimentos SET forma_pagamento = 'Cartão de Crédito'
 WHERE forma_pagamento IS NOT NULL
   AND forma_pagamento <> 'Cartão de Crédito'
   AND forma_pagamento ILIKE '%cr%dito%'
   AND forma_pagamento NOT ILIKE '%d%bito%';

UPDATE caixa_movimentos SET forma_pagamento = 'Cartão de Débito'
 WHERE forma_pagamento IS NOT NULL
   AND forma_pagamento <> 'Cartão de Débito'
   AND forma_pagamento ILIKE '%d%bito%'
   AND forma_pagamento NOT ILIKE '%cr%dito%';

UPDATE caixa_movimentos SET forma_pagamento = 'Dinheiro'
 WHERE forma_pagamento IS NOT NULL
   AND forma_pagamento <> 'Dinheiro'
   AND (forma_pagamento ILIKE '%dinheiro%' OR forma_pagamento ILIKE '%esp%cie%');

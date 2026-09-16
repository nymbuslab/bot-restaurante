---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: extrato-geral-estoque
titulo: Extrato geral do restaurante (estoque)
tipo_trabalho: feature
fechado_em: 2026-09-16
modulo_afetado: [src, public, test]
arquivos_alterados: [src/estoque-db.js, src/servidor.js, public/admin.html, public/app.js, public/extrato-estoque.js, test/estoque-db-geral.test.js, test/integracao/estoque-extrato-geral.test.js, test/relatorios-aba-scaffold.test.js, test/extrato-estoque.test.js, test/design-system-carregando.test.js]
palavras_chave: [estoque, extrato, relatorios, movimentos, filtro-tipo, periodo, paginacao-cursor, plano-completo]
resumo: O dono agora vê todos os movimentos de estoque do restaurante numa tela só (aba Relatórios > Estoque), com filtro por tipo e por período, sem abrir produto por produto.
decisao_principal: "D-10 — o extrato entra como item real 'Estoque' dentro do acordeão 'Relatórios' já existente em admin.html, em vez de criar uma aba nova de nível principal (achado durante a geração do protótipo, corrigiu a premissa de D-02)"
risco_residual: "O índice existente (estoque_mov_data_idx) foi confirmado suficiente por EXPLAIN até 5.000 linhas sintéticas, não sob o volume real de produção — reavaliar se o volume por tenant crescer muitas ordens de grandeza. (A paginação por cursor em si já foi validada ao vivo com volume real de 26 movimentos, ver atualização de 2026-09-16 abaixo.)"
testes_adicionados: 27
---

# Fechamento — extrato-geral-estoque

## O que foi entregue

O dono agora vê todos os movimentos de estoque do restaurante (entrada, perda, contagem,
ajuste, venda, devolução) numa tela só — aba "Relatórios" → "Estoque" — com filtro por tipo
(multi-seleção, 4 tipos operacionais marcados por padrão) e por período (Hoje/7 dias/
Personalizado), paginada por cursor, sem precisar abrir produto por produto.

## Decisão principal

D-10 — o extrato entra como item real "Estoque" dentro do acordeão "Relatórios" que já
existia em `admin.html` (com 4 placeholders "Em breve"), em vez de criar uma aba nova de
nível principal como D-02 originalmente descrevia. Achado durante a geração do protótipo
Stitch (T-01.01): a F1/F2 não tinha visto esse acordeão já existente; a correção foi aprovada
pelo dono junto com o visual do protótipo.

## Risco residual

O índice existente (`estoque_mov_data_idx`) foi confirmado suficiente por `EXPLAIN ANALYZE`
contra 5.000 linhas sintéticas (T-02.01), não contra o volume real que um restaurante em
produção vai acumular — reavaliar se o volume por tenant crescer muitas ordens de grandeza.

**Atualização (2026-09-16, mesmo dia):** o "Carregar mais" (paginação por cursor além da
primeira página) foi validado ao vivo com volume real — tenant descartável no projeto de
testes, 26 movimentos de um produto — tanto no extrato geral (`Relatórios → Estoque`) quanto
na gaveta por produto (`Controle de estoque`, tela pré-existente): a segunda página carrega
sem repetir nem pular linha, e o botão some corretamente ao fim.

## Onde isto mexeu

- **Módulos:** src, public, test
- **Arquivos:** `src/estoque-db.js`, `src/servidor.js`, `public/admin.html`, `public/app.js`,
  `public/extrato-estoque.js`, `test/estoque-db-geral.test.js`,
  `test/integracao/estoque-extrato-geral.test.js`, `test/relatorios-aba-scaffold.test.js`,
  `test/extrato-estoque.test.js`, `test/design-system-carregando.test.js`
- **Testes adicionados:** 27

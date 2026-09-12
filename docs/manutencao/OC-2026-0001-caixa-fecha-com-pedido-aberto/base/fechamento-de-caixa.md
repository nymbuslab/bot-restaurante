---
expx_schema: 1
expx_tool: runx
kind: base_area
trabalho_id: OC-2026-0001
area: fechamento-de-caixa
modulo_afetado: [caixa]
atualizado_em: 2026-09-12
---

# Área de base — fechamento de caixa

## 1. Resumo

Fluxo do caixa do dia (Plano Completo): abertura, recebimento de pedidos, movimentações, estorno, resumo e fechamento com conferência. O fechamento é guardado por duas verificações: mesas abertas e pedidos "a receber" do próprio turno. A área do bug é a contagem "a receber".

## 2. Objetivos

- Caixa é único por empresa: a abertura não fecha caixa anterior, mas um caixa `vencido` (aberto em dia anterior) bloqueia o PDV até ser fechado.
- O fechamento NÃO pode acontecer com mesas abertas nem com pedidos a receber do turno, e — regra que esta ocorrência corrige — nem com pedidos a receber de dias anteriores.
- Conferência de fechamento por forma de pagamento (esperado × contado) e relatório 80mm.

## 3. Regras de negócio

- Contagem "a receber" usa `pedidos.recebido_em IS NULL` + `status <> 'cancelado'`.
- Escopo temporal ATUAL: `criado_em >= aberto_em` (início da abertura do caixa) — é desse recorte que a ocorrência trata.
- Pedidos com mesa: contados separadamente por `_contarMesasAbertas` (mesas abertas bloqueiam à parte).
- Pedido cancelado não bloqueia (regressão corrigida no passado); ver `7932262`.
- Formas de pagamento "a receber": pix/cartao/credo que ainda não receberam? (ver `receberPorPagamento`).
- Fechamento grava `detalhe_fechamento` (snapshot jsonb) para reimpressão.

## 4. Arquivos e funções

- `src/caixa.js`:
  - `_contarAReceber(empId, abertoEm)` (34-42): conta pedidos a receber criados desde `abertoEm` — recorte do turno. `WHERE mesa_id IS NULL AND status <> 'cancelado' AND recebido_em IS NULL AND criado_em >= $2`.
  - Comentário (44-46): decisão explícita de que pedidos a receber ANTERIORES ao turno não bloqueiam o fechamento (documentação do bug está AQUI).
  - `_contarMesasAbertas(empId)` (67-73): mesas abertas.
  - `caixaAberto(empId)` (78-88): caixa aberto + cálculo de `vencido` no fuso BR.
  - `resumo(empId, caixaAberto)` (486-536): usa `_contarAReceber` (linha 505) e `_resumoAReceberAntigos` (506) para exibir "pedidos a receber antigos" como aviso no resumo da tela.
  - `_resumoAReceberAntigos(empId, abertoEm)` (47-63): pedidos a receber criados ANTES de `abertoEm`.
  - `fecharCaixa(empId, operador, fechamento)` (727-862): lock `FOR UPDATE` (739-738), gates de mesas (744) e a receber (745-752) via `_contarAReceber(empId, caixa.aberto_em)` (749); grava relatório/fechamento.
- `src/servidor.js`: rota `POST /api/caixa/fechar` (2664) → `caixa.fecharCaixa`; `GET /api/caixa` (2524) → resumo; demais rotas do caixa (2524-2683).

## 5. Estrutura de dados envolvida

- Tabela `caixas` (`supabase/migrations/20260620120000_caixa.sql`, complementos `20260620130000` e `20260620140000`):
  - `id`, `empresa_id`, `aberto_em` (timestamptz), `fechado_em`, `fundo_troco`, `status ('aberto'|'fechado')`, `contado_dinheiro`, `contado_eletronico`, `diferenca`, `observacao`, `operador`, `obs_abertura`, `detalhe_fechamento` (jsonb).
  - Índice único parcial: 1 caixa aberto por empresa.
- Tabela `caixa_movimentos`: `caixa_id`, `empresa_id`, `tipo ('recebimento'|'sangria'|'suprimento')`, `forma_pagamento`, `valor`, `pedido_id`, `descricao`, `criado_em`.
- `pedidos.recebido_em` (timestamptz, null = a receber), `pedidos.status`, `pedidos.mesa_id`, `pedidos.criado_em`, `pedidos.origem`.
- Hardening padrão do projeto: RLS on + sem grants anon/authenticated (bloco 35-39 do 20260620120000_caixa.sql).

## 6. Proposta de alteração da área

- O guarda de fechamento passa a contar pedidos a receber de QUALQUER data (`_contarAReceberTotal` — sem limite inferior de `criado_em`).
- O resumo da tela mantém o comportamento atual (turno + aviso de antigos), sem mudança de UI.
- Mensagem de bloqueio continua "Há N pedido(s) com pagamento a receber. Receba todos antes de fechar o caixa."
- Atualizar os docs que descrevem a regra (ver `documentacao-da-regra.md`).

## 7. Riscos

- Risco de regressão visual no resumo (conter o aviso de antigos): mitigada mantendo `_contarAReceber` + `_resumoAReceberAntigos` intactos; só adiciona função nova.
- Bloqueio pode reter um fechamento se houver pedido a receber esquecido — é o comportamento desejado pelo usuário; o aviso continua guiando.
- Não revisar encerramento: LOW.

## 8. Mudanças recentes na área

- `6292a54 feat(caixa): bloqueia fechamento com pedidos do turno a receber` (introduziu o recorte por turno).
- `7932262 fix(caixa): pedido cancelado nao trava mais o fechamento + mesa separada de delivery`.
- `2f61585 fix(caixa): avisa pedidos antigos a receber` (resumo + aviso sem bloquear).
- Migrações de extensão do caixa: `20260704130000_caixa_valor_pago_troco.sql`, `20260830150000_indice_caixa_movimentos_pedido.sql`.

## 9. Dívidas e janelas

- `PROGRESSO.md:679` (varredura 2026-08-24) registrou o mesmo achado em PRODUÇÃO (pedido a receber de 10/07 + caixa aberto 22/08) e a decisão então tomada de NÃO bloquear — o usuário agora reverte essa decisão.

## 10. Considerações de segurança / LGPD / compliance

- Sem dados pessoais novos expostos. Operações apenas no backend (conexão privilegiada); nenhuma rota pública.
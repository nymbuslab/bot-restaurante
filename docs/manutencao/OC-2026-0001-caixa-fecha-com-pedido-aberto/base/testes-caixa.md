---
expx_schema: 1
expx_tool: runx
kind: base_area
trabalho_id: OC-2026-0001
area: testes-caixa
modulo_afetado: [testes]
atualizado_em: 2026-09-12
---

# Área de base — testes que tocam a regra do caixa

## 1. Resumo

Cobertura atual do fechamento do caixa: integração real (Postgres descartável) e unitários com `db.query` stubado. O teste de integração que hoje ASSEVERA o comportamento antigo é o que será transformado em regressão.

## 2. Objetivos

- Montar a TDD: o teste certo precisa estar VERMELHO antes do fix e VERDE depois.

## 3. Regras de negócio testadas

- Fechar com pedido do turno a receber → 400 (bloqueia).
- Fechar com pedido a receber ANTIGO → HOJE 200 (NÃO bloqueia) — asserção que será invertida.
- Fechar com mesa aberta → 400.
- Caixa não fecha com vendas do turno a receber nem mesa aberta (contrato da doc).

## 4. Arquivos e funções

- `test/integracao/caixa.test.js`:
  - Linha ~212: teste "pedido antigo a receber avisa, mas não bloqueia o fechamento de hoje" — com `pedidosAReceber=0` esperado no fechamento e assert 200. **Vira o teste de regressão desta ocorrência** (esperar 400 + renomear).
  - Linhas ~220-223: asserções do resumo antigos (`pedidosAReceberAntigos.quantidade=1`, `.total=TOTAL_PEDIDO`, `.maisAntigoEm`).
  - Linhas 98/129/148: casos que dependem de não haver pedidos antigos no turno.
- `test/caixa-trava.test.js`: unitário com `db.query`/`client.query` stubados; linha 38 stub de `/FROM pedidos/`; não exercita `fecharCaixa` — nova query de contagem sem quebra.

## 5. Dublês / fixtures

- Em `test/caixa-trava.test.js`: stub `db.query` retornando linhas vazias para pedidos (contagem 0); se `fecharCaixa` fosse exercitado com consulta nova, retornaria 0 (não falsa bloqueio).
- Em integração: fixtures reais via `tenant.criarEmpresa("caixa", { plano: "completo" })`, criar pedido e backdate via `UPDATE pedidos SET criado_em = now() - interval '2 days'`.

## 6. Proposta de alteração

- Inverter o teste da linha 212: renomear para "pedido antigo a receber também bloqueia o fechamento do caixa" e asserir 400 com erro `/a receber/i`. Mantém as asserções do resumo (219-223).

## 7. Riscos

- Falso vermelho: o teste novo deve falhar ANTES do fix (hoje devolve 200). Verificar.
- Falso verde: rodar apenas esse arquivo NÃO garante; devido ao `*` no final das chamadas de função (INTEGRAÇÃO roda TODA a suíte desse arquivo e de `mesas.test.js`). Rodar os dois.

## 8. Mudanças recentes na área

- Original da suíte de integração criado junto do caixa (2026-06) e aceite da bateria (`test/integracao/`).
- Sem mudanças de teste desde então que toquem a regra de antigos.

## 9. Dívidas e janelas

- Não há teste de unidade do `fecharCaixa` com `_contarAReceber` (integrado real cobre). Ok.

## 10. Considerações de segurança / LGPD / compliance

- Bateria exige `.env.test` apontando para Postgres descartável com `BANCO_DE_TESTE=1`; o runner recusa produção. Não tocar em dados reais.
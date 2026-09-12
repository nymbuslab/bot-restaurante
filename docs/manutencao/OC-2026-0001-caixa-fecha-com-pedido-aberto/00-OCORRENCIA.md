---
expx_schema: 1
expx_tool: runx
kind: ocorrencia
trabalho_id: OC-2026-0001
titulo: Caixa fecha com pedido em aberto
tipo_ocorrencia: bug
recebido_em: 2026-09-12
origem: conversa
tem_reproducao: true
modulo_afetado: [caixa, pedidos]
atualizado_em: 2026-09-12
---

# OC-2026-0001 — Caixa fecha com pedido em aberto

## Identificação

| Campo | Valor |
|---|---|
| identificador | OC-2026-0001 |
| titulo | Caixa fecha com pedido em aberto |
| tipo | bug |
| aberta em | 2026-09-12 |

Tipo ambíguo entre `bug` e `regra-de-calculo`; escolhido `bug` porque o comportamento instalado diverge da regra esperada do produto ("o caixa não fecha com pedido a receber") e o relato chega como defeito; a mudança de regra decorre da correção.

## Relato original do cliente

> vi um erro no projeto, o caixa fechou mesmo com pedido aberto isso deveria ser bloqueado e nao permitir caixa fechar com pedido em aberto, principalmente de dias anteriores

## Passos de reprodução

NÃO DETERMINADO no chamado. Reprodução reconstruída no E1 a partir do mecanismo de código e da fixture de teste já existente (`test/integracao/caixa.test.js:212-227`):

1. Abrir o caixa do dia.
2. Ter um pedido a receber criado em dia/turno ANTERIOR à abertura do caixa (ex.: Comanda ou Retirada de ontem, `recebido_em IS NULL`, `mesa_id` nulo, `status <> 'cancelado'`).
3. Fechar o caixa — resultado observado: fecha (200); esperado: deve bloquear (400) com a mensagem de "a receber", principalmente quando o pedido é de dia(s) anterior(es).

## Ambiente, versão e dados relevantes

- **Ambiente:** NÃO DETERMINADO no chamado. Há caso equivalente registrado na produção em `PROGRESSO.md:679` (pedido a receber de 10/07, R$ 6,00, com caixa aberto de 22/08).
- **Versão:** NÃO DETERMINADO.
- **Usuário/perfil:** dono do restaurante (Plano Completo, caixa é feature do Completo) — inferido do relato.
- **Dados envolvidos:** NÃO DETERMINADO.
- **Evidências anexadas:** NÃO DETERMINADO.
---
expx_schema: 1
expx_tool: runx
kind: base_area
trabalho_id: OC-2026-0001
area: documentacao-da-regra
modulo_afetado: [docs]
atualizado_em: 2026-09-12
---

# Área de base — documentação da regra "não fecha com vendas a receber"

## 1. Resumo

A regra de fechamento do caixa está descrita em 5 docs vivos. Esta ocorrência muda a regra (antigos também bloqueiam), então todos precisam ser atualizados juntos — fonte única de verdade é o código, os docs descrevem.

## 2. Objetivos

- Não deixar doc contradizendo o novo comportamento.

## 3. Regras de negócio (texto atual → novo)

- Atual: "não fecha com vendas do turno a receber"; pedido antigo = aviso sem bloquear.
- Novo: "não fecha com vendas a receber (do turno ou de dias anteriores)"; o resumo continua mostrando aviso informativo dos antigos.

## 4. Arquivos e funções (linhas exatas)

- `docs/planos-e-frete.md:303-308` — regra + parágrafo do aviso de antigos.
- `docs/arquitetura.md:33` — regra de fechamento.
- `docs/modelo-dados.md:396-401` — regra + explicação do recorte e do aviso.
- `PRD.md:116` — requisito "Não fecha com venda do turno a receber nem com mesa aberta".
- `CLAUDE.md:186` — resumo da feature caixa (linha do gate).
- `PROGRESSO.md` — entrada `679` (histórico da varredura; NÃO apagar); fechar a decisão em aberto registrada na mesma entrada.

## 5. Estrutura de dados envolvida

N/A (docs). Vínculo: `pedidos.recebido_em`/`pedidos.criado_em` descritos em `docs/modelo-dados.md`.

## 6. Proposta de alteração

- Reescrever o texto dos 4 docs + `CLAUDE.md` para: bloqueia QUALQUER pedido a receber; mantém o aviso no resumo.
- `PRD.md:116`: ampliar a frase.
- `PROGRESSO.md`: adicionar item concluído desta ocorrência (OC-2026-0001) e assinalar a decisão antiga como revertida.

## 7. Riscos

- Doc desatualizado (menor). Atualização manual de 6 arquivos; conferir com `rg` por termos "a receber" no `docs/` após o fix para não deixar menção antiga.

## 8. Mudanças recentes na área

- Documentação da regra escrita junto do caixa (2026-06) e do aviso de antigos (2026-07/08).

## 9. Dívidas e janelas

- Nenhuma adicional.

## 10. Considerações de segurança / LGPD / compliance

- N/A.
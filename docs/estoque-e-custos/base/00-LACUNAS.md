# Lacunas encontradas na base atual

## Bloqueiam a arquitetura executável

1. **Identidade relacional de produto.** Produtos vivem em `empresas.cardapio` e não possuem chave
   estrangeira disponível para itens de compra, vínculos de fornecedor ou fichas. É preciso definir
   um alvo tipado e validar sua existência sob a mesma trava da operação. Fontes:
   `../../../supabase/migrations/20260612115133_init_schema.sql:13-20` e
   `../../../src/store.js:104-117`.
2. **Serviço único de movimentação.** O saldo de produto é JSONB e o saldo de insumo é relacional;
   uma compra mista precisa atualizar ambos, custos e documento numa única transação, com ordem de
   travas definida. Hoje não existe esse orquestrador. Fonte: `../00-AUDITORIA-BASELINE.md:102-116`.
3. **Histórico de custo.** `estoque_movimentos` não registra custo, valor de estoque, documento ou
   linha de origem. Não existem tabelas de compras, fornecedores ou custo histórico. Fontes:
   `../../../supabase/migrations/20260813120000_estoque_movimentos.sql:23-43` e
   `../00-AUDITORIA-BASELINE.md:41-47`.
4. **Snapshot de venda por ficha.** `pedidos.itens` preserva itens vendidos, mas ainda não guarda a
   versão da ficha, custo dos insumos e destino de cancelamento exigidos pelas decisões aprovadas.
   Fontes: `../../../src/pedidos.js:56-95` e `../02-DECISOES-PENDENTES.md:379-392`.
5. **Idempotência de compra.** Não há chave idempotente nem restrição equivalente para confirmação,
   importação ou reenvio. Fonte: `../02-DECISOES-PENDENTES.md:157-184`.
6. **Precisão do custo.** A migration inerte usa `numeric(12,4)`, enquanto a decisão aprovada exige
   seis casas para custo unitário. Fontes:
   `../../../supabase/migrations/20260816210000_insumos.sql:28-39` e
   `../02-DECISOES-PENDENTES.md:58-83`.
7. **Unicidade global de insumo.** O índice atual é parcial para registros não arquivados; a regra
   aprovada exige nome único por empresa, sem diferenciar maiúsculas, inclusive arquivados. Será
   necessária auditoria de colisões antes da troca. Fonte:
   `../../../supabase/migrations/20260816210000_insumos.sql:43-51`.
8. **Retenção legal/operacional.** O job atual apaga movimentos de estoque após doze meses; compras,
   custos e documentos foram definidos para cinco anos. Fontes: `../../../index.js:117-130` e
   `../02-DECISOES-PENDENTES.md:624-657`.

## Precisam de contrato antes de implementação

- estados e transições exatas de compra, devolução, estorno e ajuste de custo;
- modelo de fornecedor, documento, itens, apresentação, conversão e rateio;
- lock ordering entre empresa, compra, alvos de estoque e movimentos;
- resposta de conflito para vínculo, nome duplicado e saldo negativo;
- fonte de verdade do custo vigente e histórico;
- formato de snapshot de ficha no pedido;
- transição segura entre `estoque_proprio` e `consumo_por_ficha`;
- política de leitura no rebaixamento de plano e permissões futuras por papel;
- estratégia de feature flags por tenant e rollback sem apagar dados;
- plano de migração do legado inerte de Insumos sem ativá-lo acidentalmente.

## Não documentado no sistema atual

- cadastro operacional de fornecedores;
- compras, contas a pagar ou importação XML;
- código interno, GTIN e vínculo produto-fornecedor;
- inventário valorizado e razão de custo;
- papéis separados para consultar custo, confirmar compra ou estornar;
- produção, lote e rendimento real;
- backup lógico automatizado e restauração ensaiada.

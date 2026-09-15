# Tasks — Sprint 08

```yaml
id: T-08.01
titulo: Especificação executável de Insumos e ficha
objetivo: Atualizar o plano da próxima entrega com alvos tipados, compras de insumo, snapshot de ficha e modo exclusivo.
arquivos:
  cria: [docs/insumos/ARQUITETURA-POS-COMPRAS.md]
  altera: [docs/insumos/00-DECISOES.md, PROGRESSO.md, ROADMAP.md]
teste_integracao: A especificação associa cada contrato futuro a uma fixture e ponto transacional existentes.
teste_funcional: Os casos de venda, cancelamento e saldo negativo declaram entradas e saídas exatas.
criterio_aceite: O documento elimina uso novo de `ins_<id>` e impede produto e insumo de baixarem juntos.
depende_de: [T-07.04]
paralelizavel: false
status: pendente
```

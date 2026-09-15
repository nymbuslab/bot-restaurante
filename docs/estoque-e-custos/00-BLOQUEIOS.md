# Bloqueios do programa Estoque e Custos

## Ativos

- **P0-B — recuperação antes de migration ou ativação em produção.** Não aplicar migrations novas
  nem ativar Compras, Insumos ou baixa por ficha em produção até existir dump lógico criptografado,
  cópia separada do Storage e restauração ensaiada fora de produção. A arquitetura, os contratos,
  os testes e o protótipo podem avançar. Fonte: `01-PLANO-DE-ESTABILIZACAO.md:32-65`.

## Regras desta etapa

- A base SprintX é somente documental e não autoriza migration, alteração de saldo ou escrita em
  dados reais.
- Qualquer divergência entre a base e o código deve ser resolvida pela inspeção do código antes da
  implementação.

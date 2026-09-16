---
expx_schema: 1
expx_tool: sprintx
kind: bloqueios
trabalho_id: estoque-e-custos
atualizado_em: 2026-09-16
bloqueios:
  - id: P0-B
    task: null
    aberto_em: null
    resolvido_em: 2026-09-16
    descricao: Recuperacao (backup criptografado + restauracao ensaiada) antes de migration ou ativacao em producao. Resolvido; ver secao "Resolvidos" abaixo.
---

# Bloqueios do programa Estoque e Custos

## Ativos

_(nenhum bloqueio ativo no momento)_

## Resolvidos

- **P0-B — recuperação antes de migration ou ativação em produção.** ✅ Resolvido em 2026-09-16.
  Os três critérios foram atendidos: dump lógico criptografado (`pg_dump --schema=public
  --no-privileges` + `age`), cópia separada dos objetos do Storage, e restauração ensaiada fora de
  produção (contra o projeto Supabase de testes, com dados reais conferidos — 18 tabelas,
  `empresas` e `pedidos` com contagem batendo). Backup diário automatizado via
  `.github/workflows/backup.yml`, enviado ao Cloudflare R2. RPO ~24h, RTO ~1h. Detalhe em
  `01-PLANO-DE-ESTABILIZACAO.md` (Etapa B) e [../gotchas.md](../gotchas.md). Migrations novas e
  ativação de Compras/Insumos/baixa por ficha em produção não dependem mais deste bloqueio.

## Regras desta etapa

- A base SprintX é somente documental e não autoriza migration, alteração de saldo ou escrita em
  dados reais.
- Qualquer divergência entre a base e o código deve ser resolvida pela inspeção do código antes da
  implementação.

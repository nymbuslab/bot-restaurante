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
  - id: B-01
    task: T-04.04
    aberto_em: 2026-09-16
    resolvido_em: 2026-09-16
    descricao: npm run test:integracao (23 arquivos, --test-concurrency=3) falhava intermitentemente por "canceling statement due to statement timeout" (57014) em testes de OUTROS arquivos (principal-autenticado.test.js), apos a Sprint 04 somar 4 arquivos novos e mais pesados de integracao. Nao era bug nos modulos novos (todos passam isolados e em conjunto); era o teto de conexao do Session pooler do projeto Supabase de teste sendo estourado com mais carga. Resolvido baixando --test-concurrency para 2 em scripts/test-integracao.js; suite completa rodou limpa depois (124 passed, 0 failed).
---

# Bloqueios do programa Estoque e Custos

## Ativos

_(nenhum bloqueio ativo no momento)_

## Resolvidos

- **B-01 — suíte de integração falhando por contenção de conexão.** ✅ Resolvido em 2026-09-16
  (T-04.04). `npm run test:integracao` (23 arquivos, `--test-concurrency=3`) começou a falhar de
  forma intermitente com `error: canceling statement due to statement timeout` (57014) em testes
  de arquivos que a Sprint 04 não tocou (`principal-autenticado.test.js`), depois que os 4 novos
  arquivos de integração desta sprint (fornecedores/financeiro, cada um com vários
  `db.pool.connect()` transacionais + criação de tenant via Supabase Auth) somaram carga ao
  Session pooler do projeto Supabase de teste. Confirmado NÃO ser bug nos módulos novos: os 4
  arquivos passam limpos isolados e em conjunto; e um arquivo pré-existente não relacionado
  (`pedidos-comanda.test.js`) também bateu no mesmo teto no mesmo run. Corrigido baixando
  `--test-concurrency` de 3 para 2 em `scripts/test-integracao.js`; suíte completa (124 testes)
  rodou limpa depois disso, duas vezes.
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

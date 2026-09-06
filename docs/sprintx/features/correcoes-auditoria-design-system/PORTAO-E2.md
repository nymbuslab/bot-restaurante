```
mergex E2 — PORTÃO DE PRONTIDÃO (reauditoria)
Trabalho: correcoes-auditoria-design-system   Branch: feature/correcoes-auditoria-design-system (base: main)   Data: 2026-09-05

RESULTADO: PRONTO
```

## O que mudou desde a primeira rodada (histórico em `docs/entregas/.../ENTREGA.md`)

A primeira rodada deste portão (2026-09-05, manhã) bloqueou por dois motivos: nenhuma branch/commit
existia (E0/E1 nunca rodaram) e o modo legado estava ativo sem raio de impacto calculado (V8).
Desde então:

- **E0 rodou**: branch `feature/correcoes-auditoria-design-system` criada a partir de `main`,
  carregando o trabalho já implementado.
- **E1 rodou**: 24 commits — 13 limpos por task (harness + as 12 correções, cada uma com seu
  próprio arquivo de teste `test/design-system-*.test.js`, sem colisão de arquivo), 1 por task
  para `public/admin-master.html` (única sem conflito), 3 agrupados por arquivo compartilhado
  (`public/style.css`, `public/admin.html`, `public/app.js` — ver aviso), 2 para os desvios
  (`.gitignore`, `PROGRESSO.md`, aprovados explicitamente pelo dono) e 5 de documentação
  (design-system, sprintx, legado × 2, e o registro da própria entrega).
- **Raio de impacto calculado** (`docs/legado/raio/correcoes-auditoria-design-system.md`): faixa
  **ALTO**, determinado por 74 chamadores de `toast()` em `public/app.js` e por tocar a zona
  Financeiro (gate de PDV/Mesas/Caixa). Nenhuma migração de banco nem dado histórico afetado.
- **Roteiro de teste manual gerado** (`docs/legado/manual/correcoes-auditoria-design-system.md`):
  17 casos, os 7 primeiros bloqueantes, cobrindo o teste do gate que motivou o raio ALTO.
- **Aprovação humana registrada**: Pabllo Martins (dono do projeto), 2026-09-05, ciente dos
  riscos declarados (gate a conferir pelo roteiro manual; orçamento de mudança excedido por o
  raio ter sido calculado depois da execução).

## As dez verificações (reauditoria)

| # | Verificação | Resultado |
|---|---|---|
| V1 | Tasks concluídas | OK |
| V2 | Suíte verde por task | OK |
| V3 | Dois testes por task | OK |
| V4 | Teste de regressão na primeira task (bug da runx) | n/a |
| V5 | QA da runx aprovado | n/a |
| V6 | Auditoria da sprintx aprovada | OK |
| V7 | Bloqueio aberto no escopo entregue | OK |
| V8 | Modo legado: raio, caracterização, reversão, orçamento, aprovação | OK (com aviso) |
| V9 | Arquivo alterado fora da lista declarada | OK (com aviso) |
| V10 | Segredo, credencial ou dado real de cliente | OK |

Nenhuma verificação deu FALHA.

## Avisos

- **V8, sub-item Orçamento (Camada 5):** o orçamento ALTO (2 arquivos/40 linhas por task) foi
  excedido — o trabalho tocou 4 arquivos de produção com 96 inserções/48 remoções ao todo. Isso
  é o efeito esperado de calcular o raio DEPOIS da execução (não havia orçamento governando em
  tempo real). O dono aprovou explicitamente essa exceção, registrada em
  `docs/legado/raio/correcoes-auditoria-design-system.md`. Não bloqueia esta entrega; é um
  aprendizado de processo para o próximo trabalho que tocar estes arquivos: calcular o raio
  ANTES do plano.
- **V9:** `.gitignore` e `PROGRESSO.md` foram alterados fora de qualquer task declarada nas 13
  tasks do plano. Diferente do fluxo padrão (deixar o desvio sem commit até alguém decidir), o
  dono já decidiu explicitamente incluir os dois, cientes de que são inofensivos (scaffold da
  sprintx e atualização do progresso do projeto) — commitados em separado
  (`b8c97d8`, `d81ffa9`) e documentados em `desvios` no `ENTREGA.md`. Registrando como aviso, não
  como falha, porque a decisão humana que a regra exige já foi tomada e está no histórico.
- **Backfill de commits para 3 arquivos compartilhados:** `public/style.css` (`99b4c18`),
  `public/admin.html` (`e3d4bfd`) e `public/app.js` (`bd31fa2`) foram commitados um por ARQUIVO,
  não um por TASK, porque a implementação já existia inteira quando a branch foi aberta (sem
  histórico incremental por task para separar os hunks com segurança). É um desvio deliberado e
  disclosed da regra 3 ("um commit por task"), específico desta abertura retroativa — trabalhos
  futuros executados ao vivo pela mergex (E0 no início, E1 a cada task) não têm esse problema,
  porque cada commit nasce do diff incremental real daquela task.
- **Conferência visual pendente:** o roteiro de teste manual existe, mas ainda não foi executado
  por uma pessoa (ver `docs/legado/manual/correcoes-auditoria-design-system.md`, seção "Registro
  do resultado", em branco). Os Casos 1 a 7 (o teste do gate financeiro) são bloqueantes para
  considerar o raio ALTO plenamente coberto — recomendado executá-los antes do merge, mesmo com
  o portão técnico já `PRONTO`.

---

**PRONTO** → `portao: pronto` no `ENTREGA.md`. Segue para o E3 (classificação de atenção
humana).

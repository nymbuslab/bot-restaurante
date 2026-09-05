```
mergex E2 — PORTÃO DE PRONTIDÃO
Trabalho: correcoes-auditoria-design-system   Branch: main (nenhuma branch de trabalho existe)   Data: 2026-09-05

RESULTADO: BLOQUEADO
```

## Pré-requisito não atendido (antes das dez verificações)

`docs/entregas/correcoes-auditoria-design-system/ENTREGA.md` **não existe** — o E0 (abertura)
nunca rodou. A sessão que executou a F6 implementou as 13 tasks diretamente em `main`, sem
criar branch e sem commitar task por task (`git log` não tem nenhum commit desta feature; `git
status` mostra tudo como alteração não commitada, direto na working tree de `main`, que já
rastreia `origin/main`).

Isso viola as regras invioláveis 1 ("a branch nasce com o trabalho, não no fim") e 3 ("cada task
concluída com suíte verde vira um commit próprio") da mergex. Como o comando pedido é
explicitamente **só o E2** ("não commite, não suba nada, não abra PR"), não criei branch nem
commitei nada — apenas rodei as dez verificações possíveis contra a árvore de trabalho atual
(equivalente ao fallback "branch base indisponível" de `references/02-prontidao.md`).

**Isto sozinho já bloquearia a entrega**, independente do resultado das dez verificações: hoje
não há como abrir PR, nem dar push, nem isolar este trabalho de qualquer outro que também esteja
mexendo em `main`.

## As dez verificações

| # | Verificação | Resultado |
|---|---|---|
| V1 | Tasks concluídas | OK |
| V2 | Suíte verde por task | OK |
| V3 | Dois testes por task | OK |
| V4 | Teste de regressão na primeira task (bug da runx) | n/a |
| V5 | QA da runx aprovado | n/a |
| V6 | Auditoria da sprintx aprovada | OK |
| V7 | Bloqueio aberto no escopo entregue | OK |
| V8 | Modo legado: raio, caracterização, reversão, orçamento, aprovação | FALHA |
| V9 | Arquivo alterado fora da lista declarada | FALHA |
| V10 | Segredo, credencial ou dado real de cliente | OK |

## O que falta

```
V8 — FALHA: modo legado ativo sem raio de impacto calculado para este trabalho
  docs/legado/PERFIL.md existe no repositório ("a existência deste arquivo é o gatilho do modo
  legado") — todo trabalho com conjunto de arquivos alvo definido deveria ter passado pela
  Camada 2 (avaliador-de-raio) antes do plano. Este trabalho (correcoes-auditoria-design-system)
  não tem nenhum raio registrado.
  Sub-itens:
    - Raio calculado: FALHA — nenhum arquivo de raio para este trabalho.
    - Caracterização: FALHA — não verificável sem o raio (ausência de prova não é prova).
    - Reversão: FALHA — nenhum plano de reversão registrado em ORQUESTRADOR.md, 00-DECISOES.md
      ou FECHAMENTO.md.
    - Orçamento: n/a — nenhum orçamento de mudança foi declarado (feature não passou pela F3.5).
    - Aprovação humana: FALHA — não verificável sem o raio (se vier ALTO, precisaria de
      aprovação explícita do dono, que não está registrada).
  Onde corrigir: docs/legado/ (novo arquivo de raio para este trabalho) e
  docs/sprintx/features/correcoes-auditoria-design-system/00-DECISOES.md ou ORQUESTRADOR.md
  (plano de reversão)
  O que fazer: rodar o avaliador-de-raio (legadox-raio) sobre os arquivos desta feature
  (public/app.js, public/admin.html, public/admin-master.html, public/style.css) e registrar o
  resultado; se der BAIXO (esperado — nenhuma das 6 zonas de risco declaradas em PERFIL.md é
  tocada por esta feature, que é só front-end de apresentação), documentar isso explicitamente
  em vez de deixar a lacuna; escrever um plano de reversão de uma linha (ex.: "reverter os 4
  arquivos de código e remover os 14 arquivos de teste novos restaura o estado anterior; nenhuma
  migração de banco envolvida")

V9 — FALHA: 2 arquivos alterados fora da lista declarada em qualquer task
  .gitignore — modificado (+3 linhas: comentário e a entrada "docs/eventos/"), não aparece em
  nenhum arquivos.cria/arquivos.altera de nenhuma das 13 tasks
  PROGRESSO.md — modificado (+2 linhas: o item de fechamento movido para "✅ Concluído"), não
  aparece em nenhuma task
  Onde corrigir: docs/sprintx/features/correcoes-auditoria-design-system/sprint-01/tasks.md e
  sprint-02/tasks.md (se decidir declarar os dois retroativamente), ou reverter as duas
  alterações se forem consideradas fora de escopo
  O que fazer: nenhuma das duas mudanças é suspeita — .gitignore ganhou a linha `docs/eventos/`
  como parte do scaffold da própria sprintx (F1, exigido pelo método) e PROGRESSO.md foi
  atualizado seguindo a convenção do projeto de fechar a tarefa no arquivo de progresso; ainda
  assim, nenhuma task declarou esses dois arquivos, então o portão os reporta como desvio
  (regra 6: nunca maquiar). Não é um problema de segurança nem de escopo indevido — é uma
  lacuna de rastreabilidade do plano.
```

## Avisos

- **Nenhuma branch de trabalho existe.** Tudo está direto em `main`, que rastreia
  `origin/main`. Enquanto isso não for corrigido (E0 + backfill de commits por task, ou um
  commit único documentando a situação), não há como isolar este trabalho de qualquer outro
  em andamento no mesmo repositório, nem abrir PR nele.
- `docs/design-system/` (cartografia + `AUDIT.md`) e `docs/sprintx/` (o plano inteiro desta
  feature) estão como arquivos não rastreados (`??` no `git status`) — não são código de
  produção, são a documentação do próprio trabalho e da auditoria que o motivou; não contam
  como desvio de V9, mas também precisam ser commitados quando a branch/commits forem
  corrigidos.
- `npm test` (573 passed, 0 failed) e `npm run check` (141 arquivos OK) foram reexecutados
  agora, de forma independente do que `tasks.md`/`FECHAMENTO.md` registram, e batem exatamente
  com o que está documentado.
- `FECHAMENTO.md` registra, na seção "Ressalva — conferência visual", que a conferência visual
  manual das 4 tasks puramente visuais (T-02.03, T-02.09, T-02.10, T-02.11) não foi feita por
  falta de ferramenta de renderização na sessão que executou a F6 — exatamente a exceção
  documentada em `ORQUESTRADOR.md` (seção 7). Isso não é uma falha do portão (o teste estático
  de cada uma está verde), mas fica registrado como pendência de QA humano antes de considerar
  a feature 100% validada visualmente.
- T-02.07 passou a alterar também `public/style.css` (além de `public/app.js`), diferente da
  declaração original do plano — `tasks.md` já foi atualizado para refletir isso (o campo
  `arquivos.altera` da task já lista os dois arquivos), então isto não é uma falha de V9, só um
  registro de que o plano foi ajustado durante a execução (removendo a regra CSS antiga de
  `.cardapio-vazio-busca`, citada no `FECHAMENTO.md`).

---

**BLOQUEADO** → `portao: bloqueado`. O fluxo da mergex encerra aqui: nenhuma classificação de
atenção humana (E3), nenhuma descrição de PR (E4), nenhum pacote de QA (E5), nenhum push (E6),
nenhum PR (E7). Nada foi desfeito, nada foi descartado, nada foi maquiado — o trabalho continua
exatamente como está na árvore de `main`.

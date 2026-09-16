---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: extrato-geral-estoque
sprint_id: sprint-01
atualizado_em: 2026-09-16
tasks:
  - id: T-01.01
    titulo: Prototipo Stitch da aba Relatorios e aprovacao do dono
    fase: F-01.1
    status: pendente
    objetivo: Gerar o prototipo visual da aba Relatorios (extrato geral de estoque) e obter aprovacao explicita do dono antes de qualquer codigo de UI
    arquivos:
      cria: []
      altera: []
    teste_integracao: "Nao se aplica codigo — o teste desta task e a aprovacao explicita do dono, registrada em prosa nesta mesma task ao concluir"
    teste_funcional: "Nao se aplica codigo — verificado pelo dono revisando o link do prototipo Stitch e respondendo aprovado ou pede ajuste"
    criterio_aceite: Aprovacao explicita do dono registrada em prosa nesta task; sem ela nenhuma task de Sprint 03 pode iniciar
    depende_de: []
    paralelizavel: false
    concluida_em: null
    suite: nao_executada
---

# Tasks — Sprint 01

---

```yaml
id: T-01.01
titulo: Protótipo Stitch da aba Relatórios e aprovação do dono
objetivo: Gerar o protótipo visual da aba "Relatórios" (extrato geral de estoque) e obter aprovação explícita do dono antes de qualquer código de UI
arquivos:
  cria: []
  altera: []
teste_integracao: Não se aplica código — o teste desta task é a aprovação explícita do dono, registrada em prosa nesta mesma task ao concluir
teste_funcional: Não se aplica código — verificado pelo dono revisando o link do protótipo Stitch e respondendo "aprovado" ou pedindo ajuste
criterio_aceite: Aprovação explícita do dono registrada em prosa nesta task; sem ela nenhuma task da Sprint 03 pode iniciar
depende_de: []
paralelizavel: false
status: pendente
```

**Notas de execução (F6):** gerar via `mcp__stitch`, semeando com os tokens de
`public/style.css` e o design system já cadastrado (`assets/6506830711685967852`), incluindo
os estados vazio/erro/carregando/bloqueado-por-plano da tela (reaproveitando o padrão já
descrito em `base/ui-tela-controle-de-estoque.md`). Mostrar o link ao dono e PARAR — não
prosseguir para a Sprint 02 nem 03 sem resposta explícita. Isso vale mesmo que a F6 esteja
rodando de forma autônoma: é a única pausa que a regra global do projeto exige.

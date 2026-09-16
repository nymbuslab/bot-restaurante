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
    status: concluida
    objetivo: Gerar o prototipo visual da aba Relatorios (extrato geral de estoque) e obter aprovacao explicita do dono antes de qualquer codigo de UI
    arquivos:
      cria: []
      altera: []
    teste_integracao: "Nao se aplica codigo — o teste desta task e a aprovacao explicita do dono, registrada em prosa nesta mesma task ao concluir"
    teste_funcional: "Nao se aplica codigo — verificado pelo dono revisando o link do prototipo Stitch e respondendo aprovado ou pede ajuste"
    criterio_aceite: Aprovacao explicita do dono registrada em prosa nesta task; sem ela nenhuma task de Sprint 03 pode iniciar
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-16
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
status: concluida
```

**Execução (F6):** protótipo gerado via `mcp__stitch` no projeto `7236747227852373120`,
semeado com o design system já cadastrado `assets/6506830711685967852` ("Nymbus Pedidos" —
fundo `#10131d`, roxo `#6344BC`, Plus Jakarta Sans, sem gradiente/emoji). Tela:
`projects/7236747227852373120/screens/dc73a2774c70479c907bea423a921c35` ("Extrato de
estoque"). Screenshot: link enviado ao dono na mensagem de aprovação.

**Achado durante a geração, fora do texto original desta task:** `public/admin.html` JÁ TEM
um grupo de navegação "Relatórios" (acordeão, `navsub-relatorios`, linhas 123-146), com 3
itens placeholder desabilitados "Em breve" (Vendas Geral, Vendas por Item, Compras) —
`docs/design-system.md` já documenta esse padrão ("Sidebar aninhado... Padrão para agrupar
telas de gestão (Financeiro, Relatórios)"). A F1/F2 desta feature não tinha visto esse trecho
do nav (só olhou o conteúdo de `#aba-estoque`), e D-02/T-03.01 foram escritas como se
"Relatórios" fosse uma aba nova de nível principal, tipo `data-aba="relatorios"` "ao lado de
Caixa, Mesas". Implementar isso literalmente criaria DOIS grupos "Relatórios" na sidebar (o
acordeão existente com os relatórios futuros, e uma aba solta nova) — inconsistente com o
padrão já estabelecido e confuso para o dono.

**Correção proposta (parte do que está em aprovação nesta task):** o extrato geral de estoque
entra como um NOVO item real dentro do acordeão "Relatórios" já existente (ao lado de "Vendas
Geral", "Vendas por Item", "Compras"), com o rótulo "Estoque", em vez de criar uma aba de
nível principal separada. O protótipo já reflete essa correção. Isso muda o alvo real de
T-03.01 (que sai de "criar a aba Relatórios" para "acrescentar o item Estoque ao acordeão
Relatórios já existente e sua seção de conteúdo") — ajuste que só é aplicado no código depois
da aprovação do dono, junto com o resto desta task.

Prosseguir para a Sprint 03 (UI) SÓ após aprovação explícita registrada aqui. A Sprint 02
(backend, sem UI) já rodou em paralelo, sem esperar — T-02.01 e T-02.02 concluídas e verdes.

**Aprovação do dono (2026-09-16):** "Aprovo os dois" — visual do protótipo aprovado E a
correção de encaixe aprovada (item "Estoque" dentro do acordeão "Relatórios" já existente, em
vez de aba nova de nível principal). Portão liberado; Sprint 03 pode iniciar com o alvo
corrigido em T-03.01 (ver abaixo).

Suíte: não se aplica (task sem código) — 2026-09-16 · real: 0,5 h.

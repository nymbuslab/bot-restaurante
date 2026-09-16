# Auditoria — extrato-geral-estoque

Data: 2026-09-16

Reauditoria: verificação das correções da rodada anterior (3 ALTA, 2 MÉDIA, 1 BAIXA,
VEREDITO: NÃO) mais nova passada completa dos 9 itens do Passo 3, por um agente independente
que não viu o raciocínio da correção.

Os 3 achados ALTA da rodada anterior foram confirmados corrigidos:
- T-02.02 agora tem cenário de integração próprio para 403 por falta de `estoque.ver`,
  distinto do 403 por falta de plano, citando o padrão reutilizável de
  `test/integracao/equipe-rotas.test.js:94-112`.
- T-03.04 trocou `contemTrecho` no arquivo inteiro por `trechoEntre` recortando só a seção
  `#aba-relatorios`, eliminando o falso positivo com "venda"/"hoje"/"entrada" já presentes em
  PDV/Caixa.
- T-03.03 trocou busca solta por recorte por função (padrão `trechoDaFuncaoAntesDoAwait`),
  isolando o corpo de `carregarExtratoGeral` antes de checar `antes=`/`antesId=`, evitando
  colidir com `estCarregarExtrato` (`app.js:1132`).

As 2 MÉDIA e 1 BAIXA também foram confirmadas corrigidas:
- Caminho crítico recalculado sem `T-01.01`; `F-01.1` e `F-02.1` declaradas paralelas nos dois
  sentidos, sem colisão de arquivo.
- `T-02.01` ganhou nota de execução exigindo `EXPLAIN` do filtro por tipo (com volume
  sintético de 5.000 linhas) antes de fechar a task.
- `T-02.01` teve `criterio_aceite` reescrito em condições binárias e o `teste_integracao`
  passou a exigir inspeção do SQL/params reais, não um mock que responde à própria pergunta.

Nenhuma correção introduziu dependência circular ou paralelismo falso novo (`arquivos.cria`/
`arquivos.altera` de tasks paralelas não colidem; grafo de `depende_de` é acíclico nas 7
tasks; caminho crítico recalculado bate com as arestas reais).

Achados novos desta rodada, já corrigidos nesta mesma passada:

| severidade | arquivo | problema | correção aplicada |
|---|---|---|---|
| MÉDIA | sprint-03/tasks.md (T-03.03) | `criterio_aceite` prometia "estados vazio/erro/carregando cobertos", mas só o estado carregando tinha teste que o provasse — vazio/erro ficariam sem discriminação. | `criterio_aceite` reescrito: só o estado carregando é coberto por teste próprio; vazio/erro são reaproveitamento literal de HTML/CSS já testado em `#estoqueLock`/`carregarEstoque`, sem prometer teste que a task não tem. |
| BAIXA | sprint-02/tasks.md (T-02.02) | Cenário de 403 por falta de permissão não citava o harness reutilizável. | Nota adicionada citando `test/integracao/equipe-rotas.test.js:94-112`. |
| BAIXA | sprint-02/tasks.md (T-02.01) | Nota do `EXPLAIN` pedia "volume realista" sem número concreto. | Definido: semear ao menos 5.000 linhas sintéticas antes do `EXPLAIN`. |

VEREDITO: SIM — o plano está pronto para execução autônoma.

# Auditoria — correcoes-auditoria-design-system

2026-09-05. Reauditoria, feita pelo agente `auditor-plano` e pelo agente `revisor-testes`
(ambos leitura-only, em contexto separado de quem regerou o plano), sobre a versão do plano
regerada depois da primeira auditoria (histórico abaixo).

## Primeira rodada (histórico — todos os itens abaixo foram corrigidos nesta versão)

5 achados ALTA e 6 MÉDIA foram levantados contra a primeira versão do plano — a lista completa
e as correções aplicadas estão detalhadas na seção "Achados anteriores: resolvidos ou não" que
segue. Resumo dos 5 ALTA (todos RESOLVIDOS): teste de T-02.04 não escopado ao corpo da função
(colidia com "Carregando…" pré-existente em outro ponto do arquivo); teste de T-02.05 não
provava que as branches de erro passaram a apontar para elementos diferentes; testes de
T-02.06/T-02.07 não escopados ao corpo de `renderCardapio` (colidiam com `estado-vazio`
pré-existente em outras 4 funções); critério de aceite de T-02.09 ("exatamente 1 `<h1>`")
insatisfazível mesmo com a implementação correta; e a Definição de Pronto Global do
`ORQUESTRADOR.md` removia, sem substituto, o fallback de "UI não validada" que o `CLAUDE.md` do
projeto já prevê para mudança de UI sem ferramenta de validação visual disponível.

## Segunda rodada (achados novos desta reauditoria — já corrigidos)

| severidade | arquivo | problema | correção sugerida | status |
|---|---|---|---|---|
| MÉDIA | sprint-02/tasks.md (T-02.09) | O texto `<h1>Painel Master</h1>` é idêntico nos dois pontos do arquivo (login e header autenticado); a instrução de ancoragem não especificava um algoritmo inequívoco para descartar a ocorrência da view de login. | Especificar o algoritmo exato: localizar `header-direita` (ocorrência única) e usar `lastIndexOf("<h1>")` a partir desse índice para trás. | **CORRIGIDO** — `teste_integracao` de T-02.09 reescrito com o algoritmo exato. |
| MÉDIA | sprint-01/tasks.md (T-01.01) | O helper `contemTrecho` só confirma presença de texto no arquivo inteiro; 6 tasks da sprint-02 precisam ISOLAR um trecho antes de checar, sem uma peça de infraestrutura compartilhada para isso. | Ampliar T-01.01 com um segundo helper de escopo (`trechoEntre`), com teste próprio. | **CORRIGIDO** — T-01.01 agora cria `contemTrecho` E `trechoEntre`, com teste dos dois. |
| MÉDIA | sprint-02/tasks.md (T-02.08) | O `criterio_aceite` exige que os containers de `.campo`/`.auth-campo` continuem com layout distinto, mas nenhum teste verificava isso — uma implementação que também fundisse os containers passaria. | Acrescentar checagem de que as regras de container permanecem separadas e com as propriedades atuais. | **CORRIGIDO** — teste de T-02.08 agora confirma que os containers continuam em blocos separados. |
| BAIXA | ORQUESTRADOR.md (regra de autonomia 4) | A regra promete "pular para a próxima paralelizável" em bloqueio, mas só `T-02.09` é paralelizável nesta feature — a promessa quase nunca tem para onde se cumprir. | Explicitar que, fora de `T-02.09`, um bloqueio interrompe a sequência daquele ponto. | **CORRIGIDO** — regra 4 do `ORQUESTRADOR.md` reescrita com essa ressalva. |

## Achados anteriores: resolvidos ou não (primeira rodada, para registro)

| # | Severidade original | Item | Status |
|---|---|---|---|
| 1 | ALTA | T-02.04 (Carregando não escopado ao corpo da função) | RESOLVIDO |
| 2 | ALTA | T-02.05 (branches de erro apontando pro mesmo elemento) | RESOLVIDO |
| 3 | ALTA | T-02.06/T-02.07 (estado-vazio não escopado a renderCardapio) | RESOLVIDO |
| 4 | ALTA | T-02.09 (critério "exatamente 1 h1" insatisfazível) | RESOLVIDO (refinado na segunda rodada) |
| 5 | ALTA | ORQUESTRADOR sem fallback de "UI não validada" | RESOLVIDO |
| 6 | MÉDIA | Risco de letter-spacing sem checagem em T-02.09 | RESOLVIDO (e o risco em si não se confirmou: `.am-titulo` já declara letter-spacing próprio) |
| 7 | MÉDIA | T-02.09 deveria ser paralelizável | RESOLVIDO |
| 8 | MÉDIA | 12 tasks sem o arquivo de teste em `arquivos.altera` | RESOLVIDO (redesenho: cada task cria seu próprio arquivo de teste) |
| 9 | MÉDIA | T-02.02 teste ambíguo (risco de contagem global) | RESOLVIDO |
| 10 | MÉDIA | T-02.12 role solto no arquivo, não amarrado ao editor | RESOLVIDO |
| 11 | MÉDIA | T-02.10 não verificava outros usos de .mini intactos | RESOLVIDO |
| 12 | BAIXA | T-02.01 caso de sucesso fracamente discriminante | RESOLVIDO |
| 13 | BAIXA | ORQUESTRADOR caminho_critico não reflete ordem real | RESOLVIDO |

## Revisão de solidez dos testes (agente `revisor-testes`, segunda rodada)

13 de 13 tasks avaliadas como **sólidas** — nenhum teste, na redação atual, passaria com uma
implementação incorreta. Cada âncora textual citada nos testes (`aria-label="Fechar"`,
`estado-vazio`, `role="tablist"/"tab"`, `Carregando…`, `<h1>`/`header-direita`, `.mini`,
`max-width:980px`) foi conferida contra o código real e confirmada única no ponto certo, com a
instrução de isolamento suficiente para descartar as ocorrências pré-existentes alheias.

Ponto de atenção não-bloqueante registrado pelo revisor: as tasks que isolam corpo de função
(T-02.01, T-02.04, T-02.05, T-02.06, T-02.07, T-02.12) ainda precisam de lógica de
bracket-matching própria em cada arquivo de teste (o helper `trechoEntre` isola por marcador de
texto, não por parsing de chaves) — validado manualmente que nenhuma das funções-alvo tem chaves
escondidas em template literal que quebrariam essa extração; é custo de implementação, não falha
de discriminação.

VEREDITO: SIM — o plano está pronto para execução autônoma.

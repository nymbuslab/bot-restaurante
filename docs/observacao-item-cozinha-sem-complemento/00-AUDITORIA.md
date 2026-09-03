# Auditoria — observacao-item-cozinha-sem-complemento

Data: 2026-09-03 (reauditoria após correção do achado ALTA)

| severidade | arquivo | problema | correção sugerida |
|---|---|---|---|
| MÉDIA | 00-DECISOES.md (D-05) / base/03-pdv-mesas-tile-click.md | A base registra que `abrirPdvItemModal` "já renderiza corretamente um item sem nenhum grupo/variação" verificado por LEITURA do código na F1, não por execução real (DOM/Playwright). O plano só valida esse caminho de verdade na F-02.2 (T-02.03), no fim da feature. | Não bloqueia — T-02.03 cobre esse risco antes de considerar a feature pronta. Se o modal renderizar algo estranho para item sem grupo/variação durante a T-02.03, é sinal de reler `abrirPdvItemModal` por inteiro antes de prosseguir. |
| BAIXA | sprint-02/tasks.md (T-02.01, T-02.02) | As duas tasks alteram o mesmo `test/pdv-clique-produto.test.js`; a ordem entre elas importa dentro da mesma sessão de execução, embora `paralelizavel: false` já impeça rodá-las ao mesmo tempo. | Nenhuma ação obrigatória — já resolvido na prática pelo `paralelizavel: false`. |

**Achado ALTA da auditoria anterior — resolvido:** a instrução contraditória sobre recortar vs. stubar `abrirPdvItemModal`/`pdvGruposDoItem` no arnês da Sprint 01 foi corrigida em `sprint-01/fases.md` (F-01.1) e `sprint-01/tasks.md` (T-01.01, T-01.02): agora está explícito que só `pdvTileClick`/`pdvVariacaoClick` são recortadas de verdade, `abrirPdvItemModal` é sempre um spy e `pdvGruposDoItem` é sempre um stub por `item.grupos`, com o formato exato das 4 fixtures escrito na task.

VEREDITO: SIM — o plano está pronto para execução autônoma.

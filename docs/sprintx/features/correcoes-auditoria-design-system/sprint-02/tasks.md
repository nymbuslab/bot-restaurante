---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: correcoes-auditoria-design-system
sprint_id: sprint-02
atualizado_em: 2026-09-05
tasks:
  - id: T-02.01
    titulo: Toast com aria-live e role de alerta
    fase: F-02.1
    status: concluida
    objetivo: Fazer o toast anunciar sucesso/erro para leitor de tela, corrigindo o achado Alto 1
    arquivos:
      cria: [test/design-system-toast.test.js]
      altera: [public/app.js, public/admin.html]
    teste_integracao: Teste estatico confirma que admin.html define aria-live="polite" em #toast-container, e que dentro do corpo da funcao toast() em app.js a atribuicao de role="alert" esta dentro do bloco condicional tipo === "erro", nao fora dele
    teste_funcional: Dado tipo="erro", o elemento criado recebe role="alert"; dado tipo="sucesso" (default), o elemento NAO recebe role="alert" e o container mantem aria-live="polite"
    criterio_aceite: admin.html contem aria-live="polite" no #toast-container; a atribuicao de role="alert" em app.js esta dentro do if (tipo === "erro") da funcao toast(), e nenhum outro branch da funcao define esse atributo
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 548 passed, 0 failed
  - id: T-02.02
    titulo: Aria-label nos 4 botoes de fechar sem nome acessivel
    fase: F-02.1
    status: concluida
    objetivo: Dar nome acessivel aos 4 botoes ✕ (pedido-fechar, qr-fechar, editor-fechar, cartao-fechar), corrigindo o achado Alto 2 e o achado D-09
    arquivos:
      cria: [test/design-system-botoes-fechar.test.js]
      altera: [public/admin.html]
    teste_integracao: Teste estatico faz 4 checagens independentes por id, confirmando que os elementos com id="pedido-fechar", id="qr-fechar", id="editor-fechar" e id="cartao-fechar" tem aria-label="Fechar" na MESMA tag button -- nunca uma contagem solta de aria-label="Fechar" no arquivo, que ja tem 4 ocorrencias pre-existentes em outros botoes (mesasConfigFechar, grpGavetaFechar, estGavetaFechar, upsell-fechar)
    teste_funcional: Dado o trecho de HTML de cada um dos 4 botoes, contemTrecho encontra a combinacao id="<id>" seguida de aria-label="Fechar" dentro da mesma tag button, para cada um dos 4 ids, individualmente
    criterio_aceite: Os 4 ids (#pedido-fechar, #qr-fechar, #editor-fechar, #cartao-fechar) em admin.html tem aria-label="Fechar" no mesmo elemento button, verificado individualmente por id
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 550 passed, 0 failed
  - id: T-02.03
    titulo: Token --text-secondary-fg para contraste AA
    fase: F-02.2
    status: concluida
    objetivo: Criar um token de texto com contraste suficiente sobre --bg-overlay, corrigindo o achado Alto 3, seguindo a decisao D-05
    arquivos:
      cria: [test/design-system-contraste.test.js]
      altera: [public/style.css]
    teste_integracao: Teste estatico confirma que style.css declara --text-secondary-fg em :root e que .mesa-status-badge.s-livre usa var(--text-secondary-fg) no lugar de var(--text-secondary)
    teste_funcional: Dado o valor hex de --text-secondary-fg e o de --bg-overlay, o contraste calculado pelo proprio teste e maior ou igual a 4.5:1
    criterio_aceite: --text-secondary-fg existe em :root com contraste maior ou igual a 4.5:1 sobre --bg-overlay, e .mesa-status-badge.s-livre usa esse token para color
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 555 passed, 0 failed
  - id: T-02.04
    titulo: Estado de carregando em Pedidos, PDV, Mesas e Caixa
    fase: F-02.3
    status: concluida
    objetivo: Mostrar "Carregando..." nas 4 telas antes da resposta da API, corrigindo o achado Alto 4, seguindo a decisao D-07
    arquivos:
      cria: [test/design-system-carregando.test.js]
      altera: [public/app.js]
    teste_integracao: Teste estatico extrai o corpo de cada uma das 4 funcoes (carregarPedidos, carregarPdv, carregarMesas, carregarCaixa), do inicio ao fechamento de cada funcao, e confirma que o texto Carregando aparece DENTRO desse corpo isolado, antes do respectivo await api( -- nunca uma checagem no arquivo inteiro, que ja tem o texto Carregando em outros dois pontos (linhas 1082 e 2004) antes das 4 funcoes
    teste_funcional: Dado o corpo de cada funcao isolado do resto do arquivo, a posicao da atribuicao do texto Carregando e anterior a posicao do await api( dentro do MESMO corpo
    criterio_aceite: Isolando o corpo de cada uma das 4 funcoes (carregarPedidos, carregarPdv, carregarMesas, carregarCaixa), ha uma atribuicao do texto Carregando antes do await api( correspondente, dentro do mesmo corpo de funcao
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 559 passed, 0 failed
  - id: T-02.05
    titulo: Erro de rede distinto de caixa fechado, com retry
    fase: F-02.3
    status: concluida
    objetivo: Separar erro de rede/servidor de ausencia real de caixa no PDV e em Mesas, com botao de tentar de novo, corrigindo o achado Alto 5, seguindo a decisao D-02
    arquivos:
      cria: [test/design-system-erro-rede.test.js]
      altera: [public/app.js, public/admin.html]
    teste_integracao: Teste estatico confirma, dentro dos corpos de carregarPdv e carregarMesas isolados do resto do arquivo, que a branch !r.ok referencia um id de elemento de erro diferente (ex. pdvErroRede/mesasErroRede) do id referenciado pela branch !data.caixa (pdvSemCaixa/mesasSemCaixa) -- nao basta a coexistencia das duas condicoes, que ja existe hoje
    teste_funcional: Dado o corpo de carregarPdv (e o de carregarMesas) isolado, a branch do !r.ok atribui hidden=false a um elemento distinto do que a branch !data.caixa atribui, e o novo bloco em admin.html contem um button cujo texto e Tentar de novo
    criterio_aceite: Dentro de carregarPdv e carregarMesas, a branch de erro de rede referencia um id diferente do id referenciado pela branch de "sem caixa"; admin.html tem os 2 blocos novos com ids distintos, cada um com um botao de retry
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 562 passed, 0 failed
  - id: T-02.06
    titulo: Estado vazio do cardapio para tenant novo
    fase: F-02.4
    status: concluida
    objetivo: Mostrar um estado vazio com CTA quando o tenant nao tem nenhuma categoria, corrigindo o achado Alto 6, seguindo a decisao D-06
    arquivos:
      cria: [test/design-system-cardapio-vazio.test.js]
      altera: [public/app.js]
    teste_integracao: Teste estatico extrai o corpo de renderCardapio() isolado do resto do arquivo e confirma que a classe estado-vazio aparece DENTRO desse corpo, associada a uma checagem de cardapioAtual.categorias vazio -- nunca uma checagem solta no arquivo inteiro, que ja usa essa classe em outras 4 funcoes (linhas 748, 771, 1827, 5280)
    teste_funcional: Dado o corpo de renderCardapio isolado, existe um trecho que testa o comprimento de cardapioAtual.categorias e, quando zero, grava um bloco com a classe estado-vazio contendo um elemento que aciona a navegacao para Categorias
    criterio_aceite: Dentro do corpo de renderCardapio (isolado do resto do arquivo), ha uma checagem de categorias vazias que grava um bloco estado-vazio com CTA para Categorias
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 563 passed, 0 failed
  - id: T-02.07
    titulo: Estado vazio de busca do cardapio no padrao estado-vazio
    fase: F-02.4
    status: concluida
    objetivo: Trocar o markup proprio da busca sem resultado pelo componente padrao estado-vazio, corrigindo o achado Medio 3
    arquivos:
      cria: [test/design-system-cardapio-busca-vazia.test.js]
      altera: [public/app.js, public/style.css]
    teste_integracao: Teste estatico extrai o corpo de renderCardapio() isolado e confirma, DENTRO dele, que a branch de busca sem resultado (termo preenchido e totalMostrado igual a zero) usa a classe estado-vazio, e confirma tambem que a string cardapio-vazio-busca nao aparece em nenhum lugar do arquivo inteiro
    teste_funcional: Dado o corpo de renderCardapio isolado, o branch termo e totalMostrado igual a zero grava um bloco com a classe estado-vazio (nao mais cardapio-vazio-busca) com a mensagem de nenhum item encontrado
    criterio_aceite: Dentro do corpo de renderCardapio, o branch de busca sem resultado usa a classe estado-vazio; a string cardapio-vazio-busca nao aparece em nenhum lugar de app.js
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 564 passed, 0 failed
  - id: T-02.08
    titulo: Unificar label de .campo e .auth-campo
    fase: F-02.5
    status: concluida
    objetivo: Eliminar a duplicacao de CSS do label de formulario entre .campo e .auth-campo, corrigindo o achado Medio 1
    arquivos:
      cria: [test/design-system-campo-auth-campo.test.js]
      altera: [public/style.css]
    teste_integracao: Teste estatico confirma que o estilo do label (font-size, font-weight, color, text-transform, letter-spacing) esta declarado uma unica vez, num seletor combinado usado por .campo e .auth-campo, e confirma tambem que as regras de CONTAINER continuam separadas: .campo declara margin-bottom e .auth-campo continua com display:flex e flex-direction:column, cada uma no seu proprio bloco
    teste_funcional: Dado o CSS de .campo label e de .auth-campo label, os dois resolvem para o mesmo bloco de declaracao, sem repetir as 5 propriedades; dado o CSS do container .campo e do container .auth-campo, cada um mantem sua propria regra de layout, sem terem sido fundidos
    criterio_aceite: style.css nao repete as 5 propriedades do label em blocos separados para .campo e .auth-campo; os containers de .campo e .auth-campo continuam com o layout atual (margin-bottom e flex, respectivamente), verificado por teste, nao apenas por descricao
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 566 passed, 0 failed
  - id: T-02.09
    titulo: Heading do painel master vira h2 nas abas
    fase: F-02.5
    status: concluida
    objetivo: Corrigir os dois h1 simultaneos na area autenticada do painel master, trocando o titulo de cada aba para h2, corrigindo o achado Medio 2 -- a regra .am-titulo ja declara seu proprio letter-spacing em style.css:3746, entao a troca de tag nao muda a aparencia
    arquivos:
      cria: [test/design-system-heading-master.test.js]
      altera: [public/admin-master.html]
    teste_integracao: Teste estatico localiza o indice de "header-direita" em admin-master.html (ocorrencia unica no arquivo) e usa lastIndexOf("<h1>") a partir desse indice PARA TRAS para achar o h1 do header autenticado -- nunca indexOf a partir do inicio do arquivo, que acharia primeiro o h1 da view de login (linha 38, texto identico "Painel Master"); a partir desse ponto ate o fim do arquivo, confirma exatamente 1 elemento h1 e 4 ocorrencias de h2 class="am-titulo"; le tambem style.css e confirma que a regra .am-titulo ja declara letter-spacing proprio (nao dependendo da tag h1/h2)
    teste_funcional: Dado o trecho de admin-master.html a partir do header autenticado, ha 1 h1 e 4 h2 class="am-titulo"; dado o CSS de .am-titulo, a regra ja declara letter-spacing:-0.3px, independente da tag
    criterio_aceite: A partir do header autenticado de admin-master.html (excluindo a view de login), ha exatamente 1 elemento h1 e 4 ocorrencias de h2 class="am-titulo"; a regra .am-titulo em style.css continua declarando letter-spacing proprio (nenhuma alteracao necessaria nessa regra)
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-05
    suite: 568 passed, 0 failed
  - id: T-02.10
    titulo: Modificador mini-lista para botoes de acao em linha
    fase: F-02.5
    status: concluida
    objetivo: Criar uma variante de button.mini com altura de toque adequada para botoes de acao de linha de tabela, corrigindo o achado Medio 4, seguindo a decisao D-03
    arquivos:
      cria: [test/design-system-mini-lista.test.js]
      altera: [public/style.css, public/app.js]
    teste_integracao: Teste estatico confirma que style.css declara button.mini-lista com padding vertical maior que o de button.mini, que os 3 botoes de acao de item do cardapio (restaurar/editar/excluir) em app.js usam mini-lista no lugar de mini, e que a contagem de outras ocorrencias de class contendo "mini" (sem "-lista") fora desses 3 botoes nao diminuiu em relacao ao estado atual do arquivo
    teste_funcional: Dado o CSS de button.mini-lista, o padding vertical somado a altura de linha resulta em altura igual ou maior que 36px; dado o HTML gerado pelos 3 botoes de acao, cada um usa a classe mini-lista; dado o restante do arquivo, nenhum outro uso pre-existente de .mini foi trocado
    criterio_aceite: button.mini-lista existe em style.css com altura igual ou maior que 36px; os 3 botoes de restaurar, editar e excluir usam mini-lista; a contagem de outros usos de .mini (fora desses 3) e igual a contagem atual, antes da mudanca
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 571 passed, 0 failed
  - id: T-02.11
    titulo: Breakpoint do PDV alinhado ao da sidebar
    fase: F-02.6
    status: concluida
    objetivo: Mudar o breakpoint intermediario do .pdv de 980px para 1100px, corrigindo o achado Medio 5, seguindo a decisao D-08
    arquivos:
      cria: [test/design-system-pdv-breakpoint.test.js]
      altera: [public/style.css]
    teste_integracao: Teste estatico confirma que o seletor @media que redefine .pdv para 116px 1fr 320px usa max-width 1100px, e nao 980px
    teste_funcional: Dado o bloco CSS do breakpoint intermediario do .pdv, o valor de max-width e 1100px
    criterio_aceite: style.css nao tem mais nenhum @media (max-width 980px) para o seletor .pdv; o breakpoint intermediario do .pdv passou a ser 1100px
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 573 passed, 0 failed
  - id: T-02.12
    titulo: Role tablist e tab nas abas do editor de item
    fase: F-02.1
    status: concluida
    objetivo: Dar a marcacao ARIA de abas ao editor-tabs, por consistencia com o cfg-subnav, corrigindo o achado Baixo 1 seguindo a decisao D-04
    arquivos:
      cria: [test/design-system-editor-tabs.test.js]
      altera: [public/admin.html]
    teste_integracao: Teste estatico isola o trecho de #editor-tabs-nav do resto do arquivo e confirma, DENTRO desse trecho isolado, que o container tem role="tablist" e que cada elemento com class contendo editor-tab tem role="tab" -- nunca uma checagem solta de role="tablist"/role="tab" no arquivo inteiro, que ja existem em .cfg-subnav (linha 307-308) e .pdv-cats (linha 964)
    teste_funcional: Dado o trecho de #editor-tabs-nav isolado, o container tem role="tablist" e os 3 botoes filhos tem role="tab", com aria-selected="true" so no botao que tambem tem class="editor-tab ativo"
    criterio_aceite: O trecho de #editor-tabs-nav (isolado do resto do arquivo) tem role="tablist" no container e role="tab" com aria-selected coerente nos 3 .editor-tab
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 552 passed, 0 failed
---

# Tasks — Sprint 02

> Nenhuma das 12 tasks desta sprint declara `depende_de`: todas têm `depende_de: []`. A
> dependência do helper de teste (`test/apoio/arquivo-estatico.js`, criado por T-01.01) é
> ESTRUTURAL, garantida pela ordem das sprints (regra do método: a sprint-01 entrega a
> capacidade de testar antes de qualquer task de negócio da sprint-02 rodar), não uma
> dependência funcional entre tasks individuais. Declarar `depende_de: [T-01.01]` em toda task
> impediria qualquer uma delas de ser `paralelizavel: true` (contradição "paralelizavel com
> depende_de não vazio", `references/09-diagrama.md`), o que bloquearia sem necessidade a
> T-02.09. Nenhuma das 12 tasks depende de outra task desta sprint.
>
> Cada task CRIA seu próprio arquivo de teste (`test/design-system-<assunto>.test.js`), em vez
> de todas alterarem um único arquivo compartilhado — um arquivo de teste compartilhado faria
> as 12 tasks conflitarem entre si por escrita concorrente, inviabilizando qualquer
> paralelismo real (achado auto-corrigido durante a regeração desta F3, depois da F5 apontar o
> conflito em `T-02.09`). Todo arquivo novo usa o helper `contemTrecho`, de
> `test/apoio/arquivo-estatico.js` (T-01.01, sprint-01).
>
> Quase todas as tasks foram declaradas `paralelizavel: false` porque tocam `public/app.js`,
> `public/admin.html` ou `public/style.css` — arquivos compartilhados entre várias tasks — e a
> execução é sequencial para não haver duas edições concorrentes no mesmo arquivo. **Exceção:
> T-02.09**, a única task que toca `public/admin-master.html` e não toca nenhum dos 3 arquivos
> compartilhados (não precisa editar `style.css`: a regra `.am-titulo` já declara seu próprio
> `letter-spacing`, `style.css:3746` — a task só verifica isso, não altera), declarada
> `paralelizavel: true` (achado MÉDIA da F5, `00-AUDITORIA.md`).

---

```yaml
id: T-02.01
titulo: Toast com aria-live e role de alerta
objetivo: Fazer o toast anunciar sucesso/erro para leitor de tela, corrigindo o achado Alto #1
arquivos:
  cria: [test/design-system-toast.test.js]
  altera: [public/app.js, public/admin.html]
teste_integracao: Teste estático confirma que admin.html define aria-live="polite" em #toast-container, e que dentro do corpo da função toast() em app.js a atribuição de role="alert" está dentro do bloco condicional tipo === "erro", não fora dele
teste_funcional: Dado tipo="erro", o elemento criado recebe role="alert"; dado tipo="sucesso" (default), o elemento NÃO recebe role="alert" e o container mantém aria-live="polite"
criterio_aceite: admin.html contém aria-live="polite" no #toast-container; a atribuição de role="alert" em app.js está dentro do if (tipo === "erro") da função toast(), e nenhum outro branch da função define esse atributo
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.02
titulo: Aria-label nos 4 botões de fechar sem nome acessível
objetivo: Dar nome acessível aos 4 botões ✕ (pedido-fechar, qr-fechar, editor-fechar, cartao-fechar), corrigindo o achado Alto #2 e o achado D-09
arquivos:
  cria: [test/design-system-botoes-fechar.test.js]
  altera: [public/admin.html]
teste_integracao: Teste estático faz 4 checagens independentes por id, confirmando que os elementos com id="pedido-fechar", id="qr-fechar", id="editor-fechar" e id="cartao-fechar" têm aria-label="Fechar" na MESMA tag <button> — nunca uma contagem solta de aria-label="Fechar" no arquivo, que já tem 4 ocorrências pré-existentes em outros botões (mesasConfigFechar, grpGavetaFechar, estGavetaFechar, upsell-fechar)
teste_funcional: Dado o trecho de HTML de cada um dos 4 botões, contemTrecho encontra a combinação id="<id>" seguida de aria-label="Fechar" dentro da mesma tag <button>, para cada um dos 4 ids, individualmente
criterio_aceite: Os 4 ids (#pedido-fechar, #qr-fechar, #editor-fechar, #cartao-fechar) em admin.html têm aria-label="Fechar" no mesmo elemento button, verificado individualmente por id
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.03
titulo: Token --text-secondary-fg para contraste AA
objetivo: Criar um token de texto com contraste suficiente sobre --bg-overlay, corrigindo o achado Alto #3, seguindo a decisão D-05
arquivos:
  cria: [test/design-system-contraste.test.js]
  altera: [public/style.css]
teste_integracao: Teste estático confirma que style.css declara --text-secondary-fg em :root e que .mesa-status-badge.s-livre usa var(--text-secondary-fg) no lugar de var(--text-secondary)
teste_funcional: Dado o valor hex de --text-secondary-fg e o de --bg-overlay, o contraste calculado pelo próprio teste é maior ou igual a 4.5:1
criterio_aceite: --text-secondary-fg existe em :root com contraste maior ou igual a 4.5:1 sobre --bg-overlay, e .mesa-status-badge.s-livre usa esse token para color
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.04
titulo: Estado de carregando em Pedidos, PDV, Mesas e Caixa
objetivo: Mostrar "Carregando…" nas 4 telas antes da resposta da API, corrigindo o achado Alto #4, seguindo a decisão D-07
arquivos:
  cria: [test/design-system-carregando.test.js]
  altera: [public/app.js]
teste_integracao: Teste estático extrai o corpo de cada uma das 4 funções (carregarPedidos, carregarPdv, carregarMesas, carregarCaixa), do início ao fechamento de cada função, e confirma que o texto "Carregando…" aparece DENTRO desse corpo isolado, antes do respectivo await api( — nunca uma checagem no arquivo inteiro, que já tem o texto "Carregando…" em outros dois pontos (linhas 1082 e 2004) antes das 4 funções
teste_funcional: Dado o corpo de cada função isolado do resto do arquivo, a posição da atribuição do texto "Carregando…" é anterior à posição do await api( dentro do MESMO corpo
criterio_aceite: Isolando o corpo de cada uma das 4 funções (carregarPedidos, carregarPdv, carregarMesas, carregarCaixa), há uma atribuição do texto "Carregando…" antes do await api( correspondente, dentro do mesmo corpo de função
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.05
titulo: Erro de rede distinto de caixa fechado, com retry
objetivo: Separar erro de rede/servidor de ausência real de caixa no PDV e em Mesas, com botão de tentar de novo, corrigindo o achado Alto #5, seguindo a decisão D-02
arquivos:
  cria: [test/design-system-erro-rede.test.js]
  altera: [public/app.js, public/admin.html]
teste_integracao: Teste estático confirma, dentro dos corpos de carregarPdv e carregarMesas isolados do resto do arquivo, que a branch !r.ok referencia um id de elemento de erro diferente (ex.: pdvErroRede/mesasErroRede) do id referenciado pela branch !data.caixa (pdvSemCaixa/mesasSemCaixa) — não basta a coexistência das duas condições, que já existe hoje
teste_funcional: Dado o corpo de carregarPdv (e o de carregarMesas) isolado, a branch do !r.ok atribui hidden=false a um elemento distinto do que a branch !data.caixa atribui, e o novo bloco em admin.html contém um <button> cujo texto é "Tentar de novo"
criterio_aceite: Dentro de carregarPdv e carregarMesas, a branch de erro de rede referencia um id diferente do id referenciado pela branch de "sem caixa"; admin.html tem os 2 blocos novos com ids distintos, cada um com um botão de retry
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.06
titulo: Estado vazio do cardápio para tenant novo
objetivo: Mostrar um estado vazio com CTA quando o tenant não tem nenhuma categoria, corrigindo o achado Alto #6, seguindo a decisão D-06
arquivos:
  cria: [test/design-system-cardapio-vazio.test.js]
  altera: [public/app.js]
teste_integracao: Teste estático extrai o corpo de renderCardapio() isolado do resto do arquivo e confirma que a classe estado-vazio aparece DENTRO desse corpo, associada a uma checagem de cardapioAtual.categorias vazio — nunca uma checagem solta no arquivo inteiro, que já usa essa classe em outras 4 funções (linhas 748, 771, 1827, 5280)
teste_funcional: Dado o corpo de renderCardapio isolado, existe um trecho que testa o comprimento de cardapioAtual.categorias e, quando zero, grava um bloco com a classe estado-vazio contendo um elemento que aciona a navegação para Categorias
criterio_aceite: Dentro do corpo de renderCardapio (isolado do resto do arquivo), há uma checagem de categorias vazias que grava um bloco .estado-vazio com CTA para Categorias
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.07
titulo: Estado vazio de busca do cardápio no padrão .estado-vazio
objetivo: Trocar o markup próprio da busca sem resultado pelo componente padrão .estado-vazio, corrigindo o achado Médio #3
arquivos:
  cria: [test/design-system-cardapio-busca-vazia.test.js]
  altera: [public/app.js]
teste_integracao: Teste estático extrai o corpo de renderCardapio() isolado e confirma, DENTRO dele, que a branch de busca sem resultado (termo preenchido e totalMostrado igual a zero) usa a classe estado-vazio, e confirma também que a string cardapio-vazio-busca não aparece em nenhum lugar do arquivo inteiro
teste_funcional: Dado o corpo de renderCardapio isolado, o branch termo e totalMostrado igual a zero grava um bloco com a classe estado-vazio (não mais cardapio-vazio-busca) com a mensagem de nenhum item encontrado
criterio_aceite: Dentro do corpo de renderCardapio, o branch de busca sem resultado usa a classe estado-vazio; a string cardapio-vazio-busca não aparece em nenhum lugar de app.js
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.08
titulo: Unificar label de .campo e .auth-campo
objetivo: Eliminar a duplicação de CSS do label de formulário entre .campo e .auth-campo, corrigindo o achado Médio #1
arquivos:
  cria: [test/design-system-campo-auth-campo.test.js]
  altera: [public/style.css]
teste_integracao: Teste estático confirma que o estilo do label (font-size, font-weight, color, text-transform, letter-spacing) está declarado uma única vez, num seletor combinado usado por .campo e .auth-campo, e confirma também que as regras de CONTAINER continuam separadas: .campo declara margin-bottom e .auth-campo continua com display:flex e flex-direction:column, cada uma no seu próprio bloco
teste_funcional: Dado o CSS de .campo label e de .auth-campo label, os dois resolvem para o mesmo bloco de declaração, sem repetir as 5 propriedades; dado o CSS do container .campo e do container .auth-campo, cada um mantém sua própria regra de layout, sem terem sido fundidos
criterio_aceite: style.css não repete as 5 propriedades do label em blocos separados para .campo e .auth-campo; os containers de .campo e .auth-campo continuam com o layout atual (margin-bottom e flex, respectivamente), verificado por teste, não apenas por descrição
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.09
titulo: Heading do painel master vira h2 nas abas
objetivo: Corrigir os dois <h1> simultâneos na área autenticada do painel master, trocando o título de cada aba para <h2>, corrigindo o achado Médio #2 — a regra .am-titulo já declara seu próprio letter-spacing em style.css:3746, então a troca de tag não muda a aparência
arquivos:
  cria: [test/design-system-heading-master.test.js]
  altera: [public/admin-master.html]
teste_integracao: Teste estático localiza o índice de "header-direita" em admin-master.html (ocorrência única no arquivo) e usa lastIndexOf("<h1>") a partir desse índice PARA TRÁS para achar o <h1> do header autenticado — nunca indexOf a partir do início do arquivo, que acharia primeiro o <h1> da view de login (linha 38, texto idêntico "Painel Master"); a partir desse ponto até o fim do arquivo, confirma exatamente 1 elemento <h1> e 4 ocorrências de <h2 class="am-titulo">; lê também style.css e confirma que a regra .am-titulo já declara letter-spacing próprio (não dependendo da tag h1/h2)
teste_funcional: Dado o trecho de admin-master.html a partir do header autenticado, há 1 <h1> e 4 <h2 class="am-titulo">; dado o CSS de .am-titulo, a regra já declara letter-spacing:-0.3px, independente da tag
criterio_aceite: A partir do header autenticado de admin-master.html (excluindo a view de login), há exatamente 1 elemento <h1> e 4 ocorrências de <h2 class="am-titulo">; a regra .am-titulo em style.css continua declarando letter-spacing próprio (nenhuma alteração necessária nessa regra)
depende_de: []
paralelizavel: true
status: pendente
```

---

```yaml
id: T-02.10
titulo: Modificador .mini-lista para botões de ação em linha
objetivo: Criar uma variante de button.mini com altura de toque adequada para botões de ação de linha de tabela, corrigindo o achado Médio #4, seguindo a decisão D-03
arquivos:
  cria: [test/design-system-mini-lista.test.js]
  altera: [public/style.css, public/app.js]
teste_integracao: Teste estático confirma que style.css declara button.mini-lista com padding vertical maior que o de button.mini, que os 3 botões de ação de item do cardápio (restaurar/editar/excluir) em app.js usam mini-lista no lugar de mini, e que a contagem de outras ocorrências de class contendo "mini" (sem "-lista") fora desses 3 botões não diminuiu em relação ao estado atual do arquivo
teste_funcional: Dado o CSS de button.mini-lista, o padding vertical somado à altura de linha resulta em altura igual ou maior que 36px; dado o HTML gerado pelos 3 botões de ação, cada um usa a classe mini-lista; dado o restante do arquivo, nenhum outro uso pré-existente de .mini foi trocado
criterio_aceite: button.mini-lista existe em style.css com altura igual ou maior que 36px; os 3 botões de restaurar, editar e excluir usam mini-lista; a contagem de outros usos de .mini (fora desses 3) é igual à contagem atual, antes da mudança
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.11
titulo: Breakpoint do PDV alinhado ao da sidebar
objetivo: Mudar o breakpoint intermediário do .pdv de 980px para 1100px, corrigindo o achado Médio #5, seguindo a decisão D-08
arquivos:
  cria: [test/design-system-pdv-breakpoint.test.js]
  altera: [public/style.css]
teste_integracao: Teste estático confirma que o seletor @media que redefine .pdv para 116px 1fr 320px usa max-width:1100px, e não 980px
teste_funcional: Dado o bloco CSS do breakpoint intermediário do .pdv, o valor de max-width é 1100px
criterio_aceite: style.css não tem mais nenhum @media (max-width:980px) para o seletor .pdv; o breakpoint intermediário do .pdv passou a ser 1100px
depende_de: []
paralelizavel: false
status: pendente
```

---

```yaml
id: T-02.12
titulo: Role tablist e tab nas abas do editor de item
objetivo: Dar a marcação ARIA de abas ao .editor-tabs, por consistência com o .cfg-subnav, corrigindo o achado Baixo #1 seguindo a decisão D-04
arquivos:
  cria: [test/design-system-editor-tabs.test.js]
  altera: [public/admin.html]
teste_integracao: Teste estático isola o trecho de #editor-tabs-nav do resto do arquivo e confirma, DENTRO desse trecho isolado, que o container tem role="tablist" e que cada elemento com class contendo editor-tab tem role="tab" — nunca uma checagem solta de role="tablist"/role="tab" no arquivo inteiro, que já existem em .cfg-subnav (linha 307-308) e .pdv-cats (linha 964)
teste_funcional: Dado o trecho de #editor-tabs-nav isolado, o container tem role="tablist" e os 3 botões filhos têm role="tab", com aria-selected="true" só no botão que também tem class="editor-tab ativo"
criterio_aceite: O trecho de #editor-tabs-nav (isolado do resto do arquivo) tem role="tablist" no container e role="tab" com aria-selected coerente nos 3 .editor-tab
depende_de: []
paralelizavel: false
status: pendente
```

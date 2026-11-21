---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-03
atualizado_em: 2026-11-12
tasks:
  - id: T-03.01
    titulo: Exibir comandas abertas
    fase: F-03.1
    status: concluida
    objetivo: Renderizar secao permanente contador e menu com gates separados de mesas
    arquivos:
      cria: [test/comandas-mesas-ui.test.js]
      altera: [public/admin.html, public/app.js, public/equipe.js, public/style.css]
    teste_integracao: Carregamento combina comandas e mesas sem exigir mesas.operar para a secao de comandas
    teste_funcional: Renderiza abertas mais antigas primeiro com numero duracao itens e total
    criterio_aceite: Usuario com apenas pdv.operar ve comandas e nao ve mesas fisicas
    origem: [D-01, D-04, D-06, D-07, D-08, D-09, D-15]
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-11-12
    suite: verde
  - id: T-03.02
    titulo: Operar comanda no drawer
    fase: F-03.2
    status: concluida
    objetivo: Abrir detalhe responsivo com acrescimo pre-conta recebimento e cancelamento
    arquivos:
      cria: []
      altera: [public/admin.html, public/app.js, public/style.css, test/comandas-mesas-ui.test.js]
    teste_integracao: Acoes chamam endpoints corretos e a lista remove comanda recebida ou cancelada
    teste_funcional: Caixa fechado desabilita acrescimo e recebimento sem ocultar impressao e cancelamento
    criterio_aceite: Drawer desktop e sheet mobile exibem somente acoes compativeis com comanda
    origem: [D-02, D-07, D-09, D-10, D-12, D-15]
    depende_de: [T-03.01]
    paralelizavel: false
    concluida_em: 2026-11-12
    suite: verde
  - id: T-03.03
    titulo: Abrir apos criar no PDV
    fase: F-03.2
    status: concluida
    objetivo: Navegar destacar e abrir a comanda criada sem reenviar a venda
    arquivos:
      cria: []
      altera: [public/app.js, public/style.css, test/pdv-comanda-modo.test.js, test/comandas-mesas-ui.test.js, CLAUDE.md]
    teste_integracao: Sucesso da venda navega para Mesas e Comandas e abre o id retornado
    teste_funcional: Falha ao abrir mostra numero e acao de tentativa sem repetir POST de criacao
    criterio_aceite: Comanda criada fica destacada e aberta ou oferece tentar abrir novamente
    origem: [D-05, D-06, D-11, D-14, D-15]
    depende_de: [T-03.02]
    paralelizavel: false
    concluida_em: 2026-11-12
    suite: verde
---

# Tasks - Sprint 03

## T-03.01 - Exibir comandas abertas

```yaml
id: T-03.01
titulo: Exibir comandas abertas
objetivo: Renderizar secao permanente contador e menu com gates separados de mesas
arquivos:
  cria: [test/comandas-mesas-ui.test.js]
  altera: [public/admin.html, public/app.js, public/equipe.js, public/style.css]
teste_integracao: Carregamento combina comandas e mesas sem exigir mesas.operar para a secao de comandas
teste_funcional: Renderiza abertas mais antigas primeiro com numero duracao itens e total
criterio_aceite: Usuario com apenas pdv.operar ve comandas e nao ve mesas fisicas
origem: [D-01, D-04, D-06, D-07, D-08, D-09, D-15]
depende_de: []
paralelizavel: false
status: concluida
```

2026-11-12 · suíte: 806 passed, 0 failed · real: 1,5 h

A seção "Comandas abertas" fica acima de `#mesasGrade` (e o "Configurar" continua no topo, ação das mesas). `carregarComandasAbertas` mostra a seção com `pdv.operar`, trata 403 como gate do Plano Completo (`comandaState.semPlano`) e um poll de 30 s atualiza só o contador. `carregarMesas` carrega as comandas antes e, com caixa fechado, esconde apenas as mesas físicas (`mesasSemCaixa`) — as comandas seguem visíveis (D-08). Coberto por `test/comandas-mesas-ui.test.js` (estrutura no HTML, ordem/duração/itens/total, estados vazio/retry, gates de caixa e permissão) e por `test/design-system-erro-rede.test.js`.

## T-03.02 - Operar comanda no drawer

```yaml
id: T-03.02
titulo: Operar comanda no drawer
objetivo: Abrir detalhe responsivo com acrescimo pre-conta recebimento e cancelamento
arquivos:
  cria: []
  altera: [public/admin.html, public/app.js, public/style.css, test/comandas-mesas-ui.test.js]
teste_integracao: Acoes chamam endpoints corretos e a lista remove comanda recebida ou cancelada
teste_funcional: Caixa fechado desabilita acrescimo e recebimento sem ocultar impressao e cancelamento
criterio_aceite: Drawer desktop e sheet mobile exibem somente acoes compativeis com comanda
origem: [D-02, D-07, D-09, D-10, D-12, D-15]
depende_de: [T-03.01]
paralelizavel: false
status: concluida
```

2026-11-12 · suíte: 806 passed, 0 failed · real: 2,0 h

O drawer `#comandaPainel` reusa a estrutura e o comportamento do painel de mesa (overlay, Escape, foco) sem oferecer recurso exclusivo de mesa. Cada ação usa o seu contrato (D-07): acrescentar → `POST /api/comandas/:id/itens` via PDV com `viaComanda`; receber → `/api/caixa/receber/:id`; pré-conta → `POST /api/comandas/:id/imprimir-pre-conta`; cancelar comanda/item → rotas de Pedidos com permissão `pedidos.cancelar`. Com caixa fechado ou vencido, "Adicionar produtos" e "Receber" ficam desabilitados com aviso próprio, e pré-conta/cancelar continuam disponíveis. Coberto por 9 casos de `test/comandas-mesas-ui.test.js` (incluindo o CSS e o bloco mobile de 560 px).

## T-03.03 - Abrir apos criar no PDV

```yaml
id: T-03.03
titulo: Abrir apos criar no PDV
objetivo: Navegar destacar e abrir a comanda criada sem reenviar a venda
arquivos:
  cria: []
  altera: [public/app.js, public/style.css, test/pdv-comanda-modo.test.js, test/comandas-mesas-ui.test.js, CLAUDE.md]
teste_integracao: Sucesso da venda navega para Mesas e Comandas e abre o id retornado
teste_funcional: Falha ao abrir mostra numero e acao de tentativa sem repetir POST de criacao
criterio_aceite: Comanda criada fica destacada e aberta ou oferece tentar abrir novamente
origem: [D-05, D-06, D-11, D-14, D-15]
depende_de: [T-03.02]
paralelizavel: false
status: concluida
```

2026-11-12 · suíte: 806 passed, 0 failed · real: 1,5 h

Ao finalizar a venda de tipo Comanda, `finalizarVendaPdv` lê o `pedido` devolvido por `/api/pdv/vender` e chama `abrirComandaNaTela(id, numero)`: a aba Mesas é acionada, o card já nasce com `destaque`, o detalhe abre quando a lista carrega e, se a abertura falhar, sobra o aviso "Tentar abrir" sem refazer o POST (D-05/D-11). O mesmo caminho serve ao acréscimo feito pelo drawer (volta para a comanda em vez da aba Pedidos). Coberto pelos 3 casos novos de `test/pdv-comanda-modo.test.js` (rota `/api/comandas/:id/itens`, navegação para Mesas com destaque, falha de POST que não muda de aba) e pelo caso de retry em `test/comandas-mesas-ui.test.js`.

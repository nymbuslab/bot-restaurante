---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: paginacao-pedidos
atualizado_em: 2026-09-06
decisoes:
  - id: D-01
    decisao: paginacao vira botao carregar mais, client-side, sem medir altura da tela
    alternativa_descartada: calcular quantas linhas cabem na altura disponivel (adaptativa)
    motivo: nao ha hoje container com altura propria para medir; adaptativa exigiria recalcular em resize/zoom e tratar desktop/mobile como casos distintos
    status: fechada
    bloqueante: false
  - id: D-02
    decisao: correcao vale so para a visao desktop (tabela); cards do celular ficam sem mudanca
    alternativa_descartada: aplicar a mesma mudanca tambem nos cards do celular
    motivo: o problema (metade da tela vazia) so ocorre em monitor grande; no celular os cards ja empilham sem desperdicar espaco
    status: fechada
    bloqueante: false
  - id: D-03
    decisao: mostrar 30 pedidos de cara na tela grande, em vez de 10
    alternativa_descartada: so trocar o numero fixo de 10 por outro numero fixo maior, sem mecanismo de carregar mais
    motivo: definicao de pronto do usuario e ver bem mais que 10 pedidos sem clicar em nada
    status: fechada
    bloqueante: false
  - id: D-04
    decisao: botao carregar mais no fim da lista, sem scroll infinito
    alternativa_descartada: carregar sozinho ao rolar a tela ate o fim (scroll infinito)
    motivo: mais previsivel para quem usa e mais facil de testar (evento de clique, nao comportamento de scroll)
    status: fechada
    bloqueante: false
  - id: D-05
    decisao: cada clique em carregar mais soma 20 pedidos aos ja visiveis; nunca renderiza tudo de uma vez mesmo com centenas de pedidos no periodo
    alternativa_descartada: renderizar a lista inteira do periodo de uma vez, sem limite de exibicao
    motivo: evita travar a tela quando um periodo largo (ex.: 7 dias) traz muitos pedidos
    status: fechada
    bloqueante: false
  - id: D-06
    decisao: a conta de quantos pedidos mostrar (total visivel atual + incremento, limitado ao total da lista) vira funcao pura num arquivo dual-mode testavel, seguindo o padrao de public/busca.js
    alternativa_descartada: deixar a conta solta dentro de app.js, testada so por checagem estatica de texto (contemTrecho/trechoEntre)
    motivo: e uma conta deterministica, sem tocar DOM; merece teste real de node:test, reaproveitando convencao ja validada no projeto
    status: fechada
    bloqueante: false
  - id: PENDENTE-01
    decisao: falta decidir se o servidor deve ganhar um teto de linhas para o filtro de periodo customizado (desde/ate) quando o intervalo for muito largo
    alternativa_descartada: null
    motivo: null
    status: pendente
    bloqueante: false
  - id: D-07
    decisao: o mesmo mecanismo de carregar mais (30 iniciais, +20) vale tambem para os cards do celular, revisando D-02
    alternativa_descartada: separar em dois mecanismos independentes (um so para desktop, outro so para celular) para manter o celular com paginacao numerada como hoje
    motivo: descoberto na F3, ao escrever as tasks, que desktop (tabela) e celular (cards) hoje leem a mesma fatia de dado ja cortada - so a aparencia muda por CSS; manter o celular com o mecanismo antigo exigiria duplicar a logica, contrariando o proprio motivo de D-01 (evitar complexidade)
    status: fechada
    bloqueante: false
---

# Decisões — paginacao-pedidos

## Decisões

```
D-01 | Paginação vira botão "Carregar mais", client-side, sem medir altura da tela | Calcular quantas linhas cabem na altura disponível (adaptativa) | Não há hoje container com altura própria para medir; adaptativa exigiria recalcular em resize/zoom e tratar desktop/mobile como casos distintos
D-02 | Correção vale só para a visão desktop (tabela); cards do celular ficam sem mudança | Aplicar a mesma mudança também nos cards do celular | O problema (metade da tela vazia) só ocorre em monitor grande; no celular os cards já empilham sem desperdiçar espaço
D-03 | Mostrar 30 pedidos de cara na tela grande, em vez de 10 | Só trocar o número fixo de 10 por outro número fixo maior, sem mecanismo de "carregar mais" | Definição de pronto do usuário é ver bem mais que 10 pedidos sem clicar em nada
D-04 | Botão "Carregar mais" no fim da lista, sem scroll infinito | Carregar sozinho ao rolar a tela até o fim (scroll infinito) | Mais previsível para quem usa e mais fácil de testar (evento de clique, não comportamento de scroll)
D-05 | Cada clique em "Carregar mais" soma 20 pedidos aos já visíveis; nunca renderiza tudo de uma vez mesmo com centenas de pedidos no período | Renderizar a lista inteira do período de uma vez, sem limite de exibição | Evita travar a tela quando um período largo (ex.: 7 dias) traz muitos pedidos
D-06 | A conta de quantos pedidos mostrar (total visível atual + incremento, limitado ao total da lista) vira função pura num arquivo dual-mode testável, seguindo o padrão de `public/busca.js` | Deixar a conta solta dentro de `app.js`, testada só por checagem estática de texto (`contemTrecho`/`trechoEntre`) | É uma conta determinística, sem tocar DOM; merece teste real de `node:test`, reaproveitando convenção já validada no projeto
D-07 | O mesmo mecanismo de "Carregar mais" (30 iniciais, +20) vale também para os cards do celular — **revisa D-02** | Separar em dois mecanismos independentes (um só para desktop, outro só para celular), para manter o celular com paginação numerada como hoje | Descoberto na F3, ao escrever as tasks: desktop (tabela) e celular (cards) hoje leem a mesma fatia de dado já cortada — só a aparência muda por CSS. Manter o celular com o mecanismo antigo exigiria duplicar a lógica, contrariando o próprio motivo de D-01 (evitar complexidade)
```

> **D-07 revisa D-02.** A intenção de D-02 (o problema visual só existe em monitor grande) continua verdadeira e é a motivação original da correção — o que mudou é que "deixar o celular sem mudança" se mostrou tecnicamente mais complexo que unificar, porque os dois já compartilhavam o mesmo dado paginado. D-02 fica registrada como está (não se apaga decisão), e D-07 é o que vale na prática a partir daqui.

## Pendências

```
PENDENTE-01 (NÃO BLOQUEANTE) | Falta decidir se o servidor deve ganhar um teto de linhas para o filtro de período customizado (desde/ate) quando o intervalo for muito largo | trava: nada nesta feature — é assunto separado, de back-end, sem relação com a tela ficar "pela metade". Registrado a pedido do dono para não ser esquecido; será aberto como item próprio em `PROGRESSO.md` (📋 Próximos Passos), fora do escopo deste plano.
```

## Eixos cobertos, sem decisão do usuário por não se aplicarem

- **Contrato de dados**: não se aplica. Nenhuma mudança de schema, tabela, coluna ou migração — o servidor já devolve o período inteiro hoje (`base/00-pedidos-renderizacao-e-paginacao.md`), e esta feature não muda nenhuma rota.
- **Estado e observabilidade**: não se aplica. Troca de UI pura, sem necessidade de log, métrica ou auditoria nova.
- **Ambiente e segredos**: não se aplica. Nenhuma variável de ambiente, segredo ou serviço externo novo.

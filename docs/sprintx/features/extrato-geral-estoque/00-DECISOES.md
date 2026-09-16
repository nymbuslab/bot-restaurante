---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: extrato-geral-estoque
atualizado_em: 2026-09-16
decisoes:
  - id: D-01
    decisao: "extrato geral mostra por padrao so os 4 tipos operacionais (entrada, perda, contagem, ajuste); venda e devolucao ficam fora do padrao, so aparecem se o usuario marcar o filtro"
    alternativa_descartada: mostrar os 6 tipos juntos desde o inicio, sem filtro pre-aplicado
    motivo: "venda e devolucao ja tem visao propria na aba Pedidos; duplicar por padrao poluiria a pergunta que o extrato geral resolve (o que mudou no estoque fora do fluxo de vendas)"
    status: fechada
    bloqueante: false
  - id: D-02
    decisao: "cria aba Relatorios nova e permanente no menu principal do painel (nao existe hoje), com o extrato geral de estoque como primeiro conteudo"
    alternativa_descartada: botao/toggle dentro da aba existente Controle de estoque, sem aba nova
    motivo: "ROADMAP ja sinaliza relatorio financeiro futuro (P3) que precisaria de um lugar assim; criar agora evita realocar o extrato depois e agrupa semanticamente os relatorios do restaurante"
    status: fechada
    bloqueante: false
  - id: D-03
    decisao: "extrato geral reusa a permissao estoque.ver (mesma de Controle de estoque hoje), sem permissao nova"
    alternativa_descartada: permissao nova mais restrita (so o dono, mesmo com estoque.ver)
    motivo: "quem ja ve o estoque por produto deveria ver o consolidado tambem; menos superficie de configuracao de permissoes"
    status: fechada
    bloqueante: false
  - id: D-04
    decisao: "definicao de pronto: lista de movimentos de todos os produtos numa tela so, com filtro por tipo (multi-selecao) e por periodo (presets + customizado), sem abrir produto por produto"
    alternativa_descartada: entregar so a lista geral sem filtros, deixar filtro para depois
    motivo: usuario confirmou que filtro por tipo e periodo fazem parte do que considera pronto
    status: fechada
    bloqueante: false
  - id: D-05
    decisao: "filtro de tipo permite multi-selecao (varios tipos marcados ao mesmo tempo)"
    alternativa_descartada: selecao unica (um chip ativo por vez)
    motivo: "perguntas reais do dia a dia cruzam mais de um tipo (ex.: o que entrou e o que se perdeu esta semana)"
    status: fechada
    bloqueante: false
  - id: D-06
    decisao: "filtro de periodo usa presets (Hoje / 7 dias) + periodo customizado (desde/ate), mesmo padrao ja usado na aba Pedidos"
    alternativa_descartada: so datas livres, sem atalho de presets
    motivo: consistencia com padrao ja validado, atalho mais rapido para o caso comum
    status: fechada
    bloqueante: false
  - id: D-07
    decisao: "paginacao do extrato geral e so por cursor (antes/antesId, como a gaveta de produto ja faz), sem teto de dias no periodo customizado"
    alternativa_descartada: "cursor + teto de 366 dias, como o que foi criado em GET /api/pedidos"
    motivo: "cursor sozinho ja evita payload grande de uma vez; periodo largo so significa mais cliques em Carregar mais, nao risco de resposta gigante"
    status: fechada
    bloqueante: false
  - id: D-08
    decisao: "extrato geral nao tem busca por nome de produto; e a visao consolidada, sem filtro de produto especifico"
    alternativa_descartada: adicionar campo de busca por produto tambem dentro do extrato geral
    motivo: "manter a tela simples; quem quer um produto especifico usa a gaveta que ja existe em Controle de estoque"
    status: fechada
    bloqueante: false
  - id: D-09
    decisao: "aba Relatorios aparece no menu para todos os tenants; quem nao tem Plano Completo ve a mesma tela de bloqueio (cadeado + Ver planos) que Controle de estoque ja usa"
    alternativa_descartada: esconder o item de menu inteiramente para tenants sem Plano Completo
    motivo: "mesmo padrao visual ja validado, funciona como vitrine do recurso"
    status: fechada
    bloqueante: false
---

# Decisões — extrato-geral-estoque

> Uma linha por decisão tomada no planejamento (F2 e, excepcionalmente, F3). Formato fixo. Não apague decisões: uma decisão revertida ganha nova linha que cita a anterior.

## Decisões

```
D-01 | Extrato geral mostra por padrão só os 4 tipos operacionais (entrada, perda, contagem, ajuste); venda/devolução ficam fora do padrão | Mostrar os 6 tipos juntos desde o início, sem filtro pré-aplicado | Venda/devolução já têm visão própria na aba Pedidos; duplicar por padrão poluiria a pergunta que o extrato geral resolve
D-02 | Cria aba "Relatórios" nova e permanente no menu principal, com o extrato geral de estoque como primeiro conteúdo | Botão/toggle dentro da aba existente "Controle de estoque", sem aba nova | ROADMAP já sinaliza relatório financeiro futuro (P3); criar agora evita realocar o extrato depois e agrupa semanticamente os relatórios do restaurante
D-03 | Extrato geral reusa a permissão `estoque.ver` (mesma de Controle de estoque hoje) | Permissão nova mais restrita (só o dono) | Quem já vê o estoque por produto deveria ver o consolidado também
D-04 | Definição de pronto: lista de movimentos de todos os produtos, com filtro por tipo (multi-seleção) e por período (presets + customizado), sem abrir produto por produto | Entregar só a lista geral sem filtros | Usuário confirmou que filtro por tipo e período fazem parte do que considera pronto
D-05 | Filtro de tipo permite multi-seleção | Seleção única (um chip ativo por vez) | Perguntas reais do dia a dia cruzam mais de um tipo
D-06 | Filtro de período usa presets (Hoje / 7 dias) + customizado (desde/até), mesmo padrão da aba Pedidos | Só datas livres | Consistência com padrão já validado
D-07 | Paginação só por cursor (`antes`/`antesId`, como a gaveta já faz), sem teto de dias | Cursor + teto de 366 dias (como em `GET /api/pedidos`) | Cursor sozinho já evita payload grande de uma vez
D-08 | Extrato geral não tem busca por nome de produto | Adicionar campo de busca por produto | Manter a tela simples; a gaveta já resolve o caso de produto específico
D-09 | Aba "Relatórios" aparece no menu para todos os tenants, com a mesma tela de bloqueio (Plano Completo) que Controle de estoque já usa | Esconder o item de menu inteiramente sem o plano | Mesmo padrão visual já validado, funciona como vitrine do recurso
```

## Pendências

Nenhuma pendência.

## Eixos cobertos, sem decisão do usuário por não se aplicarem

- **Contrato de dados**: não se aplica migration nova. `estoque_movimentos` já existe com
  índice compatível (`base/schema-e-consultas-estoque.md`); a feature é só uma consulta nova
  de leitura sobre a tabela existente.
- **Estado e observabilidade**: não se aplica. Rota só de leitura, sem escrita, sem efeito a
  auditar; nenhum log/métrica nova além do já existente para as demais rotas de estoque.
- **Resiliência e política de erro**: não se aplica decisão nova. Reusa os estados já
  padronizados na tela (vazio, erro de rede com "tentar de novo", bloqueado por plano,
  carregando) documentados em `base/ui-tela-controle-de-estoque.md`.
- **Ambiente e segredos**: não se aplica. Nenhuma variável de ambiente, segredo ou serviço
  externo novo.

## Nota — portão de design (regra global, não é decisão do plano)

A aba "Relatórios" é tela nova. Pelas regras globais do usuário, código de UI não pode ser
escrito antes de um protótipo (Google Stitch) aprovado pelo dono — mesmo durante a execução
autônoma da F6. A F3 deve reservar uma task explícita de protótipo + aprovação ANTES de
qualquer task de UI, e a F6 deve parar e aguardar aprovação nesse ponto (a única pausa
permitida dentro da execução autônoma do método).

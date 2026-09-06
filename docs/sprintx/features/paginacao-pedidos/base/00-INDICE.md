---
expx_schema: 1
expx_tool: sprintx
kind: base_indice
trabalho_id: paginacao-pedidos
atualizado_em: 2026-09-06
areas:
  - arquivo: 00-pedidos-renderizacao-e-paginacao.md
    titulo: pedidos renderizacao e paginacao
    lacunas: 1
  - arquivo: 01-padrao-teste-funcao-pura-dual-mode.md
    titulo: padrao teste funcao pura dual mode
    lacunas: 1
---

# Índice da base — paginacao-pedidos

| Arquivo | Área | Resumo |
|---|---|---|
| `00-pedidos-renderizacao-e-paginacao.md` | Pedidos — renderização e paginação atual | Como `carregarPedidos`/`renderListaPedidos` funcionam hoje: busca tudo do período de uma vez, fatia em páginas de 10 no cliente, sem container de altura própria para medir. |
| `01-padrao-teste-funcao-pura-dual-mode.md` | Padrão de teste para função pura extraída de `app.js` | O molde UMD (`busca.js` e outros) que permite testar com `node:test` de verdade, em vez de só checagem estática de texto. |

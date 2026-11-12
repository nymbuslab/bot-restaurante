---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: comandas-abertas-mesas
titulo: comandas abertas em mesas e comandas
tipo_trabalho: feature
fechado_em: 2026-11-12
modulo_afetado: [pedidos, servidor, public, test, documentacao]
arquivos_alterados: [src/pedidos.js, src/servidor.js, public/admin.html, public/app.js, public/equipe.js, public/style.css, test/fixtures/comandas.js, test/comandas-fixtures.test.js, test/comandas-pedidos.test.js, test/comanda-preconta.test.js, test/comandas-mesas-ui.test.js, test/pdv-comanda-modo.test.js, test/integracao/comandas-abertas.test.js, CLAUDE.md]
palavras_chave: [comanda, pdv, mesas, caixa, permissao, pre-conta, responsivo]
resumo: Comandas abertas do PDV aparecem em Mesas com contador, detalhe operacional e retorno do PDV para o registro criado
decisao_principal: D-07 permissoes seguem o risco de cada acao, com pdv.operar para ver imprimir e acrescentar, caixa.movimentar para receber e pedidos.cancelar para cancelar
risco_residual: Tres tasks de API ficaram bloqueadas sem a suite de integracao executada, e a interface nao foi validada em navegador real desktop e mobile
testes_adicionados: 34
---

# Fechamento — comandas-abertas-mesas

> Registro do que este trabalho entregou, em que módulo e em que arquivos. É o que torna a
> feature encontrável depois: por arquivo, por módulo e por palavra-chave.
> Os três campos de indexação são cópia fiel do `ORQUESTRADOR.md` no momento do fechamento.

## O que foi entregue

Quem abre uma comanda no PDV passa a encontrá-la na tela Mesas / Comandas, em uma seção acima das mesas físicas, com número, duração, quantidade de itens e total, sem filtro de data e com as mais antigas primeiro. O detalhe da comanda permite acrescentar produtos, imprimir a pré-conta, receber e cancelar conforme a permissão de cada ação, e continua visível com o caixa fechado ou vencido: nesse estado só o acréscimo e o recebimento ficam bloqueados. Ao finalizar uma venda de tipo Comanda, o sistema navega para a tela, destaca o card e abre o detalhe do registro criado, sem repetir o POST em caso de falha de navegação.

## Decisão principal

**D-07:** `pdv.operar` permite ver, imprimir e acrescentar; `caixa.movimentar` permite receber; `pedidos.cancelar` permite cancelar. É a decisão de maior impacto porque separa risco operacional de risco financeiro: quem lança a comanda não ganha automaticamente o direito de mexer no caixa nem de cancelar pedido.

## Risco residual

T-02.01, T-02.02 e T-02.03 estão `bloqueada` (B-01, B-02, B-03): os endpoints de lista, detalhe, acréscimo e pré-conta estão implementados e cobertos por testes unitários, mas os 12 casos de `test/integracao/comandas-abertas.test.js` nunca rodaram porque falta `.env.test` de um projeto Supabase descartável. A interface também não foi validada em navegador real desktop e mobile; a cobertura executável é a suíte de DOM falso em `test/comandas-mesas-ui.test.js`.

## Onde isto mexeu

- **Módulos:** pedidos, servidor, public, test, documentacao
- **Arquivos:** `src/pedidos.js`, `src/servidor.js`, `public/admin.html`, `public/app.js`, `public/equipe.js`, `public/style.css`, `test/fixtures/comandas.js`, `test/comandas-fixtures.test.js`, `test/comandas-pedidos.test.js`, `test/comanda-preconta.test.js`, `test/comandas-mesas-ui.test.js`, `test/pdv-comanda-modo.test.js`, `test/integracao/comandas-abertas.test.js`, `CLAUDE.md`
- **Testes adicionados:** 34 (22 unitários e 12 de integração)

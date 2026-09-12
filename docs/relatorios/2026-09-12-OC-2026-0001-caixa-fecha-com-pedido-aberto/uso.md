---
expx_schema: 1
expx_tool: runx
kind: relatorio_uso
trabalho_id: OC-2026-0001
titulo: O caixa nao fecha mais com pedido em aberto
tipo_ocorrencia: bug
fechado_em: 2026-09-12
modulo_afetado: [caixa]
---

<!--
LEITOR: o suporte copia este texto e devolve ao cliente.

PROIBIDO APARECER NESTE ARQUIVO — inclusive DENTRO DO FRONTMATTER:
  - nome de arquivo, de pasta ou de caminho
  - nome de função, classe, método ou variável
  - nome de tabela, de coluna ou de banco de dados
  - jargão técnico: endpoint, API, cache, migração, deploy, commit, branch,
    query, log, null, timeout, teste unitário, regressão, integração, build
  - stack trace, trecho de código ou mensagem de erro bruta
  - identificador interno: número de task, nome de sprint, código de commit
  - "N/A" ou "não aplicável" — escreva a dispensa em linguagem de cliente

O FRONTMATTER deste arquivo:
  - NAO leva arquivos_alterados nem testes_adicionados
  - titulo e modulo_afetado vao em linguagem de cliente
  - nenhum nome de arquivo, funcao, tabela ou coluna no YAML

OBRIGATÓRIO:
  - frases curtas, uma ideia por frase
  - falar do que a pessoa VÊ e FAZ no sistema: a tela, o botão, o valor
  - teste final: se um cliente que não é desenvolvedor não entenderia
    qualquer frase, está errado — reescreva

Apague este comentário antes de salvar? NÃO. Ele não aparece no texto
renderizado e serve de lembrete para quem editar o arquivo depois.
-->

# O caixa não fecha mais com pedido em aberto

## O que estava acontecendo

O caixa fechava mesmo com pedidos ainda não pagos, inclusive pedidos de dias anteriores. O sistema avisava no resumo que havia pedidos antigos, mas deixava o caixa fechar assim mesmo, e o pedido em aberto continuava esperando o pagamento.

## O que muda a partir de agora

O sistema passa a impedir o fechamento do caixa enquanto existir qualquer pedido em aberto, não importa o dia do pedido. Se houver um pedido de hoje ou de dias anteriores ainda não pago, o fechamento é bloqueado e o sistema mostra o aviso. Depois de pagar ou cancelar a pendência, é só fechar o caixa como de costume.

## Se é preciso fazer algo diferente

Sim. Antes de fechar o caixa, confira se há pedidos em aberto, inclusive de dias anteriores, e pague ou cancele cada um deles. A tela de Pedidos permite ver e receber essa pendência. Recebendo ou cancelando tudo, o fechamento volta a funcionar normalmente.

## Se é preciso refazer alguma coisa que ficou errada no período

Nada precisa ser refeito. Se houver pedidos que ficaram em aberto de dias anteriores, o primeiro fechamento vai pedir que eles sejam resolvidos antes de fechar — basta receber ou cancelar cada um na tela de Pedidos.
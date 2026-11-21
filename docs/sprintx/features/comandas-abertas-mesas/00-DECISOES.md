---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: comandas-abertas-mesas
atualizado_em: 2026-11-12
decisoes:
  - id: D-01
    decisao: Comandas abertas aparecem em secao sempre visivel acima da grade de mesas
    alternativa_descartada: Abas internas ou mistura de mesas e comandas na mesma grade
    motivo: A conta aberta precisa permanecer visivel sem exigir troca de contexto
    status: fechada
    bloqueante: false
  - id: D-02
    decisao: A Comanda oferece apenas acoes compativeis com pedido aberto
    alternativa_descartada: Copiar pessoas taxa de servico pagamento parcial solicitar conta e transferencia de Mesa
    motivo: Comanda avulsa nao e uma mesa fisica e nao deve ganhar estado artificial
    status: fechada
    bloqueante: false
  - id: D-03
    decisao: Pedidos continua como unica fonte de verdade sem migration nem mesa artificial
    alternativa_descartada: Criar linha em mesas para cada Comanda do PDV
    motivo: Evita duplicacao e preserva o contrato ja entregue da Comanda
    status: fechada
    bloqueante: false
  - id: D-04
    decisao: A secao lista todas as Comandas abertas sem filtro de data e ordena a mais antiga primeiro
    alternativa_descartada: Limitar ao dia ou ao caixa atual
    motivo: Uma Comanda esquecida nao pode desaparecer na virada do dia
    status: fechada
    bloqueante: false
  - id: D-05
    decisao: Abrir Comanda no PDV navega para Mesas e Comandas destaca o card e abre seu detalhe
    alternativa_descartada: Permanecer no PDV com confirmacao passiva
    motivo: O operador confere imediatamente que o lancamento entrou
    status: fechada
    bloqueante: false
  - id: D-06
    decisao: Contador aparece no menu e na secao e cada card mostra duracao sem alerta por limite de tempo
    alternativa_descartada: Alerta apos duas horas ou contador em um unico lugar
    motivo: Visibilidade permanente sem criar prazo arbitrario
    status: fechada
    bloqueante: false
  - id: D-07
    decisao: pdv.operar permite ver imprimir e acrescentar caixa.movimentar permite receber e pedidos.cancelar permite cancelar
    alternativa_descartada: Liberar tudo por pdv.operar ou exigir permissoes de Pedidos para todas as acoes
    motivo: Cada acao segue seu risco operacional e financeiro
    status: fechada
    bloqueante: false
  - id: D-08
    decisao: Quem tem pdv.operar e nao mesas.operar acessa somente a secao de Comandas
    alternativa_descartada: Exigir Mesas ou liberar mesas fisicas junto
    motivo: Quem cria Comanda precisa acompanha-la sem ganhar permissao de salao
    status: fechada
    bloqueante: false
  - id: D-09
    decisao: Comandas continuam visiveis com caixa fechado ou vencido e bloqueiam acrescimo e recebimento
    alternativa_descartada: Ocultar a secao ou permitir lancar em turno irregular
    motivo: A pendencia deve ficar visivel sem misturar operacoes entre turnos
    status: fechada
    bloqueante: false
  - id: D-10
    decisao: A impressao manual da Comanda aberta gera somente a pre-conta
    alternativa_descartada: Oferecer reimpressao integral da via de cozinha
    motivo: A cozinha recebe somente os itens novos de cada rodada e nao deve preparar duplicado
    status: fechada
    bloqueante: false
  - id: D-11
    decisao: Falha de navegacao apos gravar preserva a Comanda mostra seu numero e oferece tentar abrir novamente
    alternativa_descartada: Repetir automaticamente a criacao ou ocultar o sucesso
    motivo: O POST nao pode ser reenviado e duplicar pedido ou estoque
    status: fechada
    bloqueante: false
  - id: D-12
    decisao: Receber ou cancelar remove o card aberto e preserva o registro no historico de Pedidos
    alternativa_descartada: Manter cards encerrados na tela operacional
    motivo: A secao representa somente trabalho pendente
    status: fechada
    bloqueante: false
  - id: D-13
    decisao: A feature usa endpoints internos dedicados de Comandas e reutiliza os servicos existentes de pedido estoque caixa e impressao
    alternativa_descartada: Filtrar a API geral de Pedidos no navegador ou duplicar regras de negocio
    motivo: A lista operacional nao pode herdar a janela Hoje e o servidor segue autoritativo
    status: fechada
    bloqueante: false
  - id: D-14
    decisao: A feature roda nos ambientes existentes sem segredo ou variavel nova
    alternativa_descartada: Criar configuracao ambiental para comportamento local
    motivo: Todo o fluxo e interno e usa infraestrutura ja instalada
    status: fechada
    bloqueante: false
  - id: D-15
    decisao: Pronto exige fluxo completo permissao por acao estados de tela testes e validacao visual desktop e mobile
    alternativa_descartada: Aceitar apenas listagem funcional sem validar falhas e responsividade
    motivo: A entrega precisa impedir o esquecimento e nao apenas mover o problema de lugar
    status: fechada
    bloqueante: false
---

# Decisoes - comandas-abertas-mesas

## Decisoes

```text
D-01 | Comandas abertas ficam em secao sempre visivel acima das mesas | Abas internas ou grade unica | Evita esconder a conta em outro contexto
D-02 | Comanda oferece somente acoes compativeis com pedido aberto | Copiar todos os recursos de Mesa | Comanda avulsa nao e mesa fisica
D-03 | `pedidos` segue como fonte unica, sem migration | Criar mesa artificial | Evita duplicacao de estado
D-04 | Todas as abertas aparecem, mais antiga primeiro | Recorte por dia ou caixa | Conta esquecida nao some na virada
D-05 | Abrir no PDV navega, destaca e abre o card | Permanecer no PDV | Confirma visualmente o lancamento
D-06 | Contador no menu e secao, com duracao e sem limite | Alerta por tempo arbitrario | Visibilidade sem falso prazo
D-07 | Permissoes seguem o risco de cada acao | Tudo por PDV ou tudo por Pedidos | Preserva controle operacional
D-08 | `pdv.operar` sem `mesas.operar` ve somente Comandas | Exigir ou liberar Mesas | Criador acompanha sem ganhar acesso indevido
D-09 | Caixa fechado/vencido mantem visivel e bloqueia acrescimo/recebimento | Ocultar ou editar livremente | Mostra a pendencia sem misturar turnos
D-10 | Impressao manual gera pre-conta | Reimprimir cozinha inteira | Evita preparo duplicado
D-11 | Falha pos-gravacao preserva e oferece tentar abrir | Repetir POST | Evita duplicidade
D-12 | Recebida/cancelada sai da secao e fica em Pedidos | Manter encerradas | Tela mostra somente pendencias
D-13 | Endpoints dedicados reutilizam servicos existentes | Filtrar Pedidos no front ou duplicar regra | Remove filtro Hoje sem bifurcar negocio
D-14 | Sem env ou segredo novo | Configuracao ambiental | Fluxo interno
D-15 | Pronto inclui E2E, permissoes, estados e visual desktop/mobile | Validar so listagem | Fecha o risco operacional completo
```

## Pendencias

Nenhuma pendencia.

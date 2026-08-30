# Decisoes

D-01 | Configurar comprovantes no painel do cliente em `config.impressao.caixa` | configurar no agente desktop | o agente deve continuar imprimindo apenas o que o servidor enfileira
D-02 | Padrao inicial desligado para suprimento, sangria e cancelamento | ligar automaticamente para todos os clientes | preserva o comportamento atual ate o restaurante escolher imprimir
D-03 | Comprovante de cancelamento cobre pedido pago cancelado | incluir estorno manual nesta entrega | o pedido do usuario citou cancelamento, suprimento e sangria
D-04 | Falha ao enfileirar comprovante nao desfaz a acao financeira, mas precisa ser avisada no painel | rollback do movimento quando impressao falhar ou silenciar a falha | caixa ja registrado nao pode ser revertido por erro operacional de impressora, e o operador precisa saber que o papel nao vai sair

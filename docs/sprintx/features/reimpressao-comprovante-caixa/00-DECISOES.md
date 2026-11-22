# Decisões — reimpressao-comprovante-caixa

> Uma linha por decisão tomada no planejamento (F2 e, excepcionalmente, F3). Formato fixo. Não apague decisões: uma decisão revertida ganha nova linha que cita a anterior.

## Decisões

```
D-01 | Comprovante com o toggle DESLIGADO nas Configuracoes ainda mostra o icone e reimprime | esconder o icone junto com o toggle; pedir confirmacao antes | o toggle governa a impressao AUTOMATICA; clicar no icone e pedido explicito do operador, e e justamente na emergencia (papel acabou, impressora desligada) que a saida precisa existir
D-02 | Reimpressao de cancelamento reagrupa os movimentos irmaos e sai IDENTICA ao papel original (valor total + todas as formas) | imprimir so a linha clicada | base/montagem-e-enfileiramento.md risco 1: cancelamento e montado de varios movimentos por normalizarMovimentosComprovante; imprimir um so geraria papel que nunca existiu e nao bate com o extrato na conferencia
D-03 | Movimento de ESTORNO fica FORA do escopo (sem icone) | incluir estorno junto | estorno nao tem comprovante nem toggle hoje (base/00-LACUNAS.md); incluir exigiria criar modelo de comprovante e toggle novos, que e outra feature
D-04 | Reimpressao vale so para o turno ABERTO | alcancar tambem caixas ja fechados | a grade de Movimentacao so mostra o caixa aberto (base/persistencia-do-movimento.md), entao o icone ja nasce limitado a ele; caixas anteriores tem o relatorio de fechamento para reimprimir
D-05 | A rota exige os DOIS gates de plano: exigeCaixa E exigeImpressao | so exigeCaixa; so exigeImpressao | e acao de caixa que produz papel, entao checa os dois eixos; hoje ambos caem no Plano Completo e nao muda nada para o cliente, mas fica correto se os planos separarem
D-06 | Reimpressao NAO grava trilha de auditoria | gravar na tabela auditoria existente | a fila de impressao ja guarda o trabalho com data, e reimprimir nao mexe em dinheiro, entao nao cria risco de conta errada
D-07 | O icone desabilita enquanto a chamada corre e volta depois, com aviso na tela | imprimir a cada clique; travar apos a primeira reimpressao | impede a rajada acidental sem quebrar o caso principal, que e justamente tentar de novo depois que a impressora voltou
D-08 | Pronto = bateria de integracao provando que o texto reenfileirado e identico ao original + visual validado; conferencia no PAPEL real fica registrada como pendencia para a proxima visita ao cliente | exigir papel identico na termica antes de fechar; dispensar a conferencia no papel | fecha a tarefa sem depender de acesso a impressora, sem fingir que o hardware foi validado
D-09 | Nenhuma variavel de ambiente nem segredo novo | — | reusa a fila de impressao, a config de comprovantes e as colunas que ja existem em caixa_movimentos
D-10 | CRIA migracao com indice em caixa_movimentos(pedido_id) | deixar sem indice e so registrar em Proximos Passos | o reagrupamento do cancelamento (D-02) filtra por essa coluna e o indice nao existe hoje (base/00-LACUNAS.md); o dono preferiu resolver junto a ter que lembrar depois
D-11 | O servidor recusa reimprimir o MESMO movimento duas vezes dentro de uma janela curta | aceitar o risco sem limite; limitador por rota como no login | protege a fila da rajada sem barrar a segunda via legitima de OUTRO movimento, que o limitador por rota barraria num dia de muita correcao (achado MEDIA da 1a auditoria, 00-AUDITORIA.md)
D-12 | O passo de apontar o CLI do Supabase para o projeto de TESTE fica escrito na task, e a execucao autonoma segue com ele | tirar o db push da execucao autonoma e deixar como passo manual do dono | escolha do dono; o achado ALTA da 1a auditoria mostrou que sem o passo escrito um executor autonomo aplicaria a migracao em PRODUCAO, ja que o .env local aponta para la
```

### Atenção: cruzamento entre D-09 e D-10

A resposta de P-09 afirmou "nenhuma migração de banco nova" e a de P-10 pediu a migração do índice. As duas foram dadas no mesmo bloco e o texto da opção de P-10 já avisava do conflito. **Resolução registrada:** D-09 vale para variáveis de ambiente e segredos (nada novo); D-10 prevalece sobre a parte de migração, então **a entrega TEM uma migração**, e `npx supabase db push` entra no plano. Se a intenção era não ter migração nenhuma, esta linha precisa ser revertida com uma D-11 antes da F3.

## Pendências

Nenhuma pendência.

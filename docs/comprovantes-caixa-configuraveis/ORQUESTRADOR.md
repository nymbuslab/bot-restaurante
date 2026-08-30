# Orquestrador

## Objetivo

Adicionar comprovantes configuraveis para suprimento, sangria e cancelamento pago. A configuracao fica no painel do cliente, o servidor renderiza e enfileira, e o agente continua apenas imprimindo a fila.

## Mapa e ordem de leitura

1. `docs/comprovantes-caixa-configuraveis/ORQUESTRADOR.md`
2. `docs/comprovantes-caixa-configuraveis/00-DECISOES.md`
3. `docs/comprovantes-caixa-configuraveis/base/00-INDICE.md`
4. `docs/comprovantes-caixa-configuraveis/base/caixa.md`
5. `docs/comprovantes-caixa-configuraveis/base/impressao-fila.md`
6. `docs/comprovantes-caixa-configuraveis/base/configuracoes.md`
7. `docs/comprovantes-caixa-configuraveis/sprint-01/sprint.md`
8. `docs/comprovantes-caixa-configuraveis/sprint-01/fases.md`
9. `docs/comprovantes-caixa-configuraveis/sprint-01/tasks.md`

## Rota de execucao

Executar Sprint 01 em ordem: F-01, F-02, F-03. Caminho critico: T-01.01 -> T-01.02 -> T-01.03. Nao ha paralelismo declarado.

## Ferramentas

- Teste puro: `node --test test/comprovante-caixa.test.js`
- Teste de integracao focado: `node --test test/integracao/caixa-comprovantes.test.js`
- Sintaxe: `npm run check`
- Integracao geral: `npm run test:integracao`
- Suite rapida: `npm test`
- Segredos: `DATABASE_URL` em `.env` e `.env.test`, sem registrar valores.

## Agentes

Um agente unico assume tres papeis por task: implementador escreve teste e codigo; revisor de testes confere se o teste falharia com implementacao errada; auditor de aceite confirma o criterio antes de marcar concluida.

## Regras de autonomia

Teste antes do codigo. Duvida nova vira registro em `00-BLOQUEIOS.md`. Criterio de aceite nao atendido impede marcar task como concluida. Atualizar `tasks.md` conforme cada task fecha.

## Definicao de pronto global

A tela Configuracoes > Impressora salva tres toggles de comprovante. O servidor enfileira somente os tipos ativados. A falha de impressao nao desfaz o movimento financeiro. Testes focados e suites do projeto passam.

## Como retomar uma sessao interrompida

Ler este arquivo, ler os `status` em `sprint-01/tasks.md`, ler `00-BLOQUEIOS.md` e continuar da primeira task `pendente` ou `em_andamento` cujas dependencias estejam `concluida`.

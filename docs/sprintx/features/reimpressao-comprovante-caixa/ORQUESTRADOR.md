# Orquestrador — reimpressao-comprovante-caixa

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

Hoje o comprovante 80mm de sangria, suprimento e cancelamento de pedido pago é impresso uma única vez, no instante do movimento. Se a impressora estava desligada, o papel acabou ou o cliente pede segunda via, não existe caminho de volta. Esta feature põe um ícone de impressora na coluna de ações que já existe na grade do caixa aberto, e uma rota que remonta o comprovante a partir do movimento guardado e o enfileira de novo, idêntico ao original.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — as 10 decisões que governam o plano, com destaque para o cruzamento entre D-09 e D-10
3. `base/00-INDICE.md` — e os 4 arquivos da base que ele lista, principalmente `base/montagem-e-enfileiramento.md`, que carrega o risco mais alto
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/sprint.md` → `fases.md` → `tasks.md`
6. `sprint-03/sprint.md` → `fases.md` → `tasks.md`
7. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução
8. `00-AUDITORIA.md` — achados MÉDIA/BAIXA que permanecem válidos

## 3. Rota de execução

- **Sprint 01:** F-01.1 ∥ F-01.2 (paralelas). Dentro da F-01.2, T-01.02 → T-01.03.
- **Sprint 02:** F-02.1 → F-02.2 → F-02.3 (sequenciais). Dentro da F-02.2, T-02.02 → T-02.03; dentro da F-02.3, T-02.04 → T-02.05.
- **Sprint 03:** F-03.1 → F-03.2 (sequenciais). Dentro da F-03.1, T-03.01 → T-03.02.

Única janela de paralelismo do plano inteiro: **T-01.01 ∥ T-01.02** (a migração do índice e o helper de fila não se tocam). Todo o resto é sequencial por dependência declarada.

**Caminho crítico:** T-01.02 → T-01.03 → T-02.02 → T-02.03 → T-02.04 → T-02.05 → T-03.02 → T-03.03 → T-03.04

**Ponto de atenção no caminho:** a T-01.01 carrega o único comando do plano que pode escrever no banco do cliente (`npx supabase db push`). O portão obrigatório está escrito no próprio `sprint-01/tasks.md`, logo abaixo da task, e é para ser seguido passo a passo (D-12).

Observe que T-02.01 e T-01.01 ficam fora do caminho crítico: podem ser feitas a qualquer momento antes de quem depende delas (T-02.04/T-03.01 e a aplicação do schema, respectivamente).

## 4. Ferramentas

- **MCPs / SDKs:** Playwright (validação visual da T-03.03). Claude Design não é necessário na execução: o desenho já está aprovado em `design/canvas/Main.dc.html`.
- **Testes:** `npm test` (suíte rápida), `npm run test:integracao` (banco real do `.env.test`), `npm run test:ci` (o que o GitHub roda)
- **Lint:** NÃO EXISTE NO PROJETO. O equivalente é `npm run check` (varredura de sintaxe).
- **Typecheck:** NÃO EXISTE NO PROJETO (JavaScript puro, sem TypeScript).
- **Migração:** `npx supabase db push` — na T-01.01, aplicada ao **projeto de teste**, não ao de produção.
- **Segredos:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ficam no `.env` local (aponta para PRODUÇÃO); a bateria de integração usa o `.env.test`, que precisa da marca `BANCO_DE_TESTE=1` e recusa rodar se apontar para o mesmo projeto do `.env`. NUNCA escreva o valor de nenhuma delas.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task, vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem, tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada.
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite` verificado. Não existe "concluído com ressalva".
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md` (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`, pular para a próxima paralelizável. Nunca parar e esperar.
5. Só rode em paralelo o que o plano declarou paralelizável; a execução nunca decide paralelismo.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.

## 7. Definição de pronto global

- [ ] `POST /api/caixa/movimento/:id/reimprimir` devolve 200 para sangria, suprimento e cancelamento, e o texto enfileirado é **string-idêntico** ao enfileirado no registro original.
- [ ] A reimpressão funciona com o toggle daquele tipo DESLIGADO (D-01).
- [ ] Reimpressão de cancelamento sai reagrupada, com valor somado e todas as formas (D-02).
- [ ] Movimento de `recebimento` e de `estorno` são recusados pela rota e não mostram ícone (D-03).
- [ ] Rota barra empresa fora do Plano Completo pelos dois gates (D-05) e devolve 404 para id de outra empresa.
- [ ] O ícone aparece só nas três linhas certas e desabilita durante o envio (D-07).
- [ ] Dois pedidos seguidos de reimpressão do MESMO movimento, dentro da janela, enfileiram 1 trabalho e não 2 (D-11).
- [ ] `npm test`, `npm run check`, `npm run test:ci` e `npm run test:integracao` terminam com `fail 0`.
- [ ] Playwright em 1366x768 e 390x844 sem erro de console e sem scroll horizontal.
- [ ] `PROGRESSO.md` com o item em Concluído e a **conferência no papel real da térmica** aberta em Próximos Passos (D-08), porque essa parte fica pendente de propósito.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

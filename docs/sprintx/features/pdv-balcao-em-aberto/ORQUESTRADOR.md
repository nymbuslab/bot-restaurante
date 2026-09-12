---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: pdv-balcao-em-aberto
titulo: PDV - Comanda em aberto
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f6
status: concluido
criado_em: 2026-09-07
atualizado_em: 2026-09-11
concluido_em: 2026-09-11
sprints: [sprint-01, sprint-02, sprint-03, sprint-04]
caminho_critico: [T-01.01, T-02.01, T-02.02, T-02.03, T-03.02, T-03.03, T-04.01]
modulo_afetado: [raiz, public, test]
arquivos_alterados: [src/servidor.js, src/pedidos.js, public/app.js, scripts/test-integracao.js, test/pdv-comanda-tile.test.js, test/pdv-comanda-modo.test.js, test/pedido-modal-acrescentar-item.test.js, test/pedido-modal-cancelar-aviso.test.js, test/integracao/pedidos-comanda.test.js]
palavras_chave: [comanda, pdv, pedidos, cozinha, acrescimo-itens, fechamento-caixa, impressao, balcao]
---

# Orquestrador — pdv-balcao-em-aberto

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

O PDV ganha um novo tipo de venda, "Comanda", que fica em aberto (como uma mesa) em vez de
fechar na hora: o atendente pode reabrir o pedido a partir da aba Pedidos e acrescentar itens
antes de fechar e cobrar. Resolve o atrito de hoje — cliente decide levar mais coisas depois
que o pedido de Balcão já foi fechado, e a única saída era lançar de novo, cancelar e relançar,
ou passar pelo fluxo pesado de abrir uma Mesa. O fechamento reusa o modal "Receber pagamento"
que Entrega/Retirada já usam — não precisa de tela nova para isso.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — decisões que governam o plano (D-01 a D-13)
3. `base/00-INDICE.md` — e os arquivos da base que ele lista
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/` → `sprint-03/` → `sprint-04/`, na mesma ordem (`sprint.md` → `fases.md` → `tasks.md` em cada uma)
6. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução
7. `00-AUDITORIA.md` — achados MÉDIA/BAIXA que permanecem válidos (quando existir)

## 3. Rota de execução

- Sprint 01 (capacidade de testar): F-01.1
- Sprint 02 (backend): F-02.1 → F-02.2 sequencial (T-02.01 e T-02.03 alteram o mesmo `src/servidor.js` — corrigido na F5, deixou de ser paralelo)
- Sprint 03 (UI): F-03.1 → F-03.2 → F-03.3 (cadeia única, mesmo arquivo `public/app.js`)
- Sprint 04 (fechamento e testes finais): F-04.1 (depende de T-03.03, sprint-03) ∥ F-04.2 (paralelas entre si, nenhuma depende da outra) → F-04.3

**Caminho crítico:** T-01.01 → T-02.01 → T-02.02 → T-02.03 → T-03.02 → T-03.03 → T-04.01
(7 tasks). T-04.01 é a task mais longa do feature porque depende de TODA a cadeia de UI da
sprint-03 (mesmo arquivo `public/app.js`) — corrigido na F5 (achado ALTA: T-04.01 estava sem
essa dependência declarada). T-04.03 (fim a fim) também depende de T-02.03 e T-04.02, mas seu
caminho é mais curto (6 tasks) e não é o gargalo.

## 4. Ferramentas

- **MCPs / SDKs:** nenhum além do padrão do projeto.
- **Testes (integração, backend):** `npm run test:integracao` (roda `test/integracao/**`, exige `.env.test` com `BANCO_DE_TESTE=1` — ver `CLAUDE.md` raiz, seção "Como rodar").
- **Testes (harness de front, lógica pura de `public/app.js`):** `npm test` (runner `node:test`, sem dependência de banco).
- **Lint:** NÃO EXISTE NO PROJETO (usa `npm run check`, varredura de sintaxe, não lint de estilo).
- **Typecheck:** NÃO EXISTE NO PROJETO (JS puro, sem TypeScript).
- **Segredos:** nenhuma variável nova (D-12 do `00-DECISOES.md`). A feature reusa `.env.test` já existente para os testes de integração.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task, vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem, tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

**Portão de design (sprint-03 e T-04.01).** Antes de escrever qualquer HTML/CSS/JS de tela
nova ou alterada — o tile "Comanda", o banner "Acrescentando à Comanda #NN", o botão
"Acrescentar item" e a confirmação de cancelamento — gerar o protótipo na skill `design`
(Claude Design) com os tokens reais de `public/style.css` e aguardar aprovação explícita do
dono. Este portão vale mesmo durante a execução autônoma da F6 e não é dispensado por "não
pergunte" da regra 1 abaixo — é uma exceção deliberada (ver `sprint-03/sprint.md`).

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — **exceto o portão de design da Seção 5, que é a única exceção deliberada**.
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite` verificado. Não existe "concluído com ressalva".
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md` (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`, pular para a próxima paralelizável. Nunca parar e esperar.
5. Só rode em paralelo o que o plano declarou paralelizável; a execução nunca decide paralelismo.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.

## 7. Definição de pronto global

Os 4 critérios de D-13 (`00-DECISOES.md`), cada um coberto pelo teste da task que o implementa
(**correção da F5**: nem todos são cobertos por T-04.03 — o critério 4 é comportamento de UI,
inacessível a um teste HTTP/Postgres):

1. Abrir uma Comanda e acrescentar itens depois, com total/itens atualizados na tela — coberto por T-04.03 (`test/integracao/pedidos-comanda.test.js`).
2. A cozinha recebe uma via impressa só com os itens do acréscimo, não o pedido inteiro de novo — coberto por T-04.03.
3. Fechar a Comanda e cobrar pelo modal "Receber pagamento" já existente — coberto por T-04.02 e T-04.03.
4. Cancelar um item já enviado à cozinha mostra o segundo aviso específico de cozinha (D-08) — coberto por T-04.01 (`test/pedido-modal-cancelar-aviso.test.js`, harness de UI), NÃO por T-04.03.

Mais os critérios de saída de cada sprint (`sprint-01/sprint.md` a `sprint-04/sprint.md`) e a
suíte completa (`npm test` + `npm run test:integracao`) passando com 0 failed.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

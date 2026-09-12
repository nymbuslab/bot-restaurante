---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: relatorios-telegram
titulo: Relatorios via Telegram para o dono do restaurante
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f6
status: concluido
criado_em: 2026-09-06
atualizado_em: 2026-09-06
concluido_em: 2026-09-06
sprints: [sprint-01, sprint-02, sprint-03]
caminho_critico: [F-01.1, F-03.1, F-03.2, F-03.3]
modulo_afetado: [raiz, test, design, public]
arquivos_alterados: [src/telegram.js, test/telegram.test.js, src/empresas.js, test/empresas-telegram.test.js, test/telegram-admin-rotas.test.js, src/servidor.js, test/telegram-job.test.js, index.js, design/canvas/relatorios-telegram.dc.html, test/telegram-admin-ui.test.js, public/app-admin.js, public/style.css, test/telegram-fechamento-caixa.test.js, src/caixa.js]
palavras_chave: [telegram, relatorios, caixa, estoque, admin-master, vinculacao, notificacao, fechamento]
---

# Orquestrador — relatorios-telegram

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

Enviar, via Telegram, o fechamento de caixa do dia e um alerta de estoque baixo/esgotado ao
dono de cada restaurante, assim que ele fecha o caixa pelo painel. Configuração exclusiva do
admin-master (operador), restrita a tenants no Plano Completo. Bot único da plataforma; cada
tenant é identificado pelo próprio `chat_id`, vinculado por um código de uso único gerado no
admin-master.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — decisões que governam o plano (14 decisões, D-01 a D-13, e PENDENTE-01 não bloqueante)
3. `base/00-INDICE.md` — e os arquivos da base que ele lista (7 áreas: Telegram Bot API, admin-master, config jsonb, canal de e-mail, jobs agendados, fontes de dados, gating de plano)
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/` e `sprint-03/`, na mesma ordem
6. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução

## 3. Rota de execução

- Sprint 01: F-01.1 ∥ F-01.2 (paralelas, arquivos diferentes: `src/telegram.js` vs `src/empresas.js`)
- Sprint 02: F-02.1 → F-02.3 (T-02.05 depende de T-02.01, dentro de F-02.1) ∥ F-02.2 (independente, só depende de sprint-01) → F-02.4 (depende de F-02.1 e F-02.3)
- Sprint 03: F-03.1 → F-03.2 → F-03.3 (cadeia única, sem paralelismo)

**Caminho crítico:** T-01.01 → T-01.02 → T-01.03 → T-01.04 → T-01.05 → T-01.06 → T-03.01 → T-03.02 → T-03.03 (nove tasks; é a cadeia mais longa da feature — as rotas e a UI do admin-master, sprint-02, terminam antes por um caminho mais curto e não apertam o calendário total).

**Atenção — pausa não negociável no meio do caminho não-crítico:** `T-02.05` (fora do
caminho crítico, mas bloqueante para `T-02.06`) é o protótipo visual da aba no admin-master.
Por instrução do `CLAUDE.md` global do usuário, a execução autônoma PARA nessa task e espera
aprovação explícita do protótipo antes de escrever qualquer código de `T-02.06` — essa é a
única exceção à Regra de autonomia 1 (seção 6), e ela vence mesmo em execução autônoma.

## 4. Ferramentas

- **MCPs / SDKs:** nenhum além do padrão do projeto. O envio ao Telegram é HTTP puro
  (`fetch` para `api.telegram.org`), sem SDK — mesmo padrão de `src/email.js` (Resend) e
  `src/frete.js` (Geoapify).
- **Testes:** `npm test` (roda `node --test test/*.test.js`). Testes de rota seguem o padrão
  estático do projeto (leitura de `src/servidor.js` como texto + `assert.match`, ver
  `test/super-admin.test.js`), não chamadas HTTP reais — o projeto não usa supertest.
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO. Há `npm run check` (varredura de sintaxe, `scripts/check-syntax.js`), útil mas não é typecheck.
- **Segredos:** `TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME` — ficam em `.env` local e nas
  variáveis de ambiente de produção (Fly.io), mesmo padrão de `RESEND_API_KEY`/`GEOAPIFY_API_KEY`.
  NUNCA escreva o valor em nenhum artefato. Ver PENDENTE-01 em `00-DECISOES.md`: o bot ainda
  não existe — até existir, `src/telegram.js` roda em modo no-op (`CONFIGURADO=false`),
  igual a `src/email.js` sem `RESEND_API_KEY`.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task, vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem, tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — **exceto** o portão de design descrito na seção 3 (`T-02.05`): esse é o único ponto da execução onde a instrução do `CLAUDE.md` global do usuário substitui esta regra, e a task fica em andamento até a aprovação chegar.
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite` verificado. Não existe "concluído com ressalva" — exceto `T-03.03`, cujo "teste" é o próprio roteiro manual com Telegram real (ver Definição de pronto global, item 4).
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md` (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`, pular para a próxima paralelizável. Nunca parar e esperar — exceto a exceção da regra 1.
5. Só rode em paralelo o que o plano declarou paralelizável; a execução nunca decide paralelismo.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.

## 7. Definição de pronto global

Derivado de D-13 (`00-DECISOES.md`) e dos critérios de saída das três sprints:

1. `npm test` verde, cobrindo todas as tasks de sprint-01, sprint-02 e sprint-03.
2. Operador consegue, no admin-master, gerar o link de vinculação, ver o tenant passar para
   "vinculado" depois de um `/start` real no Telegram, e disparar "Enviar teste agora" com
   sucesso (T-02.06 + T-03.03, primeira metade).
3. Fechar um caixa de teste real (com item de estoque baixo cadastrado) dispara sozinho, sem
   clique adicional, as duas mensagens (fechamento de caixa e estoque baixo, D-12) no Telegram
   do dono de teste (T-03.03, segunda metade).
4. `GET /api/admin/tenants/:slug/telegram` reflete `ultimoEnvio` corretamente após essa tentativa.
5. Nenhuma task com PENDENTE-01 ainda pendente impede os itens 1 e 2 acima — só os itens 3 e 4
   (que exigem Telegram real) dependem do usuário ter criado o bot e configurado
   `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

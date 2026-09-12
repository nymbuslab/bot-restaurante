---
expx_schema: 1
expx_tool: sprintx
kind: orquestrador
trabalho_id: personalizacao-relatorios-telegram
titulo: Personalizacao dos Relatorios Telegram
tipo_trabalho: feature
tipo_ocorrencia: null
estagio: f6
status: concluido
criado_em: 2026-09-07
atualizado_em: 2026-09-08
concluido_em: 2026-09-08
sprints: [sprint-01, sprint-02, sprint-03, sprint-04]
caminho_critico: [F-01.2, F-01.4, F-02.1, F-02.3, F-02.4, F-03.1, F-03.2, F-03.3, F-04.1]
modulo_afetado: [raiz, test, design, public]
arquivos_alterados: [public/relatorio-caixa.js, test/relatorio-caixa.test.js, src/caixa-calc.js, test/caixa-calc.test.js, src/telegram.js, test/telegram.test.js, src/servidor.js, test/telegram-admin-rotas.test.js, design/canvas/personalizacao-relatorios-telegram.dc.html, public/app-admin.js, public/style.css, test/telegram-admin-ui.test.js, src/caixa.js, test/telegram-cancelamento.test.js, test/telegram-fechamento-caixa.test.js]
palavras_chave: [telegram, relatorios, caixa, estoque, cancelamento, admin-master, personalizacao, toggles]
---

# Orquestrador — personalizacao-relatorios-telegram

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

Evolução da feature `relatorios-telegram`: o dono passa a escolher, por checkbox no
admin-master, quais relatórios cada restaurante recebe (fechamento de caixa, estoque, alerta de
cancelamento com margem em R$). O fechamento de caixa fica muito mais detalhado (operador,
data/hora, quantidade e valor por forma, diferença por forma) e o estoque sai em duas seções
(zerado / mínimo). O alerta de cancelamento cobre só os dois pontos onde dinheiro já recebido é
revertido (cancelar pedido pago/PDV, estornar recebimento) — não cancelamentos antes de pagar.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — 10 decisões (D-01 a D-10), sem pendência
3. `base/00-INDICE.md` — 8 áreas, incluindo `pontos-de-cancelamento.md` (mapeamento dos 6 pontos de cancelamento do sistema, só 2 em escopo)
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/`, `sprint-03/`, `sprint-04/`, na mesma ordem
6. `00-BLOQUEIOS.md`

## 3. Rota de execução

- Sprint 01: F-01.1 ∥ F-01.2 ∥ F-01.3 (independentes, arquivos diferentes) → F-01.4 (depende das três)
- Sprint 02: F-02.1 → F-02.2 ∥ F-02.3 (paralelas entre si, ambas só dependem de F-02.1) → F-02.4
- Sprint 03: F-03.1 → F-03.2 (mesmo arquivo, sequencial) ∥ F-03.3 (independente das duas, mas mesmo arquivo na prática — sem paralelismo declarado)
- Sprint 04: F-04.1 ∥ F-04.2 (independentes entre si; cada uma fecha uma metade da Definição de Pronto)

**Caminho crítico:** T-01.02 → T-01.03 → T-01.05 → T-01.06 → T-01.07 → T-02.01 (via T-01.04... na
verdade T-02.01 depende de T-01.04, não da cadeia de T-01.07 — ver nota abaixo) → T-02.03 →
T-02.04 → T-02.05 → T-04.01 (nove tasks, contando a mais longa cadeia real: T-01.02→T-01.03→
T-01.05→T-01.06→T-01.07 termina na sprint-01; em paralelo, T-01.04→T-02.01→T-02.03→T-02.04→
T-02.05→T-04.01 é a cadeia que efetivamente comanda o calendário, por atravessar as quatro
sprints). Use `tasks.md` de cada sprint como fonte exata de dependência — este resumo é
só orientação de leitura.

**Atenção — pausa não negociável:** `T-02.03` (protótipo das abas) é o portão de design do
`CLAUDE.md` global do usuário — a execução autônoma para ali e espera aprovação explícita antes
de `T-02.04`/`T-02.05`, mesma exceção já usada e documentada na feature `relatorios-telegram`.

## 4. Ferramentas

- **MCPs / SDKs:** nenhum além do padrão do projeto (Claude Design para o protótipo de T-02.03).
- **Testes:** `npm test`. Rotas/UI/job seguem o padrão estático do projeto (leitura de
  código-fonte como texto + `assert.match`/`indexOf`), não HTTP real nem DOM real — mesmo
  padrão já usado em `test/telegram-admin-rotas.test.js`/`test/telegram-admin-ui.test.js`.
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO. `npm run check` faz varredura de sintaxe.
- **Segredos:** nenhum novo. Reaproveita `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` já
  configurados em produção (Fly) pela feature `relatorios-telegram`.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task, vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência dentro de cada task, tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — **exceto** o portão de design em `T-02.03` (seção 3), onde a instrução do `CLAUDE.md` global do usuário substitui esta regra.
2. O teste vem antes do código, sempre.
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite` verificado — exceto `T-04.01`/`T-04.02`, cujo "teste" é o roteiro manual com Telegram real.
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md`, marcar `bloqueada`, pular para a próxima paralelizável. Nunca parar e esperar — exceto a exceção da regra 1.
5. Só rode em paralelo o que o plano declarou paralelizável; a execução nunca decide paralelismo.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado da suíte — sincronizando frontmatter E prosa (lição da feature anterior: as duas têm que dizer a mesma coisa).
7. Critério de saída de fase/sprint não atendido = não avança.
8. **Lições da feature anterior, aplicáveis aqui:** toda rota nova em `src/servidor.js` que toca `config` de um tenant chama `store.ensure(tenantDir)` ANTES de `store.getConfig` (cache pode estar frio); todo `store.setConfig` mescla no config JÁ lido, nunca substitui o objeto inteiro; todo teste que afirma "preserva as demais chaves" semeia a fixture via stub de `db.query`, nunca via `store.setConfig` (que aqueceria o cache e mascararia a ausência de `ensure`).

## 7. Definição de pronto global

Derivado de D-10 e dos critérios de saída das quatro sprints:

1. `npm test` verde cobrindo todas as tasks de sprint-01, 02 e 03.
2. Checkboxes de tipo (fechamento, estoque, cancelamento) funcionam de verdade no admin-master —
   marcar/desmarcar muda o que é enviado (T-04.01, primeira metade).
3. Fechamento de caixa chega detalhado (operador, quantidade+valor por forma, diferença por
   forma) e o estoque chega em duas seções, testado com Telegram real (T-04.01, segunda metade).
4. Alerta de cancelamento chega só acima da margem configurada, testado com Telegram real tanto
   para cancelamento de pedido pago quanto para estorno de recebimento (T-04.02).
5. `GET /api/admin/tenants/:slug/telegram` reflete `tipos` e `ultimoEnvio` por tipo corretamente.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

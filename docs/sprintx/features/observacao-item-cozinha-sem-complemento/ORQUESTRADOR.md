# Orquestrador — observacao-item-cozinha-sem-complemento

> Porta de entrada da execução. Escrito para quem abriu o repositório agora e não sabe nada. Só caminhos relativos; nunca o valor de um segredo.

## 1. Objetivo

Fazer o PDV e as Mesas (mesma grade, mesmos handlers em `public/app.js`) abrirem o modal de item já existente ao clicar num produto marcado como "Imprime na cozinha" (`item.cozinha === true`) que não tem grupo de complemento/composição configurado — hoje esse clique empilha o item direto no carrinho, sem chance de observação. O modal (já pronto, reaproveitado sem alteração visual) deixa o operador escrever uma observação opcional, que já é persistida e já sai impressa na via da cozinha sem nenhuma mudança de backend. O cardápio web (`/c/:slug`, link do bot) não muda — já pergunta observação para todo item hoje.

## 2. Mapa e ordem de leitura

1. Este arquivo (`ORQUESTRADOR.md`)
2. `00-DECISOES.md` — decisões que governam o plano (D-01 a D-11)
3. `base/00-INDICE.md` — e os arquivos da base que ele lista (especialmente `base/03-pdv-mesas-tile-click.md`, onde está o gap real)
4. `sprint-01/sprint.md` → `fases.md` → `tasks.md`
5. `sprint-02/sprint.md` → `fases.md` → `tasks.md`
6. `00-BLOQUEIOS.md` — bloqueios registrados durante a execução
7. `00-AUDITORIA.md` — achados MÉDIA/BAIXA que permanecem válidos (gerado na F5)

## 3. Rota de execução

- Sprint 01: F-01.1 → F-01.2 (sequencial: F-01.2 depende do arnês da F-01.1)
- Sprint 02: F-02.1 → F-02.2 (sequencial: a validação real da F-02.2 depende da mudança de código da F-02.1)

Dentro de cada fase, as tasks também são sequenciais (nenhuma task desta feature foi declarada `paralelizavel: true` — T-02.01 e T-02.02 tocam o mesmo arquivo `public/app.js` e por isso rodam em sequência, não em paralelo).

**Caminho crítico:** T-01.01 → T-01.02 → T-02.01 → T-02.02 → T-02.03 (toda a feature é uma cadeia única, sem ramais paralelos).

## 4. Ferramentas

- **MCPs / SDKs:** nenhum além do padrão do projeto. A F-02.1 usa a skill `design` (Claude Design) para o protótipo exigido em D-06 — sem MCP, é a skill nativa do Claude Code.
- **Testes:** `npm test` (suíte completa, `node --test test/*.test.js`) — para rodar só os testes desta feature: `node --test test/pdv-clique-produto.test.js`.
- **Sintaxe:** `npm run check` (`node scripts/check-syntax.js`).
- **CI (sem `.env`):** `npm run test:ci`.
- **Integração (toca banco real de teste):** `npm run test:integracao` — exige `.env.test` próprio (ver `CLAUDE.md` do projeto); não roda contra produção.
- **Lint:** NÃO EXISTE NO PROJETO.
- **Typecheck:** NÃO EXISTE NO PROJETO (projeto é JavaScript puro, sem TypeScript).
- **Segredos:** nenhum segredo novo é necessário para esta feature.

## 5. Agentes

- **Implementador** — escreve primeiro os dois testes da task, vê ambos falharem, implementa até passarem.
- **Revisor de testes** — antes de aceitar o verde, responde: este teste falharia com uma implementação errada? Se não, o teste volta.
- **Auditor de aceite** — verifica de fato o `criterio_aceite` da task antes de permitir `status: concluida`.

**Agente único:** assume os três papéis em sequência dentro de cada task, nesta ordem, tratando cada papel como um portão — não avança ao papel seguinte sem fechar o anterior.

## 6. Regras de autonomia

1. Não pergunte nada; não peça autorização para nada — **exceto** o portão de protótipo (D-06, regra 12-A do método): T-02.01 e T-02.02 nascem com `prototipo: pendente` e só fecham com `prototipo: aprovado: <caminho>`; gere o protótipo, registre o bloqueio de aprovação e siga para a próxima task paralelizável enquanto aguarda.
2. O teste vem antes do código, sempre (T-02.01 e T-02.02 editam o mesmo teste de caracterização criado em T-01.02 — a mudança de expectativa nesse arquivo É o RED da task).
3. Task só é `concluida` com teste de integração E funcional passando e `criterio_aceite` verificado. Não existe "concluído com ressalva".
4. Dúvida nova ou pré-requisito faltando: registrar em `00-BLOQUEIOS.md` (`B-NN | task | bloqueio | o que destravaria`), marcar a task `bloqueada`, pular para a próxima paralelizável. Nunca parar e esperar.
5. Só rode em paralelo o que o plano declarou paralelizável — nesta feature, nada é paralelo; a rota é uma cadeia única.
6. Atualize `status` em `tasks.md` a cada transição; ao concluir, acrescente data e resultado da suíte.
7. Critério de saída de fase/sprint não atendido = não avança.

## 7. Definição de pronto global

- [x] `npm test`, `npm run check` e `npm run test:integracao` terminam 100% verdes.
- [x] Item fixture `cozinha:true` sem grupo/variação/kg, clicado no PDV, abre `abrirPdvItemModal` (não empilha direto) — T-02.01 GREEN.
- [x] Item fixture `cozinha:true` com variação e sem grupo, clicado como sabor de busca, abre `abrirPdvItemModal` — T-02.02 GREEN.
- [x] Os casos que NÃO mudam (sem-cozinha+sem-nada; cozinha+grupo) continuam com o mesmo comportamento documentado em T-01.02 (regressão zero, D-10).
- [x] Protótipo gerado e aprovado pelo dono (D-06) para as duas tasks de UI (aprovado em 2026-09-03).
- [x] Observação digitada no modal aparece literalmente como `Obs: <texto>` na via da cozinha, testado de verdade no PDV avulso E numa Mesa (D-07, T-02.03).
- [x] Cardápio web (`public/cardapio.js`, `src/cardapio-web.js`) permanece intocado (D-01) — nenhum arquivo desse canal aparece em nenhum `arquivos.altera` desta feature.

## 8. Como retomar uma sessão interrompida

1. Leia este arquivo inteiro.
2. Leia o `status` de cada task em cada `sprint-NN/tasks.md`.
3. Leia `00-BLOQUEIOS.md`.
4. Continue da primeira task `pendente` ou `em_andamento` cujas dependências (`depende_de`) estão todas `concluida`. Ignore as `bloqueada` até que o bloqueio registrado seja resolvido.

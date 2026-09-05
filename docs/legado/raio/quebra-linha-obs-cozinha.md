# Raio de impacto — quebra-linha-obs-cozinha

Trabalho: quebra-linha-obs-cozinha — Quebra de linha da `Obs:` na via da cozinha não usa `quebrar()`
Skill irmã: runx (correção de defeito em comportamento existente)
Calculado em: 2026-09-05
Limiares aplicados: `docs/legado/PERFIL.md`, seção 9

---

## Conjunto de arquivos alvo

> Esta lista trava o escopo do cálculo. Se ela crescer durante o trabalho, o raio é recalculado.

- `public/comanda.js` — linha 92, dentro de `montarCozinha`: `linhas.push("   Obs: " + i.observacao.trim())` passa a usar `quebrar(...)` (a função já existe no mesmo arquivo, linha 28, e já é usada nas linhas 122, 168, 173, 286), do mesmo jeito que as outras linhas de texto livre do arquivo.
- `public/comanda.js` — linha 98, mesma função (`Obs. geral:` do pedido): mesmo defeito, mesma correção. **Adicionada ao escopo em 2026-09-05 por aprovação explícita do dono** (o conjunto de arquivos, `public/comanda.js`, não mudou — só as linhas tocadas dentro dele cresceram de 1 para 2; nenhum dos 8 sinais do raio muda com isso, então não houve recálculo de faixa).

---

## Sinais coletados

| # | Sinal | Valor | Método de coleta | Coletado ou assumido |
|---|---|---|---|---|
| 1 | Chamadores diretos e indiretos | 6 (4 diretos + 2 indiretos) | `grep -rn "Comanda\." --include=*.js .` (repositório inteiro) + leitura de `src/servidor.js` (rotas) e `agente-impressora/main/{print-job.js,poller.js,ipc.js}` | coletado |
| 2 | Telas e rotas que dependem | 5 | leitura de `public/app.js` (handlers de UI) cruzada com as rotas encontradas no Sinal 1 | coletado |
| 3 | Jobs, crons, relatórios, integrações | 2 (dois loops de polling do agente Electron) | leitura de `agente-impressora/main/poller.js` + `docs/arquitetura.md:63` (descrição do fluxo da fila) | coletado |
| 4 | Cobertura de teste na área | parcial | `node --test --experimental-test-coverage test/comanda.test.js` (23 testes, 0 falhas, `comanda.js` 78,35% linhas) + leitura de `test/comanda.test.js` e `test/integracao/cozinha-observacao.test.js` | coletado |
| 5 | Zona de risco tocada | Financeiro (caixa e PDV) | leitura de `docs/legado/PERFIL.md`, seção 7 (`public/comanda.js` listado explicitamente entre os arquivos da zona) | coletado |
| 6 | Churn e idade | 14 alterações, última em 2026-08-24 (criado em 2026-06-20) | `git log --format=%ad --date=short -- public/comanda.js \| wc -l`, `git log -1 --format=%ad --date=short -- public/comanda.js`, `git log -1 --format=%ad --date=short --diff-filter=A -- public/comanda.js` | coletado |
| 7 | Migração de banco envolvida | não | leitura do arquivo alvo (função pura, sem I/O) e do escopo do trabalho (troca de `linhas.push` por `quebrar(...).forEach(...)`) — nenhuma referência a `supabase/migrations/` no escopo | coletado |
| 8 | Dado histórico ou imutável afetado | não | leitura de `public/comanda.js` (função pura de formatação, não grava nada) comparada com a zona "Dado histórico imutável" do PERFIL (caixas fechados, pedidos recebidos/anonimizados, auditoria — `comanda.js` não consta ali) | coletado |

### Detalhamento dos chamadores (Sinal 1)

| Chamador | Caminho | Direto ou indireto |
|---|---|---|
| Rota `POST /api/pedidos/:id/reimprimir` (reimpressão manual, delivery/qualquer origem) | `src/servidor.js:2316` | direto |
| Rota `POST /api/pdv/vender` (venda no local, PDV) | `src/servidor.js:2702` | direto |
| Rota `POST /api/mesas/:id/pedido` (lançar itens da rodada) | `src/servidor.js:2884` | direto |
| Função `montarJob` (monta ESC/POS do pedido de delivery a partir de `Comanda.montarComanda`) | `agente-impressora/main/print-job.js:17` | direto |
| Loop de polling `processarPendentes` (auto-impressão de delivery, produção, a cada ~3s, iniciado após login) | `agente-impressora/main/poller.js:108` | indireto (chama `montarJob`) |
| Handler IPC `impressora:teste` (botão "testar impressora" da UI do agente) | `agente-impressora/main/ipc.js:45` | indireto (chama `montarJob`) |

Refinamento: `Comanda`/`montarCozinha`/`montarComanda` não são nomes genéricos (baixo risco de falso positivo), então a contagem por `grep -rn "Comanda\."` foi usada como piso e confirmada por leitura direta de cada ocorrência fora de `public/comanda.js` e de `test/`. Não há injeção de dependência, container por convenção nem rota resolvida por banco no projeto (confirmado no PERFIL, seção 6 — `require()` direto é o único padrão) — nenhuma chamada dinâmica a descartar, sinal coletável com confiança. As três rotas HTTP e os dois pontos de entrada do agente Electron (login que inicia o poller; clique no botão de teste) são pontos de entrada declarados no PERFIL — a subida parou neles.

### Telas e rotas (Sinal 2) — alimenta o roteiro manual da Camada 8

- Aba "Pedidos", botão de reimprimir por pedido — `public/app.js:4996` (botão), `public/app.js:1553-1588` (fluxo de escolha de via) — rota `/api/pedidos/:id/reimprimir`
- Modal "Novo pedido" (delivery), botão "Imprimir" — `public/app.js:1509-1533`, `1589-1595` — mesma rota de reimpressão
- Aba "PDV", venda Balcão/Entrega/Retirada — `public/app.js` (`renderPdv*`/`carregarPdv`) — rota `/api/pdv/vender`
- Aba "Mesas", lançar itens de uma rodada — `public/app.js` (fluxo de lançamento de mesa) — rota `/api/mesas/:id/pedido`
- App desktop "Nymbus Impressora" (Electron, `agente-impressora/`) — tela de status/log (sem tela por pedido); consome em segundo plano via poller e expõe o botão "Testar impressora"

### Consumo assíncrono (Sinal 3) — alimenta a seção de colateral da Camada 8

- `GET /api/agente/pendentes` — poll do agente Electron a cada ~3s; para cada pedido de delivery ainda não impresso, o PRÓPRIO agente monta o texto localmente com `Comanda.montarComanda` (cópia de `public/comanda.js` vendorizada em `agente-impressora/vendor/` no `.exe` empacotado — ver `copy-shared.js`) — `agente-impressora/main/poller.js:84-117`
- `GET /api/agente/fila` — poll do agente Electron a cada ~3s da fila genérica `impressao_fila` (PDV/Mesas/Caixa/reimpressão); nesse caminho o texto já vem PRONTO do servidor (`Comanda.montarCozinha`/`montarComanda` chamado em `src/servidor.js`), o agente só aplica o encoder ESC/POS — `agente-impressora/main/poller.js:118-...`, `src/servidor.js:456`

Consumo por poller/job automático já é, sozinho, motivo suficiente para MEDIO — mas o Sinal 5 (zona tocada) já determina ALTO.

### Leitura do churn (Sinal 6)

Área viva: 14 alterações em pouco mais de 2 meses de vida (criado 2026-06-20, última alteração 2026-08-24, ~12 dias antes deste cálculo em 2026-09-05). Não é código congelado nem esquecido — é uma peça em uso ativo, o que reduz o risco de "ninguém lembra como funciona", mas aumenta o risco de conflito com outra mudança em andamento no mesmo arquivo (o próprio D-11 que originou este trabalho veio de uma entrega em 2026-09-03 no mesmo arquivo).

---

## FAIXA: ALTO

Determinada por: Sinal 5 — `public/comanda.js` está listado explicitamente entre os arquivos da zona de risco "Financeiro (caixa e PDV)" em `docs/legado/PERFIL.md` (seção 7). Zona tocada é, isoladamente, suficiente para ALTO pelos limiares do PERFIL (seção 9), independentemente dos demais sinais (que, à parte, já indicariam MEDIO: 6 chamadores e cobertura parcial).

---

## Camadas acionadas

| Camada | Acionada | Onde vive o artefato |
|---|---|---|
| 2 Raio de impacto | sim | este arquivo |
| 6 Proibição de melhoria colateral | sim | `docs/legado/DIVIDA.md` |
| 10 Prova de código vivo | sim | seção abaixo |
| 3 Testes de caracterização | sim | `test/comanda-caracterizacao.test.js` — 9 casos, executados |
| 4 Ponto de costura | sim | seção abaixo |
| 5 Orçamento de mudança | 1 arquivo, 6 linhas (4 add + 2 rem) — dentro do teto de 2 arq/40 linhas | medido com `git diff --numstat public/comanda.js` |
| 7 Plano de reversão | sim | seção abaixo |
| 8 Roteiro de teste manual | sim | `docs/legado/manual/quebra-linha-obs-cozinha.md` |
| 9 Comparação com dado real | sim (exigido pela faixa ALTO) | `docs/legado/comparacao/quebra-linha-obs-cozinha.md` — LIBERADO, zero divergências não explicadas |
| 11 Perguntas obrigatórias da zona | sim | seção abaixo — respondidas |
| Feature flag ou chave de desligamento | dispensada, com motivo | o dono optou por não exigir: mudança pura de formatação, sem estado persistido, `git revert` já cobre a reversão em minutos (ver Camada 7 abaixo) |
| Aprovação humana explícita | sim | seção abaixo — APROVADO em 2026-09-05 |

---

## Prova de código vivo (Camada 10)

| Alvo | Resultado | Evidência | Método |
|---|---|---|---|
| `public/comanda.js` (`montarCozinha`, linha 92) | VIVO | Cadeia até 3 pontos de entrada HTTP declarados no PERFIL (`POST /api/pedidos/:id/reimprimir`, `POST /api/pdv/vender`, `POST /api/mesas/:id/pedido`, todas com `exigeAuth`) e até o loop de polling de produção do agente Electron (`agente-impressora/main/poller.js:108`, iniciado após login) | grep (`Comanda\.`) + leitura direta dos handlers em `src/servidor.js` e dos arquivos do agente |

Nenhuma suspeita de código morto neste alvo.

---

## Zona de risco e perguntas obrigatórias (Camada 11)

Zona tocada: Financeiro (caixa e PDV)
Validador (do PERFIL.md): NÃO DETERMINADO no PERFIL — **designado pelo dono nesta task**: o próprio dono do projeto, por ausência de outro responsável técnico (histórico do git mostra autor único). Ver `docs/legado/LACUNAS.md`, L-01 — a lacuna do PERFIL segue aberta para as próximas zonas; aqui ela foi fechada pontualmente por decisão do dono.
Perguntas respondidas em: 2026-09-05 por: dono do projeto (via aprovação explícita na condução deste trabalho)

1. Quem valida esta mudança antes de ir para produção: o próprio dono do projeto.
2. Existe impacto fiscal, contratual ou regulatório: Não — a via da cozinha é documento interno de preparo, não é cupom fiscal.
3. Existe dado histórico que muda de interpretação: Não — o conteúdo da observação gravada no pedido não muda; só a forma como quebra em linhas na impressão térmica muda (mesmo em reimpressão de pedido antigo).
4. É preciso avisar cliente, e com quanta antecedência: Não se aplica — mudança invisível ao cliente (a via da cozinha nunca chega até ele).
5. Existe janela de manutenção obrigatória: Não — mudança de formatação pura, sem deploy de schema nem I/O; dono optou por não exigir janela específica.
6. Existe processo manual do time que depende do comportamento atual: Não — confirmado pelo dono, nenhum processo da cozinha depende do corte de linha atual.

Perguntas específicas desta zona:
- A mudança altera o cálculo do valor esperado em espécie ou da diferença (`src/caixa-calc.js`) ou só a apresentação do relatório?: Só a apresentação — a mudança não toca `src/caixa-calc.js` nem qualquer cálculo de valor, só a formatação de texto de uma via impressa.
- Existe caixa aberto em produção no momento da mudança que ficaria com histórico calculado de forma diferente do que já foi fechado antes (dado histórico imutável)?: Não se aplica — a mudança não recalcula nada de caixa; comandas de cozinha não são reabertas/recalculadas por caixa.

Restrições que estas respostas impõem ao plano:
- Nenhuma restrição adicional — todas as respostas vieram "não" ou "não se aplica" para os itens que travariam o plano.

---

## Achados fora do escopo

- **`public/comanda.js:98` (Obs. geral) — RESOLVIDO dentro deste trabalho.** O dono aprovou explicitamente ampliar o escopo original (que cobria só a linha 92) para incluir também a linha 98, já que era o mesmo defeito na mesma função a 6 linhas de distância — corrigir só uma deixaria a via inconsistente. Ver aprovação humana e ponto de costura acima.
- **Padrão parecido, arquivo IRMÃO de comprovante — registrado em `DIVIDA.md`, não corrigido aqui:** `public/comprovante-caixa.js:80`, `linhas.push("Operador: " + d.operador)`, também não passa por `quebrar()` — mas o campo `operador` não tem contrato de tamanho livre de até centenas de caracteres como a observação (é nome de usuário), então o risco é bem menor. `d.descricao` no mesmo arquivo (linha 91) já usa `quebrar()` corretamente — não é um padrão dominante quebrado, é uma linha isolada. Registro, não correção (Camada 6).

---

## Ponto de costura (Camada 4)

Candidatos avaliados:

1. **A própria linha de `push` (linha 92 e linha 98 de `public/comanda.js`)** — escolhido. Contenção máxima (nenhum outro arquivo tocado), e o padrão já existe no mesmo arquivo (linhas 122, 168, 173, 286 já usam `quebrar(...).forEach(...)`), então não introduz técnica nova.
2. **Extrair uma função auxiliar `pushComQuebra(linhas, texto, largura)` reutilizada nas duas linhas** — descartado: seria extração de método não prevista na aprovação (Camada 6, proibição de melhoria colateral), e o ganho de DRY não compensa o risco de mexer em mais pontos do que o aprovado.
3. **Alterar `quebrar()` para aceitar um prefixo e aplicar sozinho o indent** — descartado: mudaria o contrato de uma função usada em 4 outros lugares do mesmo arquivo (linhas 122, 168, 173, 286), risco desproporcional para o ganho.

Ponto de costura escolhido: `public/comanda.js:92` (Obs do item) e `public/comanda.js:98` (Obs. geral) — as duas linhas de `push` originais, substituídas por `quebrar(...).forEach(...)`.
Por que ali: contenção total (0 arquivos além do alvo já mapeado), cobertura pela caracterização (Camada 3, 9 casos, todos verdes antes e depois), alcance total (os 6 chamadores do Sinal 1 recebem a string já pronta do `montarCozinha`, nenhum deles reprocessa o texto — a costura cobre 100% deles).
O que isola: só a formatação da linha de observação dentro de `montarCozinha`. Nenhuma outra linha do cupom, da pré-conta ou do comprovante foi tocada.
O que NÃO cobre: `public/comanda.js:98` só foi incluída porque o dono aprovou explicitamente ampliar o escopo original (que era só a linha 92) — ver aprovação humana acima. `public/comprovante-caixa.js:80` tem o mesmo padrão e **não** foi coberto (ficou registrado em `docs/legado/DIVIDA.md`, por decisão consciente de escopo).

---

## Caracterização (Camada 3)

Casos congelados: 9 (5 continuam intocados, 4 tiveram a asserção atualizada de propósito por esta task — ver cabeçalho do arquivo de teste).
Onde vivem: `test/comanda-caracterizacao.test.js`.
Comportamentos surpreendentes observados:
- O defeito não é "quebra em 48, mas erra a conta": é a ausência total de quebra. Uma observação de 88 colunas saía **inteira em uma única linha** de 88 caracteres, quase o dobro da largura da bobina.
- O mesmo defeito existia em **duas linhas do mesmo arquivo e da mesma função** (`Obs:` do item e `Obs. geral:` do pedido) — não detectado antes porque nenhum teste cobria observação longa em nenhuma das duas.
- A suíte completa (541 testes) passou sem nenhuma outra quebra — a mudança ficou de fato isolada às duas linhas.

---

## Reversão consolidada (Camada 7)

Classe da entrega como um todo: **REVERSÍVEL**.
Efeitos que não se desfazem: nenhum.

```
1. Código:            reverter public/comanda.js para o commit anterior a esta entrega
                      (git revert do commit desta task, ou checkout do arquivo)
2. Dado gravado:      nenhum — a função é pura, não grava em banco nem em disco
3. Migração:          nenhuma
4. Flag:              nenhuma — o dono optou por não exigir kill switch, dado que a
                      mudança é puramente de formatação e o revert de código já basta
5. Cache/índice:      nenhum
6. Efeito externo:    vias impressas ANTES da reversão continuam com o texto quebrado
                      corretamente (papel já saiu da impressora); vias impressas DEPOIS
                      da reversão voltam a sair sem quebrar, como antes desta entrega —
                      não há necessidade de "corrigir" papel já impresso

Tempo estimado de reversão: menos de 5 minutos (reverter 1 commit, 1 arquivo)
Quem executa a reversão: o dono do projeto, ou quem tiver acesso ao repositório
Janela: a qualquer momento; não há efeito que se acumule ou piore com o tempo
```

---

## Aprovação humana (regra 9)

Aprovado por: dono do projeto
Data: 2026-09-05
O que foi aprovado: corrigir a quebra de linha da observação em `public/comanda.js`, nas duas linhas de texto livre já mapeadas (linha 92, `Obs:` do item; e linha 98, `Obs. geral:` do pedido), usando a função `quebrar()` já existente no mesmo arquivo — sem tocar em nenhum outro arquivo.
Riscos declarados no momento da aprovação:
- Zona Financeiro/PDV tocada (o arquivo alimenta a impressão de PDV, Mesas e delivery).
- Consumo por caminho assíncrono real: o agente de impressão Electron (poll automático a cada ~3s).
- Sem validador formal designado no PERFIL para a zona; o próprio dono assumiu esse papel para esta task.

---

## Histórico de recálculo

| Data | Motivo do recálculo | Faixa anterior | Faixa nova |
|---|---|---|---|
| — | Nenhum recálculo até o momento (primeiro cálculo deste trabalho, conjunto de arquivos alvo ainda não mudou) | — | — |

---

## Nota sobre `.expx/estado.json`

`.expx/` não existe neste repositório — a gravação da faixa na barra de status (Passo 6) foi dispensada, conforme previsto no reference (não é obrigatória e não gera erro nem aviso).

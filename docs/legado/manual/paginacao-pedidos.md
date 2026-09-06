# Roteiro de teste manual — paginacao-pedidos

Trabalho: paginacao-pedidos — Troca da paginação numerada da tela de Pedidos pelo botão "Carregar mais"
Faixa do raio: MÉDIO
O que mudou, em uma linha: a lista de Pedidos deixou de mostrar 10 por página com botões numerados (1 2 3 …) e passou a mostrar 30 pedidos de cara com um único botão "Carregar mais" no fim, que soma 20 a cada clique.
Gerado em: 2026-09-06

---

## Preparação única

Ambiente onde executar: ambiente de teste/homologação — **nunca em produção com clientes reais**. Se só houver o ambiente de produção disponível, use um restaurante de teste próprio (não o de um cliente) e evite registrar pedidos reais.

Perfil de acesso necessário: login de dono/administrador de um restaurante de teste.

Configuração que precisa estar ligada: nenhuma configuração especial — a mudança é só na forma de exibir a lista de Pedidos.

Antes de começar, confirme que:
- Existe um restaurante de teste com pedidos suficientes para passar de 30 em um período (crie pedidos de teste ou use um período largo, ex.: "Todos"). Se o restaurante só tiver poucos pedidos, o caso de checar 20 por clique fica limitado — registre o que conseguir observar.
- Você consegue abrir a aba "Pedidos" normalmente.

---

## Caso 1 — A lista mostra 30 pedidos de cara, sem botões de página

Bloqueante: sim — é o comportamento central da entrega.
Janela: executável a qualquer momento com um período que tenha +30 pedidos.

**Pré-condição**
- Período selecionado com mais de 30 pedidos (ex.: "Todos" ou "7 dias" num restaurante movimentado).

**Passos**
1. Faça login no painel do restaurante de teste.
2. Clique na aba "Pedidos".
3. Observação imediata (sem clicar em nada).

**Resultado esperado**
A lista abre mostrando 30 pedidos (conte as linhas da tabela), e no fim dela aparece um resumo "Mostrando 30 de N pedidos" com um único botão "Carregar mais". **Nenhum** botão de página numerada (1, 2, 3…) aparece na tela.

**O que observar de colateral**
- Telas vizinhas: nenhuma outra aba muda (PDV, Caixa, Cardápio, Configurações continuam funcionando como antes).
- Dado antigo: a contagem "de 30 de N" usa o total filtrado; nada nos valores/estados dos pedidos muda.

**Dado de teste sugerido**
Nenhum dado novo necessário além de ter +30 pedidos no período escolhido.

---

## Caso 2 — Clicar em "Carregar mais" soma 20 pedidos à lista, sem recarregar a página

Bloqueante: sim.
Janela: executável a qualquer momento.

**Pré-condição**
- Mesmo estado do Caso 1 (lista com 30 pedidos e o botão visível).

**Passos**
1. Clique no botão "Carregar mais".
2. Conte as linhas da lista e observe o resumo.
3. Se ainda houver pedidos além do mostrado, clique de novo até o botão sumir.

**Resultado esperado**
Após cada clique, a lista passa a mostrar 20 pedidos a mais (30 → 50 → 70 …) **sem** a página recarregar e sem o painel ficar piscando/carregando de novo. O resumo acompanha: "Mostrando 50 de N pedidos", etc.

**O que observar de colateral**
- Filtros aplicados antes (período, tipo, canal, pagamento, busca) continuam valendo — a lista cresce respeitando o filtro atual, não volta para a lista completa.
- Dado antigo: a ordem e os valores dos pedidos não mudam entre cliques.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 3 — Com todos os pedidos à vista, o botão "Carregar mais" some

Bloqueante: sim — o botão não pode aparecer quando não há mais nada para carregar.
Janela: executável a qualquer momento — em período pequeno, já aparece assim de cara.

**Pré-condição**
- O período selecionado tem 30 pedidos ou menos.

**Passos**
1. Abra a aba "Pedidos" com um período pequeno (ex.: "Hoje" num dia tranquilo).

**Resultado esperado**
A lista mostra todos os pedidos (≤ 30) e **o botão "Carregar mais" não aparece**. Se aparecer o resumo "Mostrando X de Y", X e Y são iguais.

**O que observar de colateral**
- Nenhuma outra tela muda; a lista continua completa e ordenada como antes.

**Dado de teste sugerido**
Restaurante de teste com ≤ 30 pedidos no dia selecionado.

---

## Caso 4 — Trocar filtros volta a lista para o início (30 pedidos)

Bloqueante: sim — cada filtro precisa recomeçar a contagem.
Janela: executável a qualquer momento.

**Pré-condição**
- Caso 2 executado (lista crescida, ex.: 70 pedidos visíveis).

**Passos**
1. Clicar várias vezes em "Carregar mais" até a lista ficar grande (ex.: 70 de N).
2. Troque o período para outro chip (por exemplo, de "7 dias" para "Hoje").
3. Digite algo no campo de busca.
4. Mude um dos seletores de filtro (Tipo, Canal ou Pagamento).

**Resultado esperado**
Em cada uma das 4 ações, a lista volta a mostrar apenas 30 pedidos (com o "Carregar mais" de volta, se o novo filtro ainda tiver mais de 30).

**O que observar de colateral**
- Telas vizinhas: fechar/reabrir a aba "Pedidos" também reinicia em 30 (mesma regra).
- Dado antigo: o mesmo filtro continua trazendo os mesmos pedidos de antes.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 5 — Pedidos a receber mostram a lista normalmente, começando em 30

Bloqueante: não — verificação posterior.
Janela: executável a qualquer momento com pedidos "a receber".

**Pré-condição**
- Existe pelo menos um pedido a receber (PDV do tipo Entrega/Retirada sem cobrança, ou similar).

**Passos**
1. Na aba "Pedidos", clique no atalho/bloqueio que leva à lista de pedidos a receber (ex.: o aviso de "vendas a receber" ao tentar fechar o caixa).
2. Observe a lista que abre.

**Resultado esperado**
A lista dos pedidos a receber aparece com o mesmo comportamento: 30 de cara e botão "Carregar mais" se houver mais, sem nenhum botão de página numerada.

**O que observar de colateral**
- Dado antigo: os pedidos a receber listados são exatamente os mesmos de antes da entrega.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 6 — Navegando no celular, o "Carregar mais" funciona do mesmo jeito

Bloqueante: não — o botão vale para a lista de cards (celular) tanto quanto para a tabela (desktop).
Janela: executável a qualquer momento — pelo navegador do celular, ou pela janela estreita do computador.

**Pré-condição**
- Acesso pelo celular (ou janela estreita), com período de mais de 30 pedidos.

**Passos**
1. Abra "Pedidos" no celular (ou janela estreita).
2. Toque em "Carregar mais" uma vez.

**Resultado esperado**
Na versão de cards, aparecem 30 pedidos de cara; depois do toque, 20 a mais aparecem (50 no total), sem recarregar a página. O botão tem tamanho confortável para toque em toda a largura da lista.

**O que observar de colateral**
- Telas vizinhas: o restante do painel no celular continua como antes.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Registro do resultado

| Caso | Executado por | Data | Resultado | Observação |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |

Veredito: pendente de QA humano. Os 3 casos bloqueantes (1, 2 e 3) precisam ser aprovados antes de considerar a entrega fechada; os demais são verificação posterior.
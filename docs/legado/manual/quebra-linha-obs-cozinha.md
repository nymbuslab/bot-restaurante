# Roteiro de teste manual — quebra-linha-obs-cozinha

Trabalho: quebra-linha-obs-cozinha — Quebra de linha da observação na via da cozinha
Faixa do raio: ALTO
O que mudou, em uma linha: quando a observação de um item ou a observação geral do pedido é longa, a via da cozinha agora quebra o texto em várias linhas em vez de imprimir tudo espremido em uma linha só.
Gerado em: 2026-09-05

---

## Preparação única

Ambiente onde executar: ambiente de teste/homologação, ou o próprio painel em uso normal do restaurante fora do horário de pico
Perfil de acesso necessário: acesso ao painel do restaurante (PDV, Mesas ou Pedidos) e a uma impressora térmica 80mm conectada (física ou o agente de impressão instalado)
Configuração que precisa estar ligada: Plano Completo com impressão térmica configurada (o agente de impressão instalado e "Testar impressora" funcionando)
Antes de começar, confirme que: existe pelo menos um produto com "cozinha" marcado no cardápio (item que imprime via da cozinha)

---

## Caso 1 — Observação curta de item continua imprimindo normalmente

**Pré-condição**
- Um produto cadastrado que aceite observação (ex.: qualquer item vendável no PDV ou Mesas)

**Passos**
1. Abra o PDV (ou uma mesa) e adicione o produto ao pedido.
2. No campo de observação do item, digite um texto curto, por exemplo "sem cebola".
3. Finalize a venda de forma que ela gere impressão da via da cozinha.

**Resultado esperado**
A via da cozinha impressa mostra a linha `Obs: sem cebola` inteira, em uma única linha, sem cortar nenhuma palavra.

**O que observar de colateral**
- Telas vizinhas: a tela de detalhe do pedido, em Pedidos, continua mostrando a mesma observação completa.
- Relatórios: nenhum relatório resume texto de observação, então não há o que conferir ali.
- Jobs e rotinas: se o agente de impressão automática estiver rodando (poll a cada poucos segundos), confirme que a via também saiu certa por esse caminho, não só pelo botão manual.
- Integrações: nenhuma integração externa consome o texto da via da cozinha.
- Dado antigo: não se aplica a este caso (observação nova).

**Dado de teste sugerido**
Produto: qualquer item de cozinha do cardápio de teste. Observação: "sem cebola" (texto curto, fictício).

Bloqueante: sim — se falhar, não sobe.
Janela: executável a qualquer momento.

---

## Caso 2 — Observação longa de item agora quebra em várias linhas

**Pré-condição**
- O mesmo produto do Caso 1.

**Passos**
1. Adicione o produto ao pedido.
2. No campo de observação do item, digite um texto longo, por exemplo: "sem cebola por favor e sem tomate tambem e capricha no molho extra por gentileza".
3. Finalize a venda de forma que gere impressão da via da cozinha.

**Resultado esperado**
A via da cozinha impressa mostra a observação quebrada em duas ou mais linhas, cada uma começando com o texto alinhado à esquerda, e **nenhuma linha ultrapassa a largura do papel** (nenhum texto cortado ou espremido além da borda). O texto completo da observação continua legível, só distribuído em mais de uma linha.

**O que observar de colateral**
- Telas vizinhas: a tela de Pedidos continua mostrando a observação inteira em uma linha só (a quebra é só na impressão, não na tela).
- Relatórios: não se aplica.
- Jobs e rotinas: repita a verificação pelo caminho automático do agente de impressão (o mesmo pedido, impresso pelo poll em vez de manualmente), para confirmar que os dois caminhos de impressão saem iguais.
- Integrações: não se aplica.
- Dado antigo: ver Caso 4.

**Dado de teste sugerido**
Observação: "sem cebola por favor e sem tomate tambem e capricha no molho extra por gentileza" (texto fictício, sem dado de cliente).

Bloqueante: sim.
Janela: executável a qualquer momento.

---

## Caso 3 — Observação geral longa do pedido também quebra corretamente

**Pré-condição**
- Um pedido em andamento (delivery, PDV ou mesa) que aceite uma observação geral do pedido (não do item).

**Passos**
1. Ao montar o pedido, preencha o campo de observação geral (nota do pedido como um todo) com um texto longo, por exemplo: "aniversariante hoje por favor coloque uma velinha e um cartao de feliz aniversario no saco".
2. Finalize o pedido de forma a gerar a impressão da via da cozinha.

**Resultado esperado**
A linha "Obs. geral:" sai quebrada em várias linhas na via impressa, nenhuma ultrapassando a largura do papel, com o texto completo preservado.

**O que observar de colateral**
- Telas vizinhas: a tela onde a observação geral é exibida (detalhe do pedido) continua mostrando o texto completo, sem quebra — a mudança é só na impressão.
- Jobs e rotinas: mesma verificação do Caso 2, pelo caminho automático de impressão.
- Dado antigo: ver Caso 4.

**Dado de teste sugerido**
Observação geral: "aniversariante hoje por favor coloque uma velinha e um cartao de feliz aniversario no saco" (texto fictício).

Bloqueante: sim.
Janela: executável a qualquer momento.

---

## Caso 4 — Registro antigo continua exibindo o valor de antes

> Caso obrigatório: em legado é onde a regressão aparece — o novo funciona, o histórico quebra.

**Pré-condição**
- Um pedido já existente, criado antes desta entrega, que tenha uma observação (curta ou longa) — pode ser reimpresso pelo botão de reimpressão em Pedidos.

**Passos**
1. Vá em Pedidos e localize um pedido antigo com observação registrada.
2. Use a opção de reimprimir a via da cozinha desse pedido.

**Resultado esperado**
O texto da observação exibido na tela do pedido continua exatamente o mesmo de sempre (a mudança não altera o dado gravado, só a formatação de impressões novas). Se a observação for longa, a via reimpressa agora sai quebrada corretamente — o que é o comportamento correto também para reimpressão, não uma regressão.

**O que observar de colateral**
- A reimpressão não deve gerar nenhum erro nem cobrar de novo o pedido.

**Dado de teste sugerido**
Qualquer pedido já existente no ambiente de teste com uma observação preenchida.

Bloqueante: não — verificação posterior, pode ser feita quando surgir um pedido antigo real com observação.
Janela: executável a qualquer momento.

---

## Registro do resultado

| Caso | Executado por | Data | Resultado | Observação |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |

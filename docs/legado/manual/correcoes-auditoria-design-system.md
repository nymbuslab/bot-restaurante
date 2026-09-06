# Roteiro de teste manual — correcoes-auditoria-design-system

Trabalho: correcoes-auditoria-design-system — Correção dos achados de design system (Alto, Médio e Baixo)
Faixa do raio: ALTO
O que mudou, em uma linha: acessibilidade e consistência visual do painel (avisos por voz, contraste, telas de carregando/erro, botões maiores, cardápio vazio) — inclui uma mudança na ORDEM em que o sistema decide se mostra "abra o caixa", "erro de conexão" ou a tela de venda no PDV e em Mesas.
Gerado em: 2026-09-05

---

## Preparação única

Ambiente onde executar: ambiente de teste/homologação — **nunca em produção com clientes reais**. Se só houver o ambiente de produção disponível, use um restaurante de teste próprio (não o de um cliente) e evite qualquer ação em pedidos reais.

Perfil de acesso necessário: login de dono/administrador de um restaurante com **Plano Completo** (PDV, Mesas e Caixa só aparecem nesse plano).

Configuração que precisa estar ligada: nenhuma configuração especial — os casos abaixo cobrem o comportamento padrão do painel.

Antes de começar, confirme que:
- Existe pelo menos um restaurante de teste com Plano Completo, com pelo menos uma categoria e um item cadastrados no cardápio.
- Você consegue abrir e fechar o caixa do dia normalmente (Caixa → Abrir caixa / Fechar caixa).
- Você tem como desligar a internet do computador por alguns segundos (Wi-Fi ou cabo de rede), para simular uma queda de conexão em alguns casos.
- Se possível, tenha à mão um segundo restaurante de teste **recém-criado, sem nenhuma categoria** (para o Caso 8). Se não tiver, pode remover temporariamente todas as categorias de um restaurante de teste, testar, e recriá-las depois.

---

## Caso 1 — O PDV nunca libera venda quando o caixa está fechado

Bloqueante: sim — se falhar, não sobe.
Janela: executável a qualquer momento.

**Pré-condição**
- O caixa do dia está fechado (nenhum caixa aberto).

**Passos**
1. Faça login no painel do restaurante de teste.
2. Clique em "PDV" no menu lateral.

**Resultado esperado**
A tela mostra a mensagem "Abra o caixa para vender", com um botão "Ir para o Caixa". Nenhuma grade de produtos nem carrinho de venda aparece na tela.

**O que observar de colateral**
- Telas vizinhas: a aba "Mesas" (Caso 2) e a aba "Caixa" devem mostrar, cada uma, a mensagem correta para o estado em que estão — nenhuma delas deve mostrar a tela de venda liberada.
- Relatórios: não se aplica (nenhum relatório é consultado aqui).
- Jobs e rotinas: não se aplica.
- Integrações: não se aplica.
- Dado antigo: pedidos feitos em dias anteriores continuam aparecendo normalmente na aba "Pedidos", independente do estado do caixa de hoje.

**Dado de teste sugerido**
Nenhum dado novo é necessário — use o restaurante de teste já cadastrado, com o caixa fechado.

---

## Caso 2 — Mesas nunca libera lançamento quando o caixa está fechado

Bloqueante: sim.
Janela: executável a qualquer momento.

**Pré-condição**
- O caixa do dia está fechado.

**Passos**
1. Clique em "Mesas" no menu lateral.

**Resultado esperado**
A tela mostra a mensagem "Abra o caixa para usar Mesas", com um botão "Ir para o Caixa". Nenhuma grade de mesas aparece.

**O que observar de colateral**
- Telas vizinhas: a aba "PDV" (Caso 1) deve mostrar a mesma coerência.
- Dado antigo: mesas fechadas em dias anteriores continuam aparecendo corretamente no histórico/relatório de caixa daquele dia, se você consultar um Caixa anterior na lista "Caixas anteriores".

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 3 — Abrir o caixa libera PDV e Mesas normalmente

Bloqueante: sim.
Janela: executável a qualquer momento.

**Pré-condição**
- O caixa do dia está fechado (continuando do Caso 1/2).

**Passos**
1. Na tela de "Abra o caixa para vender" (PDV) ou "Abra o caixa para usar Mesas", clique no botão "Ir para o Caixa".
2. Clique em "Abrir caixa" e preencha o valor de fundo de troco (pode ser R$ 0,00 ou qualquer valor de teste).
3. Confirme a abertura.
4. Volte para a aba "PDV".
5. Volte para a aba "Mesas".

**Resultado esperado**
Depois de abrir o caixa: a aba "PDV" mostra a grade de produtos e o carrinho de venda normalmente. A aba "Mesas" mostra a grade de mesas normalmente. Nenhuma das duas mostra mais a mensagem de "abra o caixa".

**O que observar de colateral**
- Telas vizinhas: a aba "Caixa" passa a mostrar o resumo do caixa aberto (dinheiro em caixa, total para conferência), não mais a tela de abertura.
- Dado antigo: nenhum pedido ou mesa antiga muda de valor por causa dessa abertura.

**Dado de teste sugerido**
Fundo de troco de teste: R$ 50,00.

---

## Caso 4 — Uma queda de conexão no PDV mostra um aviso de erro diferente de "abra o caixa"

Bloqueante: sim — este é exatamente o comportamento que mudou de lugar nesta entrega.
Janela: executável a qualquer momento.

**Pré-condição**
- O caixa do dia está aberto.
- Você está na aba "PDV", com a internet do computador funcionando.

**Passos**
1. Desligue a internet do computador (desative o Wi-Fi, ou desconecte o cabo de rede).
2. Atualize a página do painel (F5) ou saia da aba "PDV" e entre de novo.
3. Aguarde a tela terminar de carregar (ou tentar carregar).
4. Religue a internet.
5. Clique no botão de tentar de novo, se ele estiver visível.

**Resultado esperado**
Com a internet desligada: a tela mostra uma mensagem de **erro de conexão** (algo como "não foi possível carregar" ou "tente de novo"), com um botão para tentar novamente — **e não** a mensagem "Abra o caixa para vender". Depois de religar a internet e clicar em tentar de novo, a grade de produtos do PDV volta a aparecer normalmente.

**O que observar de colateral**
- Telas vizinhas: repita o mesmo teste na aba "Mesas" (Caso 5) — o comportamento deve ser o mesmo: erro de conexão, nunca "abra o caixa".
- Dado antigo: depois de reconectar, os pedidos e vendas feitos antes da queda de conexão continuam aparecendo certos, nada se perde.

**Dado de teste sugerido**
Nenhum dado novo necessário — o teste é sobre a mensagem que aparece, não sobre um valor.

---

## Caso 5 — Uma queda de conexão em Mesas mostra o mesmo tipo de aviso de erro

Bloqueante: sim.
Janela: executável a qualquer momento.

**Pré-condição**
- O caixa do dia está aberto.
- Você está na aba "Mesas".

**Passos**
1. Desligue a internet do computador.
2. Atualize a página ou saia e entre de novo na aba "Mesas".
3. Religue a internet e clique em tentar de novo, se disponível.

**Resultado esperado**
Com a internet desligada, aparece uma mensagem de erro de conexão com opção de tentar de novo — **nunca** a mensagem de "abra o caixa". Depois de religar e tentar de novo, a grade de mesas volta a aparecer normalmente.

**O que observar de colateral**
- Telas vizinhas: compare com o resultado do Caso 4 (PDV) — as duas devem se comportar da mesma forma.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 6 — Caixa de um dia anterior ainda esquecido aberto continua bloqueando venda corretamente

Bloqueante: sim — garante que a reorganização da tela não afrouxou uma trava de segurança que já existia.
Janela: executável a qualquer momento, mas exige um caixa "esquecido aberto" de um dia anterior — se não tiver um disponível, pule este caso e registre como "não testável neste ambiente".

**Pré-condição**
- Existe um caixa aberto desde um dia anterior (não fechado ontem), no restaurante de teste.

**Passos**
1. Clique em "PDV".
2. Clique em "Mesas".

**Resultado esperado**
Em vez da grade normal de venda, aparece um aviso informando que há um caixa aberto de um dia anterior e que é preciso fechá-lo antes de vender hoje, com um atalho para a aba "Caixa".

**O que observar de colateral**
- Telas vizinhas: a aba "Caixa" deve mostrar claramente esse caixa antigo e permitir fechá-lo.
- Dado antigo: ao fechar esse caixa antigo, os valores e vendas registrados nele continuam batendo com o que já havia sido lançado — nada muda de valor.

**Dado de teste sugerido**
Se for preciso criar esse cenário: abra um caixa, não feche, e simule a virada de dia (ou peça para alguém do time técnico ajustar a data em ambiente de teste).

---

## Caso 7 — Um erro genérico ao carregar o Caixa não é confundido com "sem caixa"

Bloqueante: não — verificação posterior.
Janela: executável a qualquer momento.

**Pré-condição**
- Você está na aba "Caixa".

**Passos**
1. Desligue a internet do computador.
2. Atualize a página do painel ou saia e entre de novo na aba "Caixa".
3. Religue a internet.

**Resultado esperado**
Aparece uma mensagem indicando falha ao carregar o caixa, diferente da tela normal de "abrir caixa" ou do resumo do caixa aberto.

**O que observar de colateral**
- Telas vizinhas: compare com PDV (Caso 4) e Mesas (Caso 5).

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 8 — Restaurante novo, sem nenhuma categoria, mostra uma tela de boas-vindas no Cardápio, não uma tela em branco

Bloqueante: não — verificação posterior.
Janela: executável a qualquer momento.

**Pré-condição**
- Um restaurante de teste sem nenhuma categoria cadastrada no cardápio (recém-criado, ou com todas as categorias removidas temporariamente).

**Passos**
1. Faça login nesse restaurante.
2. Clique em "Cardápio" no menu lateral.

**Resultado esperado**
A tela mostra uma mensagem convidando a criar a primeira categoria (algo como "crie sua primeira categoria"), com um botão ou link que leva à tela de Categorias — **não** uma área em branco, sem nenhum texto.

**O que observar de colateral**
- Telas vizinhas: clicar no botão/link leva mesmo à tela de Categorias, e criar uma categoria ali faz a mensagem de boas-vindas sumir na próxima vez que abrir o Cardápio.

**Dado de teste sugerido**
Restaurante de teste "Sem Categoria Teste", sem nenhum item cadastrado.

---

## Caso 9 — Buscar por um prato que não existe no Cardápio mostra o mesmo aviso visual dos outros avisos do sistema

Bloqueante: não.
Janela: executável a qualquer momento.

**Pré-condição**
- Um restaurante de teste com pelo menos uma categoria e um item cadastrados.

**Passos**
1. Clique em "Cardápio".
2. No campo de busca, digite um nome que certamente não existe, por exemplo "xpto-inexistente-123".

**Resultado esperado**
Aparece um aviso "Nenhum item encontrado para xpto-inexistente-123", com a mesma aparência visual (caixa com borda e ícone) dos outros avisos de "lista vazia" já usados em outras telas do painel — não mais um texto solto sem moldura.

**O que observar de colateral**
- Telas vizinhas: compare visualmente com o aviso de "nenhum pedido encontrado" na aba Pedidos, se houver, para confirmar que o visual é o mesmo padrão.

**Dado de teste sugerido**
Termo de busca: "xpto-inexistente-123".

---

## Caso 10 — As telas de Pedidos, PDV, Mesas e Caixa mostram "Carregando…" ao abrir

Bloqueante: não.
Janela: executável a qualquer momento — pode ser rápido demais para ver numa conexão veloz; se não conseguir observar, registre como "não observado, conexão rápida demais" em vez de marcar como falha.

**Pré-condição**
- Caixa aberto (para ver PDV/Mesas/Caixa com conteúdo).

**Passos**
1. Clique em "Pedidos".
2. Observe o instante logo após o clique, antes da lista aparecer.
3. Repita clicando em "PDV", depois "Mesas", depois "Caixa".

**Resultado esperado**
Por um instante, antes do conteúdo da tela aparecer, é possível ver o texto "Carregando…" em cada uma das 4 telas.

**O que observar de colateral**
- Não se aplica (mudança sem efeito em outros dados).

**Dado de teste sugerido**
Nenhum dado novo necessário. Se quiser tornar o "Carregando…" mais fácil de ver, peça para alguém do time técnico simular uma conexão lenta no navegador durante o teste.

---

## Caso 11 — O aviso de sucesso ou erro (toast) é lido em voz alta pelo leitor de tela

Bloqueante: não.
Janela: executável a qualquer momento.

**Pré-condição**
- Windows com o Narrador disponível (tecla Windows + Ctrl + Enter liga e desliga o Narrador).

**Passos**
1. Ligue o Narrador do Windows (Windows + Ctrl + Enter).
2. No painel, faça uma ação que gere um aviso de sucesso — por exemplo, salvar uma alteração simples em Configurações.
3. Sem tocar em mais nada, espere o Narrador falar.
4. Depois, provoque um aviso de erro — por exemplo, desligue a internet e tente salvar algo, ou tente uma ação que já se saiba que dá erro.

**Resultado esperado**
Assim que o aviso aparece no canto da tela, o Narrador anuncia o texto do aviso em voz alta, **sem** você precisar navegar até ele com o Tab.

**O que observar de colateral**
- Telas vizinhas: o mesmo aviso aparece e é lido em qualquer aba do painel onde uma ação de salvar/excluir/confirmar dispare o aviso.

**Dado de teste sugerido**
Qualquer alteração pequena e reversível em Configurações (ex.: ligar e desligar de novo o som de novo pedido).

---

## Caso 12 — Os botões de fechar dos avisos (janelas de detalhe, QR Code, editar item, adicionar cartão) anunciam "Fechar" no leitor de tela

Bloqueante: não.
Janela: executável a qualquer momento.

**Pré-condição**
- Narrador do Windows ligado (Windows + Ctrl + Enter).

**Passos**
1. Abra o detalhe de um pedido (aba Pedidos, clique em um pedido da lista).
2. Aperte Tab até o foco chegar no botão "✕" no canto da janela.
3. Ouça o que o Narrador anuncia.
4. Feche essa janela e repita o mesmo teste para: o QR Code do cardápio (botão "Ver QR Code", se disponível), o editor de um item do cardápio (clique em editar um item), e a tela de adicionar cartão (aba Assinatura, se disponível).

**Resultado esperado**
Em todos os 4 casos, o Narrador anuncia a palavra "Fechar" ao focar o botão "✕" — nunca fica mudo nem lê um símbolo sem sentido.

**O que observar de colateral**
- Não se aplica.

**Dado de teste sugerido**
Um pedido qualquer já existente para abrir o detalhe; um item de cardápio qualquer para abrir o editor.

---

## Caso 13 — O selo cinza "Livre" nas mesas está legível

Bloqueante: não.
Janela: executável a qualquer momento.

**Pré-condição**
- Caixa aberto, aba "Mesas" com pelo menos uma mesa livre (sem pedido em aberto).

**Passos**
1. Clique em "Mesas".
2. Observe o selo/etiqueta com a palavra "Livre" sobre a mesa disponível.

**Resultado esperado**
O texto "Livre" no selo cinza é legível a olho nu, sem parecer apagado ou "lavado" contra o fundo do selo.

**O que observar de colateral**
- Telas vizinhas: os outros selos de status de mesa (ocupada, aguardando conta, fechando) continuam com a aparência de antes.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 14 — Os botões de editar/excluir/restaurar item do Cardápio ficam mais fáceis de tocar no celular

Bloqueante: não.
Janela: executável a qualquer momento.

**Pré-condição**
- Um item cadastrado no cardápio.
- Acesso pelo navegador do celular, ou pelo navegador do computador numa janela estreita (redimensione a janela para simular a tela de um celular).

**Passos**
1. Abra o painel pelo celular (ou janela estreita) e vá em "Cardápio".
2. Tente tocar/clicar no ícone de editar (lápis) e no ícone de excluir (lixeira) ao lado de um item.

**Resultado esperado**
Os dois botões respondem ao toque com facilidade, sem precisar acertar um ponto muito pequeno da tela.

**O que observar de colateral**
- Telas vizinhas: a lista de Pedidos, que também tem botões pequenos de ação, não precisa ter mudado (fora de escopo desta entrega) — confirme que ela não quebrou visualmente.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 15 — O Painel Master mostra um único título grande por aba

Bloqueante: não.
Janela: executável a qualquer momento — exige acesso de super-administrador (equipe Nymbus).

**Pré-condição**
- Login no Painel Master (não é o painel do restaurante).

**Passos**
1. Entre no Painel Master.
2. Clique em cada uma das abas: Visão Geral, Clientes, Monitoramento, Configurações Master.
3. Se possível, ligue o Narrador (Windows + Ctrl + Enter) e use a navegação por títulos (Narrador: tecla H pula entre títulos da página) em cada aba.

**Resultado esperado**
Visualmente nada muda (o título de cada aba continua do mesmo tamanho e no mesmo lugar de antes). Usando o Narrador, ao pular entre títulos, cada aba deve ter apenas 1 título do nível mais importante ("Painel Master", fixo no topo) e os demais títulos (o nome da aba: "Visão Geral", "Clientes" etc.) devem ser anunciados como título de nível abaixo.

**O que observar de colateral**
- Telas vizinhas: nenhuma tela fora do Painel Master é afetada por este caso.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 16 — As abas do editor de item (Principal / Complementos / Variações) continuam funcionando

Bloqueante: não.
Janela: executável a qualquer momento.

**Pré-condição**
- Um item de cardápio cadastrado.

**Passos**
1. Vá em "Cardápio" e clique para editar um item.
2. Clique em cada uma das abas internas: "Principal", "Complementos", "Variações".
3. Se possível, ligue o Narrador e use o Tab para navegar até as abas, ouvindo o que é anunciado.

**Resultado esperado**
Cada clique troca o conteúdo mostrado para o da aba correspondente, sem travar nem sumir com o formulário. No Narrador, ao focar cada aba, ele anuncia que se trata de uma aba (ex.: "Principal, aba, selecionada").

**O que observar de colateral**
- Não se aplica.

**Dado de teste sugerido**
Nenhum dado novo necessário.

---

## Caso 17 — A grade de produtos do PDV usa mais de uma coluna numa janela de notebook

Bloqueante: não.
Janela: executável a qualquer momento — exige acesso pelo navegador do computador (não celular).

**Pré-condição**
- Caixa aberto, aba "PDV" com pelo menos 4-5 itens cadastrados no cardápio.

**Passos**
1. Abra o painel no navegador do computador, em tela cheia.
2. Vá reduzindo a largura da janela do navegador aos poucos, até ficar em torno de 1050-1100 pixels de largura (se não souber medir em pixels, use a régua de zoom do navegador, ou peça ajuda a alguém do time técnico para ajustar).
3. Observe a grade de produtos do PDV (coluna do meio, ao lado do carrinho).

**Resultado esperado**
Nessa largura, a grade de produtos mostra mais de uma coluna de itens lado a lado — não apenas uma coluna espremida ao lado do carrinho.

**O que observar de colateral**
- Telas vizinhas: em janelas mais estreitas ainda (celular), o PDV continua virando a versão de carrinho na parte de baixo da tela, como já era antes.

**Dado de teste sugerido**
Nenhum dado novo necessário — use os itens já cadastrados no cardápio de teste.

---

## Registro do resultado

| Caso | Executado por | Data | Resultado | Observação |
|---|---|---|---|---|
| 1 | Pabllo Martins | 2026-09-05 | OK | |
| 2 | Pabllo Martins | 2026-09-05 | OK | |
| 3 | Pabllo Martins | 2026-09-05 | OK | |
| 4 | Pabllo Martins | 2026-09-05 | OK | |
| 5 | Pabllo Martins | 2026-09-05 | OK | |
| 6 | Pabllo Martins | 2026-09-05 | OK | |
| 7 | Pabllo Martins | 2026-09-05 | OK | |
| 8 | Pabllo Martins | 2026-09-05 | OK | |
| 9 | Pabllo Martins | 2026-09-05 | OK | |
| 10 | Pabllo Martins | 2026-09-05 | OK | |
| 11 | Pabllo Martins | 2026-09-05 | OK | |
| 12 | Pabllo Martins | 2026-09-05 | OK | |
| 13 | Pabllo Martins | 2026-09-05 | OK | |
| 14 | Pabllo Martins | 2026-09-05 | OK | |
| 15 | Pabllo Martins | 2026-09-05 | OK | |
| 16 | Pabllo Martins | 2026-09-05 | OK | |
| 17 | Pabllo Martins | 2026-09-05 | OK | |

Veredito: todos os 17 casos conferidos e aprovados, incluindo os 7 bloqueantes (gate de PDV/Mesas/Caixa). Confirmado pelo dono do projeto em 2026-09-05, sem observação de colateral.

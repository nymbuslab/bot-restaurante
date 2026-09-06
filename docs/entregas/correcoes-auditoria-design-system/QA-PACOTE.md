# Pacote de QA — Acessibilidade e consistência visual do painel

## 1. O que mudou

O painel ficou mais acessível e mais consistente visualmente: avisos de sucesso ou erro agora são lidos em voz alta por leitor de tela, os botões de fechar (✕) das janelas passam a anunciar "Fechar", o contraste de alguns textos e selos melhorou, as telas mostram "Carregando…" enquanto buscam informação, o Cardápio vazio ou sem resultado de busca mostra uma mensagem amigável em vez de ficar em branco, formulários ficam visualmente mais consistentes, o Painel Master usa um único título grande por aba, os botões pequenos de editar/excluir do Cardápio ficam mais fáceis de tocar no celular, e a grade de produtos do PDV aproveita melhor o espaço em telas de notebook.

Além disso, mudou a ORDEM em que o sistema decide qual mensagem mostrar nas telas de PDV, Mesas e Caixa: antes de exibir a tela de venda, o sistema agora tenta carregá-la normalmente e só mostra "abra o caixa" ou um aviso de erro de conexão se for realmente o caso — o resultado final para quem usa deve continuar sendo o mesmo de sempre (nunca é possível vender sem o caixa aberto), mas a forma como a tela chega a essa conclusão mudou por dentro. É por isso que os 7 primeiros casos do roteiro abaixo merecem atenção redobrada.

## 2. Roteiro de teste

### Preparação única

Ambiente onde executar: ambiente de teste/homologação — **nunca em produção com clientes reais**. Se só houver o ambiente de produção disponível, use um restaurante de teste próprio (não o de um cliente) e evite qualquer ação em pedidos reais.

Perfil de acesso necessário: login de dono/administrador de um restaurante com **Plano Completo** (PDV, Mesas e Caixa só aparecem nesse plano).

Configuração que precisa estar ligada: nenhuma configuração especial — os casos abaixo cobrem o comportamento padrão do painel.

Antes de começar, confirme que:
- Existe pelo menos um restaurante de teste com Plano Completo, com pelo menos uma categoria e um item cadastrados no cardápio.
- Você consegue abrir e fechar o caixa do dia normalmente (Caixa → Abrir caixa / Fechar caixa).
- Você tem como desligar a internet do computador por alguns segundos (Wi-Fi ou cabo de rede), para simular uma queda de conexão em alguns casos.
- Se possível, tenha à mão um segundo restaurante de teste **recém-criado, sem nenhuma categoria** (para o Caso 8). Se não tiver, pode remover temporariamente todas as categorias de um restaurante de teste, testar, e recriá-las depois.

---

### Caso 1 — O PDV nunca libera venda quando o caixa está fechado

Bloqueante: sim — se falhar, não sobe.

**Pré-condição:** o caixa do dia está fechado (nenhum caixa aberto).

**O que fazer:**
1. Faça login no painel do restaurante de teste.
2. Clique em "PDV" no menu lateral.

**O que deve acontecer:** a tela mostra a mensagem "Abra o caixa para vender", com um botão "Ir para o Caixa". Nenhuma grade de produtos nem carrinho de venda aparece na tela.

**O que indicaria falha:** a grade de produtos ou o carrinho de venda aparecem mesmo com o caixa fechado.

**O que observar de colateral:** as abas "Mesas" e "Caixa" devem mostrar, cada uma, a mensagem correta para o estado em que estão — nenhuma delas deve mostrar a tela de venda liberada. Pedidos feitos em dias anteriores continuam aparecendo normalmente na aba "Pedidos", independente do estado do caixa de hoje.

**Dado de teste sugerido:** nenhum dado novo é necessário — use o restaurante de teste já cadastrado, com o caixa fechado.

---

### Caso 2 — Mesas nunca libera lançamento quando o caixa está fechado

Bloqueante: sim.

**Pré-condição:** o caixa do dia está fechado.

**O que fazer:**
1. Clique em "Mesas" no menu lateral.

**O que deve acontecer:** a tela mostra a mensagem "Abra o caixa para usar Mesas", com um botão "Ir para o Caixa". Nenhuma grade de mesas aparece.

**O que indicaria falha:** a grade de mesas aparece mesmo com o caixa fechado.

**O que observar de colateral:** a aba "PDV" (Caso 1) deve mostrar a mesma coerência. Mesas fechadas em dias anteriores continuam aparecendo corretamente no histórico/relatório de caixa daquele dia, se você consultar um Caixa anterior na lista "Caixas anteriores".

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 3 — Abrir o caixa libera PDV e Mesas normalmente

Bloqueante: sim.

**Pré-condição:** o caixa do dia está fechado (continuando do Caso 1/2).

**O que fazer:**
1. Na tela de "Abra o caixa para vender" (PDV) ou "Abra o caixa para usar Mesas", clique no botão "Ir para o Caixa".
2. Clique em "Abrir caixa" e preencha o valor de fundo de troco (pode ser R$ 0,00 ou qualquer valor de teste).
3. Confirme a abertura.
4. Volte para a aba "PDV".
5. Volte para a aba "Mesas".

**O que deve acontecer:** depois de abrir o caixa, a aba "PDV" mostra a grade de produtos e o carrinho de venda normalmente, e a aba "Mesas" mostra a grade de mesas normalmente. Nenhuma das duas mostra mais a mensagem de "abra o caixa".

**O que indicaria falha:** alguma das duas telas continua mostrando "abra o caixa" mesmo com o caixa já aberto.

**O que observar de colateral:** a aba "Caixa" passa a mostrar o resumo do caixa aberto (dinheiro em caixa, total para conferência), não mais a tela de abertura. Nenhum pedido ou mesa antiga muda de valor por causa dessa abertura.

**Dado de teste sugerido:** fundo de troco de teste: R$ 50,00.

---

### Caso 4 — Uma queda de conexão no PDV mostra um aviso de erro diferente de "abra o caixa"

Bloqueante: sim — este é exatamente o comportamento que mudou de lugar nesta entrega.

**Pré-condição:** o caixa do dia está aberto. Você está na aba "PDV", com a internet do computador funcionando.

**O que fazer:**
1. Desligue a internet do computador (desative o Wi-Fi, ou desconecte o cabo de rede).
2. Atualize a página do painel (F5) ou saia da aba "PDV" e entre de novo.
3. Aguarde a tela terminar de carregar (ou tentar carregar).
4. Religue a internet.
5. Clique no botão de tentar de novo, se ele estiver visível.

**O que deve acontecer:** com a internet desligada, a tela mostra uma mensagem de **erro de conexão** (algo como "não foi possível carregar" ou "tente de novo"), com um botão para tentar novamente — **e não** a mensagem "Abra o caixa para vender". Depois de religar a internet e clicar em tentar de novo, a grade de produtos do PDV volta a aparecer normalmente.

**O que indicaria falha:** a tela mostra "Abra o caixa para vender" durante a queda de conexão (em vez de um aviso de erro), ou a grade de produtos não volta a aparecer depois de reconectar.

**O que observar de colateral:** repita o mesmo teste na aba "Mesas" (Caso 5) — o comportamento deve ser o mesmo: erro de conexão, nunca "abra o caixa". Depois de reconectar, os pedidos e vendas feitos antes da queda de conexão continuam aparecendo certos, nada se perde.

**Dado de teste sugerido:** nenhum dado novo necessário — o teste é sobre a mensagem que aparece, não sobre um valor.

---

### Caso 5 — Uma queda de conexão em Mesas mostra o mesmo tipo de aviso de erro

Bloqueante: sim.

**Pré-condição:** o caixa do dia está aberto. Você está na aba "Mesas".

**O que fazer:**
1. Desligue a internet do computador.
2. Atualize a página ou saia e entre de novo na aba "Mesas".
3. Religue a internet e clique em tentar de novo, se disponível.

**O que deve acontecer:** com a internet desligada, aparece uma mensagem de erro de conexão com opção de tentar de novo — **nunca** a mensagem de "abra o caixa". Depois de religar e tentar de novo, a grade de mesas volta a aparecer normalmente.

**O que indicaria falha:** a tela mostra "abra o caixa" durante a queda de conexão, ou a grade de mesas não volta depois de reconectar.

**O que observar de colateral:** compare com o resultado do Caso 4 (PDV) — as duas devem se comportar da mesma forma.

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 6 — Caixa de um dia anterior ainda esquecido aberto continua bloqueando venda corretamente

Bloqueante: sim — garante que a reorganização da tela não afrouxou uma trava de segurança que já existia.

Exige um caixa "esquecido aberto" de um dia anterior — se não tiver um disponível, pule este caso e registre como "não testável neste ambiente".

**Pré-condição:** existe um caixa aberto desde um dia anterior (não fechado ontem), no restaurante de teste.

**O que fazer:**
1. Clique em "PDV".
2. Clique em "Mesas".

**O que deve acontecer:** em vez da grade normal de venda, aparece um aviso informando que há um caixa aberto de um dia anterior e que é preciso fechá-lo antes de vender hoje, com um atalho para a aba "Caixa".

**O que indicaria falha:** a grade normal de venda aparece mesmo havendo um caixa esquecido aberto de um dia anterior.

**O que observar de colateral:** a aba "Caixa" deve mostrar claramente esse caixa antigo e permitir fechá-lo. Ao fechar esse caixa antigo, os valores e vendas registrados nele continuam batendo com o que já havia sido lançado — nada muda de valor.

**Dado de teste sugerido:** se for preciso criar esse cenário, abra um caixa, não feche, e simule a virada de dia (ou peça para alguém do time técnico ajustar a data em ambiente de teste).

---

### Caso 7 — Um erro genérico ao carregar o Caixa não é confundido com "sem caixa"

Bloqueante: não — verificação posterior.

**Pré-condição:** você está na aba "Caixa".

**O que fazer:**
1. Desligue a internet do computador.
2. Atualize a página do painel ou saia e entre de novo na aba "Caixa".
3. Religue a internet.

**O que deve acontecer:** aparece uma mensagem indicando falha ao carregar o caixa, diferente da tela normal de "abrir caixa" ou do resumo do caixa aberto.

**O que indicaria falha:** durante a queda de conexão, a tela mostra a tela normal de "abrir caixa" em vez de um aviso de erro.

**O que observar de colateral:** compare com PDV (Caso 4) e Mesas (Caso 5).

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 8 — Restaurante novo, sem nenhuma categoria, mostra uma tela de boas-vindas no Cardápio, não uma tela em branco

Bloqueante: não — verificação posterior.

**Pré-condição:** um restaurante de teste sem nenhuma categoria cadastrada no cardápio (recém-criado, ou com todas as categorias removidas temporariamente).

**O que fazer:**
1. Faça login nesse restaurante.
2. Clique em "Cardápio" no menu lateral.

**O que deve acontecer:** a tela mostra uma mensagem convidando a criar a primeira categoria (algo como "crie sua primeira categoria"), com um botão ou link que leva à tela de Categorias — **não** uma área em branco, sem nenhum texto.

**O que indicaria falha:** a tela fica em branco, sem texto nem botão.

**O que observar de colateral:** clicar no botão/link leva mesmo à tela de Categorias, e criar uma categoria ali faz a mensagem de boas-vindas sumir na próxima vez que abrir o Cardápio.

**Dado de teste sugerido:** restaurante de teste "Sem Categoria Teste", sem nenhum item cadastrado.

---

### Caso 9 — Buscar por um prato que não existe no Cardápio mostra o mesmo aviso visual dos outros avisos do sistema

Bloqueante: não.

**Pré-condição:** um restaurante de teste com pelo menos uma categoria e um item cadastrados.

**O que fazer:**
1. Clique em "Cardápio".
2. No campo de busca, digite um nome que certamente não existe, por exemplo "xpto-inexistente-123".

**O que deve acontecer:** aparece um aviso "Nenhum item encontrado para xpto-inexistente-123", com a mesma aparência visual (caixa com borda e ícone) dos outros avisos de "lista vazia" já usados em outras telas do painel — não mais um texto solto sem moldura.

**O que indicaria falha:** o aviso aparece como texto solto, sem a moldura padrão usada em outras telas.

**O que observar de colateral:** compare visualmente com o aviso de "nenhum pedido encontrado" na aba Pedidos, se houver, para confirmar que o visual é o mesmo padrão.

**Dado de teste sugerido:** termo de busca: "xpto-inexistente-123".

---

### Caso 10 — As telas de Pedidos, PDV, Mesas e Caixa mostram "Carregando…" ao abrir

Bloqueante: não.

Pode ser rápido demais para ver numa conexão veloz; se não conseguir observar, registre como "não observado, conexão rápida demais" em vez de marcar como falha.

**Pré-condição:** caixa aberto (para ver PDV/Mesas/Caixa com conteúdo).

**O que fazer:**
1. Clique em "Pedidos".
2. Observe o instante logo após o clique, antes da lista aparecer.
3. Repita clicando em "PDV", depois "Mesas", depois "Caixa".

**O que deve acontecer:** por um instante, antes do conteúdo da tela aparecer, é possível ver o texto "Carregando…" em cada uma das 4 telas.

**O que indicaria falha:** a tela pula direto para o conteúdo ou para uma tela em branco, sem nenhum aviso de carregamento visível em nenhuma tentativa.

**Dado de teste sugerido:** nenhum dado novo necessário. Se quiser tornar o "Carregando…" mais fácil de ver, peça para alguém do time técnico simular uma conexão lenta no navegador durante o teste.

---

### Caso 11 — O aviso de sucesso ou erro (toast) é lido em voz alta pelo leitor de tela

Bloqueante: não.

**Pré-condição:** Windows com o Narrador disponível (tecla Windows + Ctrl + Enter liga e desliga o Narrador).

**O que fazer:**
1. Ligue o Narrador do Windows (Windows + Ctrl + Enter).
2. No painel, faça uma ação que gere um aviso de sucesso — por exemplo, salvar uma alteração simples em Configurações.
3. Sem tocar em mais nada, espere o Narrador falar.
4. Depois, provoque um aviso de erro — por exemplo, desligue a internet e tente salvar algo, ou tente uma ação que já se saiba que dá erro.

**O que deve acontecer:** assim que o aviso aparece no canto da tela, o Narrador anuncia o texto do aviso em voz alta, **sem** você precisar navegar até ele com o Tab.

**O que indicaria falha:** o Narrador fica em silêncio quando o aviso aparece, e só fala o texto se você navegar manualmente até ele.

**O que observar de colateral:** o mesmo aviso aparece e é lido em qualquer aba do painel onde uma ação de salvar/excluir/confirmar dispare o aviso.

**Dado de teste sugerido:** qualquer alteração pequena e reversível em Configurações (ex.: ligar e desligar de novo o som de novo pedido).

---

### Caso 12 — Os botões de fechar dos avisos (janelas de detalhe, QR Code, editar item, adicionar cartão) anunciam "Fechar" no leitor de tela

Bloqueante: não.

**Pré-condição:** Narrador do Windows ligado (Windows + Ctrl + Enter).

**O que fazer:**
1. Abra o detalhe de um pedido (aba Pedidos, clique em um pedido da lista).
2. Aperte Tab até o foco chegar no botão "✕" no canto da janela.
3. Ouça o que o Narrador anuncia.
4. Feche essa janela e repita o mesmo teste para: o QR Code do cardápio (botão "Ver QR Code", se disponível), o editor de um item do cardápio (clique em editar um item), e a tela de adicionar cartão (aba Assinatura, se disponível).

**O que deve acontecer:** em todos os 4 casos, o Narrador anuncia a palavra "Fechar" ao focar o botão "✕" — nunca fica mudo nem lê um símbolo sem sentido.

**O que indicaria falha:** o Narrador fica em silêncio, ou lê algo sem sentido (como "botão x"), em algum dos 4 botões.

**Dado de teste sugerido:** um pedido qualquer já existente para abrir o detalhe; um item de cardápio qualquer para abrir o editor.

---

### Caso 13 — O selo cinza "Livre" nas mesas está legível

Bloqueante: não.

**Pré-condição:** caixa aberto, aba "Mesas" com pelo menos uma mesa livre (sem pedido em aberto).

**O que fazer:**
1. Clique em "Mesas".
2. Observe o selo/etiqueta com a palavra "Livre" sobre a mesa disponível.

**O que deve acontecer:** o texto "Livre" no selo cinza é legível a olho nu, sem parecer apagado ou "lavado" contra o fundo do selo.

**O que indicaria falha:** o texto continua difícil de ler contra o fundo do selo.

**O que observar de colateral:** os outros selos de status de mesa (ocupada, aguardando conta, fechando) continuam com a aparência de antes.

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 14 — Os botões de editar/excluir/restaurar item do Cardápio ficam mais fáceis de tocar no celular

Bloqueante: não.

**Pré-condição:** um item cadastrado no cardápio. Acesso pelo navegador do celular, ou pelo navegador do computador numa janela estreita (redimensione a janela para simular a tela de um celular).

**O que fazer:**
1. Abra o painel pelo celular (ou janela estreita) e vá em "Cardápio".
2. Tente tocar/clicar no ícone de editar (lápis) e no ícone de excluir (lixeira) ao lado de um item.

**O que deve acontecer:** os dois botões respondem ao toque com facilidade, sem precisar acertar um ponto muito pequeno da tela.

**O que indicaria falha:** os botões continuam pequenos demais para tocar com facilidade.

**O que observar de colateral:** a lista de Pedidos, que também tem botões pequenos de ação, não precisa ter mudado (fora de escopo desta entrega) — confirme que ela não quebrou visualmente.

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 15 — O Painel Master mostra um único título grande por aba

Bloqueante: não. Exige acesso de super-administrador (equipe Nymbus).

**Pré-condição:** login no Painel Master (não é o painel do restaurante).

**O que fazer:**
1. Entre no Painel Master.
2. Clique em cada uma das abas: Visão Geral, Clientes, Monitoramento, Configurações Master.
3. Se possível, ligue o Narrador (Windows + Ctrl + Enter) e use a navegação por títulos (Narrador: tecla H pula entre títulos da página) em cada aba.

**O que deve acontecer:** visualmente nada muda (o título de cada aba continua do mesmo tamanho e no mesmo lugar de antes). Usando o Narrador, ao pular entre títulos, cada aba deve ter apenas 1 título do nível mais importante ("Painel Master", fixo no topo) e os demais títulos (o nome da aba: "Visão Geral", "Clientes" etc.) devem ser anunciados como título de nível abaixo.

**O que indicaria falha:** o Narrador aponta mais de um título do nível mais importante na mesma aba.

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 16 — As abas do editor de item (Principal / Complementos / Variações) continuam funcionando

Bloqueante: não.

**Pré-condição:** um item de cardápio cadastrado.

**O que fazer:**
1. Vá em "Cardápio" e clique para editar um item.
2. Clique em cada uma das abas internas: "Principal", "Complementos", "Variações".
3. Se possível, ligue o Narrador e use o Tab para navegar até as abas, ouvindo o que é anunciado.

**O que deve acontecer:** cada clique troca o conteúdo mostrado para o da aba correspondente, sem travar nem sumir com o formulário. No Narrador, ao focar cada aba, ele anuncia que se trata de uma aba (ex.: "Principal, aba, selecionada").

**O que indicaria falha:** o conteúdo não troca, o formulário some, ou o Narrador não identifica os elementos como abas.

**Dado de teste sugerido:** nenhum dado novo necessário.

---

### Caso 17 — A grade de produtos do PDV usa mais de uma coluna numa janela de notebook

Bloqueante: não. Exige acesso pelo navegador do computador (não celular).

**Pré-condição:** caixa aberto, aba "PDV" com pelo menos 4-5 itens cadastrados no cardápio.

**O que fazer:**
1. Abra o painel no navegador do computador, em tela cheia.
2. Vá reduzindo a largura da janela do navegador aos poucos, até ficar em torno de 1050-1100 pixels de largura (se não souber medir em pixels, use a régua de zoom do navegador, ou peça ajuda a alguém do time técnico para ajustar).
3. Observe a grade de produtos do PDV (coluna do meio, ao lado do carrinho).

**O que deve acontecer:** nessa largura, a grade de produtos mostra mais de uma coluna de itens lado a lado — não apenas uma coluna espremida ao lado do carrinho.

**O que indicaria falha:** a grade continua mostrando só uma coluna espremida nessa largura.

**O que observar de colateral:** em janelas mais estreitas ainda (celular), o PDV continua virando a versão de carrinho na parte de baixo da tela, como já era antes.

**Dado de teste sugerido:** nenhum dado novo necessário — use os itens já cadastrados no cardápio de teste.

---

### Registro do resultado

| Caso | Executado por | Data | Resultado | Observação |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
| 14 | | | | |
| 15 | | | | |
| 16 | | | | |
| 17 | | | | |

## 3. O que observar de colateral

A área que merece mais atenção é a Financeira: PDV, Mesas e Caixa. A ordem interna de decisão dessas 3 telas mudou (Casos 1 a 7), então vale conferir também, fora do roteiro, se relatórios de fechamento de caixa e comprovantes impressos continuam com os mesmos valores de sempre — nenhuma correção desta entrega mexeu em cálculo, só em qual mensagem aparece e quando.

Fora dessa área, as demais mudanças são pontuais (um selo, um botão, um texto de tela vazia) e cada caso já descreve o que olhar ao lado.

## 4. Dado de teste sugerido

- Um restaurante de teste fictício com Plano Completo (ex.: "Restaurante Teste Nymbus"), com pelo menos uma categoria (ex.: "Lanches") e um item (ex.: "X-Teste") cadastrados.
- Um segundo restaurante de teste fictício, recém-criado, sem nenhuma categoria (ex.: "Sem Categoria Teste") — só para o Caso 8.
- Nenhum dado real de cliente, pedido ou pagamento deve ser usado em nenhum dos 17 casos.

## 5. Ambiente e estado inicial

**Onde testar:** ambiente de teste/homologação. Se só houver produção disponível, use um restaurante de teste próprio, nunca o de um cliente real, e evite qualquer ação sobre pedidos reais.

**O que precisa existir antes:** login de dono/administrador de um restaurante de teste com Plano Completo (peça o acesso a quem administra o ambiente de teste, não peça senha de cliente). Pelo menos uma categoria e um item no cardápio desse restaurante.

**O que precisa estar ligado:** nada além do funcionamento normal do painel. Alguns casos pedem para desligar e religar a internet do computador de propósito — isso é intencional, não é um problema do ambiente.

## 6. Critério de aprovação

**APROVADO quando:** os 7 primeiros casos (bloqueantes) passam exatamente como descrito — em nenhum momento a tela de venda do PDV ou de Mesas aparece liberada com o caixa fechado, e uma queda de conexão nunca é confundida com "caixa fechado". Falhas nos casos 8 a 17 (não bloqueantes) são registradas na tabela, mas não impedem a aprovação.

**REPROVADO quando:** qualquer um dos casos 1 a 7 falha — em especial se, em algum momento, a grade de venda do PDV ou de Mesas aparecer liberada com o caixa fechado, ou se uma queda de conexão mostrar "abra o caixa" em vez de um aviso de erro.

## 7. O que NÃO faz parte desta entrega

- A paginação da lista de Pedidos (quando ela cresce muito) não muda nesta entrega — é um problema já conhecido, tratado à parte.
- A confirmação de exclusão de item sem mostrar o nome do item também não muda nesta entrega — mesmo caso, tratado à parte.
- Nenhum valor, cálculo, imposto, frete, forma de pagamento ou fechamento de caixa muda nesta entrega — só a aparência das telas e a ordem em que os avisos aparecem.

---

Não se aplica: este é um trabalho de melhoria (não uma correção de ocorrência de cliente), então não existe um "relatório de uso" a devolver a um cliente depois da aprovação.

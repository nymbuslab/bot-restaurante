# Decisões — observacao-item-cozinha-sem-complemento

> Uma linha por decisão tomada no planejamento (F2 e, excepcionalmente, F3). Formato fixo. Não apague decisões: uma decisão revertida ganha nova linha que cita a anterior.

## Decisões

```
D-01 | Escopo é só PDV e Mesas (mesma grade/handlers em public/app.js) | Também mexer no cardápio web | O cardápio web já abre modal com observação para todo item disponível vendido por unidade, com ou sem complemento (base/02-cardapio-web-modal-observacao.md) — não há gap lá.
D-02 | Item com cozinha=true, variação (ex.: tamanho) mas SEM grupo de complemento também deve abrir o modal ao ser clicado como sabor na busca (pdvVariacaoClick, public/app.js:6007) | Manter o atalho de 1 clique pra variação sem grupo | O dono confirmou que a flag cozinha vale igual nesse caminho.
D-03 | Campo de observação continua opcional (sem required) | Tornar obrigatório escrever algo | Mesmo padrão já usado no cardápio web e no modal do PDV para item com grupo.
D-04 | Efeito colateral aceito: item de cozinha sem complemento deixa de somar quantidade automaticamente em clique repetido do card, porque passa a abrir modal a cada clique (mesmo padrão que item com grupo/variação/kg já tem hoje) | Desenhar uma solução que preserve a soma automática mesmo com modal | O dono aceitou o mesmo padrão já existente para itens com grupo — consistência maior que a perda do atalho.
D-05 | Reaproveitar 100% o modal existente (abrirPdvItemModal, public/app.js:6067) — a task só muda a condição de quando ele abre (pdvTileClick, public/app.js:6047, e pdvVariacaoClick, public/app.js:6008) | Criar um modal/tela nova só para observação | O modal já renderiza corretamente um item sem nenhum grupo/variação (só nome, preço, observação, quantidade, Adicionar) — confirmado lendo o código (base/03-pdv-mesas-tile-click.md).
D-06 | Toda task de código desta feature nasce com `prototipo: pendente`, mesmo sendo reaproveitamento de modal já existente e sem criar tela nova | Dispensar protótipo por ser mudança estrutural sem nova decisão visual (exceção do CLAUDE.md) | O dono pediu protótipo mesmo assim, na P-06. Decisão do dono prevalece sobre a exceção do CLAUDE.md.
D-07 | Definição de pronto: testar de verdade no PDV avulso E em Mesas (marcar item como cozinha sem complemento, clicar, ver o modal, escrever observação, confirmar e ver a observação na comanda impressa/fila de impressão) | Confiar só na suíte automatizada (node:test) sem teste ao vivo | O dono escolheu as duas opções de teste real (P-05), além da suíte que já é padrão do projeto.
D-08 | Não criar log/métrica nova para quantas vezes o modal abre por causa da flag cozinha | Adicionar contador/log específico | O dono confirmou que o registro já existente (observação salva no pedido, impressa na comanda) é suficiente.
D-09 | Não criar tratamento de erro novo — reaproveita o mesmo caminho de recálculo/gravação/erro que qualquer item com grupo/variação já usa hoje no PDV | Desenhar tratamento de erro específico para este caso | O dono confirmou que não há cenário de erro novo introduzido por esta feature.
D-10 | Item com cozinha=true QUE JÁ TEM grupo de complemento configurado continua abrindo o modal exatamente como hoje (nenhuma mudança de comportamento nesse caso) | — | Fato observado direto no código (base/03-pdv-mesas-tile-click.md): a condição atual (`bib.length || vars.length || ehKg`) já cobre esse caso; a nova condição só adiciona um caso a mais, não substitui os existentes.
D-11 | A falta de quebra de linha automática na linha "Obs: <texto>" da comanda da cozinha (public/comanda.js:92) fica FORA do escopo desta feature | Corrigir esse risco de UX junto | É um comportamento pré-existente em `montarCozinha`, não introduzido por esta mudança — reportar como achado separado (item de Próximos Passos), não misturar no escopo desta entrega.
```

## Pendências

```
Nenhuma pendência.
```

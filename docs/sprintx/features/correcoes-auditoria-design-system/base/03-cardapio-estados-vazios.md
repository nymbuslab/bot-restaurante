# Cardápio — estado vazio de tenant novo e de busca sem resultado (Alto #6 e Médio #3 do AUDIT.md)

## Contrato de entrada

- `renderCardapio()`, `public/app.js:2294-2386`, chamada sempre que a aba Cardápio é recarregada.
  Lê `cardapioAtual.categorias` (array) e `cardapioBusca` (string do campo de busca).
- Fluxo relevante:
  - `public/app.js:2300-2307`: para cada categoria, pula (`return`, sem renderizar nada) se
    `cat.itens` está vazio ou se todos os itens da categoria foram filtrados pela busca.
  - `public/app.js:2382-2384`:
    ```js
    if (termo && totalMostrado === 0) {
      c.innerHTML = `<p class="cardapio-vazio-busca">Nenhum item encontrado para "<strong>${escapar(termo)}</strong>".</p>`;
    }
    ```
    Só substitui o container por essa mensagem quando `termo` (busca) é uma string não vazia. Se
    `cardapioAtual.categorias` é `[]` (tenant novo, sem nenhuma categoria cadastrada) e
    `cardapioBusca` está vazio (`""`, falsy), o laço `forEach` (linha 2300) não roda nenhuma vez,
    `totalMostrado` fica `0`, mas a condição `termo && totalMostrado === 0` é `false` porque
    `termo` é `""` — o bloco de mensagem NUNCA executa. `c.innerHTML = ""` (linha 2297) já tinha
    zerado o container antes do laço, então o resultado final é um `<div id="cardapioContainer">`
    vazio, sem nenhum filho.
  - Único aviso reativo existente hoje: `public/app.js:3186-3189` (fora de `renderCardapio`),
    disparado só quando o usuário clica em "Novo Item" sem nenhuma categoria: mostra
    `toast("Crie uma categoria antes de adicionar itens.", "erro")`. Não aparece
    proativamente na tela, só como reação a um clique.
- Componente de estado vazio já existente e usado em outras telas: `.estado-vazio`
  (`public/style.css:2326-2349`) — bloco centralizado com ícone opcional, título (`<p>`, 15px/600)
  e `.sub` (texto secundário). A auditoria cita uso em Pedidos e Faturas (não lido nesta base —
  fora do escopo dos 12 achados).
- Estado vazio de busca (`.cardapio-vazio-busca`, linha 2383) usa markup próprio: um único `<p>`
  sem ícone e sem `.sub`, e SEM classe CSS documentada em `style.css` nas leituras desta base
  (buscar a regra exata é tarefa de implementação, não desta fase de ingestão).

## Contrato de saída

- **Hoje (tenant novo, sem categoria):** `#cardapioContainer` fica um `<div>` vazio. Nenhum
  texto, ícone ou call-to-action visível até o usuário tentar adicionar um item e ver o toast de
  erro reativo.
- **Hoje (busca sem resultado):** mostra `<p class="cardapio-vazio-busca">Nenhum item
  encontrado para "termo".</p>`, com visual diferente do `.estado-vazio` padrão (sem ícone, sem
  `.sub`, sem o card com borda/fundo/padding de `.estado-vazio`).
- **Esperado:** tenant novo mostra um `.estado-vazio` com CTA para criar a primeira categoria
  (texto exato e destino do CTA — abrir modal de categoria? navegar para a tela de Categorias
  citada no comentário `app.js:2301` "gerida na tela Categorias"? — não documentado, é pergunta
  da F2). Busca sem resultado passa a usar `.estado-vazio` no lugar do markup próprio.

## Limites e cotas

NÃO DOCUMENTADO (não se aplica).

## Erros conhecidos e tratamento

- Nenhum erro de execução; é ausência de feedback visual (achado de UX), não bug funcional.
- Contexto do próprio `CLAUDE.md` (raiz do projeto): "No primeiro acesso, crie a primeira empresa
  pelo onboarding público (...). O tenant nasce limpo (cardápio vazio, identidade só com o
  nome)." — confirma que cardápio vazio em tenant novo é um estado ESPERADO e frequente (todo
  cadastro novo passa por ele), não um caso raro.

## Riscos para a nossa implementação

- A tela "Categorias" mencionada no comentário `app.js:2301` não foi lida nesta base (fora do
  escopo dos 12 achados) — se o CTA do novo `.estado-vazio` precisar navegar até lá ou abrir um
  modal de criação direto, isso depende de uma função/rota já existente que precisa ser
  localizada na F3 antes de implementar (não inventar nome de função aqui).
- Trocar `.cardapio-vazio-busca` por `.estado-vazio` muda o HTML gerado (linha 2383) — checar se
  algum outro seletor CSS ou teste (não encontrado nas buscas desta base) depende da classe
  antiga `cardapio-vazio-busca` antes de removê-la.
- Os dois achados tocam a MESMA função (`renderCardapio`) e o MESMO arquivo/linhas próximas —
  risco de conflito se forem implementados como tasks totalmente independentes/paralelas; a F3
  deve considerar dependência entre elas (provavelmente uma tarefa só, ou duas tasks sequenciais
  na mesma função).

## Fonte

- `public/app.js:2294-2386` (`renderCardapio`), `3186-3189` (toast reativo de categoria) — lido
  em 2026-09-05.
- `public/style.css:2326-2349` (`.estado-vazio`) — lido em 2026-09-05.
- `CLAUDE.md` (raiz do projeto), seção "Como rodar" — lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achados Alto #6 e Médio #3) — lido em 2026-09-05.

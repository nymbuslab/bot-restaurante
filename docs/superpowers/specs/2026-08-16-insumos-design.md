# Insumos e ficha técnica (split de Produtos 4/4)

> Data: 2026-08-16 · Status: desenho aprovado pelo dono, implementação não iniciada
> Última etapa do split de Produtos. Depende do `id` estável de opção entregue pela 2/4 e da
> trilha de movimentação (`estoque_movimentos`) entregue pela 3/4.

## Problema

O estoque de hoje é **por produto pronto**: vender um marmitex desconta um marmitex. Isso não
responde nenhuma pergunta que o dono faz de verdade, porque ninguém compra marmitex pronto.
Compra-se arroz, feijão, frango e embalagem.

Três consequências:

1. **Não dá para saber o que está acabando de verdade.** O saldo de "Marmitex P" é uma ficção
   contábil; o que acaba no meio do almoço é o frango.
2. **O produto montado obriga a controlar o que não existe.** Para o número não mentir, o dono
   teria que dar entrada de marmitex toda manhã, um a um, adivinhando quantos vai conseguir
   montar.
3. **Complemento não desconta nada.** O cliente escolhe "Frango Grelhado" dentro de um grupo, e
   essa escolha some do controle. Dois marmitex com proteínas diferentes descontam igual.

O item 3 é o que a etapa 2/4 já preparou terreno para resolver: o `id` estável de opção foi
criado com um comentário no código dizendo que é "a âncora da ficha técnica de Insumos".

## Decisões tomadas (dono, 2026-08-16)

1. **O objetivo é a baixa por ingrediente.** Custo e CMV vêm de brinde da mesma ficha, mas não
   ganham tela nesta entrega.
2. **Falta de insumo avisa, não bloqueia.** Zerou o arroz, o marmitex continua vendendo. Difere
   do produto, que hoje bloqueia com 409. O saldo do insumo **pode ficar negativo**, e é o
   negativo que revela o furo: zerar por baixo esconderia o problema.
3. **Sem fator de correção e sem produção/pré-preparo.** O insumo é cadastrado já limpo. A peça
   de contra filé é pesada depois de limpar e entra como 3,8 kg. Peso bruto, aparas e receita de
   pré-preparo ficam fora.
4. **Saldo de insumo em tela própria.** "Controle de estoque" continua só com produtos.
5. **A ficha alcança o produto e a opção de grupo, dos dois tipos.** Correção de rota durante o
   desenho: neste código `complemento` é o extra pago e `composicao` é a escolha sem preço. A
   guarnição do marmitex é `composicao`; restringir a ficha a `complemento` deixaria de fora o
   caso que motiva a etapa inteira.
6. **Produto com ficha perde o estoque próprio.** Mesmo precedente do produto com variações, cujo
   `estoque` é apagado do pai no salvar (`src/servidor.js:1706`). Uma fonte de verdade só.
7. **Produto com variações não tem ficha.** A aba fica escondida com o motivo na tela. Uma ficha
   única multiplicada faria 300 ml e 500 ml consumirem igual, e o saldo mentiria em silêncio.
   Ficha por variação entra depois de forma aditiva (`variacao.ficha`, mesmo formato) se fizer
   falta. Não faz falta hoje: Marmitex P, M e G são produtos separados no cardápio real.
8. **Não existe chave "produto composto".** A própria ficha é a marca: produto com pelo menos uma
   linha é composto, ficha vazia é revenda e mantém o estoque próprio. Zero campo novo, zero
   decisão nova a manter em dia, e a transição acontece no gesto natural de cadastrar o primeiro
   ingrediente.

### Por que não reusar a flag `cozinha`

Foi avaliado usar `item.cozinha` ("Imprime na cozinha") como marcador de produto composto, já
que as duas coisas quase sempre andam juntas. **Descartado**: `cozinha` responde "para onde vai o
papel", a ficha responde "o que sai do estoque". Elas se separam em casos reais (caipirinha e suco
natural consomem insumo e costumam não sair na comanda da cozinha; sobremesa comprada pronta pode
sair na cozinha só para empratar), e o acoplamento criaria uma falha silenciosa: desmarcar
"imprime na cozinha" por um motivo operacional pararia a baixa de insumo sem aviso.

A intuição é aproveitada como **guia, não como regra**: a tela de Insumos mostra "produtos que
saem na cozinha e ainda não têm ficha", que ataca o problema real de adoção.

## Modelo de dados

### Tabela nova `insumos`

Insumo **não** vai para o jsonb do cardápio. O jsonb tem teto de 512 KB
(`LIMITE_CARDAPIO_BYTES`, `src/validacao.js:11`) e é reescrito inteiro a cada edição de cardápio;
saldo que muda a cada venda não pode viver ali.

```sql
id          bigserial primary key
empresa_id  uuid not null references empresas(id) on delete cascade
nome        text not null
unidade     text not null default 'un'      -- 'un' | 'kg' | 'l'
saldo       numeric(14,3) not null default 0 -- PODE ser negativo
minimo      numeric(14,3) not null default 0
custo       numeric(12,4)                    -- opcional, sem tela nesta etapa
arquivado   boolean not null default false
criado_em   timestamptz not null default now()
```

`numeric(14,3)` é explícito para o arredondamento acontecer **no banco** e matar deriva de float
do JS. Índice `(empresa_id, arquivado)` e unique parcial `(empresa_id, lower(nome)) where not
arquivado`. Bloco de hardening obrigatório (RLS sem policy + `REVOKE ALL FROM anon, authenticated`
+ `COMMENT ON TABLE`), modelo em `20260813120000_estoque_movimentos.sql`.

**Insumo nunca é apagado, só arquivado**, para não deixar movimento órfão na trilha.

### Ficha técnica no jsonb

A ficha mora junto de quem ela descreve:

```
item.ficha            = [{ insumoId, qtd }]   // o que todo marmitex leva
grupo.opcoes[].ficha  = [{ insumoId, qtd }]   // o que a opção "Frango Grelhado" leva
```

`qtd` fica **na unidade do insumo** (0.2 para 200 g de um insumo em kg). A tela aceita digitar em
grama e converte na entrada; três casas decimais dão precisão de grama e de mililitro. Nenhuma
máquina de conversão de unidade é construída.

Confirmado que `Estoque.diffEstoque` só percorre `item.estoque`/`variacoes[].estoque`, então a
ficha no jsonb **não** gera movimento `ajuste` fantasma a cada salvada do cardápio.

### Movimentos reusam `estoque_movimentos`

Com `item_id = "ins_" + id` e `variacao_id = null`, sem mudança de schema. A coluna `item_id` é
`text` sem FK justamente porque o id vive no jsonb e não tem tipo garantido.

Ganho: `estoqueDb.listar`, `estoqueDb.resumo` e a retenção de 12 meses já agendada no `index.js`
funcionam **sem uma linha de mudança**. O extrato da gaveta de insumo sai de graça.

Custo: `item_id` passa a ter dois namespaces. Neutralizado com o prefixo vivendo como constante
única em `public/insumos.js` (`PREFIXO_INSUMO`, `chaveMovimento`, `ehInsumo`), nunca string solta,
mais `COMMENT ON COLUMN` documentando o namespace duplo.

A alternativa (tabela `insumo_movimentos` separada) traria só o `insumo_id` com FK, e custaria
duplicar `listar`/`resumo`/`limparAntigos`, RLS e o agendamento da retenção.

## A ordem das fases é ditada por um problema de payload

Três dos quatro caminhos de venda passam o payload **cru** para a baixa, que tem os ids das
opções escolhidas. O **PDV Balcão** passa o já **recalculado** (`src/caixa.js:193`), que só tem
nomes. E os **cinco caminhos de cancelamento** leem `pedidos.itens`, o jsonb salvo, que também só
tem nomes.

Resolver a ficha pelos ids do payload funcionaria em **3 de 4 vendas e em 0 de 5 devoluções**.

A saída é gravar os ids no pedido. `avaliarEscolhas` (`public/grupos.js:127`) passa a devolver os
ids **dentro das estruturas que já existem**, sem quebrar o formato de saída:

- `opcionais[]` de `{nome,preco,qtd}` para `{nome,preco,qtd,id}`
- `composicao[]` de `{grupo,itens:[nome]}` para `{grupo,itens:[nome],ids:[opcaoId]}`, arrays
  paralelos preenchidos no mesmo `map`, o que garante o alinhamento por construção

Verificado que nenhum consumidor quebra: `public/comanda.js` itera `c.itens` e `o.nome/preco/qtd`;
o recálculo de total em `src/pedidos.js:308` lê `o.preco`/`o.qtd`; o trigger `sync_itens_venda`
grava os jsonb inteiros e soma por `preco*qtd`. Chave nova pega carona inerte.

**Isso obriga a sequência:** os ids precisam estar em produção **antes** da baixa. Se a baixa
subir primeiro, todo pedido criado na janela consome insumo e não devolve no cancelamento. É uma
assimetria permanente de saldo que não gera erro nenhum.

## Fases

Cada fase entrega algo funcional, testável e revertível sozinha.

**Fase 0 — Módulo puro e tabela, sem plugar nada.**
`public/insumos.js` dual-mode: `normalizarInsumo`, `normalizarFicha` (whitelist `{insumoId, qtd}`,
descarta linha sem id ou com qtd ≤ 0), `PREFIXO_INSUMO`/`chaveMovimento`/`ehInsumo`, `formatarQtd`
por unidade, `converterEntrada` (g→kg, ml→l) e `calcularConsumo(itens, cardapio)` devolvendo
`[{insumoId, delta}]` agregado. Migração `insumos` aplicada e **verificada em produção com query
real** antes de qualquer código que a leia. Zero comportamento novo.

**Fase 1 — Ids no pedido (inerte).**
`avaliarEscolhas` devolve `opcionais[].id` e `composicao[].ids`. Nada consome ainda. Deploy sem
risco, e é o que destrava a devolução mais tarde.

**Fase 2 — Unificação do payload da baixa (a arriscada, isolada).**
Trocar `b.itens` pelo `itens` recalculado nos três call sites que ainda passam o cru
(`src/servidor.js:927`, `:2208`, `:2392`). O Balcão já usa o recalculado, então o resultado é um
formato único nos quatro caminhos de venda e nos cinco de cancelamento. **Nenhuma linha de insumo
neste commit**, para que o revert seja um commit só.

Bônus real: hoje o cardápio web clampa `qtd` em 50 no `recalcularItens`, mas `_agregar`
(`public/estoque.js:35`) só garante ≥ 1. Um payload com `qtd: 999` grava pedido de 50 e **baixa
999 do estoque**. Passar o recalculado corrige.

**Fase 3 — Cadastro, sem baixa.**
`src/insumos-db.js` (espelha o papel de `src/estoque-db.js`) + rotas `/api/insumos` atrás do
`exigePdv` que já existe. Aba Insumos com grade de cards e gaveta, `data-aba` no item de menu que
hoje é "Em breve" (`public/admin.html:77-81`), gaveta **fora** da `<section class="aba">`. Quarta
aba "Ficha técnica" no editor do produto e campo de ficha na gaveta da opção. Lista "saem na
cozinha e ainda não têm ficha" como mapa de adoção. **Nada baixa ainda**: se a receita estiver
errada, ninguém se machuca.

Nesta fase entram os cinco pontos onde a ficha seria comida em silêncio:

| Ponto | Arquivo | O que faz hoje |
|---|---|---|
| Whitelist da opção | `public/grupos.js:72` | opção vira `{id, nome, preco}` |
| Reescrita da composição | `public/grupos.js:83` | grupo `composicao` tem as opções **reescritas** com preço 0, descartando tudo de novo. É o caso da guarnição, e patchar só a linha 72 deixaria o bug invisível (a ficha do complemento pago funcionaria) |
| Editor do item | `public/app.js:2522` | `salvarEditorItem` reconstrói o item do zero |
| Gaveta do grupo, abrir | `public/app.js:575` | cópia rasa `{id, nome, preco}` |
| Gaveta do grupo, salvar | `public/app.js:627` | reconstrói a opção |

Mais `MAX_FICHA_LINHAS` em `src/validacao.js`, no padrão de `MAX_VARIACOES_POR_ITEM`, com mensagem
específica ("ficha grande demais"), senão um loop de UI mal feito estoura o cardápio e o dono
perde a capacidade de salvar **qualquer** coisa.

E o vazamento: `resolverGrupos` devolve `opcoes: g.opcoes` direto e `src/cardapio-web.js:56`
injeta na projeção pública `GET /api/c/:slug`. **A ficha tem que ser removida em
`projetarCardapio`**, que já é a fronteira de whitelist declarada do projeto, com teste que quebra
se a chave reaparecer. Sem isso, as receitas e as gramaturas vão para o navegador de qualquer
cliente.

**Fase 4 — Baixa e devolução.**
`insumos-db.baixarTx`/`devolverTx` chamados dentro de `store.baixarEstoqueTx` (`src/store.js:94`)
e `devolverEstoqueTx` (`:116`), na mesma transação, depois da baixa de produto. **Sem try/catch
engolindo**: falta de insumo nunca lança, mas erro de infra tem que derrubar a transação inteira,
senão saldo e trilha divergem.

O saldo é calculado **em SQL**, porque o insumo mora em tabela própria e não sob o `FOR UPDATE` do
jsonb:

```sql
update insumos set saldo = saldo + v.delta
  from (values ...) as v(id, delta)
 where insumos.empresa_id = $1 and insumos.id = v.id
 returning insumos.id, nome, unidade, saldo
```

Uma query para N insumos; `saldo_depois` e o snapshot do nome saem do `RETURNING`. O módulo puro
calcula só o delta agregado.

Corrige junto `src/estoque-db.js:45`, que coage a unidade (`m.unidade === "kg" ? "kg" : "un"`) e
gravaria litro como unidade no extrato. Vira whitelist `['un','kg','l']`, mantendo a coerção como
rede de segurança.

**Fase 5 — Extrato, lançamentos e avisos.**
`GET/POST /api/insumos/movimentos` reusando `estoqueDb.listar`/`resumo`. O lançamento manual
precisa travar o tenant com o mesmo `select ... from empresas where slug = $1 for update` que
`ajustarEstoqueTx` usa (`src/store.js:156`), **na mesma ordem**, senão contagem concorrente com
venda pode inverter o lock. Contador de negativos, selo no menu, toast pós-venda no PDV e na Mesa.
Nada no checkout do cliente, que não tem destinatário para o aviso.

## A tela

Segue o padrão já estabelecido pelas telas de Categorias e Complementos, sem componente novo:
`.cardapio-topo` + filtros + grade de cards (`.grp-cards`) + gaveta lateral (`.gaveta*`), com a
gaveta **fora** da `.aba` porque seção inativa é `display:none` e a engoliria.

A gaveta do insumo espelha a gaveta de estoque (`public/app.js:943`): saldo, mínimo, lançamento
segmentado (entrada soma, perda subtrai, contagem substitui), prévia da diferença antes de gravar,
resumo de 30 dias e extrato paginado por cursor.

A ficha técnica aparece em dois lugares: quarta aba do editor do produto e um bloco na gaveta da
opção de grupo. Nos dois, cada linha é insumo + quantidade, com a unidade do insumo ao lado e a
entrada aceitando grama.

## Testes

`test/insumos.test.js` (novo, puro): normalização descartando linha sem id e com qtd ≤ 0 e coagindo
vírgula; `converterEntrada` 200 g → 0.2 kg e 500 ml → 0.5 l; `formatarQtd` por unidade;
`calcularConsumo` somando o mesmo insumo vindo do produto e de duas opções numa linha só,
ignorando insumo inexistente sem lançar, multiplicando pelo peso decimal em item por kg;
`ehInsumo` não reconhecendo id numérico de produto; deriva de 300 vendas de 0,005 kg somando
exatamente 1,5.

`test/grupos.test.js`: `avaliarEscolhas` devolve `opcionais[].id` e `composicao[].ids` alinhado com
`itens` na mesma ordem; `normalizarBiblioteca` preserva `ficha` em grupo `complemento` **e** em
grupo `composicao` (o caso da linha 83); ficha malformada é descartada sem descartar a opção.

`test/cardapio-web.test.js`: `projetarCardapio` **não** devolve `ficha` (anti-vazamento);
`recalcularItens` carrega os ids; pedido com opção sem ficha continua idêntico ao formato atual.

`test/pdv.test.js`: `recalcularVenda` carrega os ids (o caminho do Balcão, que era o cego); item
por kg preserva ids com `qtd` decimal intacta.

`test/store-estoque.test.js`: **paridade cru×recalculado** na Fase 2 (o teste mais importante da
etapa); venda com ficha gera um `UPDATE` e um movimento por insumo com `item_id = "ins_N"`; saldo
fica negativo e a venda retorna normalmente; `insumoId` órfão não lança e não gera movimento;
devolução inverte exatamente o delta; erro no `UPDATE` propaga e faz ROLLBACK da venda inteira.

`test/estoque-db.test.js`: `registrarTx` grava `unidade: 'l'` sem coagir; unidade desconhecida
ainda cai para `un`.

Validação visual (Playwright) no tenant de teste **Nymbus Teste**: cadastrar insumo, montar a ficha
do Marmitex P e da opção "Frango Grelhado", vender pelo PDV, conferir a baixa no extrato com o
número do pedido, cancelar e conferir a devolução, e vender com insumo zerado confirmando que a
venda passa e o saldo fica negativo. Servir o painel **sem o `index.js`**, que dispara os jobs de
retenção e o `restaurarBots()` (este derruba a sessão de WhatsApp de produção).

## Fora de escopo

- **Fator de correção e rendimento.** Insumo é cadastrado já limpo.
- **Produção e pré-preparo.** A peça de carne não vira "bife porcionado" por uma operação. Molho,
  feijão cozido e massa continuam sendo cadastrados como insumo direto.
- **Ficha por variação.** Aditiva depois, se fizer falta.
- **Compra, fornecedor e nota fiscal.** Entrada continua sendo um número com observação, como a
  3/4 já definiu. Custo que se atualiza sozinho pela compra é etapa própria.
- **Tela de CMV, margem e curva ABC.** O campo `custo` existe no insumo, mas nenhuma tela consome.
  Fica de base para depois.
- **Estoque por opção de complemento como saldo próprio** (o "Bacon" que acaba e some da opção no
  cardápio). A ficha resolve o consumo, não a disponibilidade: a opção não some do cardápio quando
  o insumo zera, porque a decisão 2 é avisar sem bloquear.
- **`item.precoCusto`**, que existe no editor e nunca foi lido por ninguém. Continua morto nesta
  etapa; resolver (usar ou remover) fica como dívida registrada.

## Riscos

| Risco | Mitigação |
|---|---|
| `insumos` não existir quando a Fase 4 subir: o `UPDATE` está dentro da transação da venda, então **toda venda quebra** | Migração na Fase 0, verificada em produção com query real. Não usar `IF NOT EXISTS` como muleta |
| Fase 2 regride a baixa de produto, que é caminho quente | Fase isolada, sem uma linha de insumo. Teste de paridade cru×recalculado. Revert é um commit |
| Ficha vaza no cardápio público e a concorrência lê as receitas | Strip em `projetarCardapio` + teste que falha se a chave voltar |
| Ficha some ao editar produto ou grupo (cinco pontos de reconstrução) | Patch nos cinco na mesma fase + teste de round-trip salvar/reabrir/salvar |
| Baixa antes dos ids: devolução assimétrica permanente e invisível | Fase 1 vai sozinha e antes; conferir em produção que pedido novo tem `opcionais[].id` |
| Cardápio estoura 512 KB com fichas e o dono não salva mais nada | `MAX_FICHA_LINHAS` com mensagem específica |
| Deadlock entre lançamento manual e venda | Mesma ordem de lock: `empresas FOR UPDATE` antes de tocar `insumos` |
| Ficha editada entre a venda e o cancelamento devolve pela receita nova | Aceito e documentado: mesmo comportamento do produto, cujo saldo também é sempre o atual. Inverter os movimentos gravados não funcionaria para cancelamento de item, porque o movimento é agregado por insumo no pedido inteiro |
| `calcularConsumo` renormalizar a biblioteca a cada item | Normalizar uma vez por carrinho e indexar `opcaoId → ficha` |

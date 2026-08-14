# Controle de estoque (split de Produtos 3/4)

> Data: 2026-08-13 · Status: desenho aprovado pelo dono, implementação não iniciada
> Etapa 3/4 do split de Produtos. Depende do `id` estável de opção entregue pela 2/4
> (Complementos como biblioteca). A 4/4 (Insumos) continua depois desta.

## Problema

O estoque existe desde a v0.20 (`item.estoque` + `item.estoqueMinimo` no jsonb do cardápio,
mesmo par por variação), mas só dá para enxergar e ajustar **um item por vez**, dentro do
editor do Cardápio. Três consequências:

1. **Sem visão de conjunto.** A contagem do fim do dia obriga a abrir item por item. Não há
   lugar que responda "o que está acabando".
2. **Sem histórico.** O estoque é um número que sobe e desce. Quando some quantidade, não há
   como saber se foi venda, perda ou erro de digitação.
3. **Cancelamento fura o controle.** A venda dá baixa, mas nenhum dos cinco caminhos de
   cancelamento devolve. Quem controla de verdade fica com o número sempre menor que a
   prateleira, e a única saída é corrigir na mão sem registro do porquê.

O item 3 foi levantado pelo dono durante o desenho e é o que mais compromete a confiança no
número. Ele entra nesta entrega.

## Decisões tomadas (dono, 2026-08-13)

1. **Tela consolidada com histórico.** Ver, ajustar e saber o porquê. Tabela nova no banco.
2. **A venda entra no extrato.** Sem isso o histórico não explica o sumiço, que era a dor.
3. **Plano Completo.** Gate igual ao de PDV, Caixa e Mesas. O campo de estoque no editor do
   item continua nos dois planos, então o Essencial não perde nada do que tem hoje.
4. **A lista mostra tudo, com filtro.** Abre em "Só controlados"; produto sem controle aparece
   apagado e pode ser controlado ali mesmo, sem abrir o editor do Cardápio.
5. **O motivo é declarado no gesto.** Botões Entrada, Perda e Contagem por linha, em vez de
   editar o número e explicar depois. O extrato nasce legível.
6. **Extrato na gaveta do produto**, no padrão que Complementos já usa.
7. **O editor do item continua editável** e a mudança feita por lá vira movimento de ajuste.
8. **Cancelamento devolve ao estoque**, com a opção de não devolver marcada por padrão como
   "devolver" (prato feito e descartado vira perda, não devolução).

## Modelo de dados

### Onde vive o saldo

**Não muda.** O saldo continua em `empresas.cardapio` (jsonb): `item.estoque` /
`item.estoqueMinimo`, e o mesmo par dentro de `item.variacoes[]`. Campo ausente, `null` ou
`""` continua significando **ilimitado** (não controlado). Cardápio web, PDV, Mesas, Caixa e a
baixa atômica seguem lendo de onde já leem.

A tabela nova é **trilha**, não fonte de verdade. Reconstruir saldo a partir dela seria trocar
o caminho crítico de venda, que hoje é atômico e testado, por soma de histórico. Não compensa.

### Tabela nova: `estoque_movimentos`

Registra **toda** mudança de saldo, sempre gravada na mesma transação que muda o saldo, pela
mesma função. Nunca diverge do número porque nasce grudada nele.

```sql
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id           bigserial PRIMARY KEY,
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  item_id      text NOT NULL,              -- referência SOLTA ao cardápio (jsonb), sem FK
  variacao_id  text,                       -- preenchido quando o saldo é o da variação
  tipo         text NOT NULL,              -- venda|devolucao|entrada|perda|contagem|ajuste
  quantidade   numeric NOT NULL,           -- assinada: +20 entrada, -3 perda, ±N contagem
  saldo_depois numeric NOT NULL,           -- saldo do item/variação após aplicar o movimento
  descricao    text NOT NULL DEFAULT '',   -- nome do produto COMO ESTAVA (snapshot)
  unidade      text NOT NULL DEFAULT 'un', -- 'un' | 'kg'
  pedido_id    bigint,                     -- venda e devolução: qual pedido originou
  numero       integer,                    -- nº do pedido (conveniência, sem join)
  obs          text,                       -- "quebrei 2 na cozinha"
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estoque_mov_saldo_idx ON estoque_movimentos
  (empresa_id, item_id, variacao_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS estoque_mov_data_idx  ON estoque_movimentos
  (empresa_id, criado_em DESC);
```

`item_id` é `text` porque o id do item no jsonb não tem tipo garantido (a base de produção tem
tanto numérico quanto string, ver `test/store-estoque.test.js`, que usa `"a1"`). `variacao_id`
é `text` porque `variacoes.js` normaliza o id para string. Referência solta, sem FK, pelo mesmo
motivo de `itens_venda`: o cardápio é jsonb editável e arquivável.

Hardening obrigatório na mesma migration (convenção do projeto, modelo em
`20260716120000_rls_hardening_2.sql`): `enable row level security`, `revoke all ... from anon,
authenticated` e `comment on table` documentando que o deny-all é deliberado.

### Por que não reusar `itens_venda`

`itens_venda` já é a projeção relacional dos itens vendidos, mantida por trigger. O primeiro
desenho lia as vendas de lá e gravava só os movimentos manuais, para não escrever a mesma coisa
em dois lugares (a decisão de arquitetura registrada na migration daquela tabela).

**A devolução derrubou esse desenho.** Ao cancelar **um item** do pedido, o `itens` do pedido
muda, o trigger reprojeta e a linha de venda **desaparece** da `itens_venda`. Se a devolução
fosse movimento e a venda sumisse da outra fonte, o mesmo estoque seria contado duas vezes e o
extrato não fecharia.

Não é escrita dupla do mesmo fato: `itens_venda` conta **faturamento** (inclui item sem
controle de estoque, ignora a dimensão de prateleira) e `estoque_movimentos` conta
**prateleira**. Ganho de quebra: toda linha do extrato passa a ter `saldo_depois`, inclusive a
venda, e a conta fecha na vertical.

### Identidade de reconciliação

```
saldo_atual = saldo_no_início_do_período
            + entradas + devoluções
            - vendas - perdas
            ± contagens ± ajustes
```

Vale linha a linha porque cada movimento carrega o `saldo_depois` do momento em que foi
aplicado.

## Componentes

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `public/estoque.js` (existente, ampliado) | PURO, dual-mode. `calcularBaixa` e `calcularDevolucao` devolvem `{ cardapio, movimentos }`; `diffEstoque(antes, depois)` compara dois cardápios; `aplicarBaixa` vira casca sobre `calcularBaixa`. | nada |
| `src/estoque-db.js` (novo) | Fala com `estoque_movimentos`: grava dentro da transação de quem chamou, lista o extrato paginado, calcula o resumo do período, aplica a retenção. | `db.js` |
| `src/store.js` (existente) | `baixarEstoqueTx` passa a gravar os movimentos de venda; ganha `devolverEstoqueTx` e `ajustarEstoqueTx`. | `estoque.js`, `estoque-db.js` |
| `src/servidor.js` (existente) | Quatro rotas novas atrás de `exigeAuth` + `exigePdv`; devolução nos caminhos de cancelamento; diff no salvar do cardápio. | acima |
| `public/app.js` + `admin.html` + `style.css` | Tela Controle de estoque: lista, filtros, gaveta, três ações. | API acima |
| `index.js` | Faxina diária da retenção, no mesmo formato das outras quatro que já rodam. | `estoque-db.js` |

### Funções puras (assinaturas)

```js
// calcularBaixa/calcularDevolucao: NÃO mutam o cardápio recebido.
// movimentos: [{ itemId, variacaoId|null, tipo, quantidade, saldoDepois, descricao, unidade }]
calcularBaixa(cardapio, itensPayload)     -> { cardapio, movimentos }  // quantidade negativa
calcularDevolucao(cardapio, itensPayload) -> { cardapio, movimentos }  // quantidade positiva
diffEstoque(cardapioAntes, cardapioDepois) -> movimentos               // tipo 'ajuste'
```

`itensPayload` é o mesmo formato que `validarEstoque`/`aplicarBaixa` já recebem hoje
(`[{ id, qtd, variacoes: [{ id, qtd }] }]`), então os chamadores não mudam de contrato.

## Rotas

Todas com `exigeAuth` + `exigePdv` (o gate de Plano Completo que Mesas já reusa; a mensagem
dele, "Recurso do Plano Completo", é genérica e serve).

| Rota | Faz |
|---|---|
| `GET /api/estoque` | Lista de saldos e contadores, montada do cache em memória do cardápio, sem ida ao banco. Uma linha por saldo: o item e, quando houver, cada variação. |
| `GET /api/estoque/movimentos?itemId=&variacaoId=&limite=&antes=` | Extrato de um saldo, paginado por cursor de data, com o resumo do período. |
| `POST /api/estoque/movimentos` | `{ itemId, variacaoId?, tipo: 'entrada'\|'perda'\|'contagem', quantidade?, contado?, obs? }`. Transação: trava a linha do tenant, aplica no jsonb, grava o movimento, devolve o saldo novo. |
| `POST /api/estoque/minimo` | `{ itemId, variacaoId?, minimo }`. Não mexe em saldo, então não vira movimento. |

**Contagem** recebe `contado` (o que foi contado de verdade) e o servidor calcula
`quantidade = contado - saldoAtual`. **Entrada** e **perda** recebem `quantidade` positiva; a
perda é gravada com sinal negativo.

**Ligar o controle** num produto que estava ilimitado é uma contagem com `contado` e `minimo`
opcional. O movimento sai com `obs` "Controle ativado" e `saldo_depois = contado`.

## Regras de comportamento

- **Produto sem controle não gera movimento nenhum.** Venda, devolução e cancelamento passam
  por ele sem registrar, porque nada mudou de saldo.
- **Saldo nunca fica negativo.** Perda maior que o saldo trava em zero e o movimento registra o
  delta **efetivamente aplicado**, não o que foi pedido.
- **Devolução só alcança produto controlado agora.** Item vendido quando era ilimitado e
  controlado depois não ganha estoque de volta, senão a devolução inventaria quantidade.
- **Quilo trabalha com três casas**, igual à baixa de hoje (`Math.round(n * 1000) / 1000`).
- **Concorrência:** tudo passa pela mesma trava de linha (`SELECT ... FOR UPDATE` na `empresas`)
  que já serializa as vendas. O movimento é gravado na mesma transação.
- **Snapshot do nome:** o extrato guarda `descricao` como estava, então excluir ou renomear o
  produto depois não deixa linha sem sentido.
- **Retenção:** doze meses, faxina diária no `index.js`, no mesmo formato das quatro que já
  rodam (sessões, auditoria, fila de impressão, incidentes).
- **Essencial gera movimento pelo editor do item** mesmo sem ver a tela. O dado nasce certo e,
  ao subir de plano, o histórico já está lá.

## Cancelamento devolve ao estoque

Os cinco caminhos passam a devolver, com a caixinha "devolver ao estoque" marcada por padrão na
confirmação. Desmarcar não devolve e não gera movimento (o produto foi feito e descartado; a
perda, se o dono quiser registrar, é lançada na tela).

| Caminho | Onde | Observação |
|---|---|---|
| Cancelar pedido inteiro | `src/pedidos.js:237` | Hoje é um `UPDATE` solto; passa a usar transação. |
| Cancelar item do pedido | `src/pedidos.js:248` | Já lê o pedido antes; devolve só o item cancelado. |
| Cancelar a mesa | `src/mesas-db.js:286` | Fecha os pedidos abertos; devolve os itens de todos eles. Hoje sem transação; passa a usar. |
| Cancelar item da comanda | `src/mesas-db.js:449` | Devolve só o item. |
| Cancelar pedido já pago | `src/caixa.js:290` | Já é transacional; a devolução entra na mesma transação do movimento de caixa. |

A venda **continua aparecendo** no extrato junto com a devolução, em vez de sumir. É a mesma
escolha que o Caixa já fez para cancelamento de recebimento (venda bruta mais o cancelamento
que deduz), pelo mesmo motivo de transparência.

## Editor do item vira movimento

`PUT /api/cardapio` passa a ser transacional: lê o cardápio atual travando a linha, grava o
novo, roda `diffEstoque(antes, depois)` e insere os movimentos de `ajuste`.

Como é comparação de estados, cobre **qualquer** caminho que grave cardápio, inclusive edição em
massa que venha depois. Não exige que cada tela lembre de registrar.

## A tela

**Onde:** Cadastros → Produtos → Controle de estoque, no slot que já existe marcado "Em breve"
(`public/admin.html:75`).

**Topo:** três contadores que também filtram (Esgotados, Abaixo do mínimo, Controlados), busca
por nome e os filtros Só controlados (padrão), Todos, Esgotados, Baixo.

**Lista:** uma linha por **saldo**, não por produto. Produto com variações não tem um número só,
então cada variação entra como sub-linha recuada sob o produto. A linha traz nome, categoria,
selo quando for o caso, quantidade em corpo grande com a unidade, o mínimo e as três ações:
Entrada, Perda, Contagem. Produto sem controle aparece apagado, com um único botão Controlar.

No celular as três ações saem da linha e ficam dentro da gaveta.

**Gaveta** (padrão de Complementos): saldo atual em destaque, mínimo editável ali, as três
ações, resumo dos últimos 30 dias (entrou, vendeu, perdeu, devolveu) e o extrato em ordem de
tempo, cada linha com data, o que foi, quanto mudou e quanto ficou. Movimento de venda leva o
número do pedido e abre o pedido ao clicar.

**Contagem** mostra a diferença antes de confirmar ("você contou 7, o sistema tinha 9, vai
registrar menos 2"). Entrada e Perda pedem quantidade e observação opcional.

**Os quatro estados:** carregando com esqueleto de linhas; vazio quando o cardápio não tem
produto, apontando para o Cardápio; erro de rede com botão de tentar de novo; e o Essencial,
que vê o convite de plano no formato que PDV e Caixa já usam.

**Design:** protótipo no Stitch aprovado pelo dono **antes** de codar a tela, reusando o design
system do projeto. Quantidade não é dinheiro: sai por `Estoque.formatarQtd` (inteiro para
unidade, decimal com vírgula para quilo), sem a máscara monetária, com `inputmode="decimal"`
nos campos de quilo.

## Testes

`node:test`, sem dependência nova. Puros em `test/estoque.test.js`, transacionais com o cliente
falso que `test/store-estoque.test.js` já usa (registra as queries, não toca o banco).

- `calcularBaixa`: movimentos com sinal e `saldoDepois` corretos; trava em zero; quilo com três
  casas; variação com movimento próprio; item sem controle ignorado; não muta o original.
- `calcularDevolucao`: soma de volta; ignora item sem controle agora; não muta o original.
- `diffEstoque`: detecta mudança de saldo, ignora igual, detecta ligar e desligar o controle,
  alcança variação.
- Contagem: `quantidade = contado - saldoAtual`, inclusive negativa e zero (zero não grava).
- `baixarEstoqueTx`: grava o `INSERT` de movimento na **mesma** transação, depois do `UPDATE`
  do cardápio, com `empresa_id` vindo do mesmo `SELECT ... FOR UPDATE`.
- `devolverEstoqueTx`: mesma trava, movimento positivo.
- Regressão: os testes atuais de `validarEstoque`/`aplicarBaixa` continuam passando sem
  alteração (o contrato não muda).

Validação visual (Playwright) da tela: lista com selos, gaveta com extrato, contagem mostrando a
diferença, e a linha de produto sem controle virando controlada.

## Fora de escopo

- **Estoque por opção de complemento** (o "Bacon" que acaba). Fica na 4/4, junto com Insumos,
  ancorado no `id` estável que a 2/4 entregou.
- **Insumos e ficha técnica** (4/4).
- **Extrato geral do restaurante** (todos os movimentos em uma lista). A gaveta por produto
  responde a pergunta comum; o geral pode vir depois se fizer falta.
- **Modo contagem em lote** para inventário de fim de mês.
- **Compra e fornecedor.** Entrada aqui é um número com observação, não um documento de compra.
- **Alerta ativo** (e-mail ou WhatsApp avisando que acabou). A tela mostra; ninguém é notificado.

## Riscos

| Risco | Mitigação |
|---|---|
| Encosta no caminho crítico de venda: se a tabela não existir, **toda venda quebra** | A migration entra em produção **antes** do código e é a primeira tarefa do plano. Teste de fumaça em uma venda real logo após o deploy. |
| Cinco caminhos de cancelamento, dois deles hoje sem transação | Cada um vira tarefa própria com teste; a devolução entra na mesma transação do cancelamento, nunca depois. |
| `PUT /api/cardapio` vira transacional (rota muito usada) | Mudança contida em uma rota; o diff é função pura testada antes de encostar na rota. |
| Volume da tabela em restaurante movimentado | Índices por `(empresa_id, item_id, variacao_id, criado_em)`; extrato paginado por cursor; retenção de doze meses. |
| `.env` local aponta para o banco de produção | Nenhum script de dados nesta entrega. A migration é aditiva (tabela nova, nada alterado no que existe). |
| Devolução automática inflar estoque de comida já preparada | Caixinha na confirmação do cancelamento, que o dono desmarca. |

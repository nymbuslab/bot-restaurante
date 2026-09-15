# Decisões P1 aprovadas

As regras deste documento foram fechadas antes da arquitetura para não serem escolhidas
implicitamente durante a implementação. Cada decisão mantém seus exemplos e testes de aceite.

> **Estado em 2026-09-14:** as 18 decisões funcionais do P1 foram aprovadas, a arquitetura SprintX
> foi concluída e os protótipos foram aprovados. A próxima etapa é a Sprint 01 de capacidade de
> testes. A única trava externa ainda aberta é o backup/restauração do P0-B, obrigatório antes de
> aplicar migration ou ativar funcionalidades em produção.

## Decisões aprovadas

### D-P1-01 — Entrada por embalagem e custo médio móvel

**Aprovada pelo dono em 2026-09-13.**

- A compra preserva a apresentação informada pelo usuário, por exemplo `4 pacotes × 5 kg`, e
  converte a quantidade para a unidade-base do item. Nesse exemplo, o movimento de estoque é uma
  entrada de `20 kg`.
- O custo unitário da entrada é calculado sobre a quantidade convertida para a unidade-base.
- Desconto e frete atribuídos à linha participam do valor líquido antes do cálculo do custo
  unitário. A forma de ratear valores gerais da compra entre as linhas ainda será decidida.
- Com saldo anterior positivo, o novo custo é o custo médio móvel ponderado:

```text
novo_custo = ((saldo_anterior × custo_anterior) + valor_líquido_da_entrada)
             ÷ (saldo_anterior + quantidade_da_entrada)
```

- Com saldo anterior igual ou menor que zero, o custo resultante passa a ser o custo unitário da
  nova entrada. O saldo continua sendo recomposto pela quantidade comprada; o valor do déficit
  anterior não contamina o custo do lote novo.
- Este número representa **custo médio de aquisição operacional**, não custo contábil ou fiscal.

Exemplo aprovado:

```text
Saldo anterior: 10 kg a R$ 5,00/kg
Entrada: 4 pacotes × 5 kg = 20 kg por R$ 120,00
Novo saldo: 30 kg
Novo custo médio: ((10 × 5) + 120) ÷ 30 = R$ 5,666667/kg
```

Casos de aceite obrigatórios:

1. `4 × 5 kg` deve ficar visível no documento e gerar exatamente `20 kg` no estoque.
2. Confirmar o exemplo acima deve resultar em saldo de `30 kg` e custo não arredondado
   prematuramente.
3. Entrada de `20 kg` a R$ 6,00/kg com saldo zero deve resultar em custo de R$ 6,00/kg.
4. Entrada de `20 kg` a R$ 6,00/kg com saldo de `-3 kg` deve resultar em saldo de `17 kg` e custo de
   R$ 6,00/kg.

Referências de mercado consultadas:

- [Consumer — entrada de estoque via XML e atualização por média ponderada](https://ajuda.programaconsumer.com.br/como-fazer-a-entrada-de-estoque-via-xml-nota-de-entrada-nfe/).
- [Omie — cálculo do custo médio de estoque](https://ajuda.omie.com.br/pt-BR/articles/6597224-entendendo-como-e-feito-o-calculo-do-cmc).

### D-P1-02 — Precisão e arredondamento

**Aprovada pelo dono em 2026-09-13.**

- Quantidade e saldo usam três casas decimais. Nas unidades-base `kg` e `l`, a menor fração
  controlada é respectivamente `1 g` e `1 ml`.
- Custo unitário, custo médio e cálculos intermediários de custo usam seis casas decimais.
- Valores monetários efetivamente pagos, cobrados, rateados ou totalizados no documento usam duas
  casas decimais.
- O cálculo não arredonda a cada parcela da média. O arredondamento monetário acontece somente ao
  fechar a linha ou o documento; eventuais centavos residuais do rateio precisam ser distribuídos
  de forma determinística para que a soma das linhas seja exatamente igual ao total.
- A interface exibe duas casas decimais como padrão e revela a precisão adicional no detalhamento
  de custo, quando ela for relevante.
- A tabela inerte `insumos` hoje possui `saldo numeric(14,3)` e `custo numeric(12,4)`. A quantidade
  já atende à regra; antes de ativar Compras, o custo deverá receber migration aditiva para seis
  casas. Essa migration continua submetida ao gate de backup e restauração do P0-B.

Casos de aceite obrigatórios:

1. `0,001 kg` e `0,001 l` devem persistir como `1 g` e `1 ml`, sem virar zero.
2. O custo médio de `R$ 5,666667` deve ser preservado com as seis casas no banco.
3. A soma das linhas após um rateio deve ser idêntica ao total monetário do documento, inclusive
   quando houver centavo residual.
4. O custo detalhado pode mostrar seis casas, mas totais financeiros e valores de pagamento nunca
   exibem fração de centavo.

### D-P1-03 — Implantação de estoque

**Aprovada pelo dono em 2026-09-13.**

- O saldo existente no início do novo controle é registrado por uma operação própria chamada
  **Implantação de estoque**. Ela não é tratada como compra.
- Cada linha informa a quantidade física contada e o custo unitário inicial estimado. A confirmação
  registra um movimento `saldo_inicial` e estabelece o ponto de partida rastreável do item.
- A implantação não exige fornecedor, não representa desembolso e não gera conta a pagar.
- Para produtos que já possuem estoque no sistema atual, a tela começa com o saldo atual
  preenchido. Esse valor só é substituído se o usuário alterar a contagem e confirmar
  explicitamente a diferença apresentada na revisão.
- A implantação só pode ser confirmada para um item que ainda não tenha movimentação no novo
  controle. Depois da primeira compra, venda ou outro movimento, a correção deve usar contagem ou
  ajuste rastreável.
- A confirmação precisa ser atômica: documento e saldos mudam juntos ou nada muda.
- O custo inicial é identificado como estimado. Ele passa a participar do custo médio e será
  substituído gradualmente pelas compras reais seguintes.

Casos de aceite obrigatórios:

1. Implantar `12 kg` a R$ 5,00/kg deve criar saldo de `12 kg`, custo inicial de R$ 5,00/kg e um
   movimento `saldo_inicial`, sem fornecedor nem conta a pagar.
2. Produto legado com saldo `8 un`, confirmado sem alterar a quantidade sugerida, deve continuar
   com `8 un` e ganhar apenas o marco inicial rastreável e o custo informado.
3. Produto legado alterado de `8 un` para `6 un` deve mostrar a diferença de `-2 un` antes da
   confirmação e somente então substituir o saldo.
4. Tentar implantar um item que já tenha movimento no novo controle deve ser recusado, orientando o
   uso de contagem ou ajuste.
5. Se qualquer linha falhar, nenhuma linha nem documento pode ficar parcialmente confirmado.

### D-P1-04 — Composição e rateio do custo da compra

**Aprovada pelo dono em 2026-09-13.**

O custo líquido de aquisição de cada linha segue esta composição:

```text
custo_líquido_da_linha
= valor_bruto_dos_itens
− descontos atribuídos
+ frete rateado
+ seguro rateado
+ outras despesas rateadas
+ impostos sem direito a crédito atribuídos
```

- Desconto lançado diretamente na linha afeta somente aquela linha.
- Desconto geral, frete, seguro e outras despesas gerais são rateados proporcionalmente ao valor
  bruto das linhas.
- Imposto recuperável não compõe custo; imposto sem direito a crédito compõe. A classificação é
  informada pelo usuário em uma área avançada, sem o sistema presumir o regime tributário do
  estabelecimento ou se apresentar como solução fiscal.
- O primeiro escopo não oferece rateio por peso. Uma compra pode misturar unidades, kg e litros, o
  que tornaria esse critério inconsistente.
- Centavos residuais são distribuídos por regra determinística, sem alterar o total: maior resto
  fracionário primeiro e, em empate, a ordem estável das linhas.
- Antes de confirmar, a revisão mostra valor bruto, descontos, acréscimos rateados e custo líquido
  de cada linha.

Casos de aceite obrigatórios:

1. Uma compra com linhas brutas de R$ 60,00 e R$ 40,00 e frete de R$ 10,00 deve ratear R$ 6,00 e
   R$ 4,00, respectivamente.
2. Desconto de R$ 3,00 lançado diretamente na primeira linha não pode reduzir o custo da segunda.
3. Tributo marcado como recuperável deve ficar fora do custo; o mesmo valor marcado como não
   recuperável deve entrar.
4. Em qualquer rateio com fração de centavo, a soma final das linhas deve ser exatamente igual ao
   total líquido do documento.
5. Alterar desconto, frete ou despesas antes da confirmação deve recalcular a prévia sem movimentar
   estoque.

### D-P1-05 — Ciclo da compra, imutabilidade e idempotência

**Aprovada pelo dono em 2026-09-13.**

- `rascunho`: pode ser editado e não altera saldo nem custo.
- `confirmada`: altera documento, estoque e custo em uma única transação. Depois da confirmação, o
  conteúdo financeiro e as linhas tornam-se imutáveis.
- `cancelada`: estado final permitido somente para rascunho; não gera movimento de estoque ou
  custo.
- `estornada`: estado final de uma compra anteriormente confirmada. A correção deixa documento e
  movimentos compensatórios vinculados ao original; nada é apagado ou reescrito silenciosamente.
- Confirmar usa trava transacional no documento e valida sua versão. Se o rascunho tiver sido
  alterado desde que a tela o carregou, a confirmação é recusada e exige nova revisão.
- A operação de confirmação possui chave de idempotência única por estabelecimento. Repetir a mesma
  confirmação, inclusive após timeout ou clique duplo, devolve o resultado original sem gerar nova
  entrada. Reutilizar a chave para outro documento ou conteúdo é conflito.
- Compra não possui exclusão definitiva. Rascunhos descartados permanecem como cancelados pelo
  período de retenção que ainda será definido.

Casos de aceite obrigatórios:

1. Salvar ou editar um rascunho não pode alterar nenhum saldo ou custo.
2. Duas confirmações concorrentes do mesmo documento devem produzir uma única série de movimentos.
3. Repetir a requisição com a mesma chave deve devolver a confirmação anterior; usar a mesma chave
   em conteúdo diferente deve retornar conflito.
4. Confirmar uma versão antiga do rascunho deve falhar antes de qualquer movimento.
5. Falha em qualquer linha deve reverter documento, saldos, custos e movimentos da transação toda.
6. Compra confirmada não pode aceitar edição nem exclusão; a interface deve oferecer estorno.

### D-P1-06 — Estorno, devolução, correção e bonificação

**Aprovada pelo dono em 2026-09-13.**

- O estorno integral só é permitido quando nenhum item da compra possui movimento posterior. Nesse
  caso, restaura exatamente os saldos e custos anteriores guardados na confirmação.
- Se houver venda, consumo, contagem, outra compra ou qualquer movimento posterior em uma das
  linhas, o estorno integral é bloqueado. O sistema informa os itens impeditivos e oferece o caminho
  de correção adequado.
- Devolução ao fornecedor é uma operação própria, parcial ou total, vinculada à compra original.
  Ela usa o custo líquido original da linha, retira somente a quantidade efetivamente devolvida e
  não pode deixar o saldo negativo.
- Erro somente no preço é corrigido por ajuste de custo vinculado à compra, sem alterar quantidade.
- Diferença física é corrigida por contagem de estoque com motivo obrigatório.
- Bonificação é identificada explicitamente: recebe quantidade positiva e custo zero. Quando vier
  junto de itens comprados, participa da quantidade total e reduz o custo médio do conjunto recebido.
- Estorno, devolução e ajustes registram autor, data, motivo e vínculo com o documento original.

Casos de aceite obrigatórios:

1. Estornar imediatamente uma compra sem movimento posterior deve restaurar os snapshots anteriores.
2. Existindo movimento posterior em qualquer linha, o estorno integral deve falhar sem alterar
   nenhuma das demais linhas.
3. Devolver `3 kg` de uma linha comprada a R$ 6,00/kg deve retirar `3 kg` e R$ 18,00 do valor de
   estoque considerado no custo, mantendo o vínculo com a compra.
4. Devolução superior ao saldo atual deve ser recusada.
5. Corrigir somente o preço não pode alterar saldo; corrigir saldo deve passar por contagem.
6. Receber `10 un` pagas mais `2 un` bonificadas deve considerar `12 un` na quantidade e custo zero
   nas duas bonificadas.

### D-P1-07 — Natureza da entrada e documento de origem

**Aprovada pelo dono em 2026-09-13.**

A natureza da operação e o documento que a acompanha são informações independentes. Ter NF-e não
transforma automaticamente uma entrada em compra paga, e uma bonificação também pode vir em NF-e.

Naturezas disponíveis:

- `compra`: entrada de fornecedor que aumenta quantidade e atualiza o custo médio. Representa uma
  obrigação financeira, embora a integração com Contas a pagar tenha escopo próprio.
- `bonificacao`: entrada sem cobrança, com quantidade positiva e custo zero. Também pode existir em
  linhas específicas de uma compra normal, por exemplo `10 un` pagas mais `2 un` bonificadas.
- `ajuste_entrada`: corrige somente a quantidade, mantém o custo médio vigente e exige motivo. É
  apresentado em Estoque e não compõe indicadores de compras.
- `saldo_inicial`: implantação aprovada em D-P1-03, disponível somente quando o item for elegível.

Documentos de origem disponíveis:

- `nfe_xml`: NF-e acompanhada do arquivo XML;
- `nfe_manual`: NF-e informada manualmente;
- `outro_comprovante`: recibo ou outro documento não fiscal;
- `sem_documento`: entrada sem documento fiscal, sempre com justificativa.

O produto não chama uma operação de “entrada fiscal”. O Nymbus registra a origem e os dados da NF-e,
mas não promete escrituração, emissão ou validação tributária. A importação automática do XML na
primeira entrega ainda precisa de decisão própria.

Casos de aceite obrigatórios:

1. Bonificação documentada em NF-e deve ser aceita sem gerar obrigação financeira.
2. Compra sem NF-e deve atualizar quantidade e custo, mantendo a justificativa e o comprovante
   informado.
3. Ajuste de entrada deve manter o custo unitário médio anterior e ficar fora dos totais de compra.
4. Uma compra deve aceitar linhas pagas e bonificadas no mesmo documento sem perder a distinção.
5. Trocar o tipo de documento não pode, por si só, alterar saldo, custo ou efeito financeiro.

Referências de mercado consultadas:

- [Bling — nota de entrada separa lançamento de estoque e de contas](https://ajuda.bling.com.br/hc/pt-br/articles/360036460513-Como-importar-o-XML-de-nota-de-entrada).
- [Omie — remessa pode movimentar estoque sem movimentar o financeiro](https://ajuda.omie.com.br/pt-BR/articles/1382980-emitindo-uma-nota-fiscal-de-remessa-de-produto).
- [Consumer — XML atualiza estoque e o Contas a Pagar é lançado separadamente](https://ajuda.programaconsumer.com.br/como-fazer-a-entrada-de-estoque-via-xml-nota-de-entrada-nfe/).

### D-P1-08 — Entrada manual primeiro, importação de XML depois

**Aprovada pelo dono em 2026-09-13.**

- A primeira entrega operacional aceita digitação manual da compra e da NF-e, incluindo número,
  série e chave de acesso.
- A chave da NF-e é única por estabelecimento. Repetir uma chave abre o documento já existente e
  não cria outra entrada de estoque.
- A arquitetura e o schema já reservam a origem `nfe_xml`, mas o parser e a conciliação automática
  entram em uma etapa posterior ao fluxo manual estabilizado.
- Na etapa de XML, a importação cria somente um rascunho: fornecedor, itens, quantidades, valores,
  descontos, frete e impostos precisam ser revisados antes da confirmação.
- Cada item importado deve ser vinculado a um produto, variação ou insumo. Cadastro novo exige ação
  explícita; o XML nunca cria cadastro nem movimenta estoque sozinho.
- Reimportar o mesmo XML recupera o rascunho ou a compra existente, preservando a idempotência.

Casos de aceite obrigatórios:

1. Na primeira entrega, uma NF-e pode ser digitada e confirmada sem upload de arquivo.
2. Duas entradas com a mesma chave de acesso no mesmo estabelecimento devem ser impedidas.
3. A mesma chave pode existir em estabelecimentos diferentes sem colisão.
4. Quando o XML for entregue, importá-lo não poderá alterar estoque antes da revisão e confirmação.
5. Item ainda não conciliado deve bloquear a confirmação, sem cadastro automático silencioso.

### D-P1-09 — Identificação, conciliação e sugestão de preço

**Aprovada pelo dono em 2026-09-13.**

O vínculo de uma linha de compra nunca depende apenas do nome. Cada destino é identificado por tipo
e ID estável: `produto`, `variacao` ou `insumo`.

Identificadores do catálogo:

- código interno único por estabelecimento, gerado pelo Nymbus e editável;
- um ou mais GTIN/EAN válidos, quando existirem;
- ID técnico estável já existente no produto, variação ou insumo;
- nome e descrição somente para busca e sugestão, nunca para confirmação automática isolada.

O fornecedor possui cadastro próprio, preferencialmente identificado por CNPJ único no
estabelecimento. Cada compra preserva também um snapshot mínimo dos dados do fornecedor, para que o
histórico não mude quando o cadastro for editado.

O vínculo fornecedor-item guarda:

- fornecedor;
- código e descrição usados pelo fornecedor;
- GTIN/EAN informado na origem;
- alvo interno tipado e seu ID;
- unidade/apresentação de compra e fator de conversão para a unidade-base;
- data e responsável pela última confirmação do vínculo.

Exemplo: `ARZ-5KG` do fornecedor Distribuidora X fica vinculado ao insumo Arroz com conversão
`1 pacote = 5 kg`. Uma entrada de quatro pacotes gera `20 kg`. O mesmo insumo pode ter vínculos
diferentes com vários fornecedores e apresentações.

Ordem de conciliação:

1. vínculo anteriormente aprovado para fornecedor + código do fornecedor;
2. GTIN/EAN exato já vinculado dentro do estabelecimento;
3. código interno exato;
4. sugestão por nome ou descrição, sempre exigindo confirmação;
5. vínculo manual ou criação explícita de novo cadastro.

Código ausente, GTIN inválido, conflito entre identificadores ou sugestão apenas textual nunca
movimentam estoque automaticamente. Produto, variação ou insumo novo só é criado por ação explícita
na conciliação.

Preço de venda:

- produto de revenda recebe seu custo médio diretamente das compras;
- produto produzido recebe custo a partir da ficha técnica;
- quando o custo mudar, a revisão mostra preço atual, margem atual e sugestão de novo preço;
- o preço de venda nunca é alterado silenciosamente durante a entrada. Qualquer atualização exige
  confirmação separada e deixa trilha;
- uma política opcional de margem-alvo pode ser projetada depois, sem fazer parte da confirmação
  automática da primeira entrega.

Casos de aceite obrigatórios:

1. O mesmo código interno ou GTIN não pode apontar para dois alvos no mesmo estabelecimento.
2. O mesmo código de fornecedor pode existir em fornecedores diferentes sem colisão.
3. Um vínculo aprovado deve ser reaproveitado na próxima nota do mesmo fornecedor.
4. GTIN conhecido vindo de outro fornecedor deve sugerir o mesmo alvo, mas preservar o novo vínculo
   e a conversão própria da apresentação.
5. `4 × ARZ-5KG` deve gerar `20 kg`, mantendo código, embalagem e fator no documento.
6. Nome parecido sem código ou GTIN deve apenas sugerir, nunca confirmar sozinho.
7. A confirmação da compra pode atualizar custo e sugerir preço, mas não pode alterar o preço de
   venda sem uma segunda confirmação explícita.

Referências de mercado consultadas:

- [Bling — conciliação por SKU, GTIN e vínculo com fornecedor](https://ajuda.bling.com.br/hc/pt-br/articles/360044990973-Como-conciliar-os-produtos-da-nota-com-produtos-do-meu-estoque).
- [Omie — código do produto por fornecedor, conversão e atualização de preço](https://ajuda.omie.com.br/pt-BR/articles/3625872-definindo-informacoes-para-compra-de-produtos-para-cada-fornecedor).

### D-P1-10 — Modo exclusivo de controle e fotografia da ficha

**Aprovada pelo dono em 2026-09-13.**

Cada alvo vendável possui exatamente um modo de controle:

- `estoque_proprio`: a venda baixa o produto ou a variação, preservando o comportamento atual;
- `consumo_por_ficha`: a venda baixa somente os insumos calculados pela ficha técnica;
- `sem_controle`: a venda não gera baixa de quantidade.

Produto e insumos nunca são baixados juntos na mesma venda. Essa exclusividade deve ser validada no
serviço transacional e representada por constraint ou contrato inequívoco no modelo, não depender
somente da interface.

A ativação de `consumo_por_ficha` exige:

- ficha válida e completa;
- todos os insumos referenciados ativos;
- produto sem variações nesta etapa;
- saldo próprio do produto igual a zero.

Se houver saldo próprio, a ativação é bloqueada. O usuário deve conferir e zerar esse saldo por
movimento rastreável ou manter `estoque_proprio`; nenhuma quantidade desaparece durante a troca.
Produtos de revenda permanecem em estoque próprio. Produtos declarados sem consumo de insumos podem
usar estoque próprio ou ficar sem controle, conforme o cadastro.

Ao confirmar a venda, o pedido guarda snapshot da versão da ficha, insumos, quantidades e custos
unitários usados. Alterar a receita ou o custo atual depois não reescreve vendas antigas e não muda
o que um eventual cancelamento precisa considerar. Toda troca de modo registra responsável, data,
modo anterior, modo novo e saldo existente.

Casos de aceite obrigatórios:

1. Uma venda em `estoque_proprio` não pode gerar movimento de insumo.
2. Uma venda em `consumo_por_ficha` não pode reduzir o saldo próprio do produto.
3. Produto com saldo próprio positivo, ficha incompleta, insumo arquivado ou variação deve ter a
   ativação recusada sem alteração parcial.
4. Depois da ativação, duas vendas concorrentes devem usar o mesmo modo confirmado e uma única
   fotografia de ficha por venda.
5. Alterar a ficha após uma venda não pode modificar seu custo histórico nem suas quantidades de
   consumo registradas.
6. A transição deve preservar em histórico o saldo e o modo anteriores.

### D-P1-11 — Saldo negativo com reconciliação assistida

**Aprovada pelo dono em 2026-09-13.**

- Estoque próprio de produto preserva o bloqueio de venda por insuficiência já existente.
- Insumo em `consumo_por_ficha` pode ficar negativo e não bloqueia a venda. O movimento registra a
  venda que atravessou o zero e o custo usa o último valor conhecido; insumo sem custo torna o custo
  do produto incompleto, nunca R$ 0,00.
- Saldo negativo fica visível no Dashboard e nas áreas Compras, Insumos e Estoque, com contador,
  destaque por linha e filtro `com_divergencia`.
- Ao atravessar zero, o sistema alerta o responsável uma vez e consolida lembretes posteriores para
  não gerar uma notificação por venda.
- Uma entrada que contenha item negativo não pode ser confirmada silenciosamente. A revisão mostra
  saldo atual, quantidade da entrada e saldo projetado e exige uma escolha sem opção pré-marcada:
  - `compensar_consumo_anterior`: soma a entrada ao negativo existente;
  - `corrigir_antes_da_entrada`: abre contagem/ajuste rastreável e depois retorna ao rascunho.
- A primeira opção é correta quando a compra já havia chegado e está sendo registrada com atraso. A
  segunda é correta quando a compra acabou de chegar e o negativo pertence a uma divergência anterior.
- Nenhuma das opções zera saldo automaticamente. Usuário, data, escolha e eventual motivo ficam no
  histórico.

Exemplo aprovado:

```text
Saldo atual: -3 kg
Entrada: +20 kg
Projeção ao compensar consumo anterior: 17 kg
Projeção após corrigir o saldo anterior para zero: 20 kg
```

Casos de aceite obrigatórios:

1. Venda por ficha pode levar um insumo a negativo sem baixar também o produto.
2. A primeira passagem para negativo deve gerar alerta; vendas seguintes não podem provocar spam.
3. Compra com item negativo deve parar na revisão até uma das duas ações ser escolhida.
4. `compensar_consumo_anterior` no exemplo deve resultar em `17 kg`.
5. Corrigir para zero deve criar movimento próprio antes da entrada e resultar em `20 kg`, sem
   apagar o histórico do déficit.
6. Falha na correção ou na compra não pode deixar somente metade da reconciliação aplicada.

### D-P1-12 — Destino do estoque no cancelamento da venda

**Aprovada pelo dono em 2026-09-13.**

Todo cancelamento de item ou pedido com controle de estoque exige escolher explicitamente o destino
da quantidade, sem opção pré-marcada:

- `devolver_estoque`: o item não foi preparado ou utilizado; devolve exatamente as quantidades do
  snapshot da venda;
- `registrar_perda`: o item foi preparado, utilizado ou descartado; não recompõe saldo e registra o
  custo consumido como perda operacional vinculada ao cancelamento.

No cancelamento integral, a interface lista os itens e permite aplicar uma decisão a todos ou
escolher item por item. A mesma regra vale para `estoque_proprio` e `consumo_por_ficha`: no primeiro,
devolve ou perde a unidade vendável; no segundo, devolve ou perde os insumos da fotografia da ficha.

O cálculo nunca consulta a receita atual para desfazer uma venda antiga. Cancelamento financeiro,
destino das quantidades e movimentos correspondentes são confirmados na mesma transação. Quando a
opção for perda, o custo deixa de ser custo da venda cancelada e passa a ser perda operacional, sem
ser apagado dos relatórios futuros.

Casos de aceite obrigatórios:

1. Cancelamento sem escolha de destino deve ser recusado antes de alterar dinheiro ou estoque.
2. `devolver_estoque` deve repor exatamente o snapshot, mesmo que a ficha tenha sido alterada depois.
3. `registrar_perda` não pode aumentar saldo e deve criar movimento de perda ligado ao cancelamento.
4. Pedido com dois itens deve aceitar devolver um e registrar perda no outro.
5. Falha em qualquer movimento deve reverter também o cancelamento financeiro.
6. Repetir a mesma confirmação de cancelamento não pode devolver nem registrar perda duas vezes.

### D-P1-13 — Custo de ingredientes, CMV teórico e preço sugerido

**Aprovada pelo dono em 2026-09-13.**

- O primeiro custo calculado do produto é `custo_ingredientes_atual`: soma da quantidade de cada
  insumo da ficha multiplicada por seu custo médio vigente.
- Embalagens podem ser cadastradas como insumos e participar da ficha.
- Qualquer linha sem custo conhecido torna o resultado `custo_incompleto`; valor ausente nunca é
  tratado como zero.
- Mão de obra, gás, taxas de pagamento, tributos, perdas técnicas e despesas fixas ficam fora do
  primeiro número. A interface não o chama de custo total real.
- A tela apresenta custo de ingredientes, preço de venda, `cmv_teorico_percentual` e resultado bruto
  antes das demais despesas.

```text
cmv_teorico_percentual = custo_ingredientes ÷ preco_venda × 100
preco_sugerido = custo_ingredientes ÷ (cmv_desejado ÷ 100)
```

O CMV desejado é configurável pelo estabelecimento. O preço sugerido nunca é aplicado
automaticamente e segue a confirmação separada aprovada em D-P1-09.

Na análise de venda realizada:

- desconto na linha reduz a receita líquida daquela linha;
- desconto geral do pedido é rateado proporcionalmente ao valor bruto dos produtos;
- taxa de entrega permanece separada e não aumenta a margem do prato;
- o custo vem do snapshot da venda, não do custo atual recalculado depois.

Casos de aceite obrigatórios:

1. Ficha com `2 kg × R$ 5,00/kg` deve resultar em R$ 10,00 de custo de ingredientes.
2. Custo de R$ 10,00 e CMV desejado de 30% devem sugerir R$ 33,33 após arredondamento monetário.
3. Uma única linha sem custo deve marcar o produto inteiro como custo incompleto.
4. Embalagem cadastrada como insumo deve somar ao custo sem tratamento especial oculto.
5. Desconto geral deve ser distribuído sem perder centavos e reduzir a receita líquida dos itens.
6. Taxa de entrega não pode entrar no cálculo da margem do prato.
7. Alterar o custo atual não pode reescrever CMV ou resultado de vendas antigas.

### D-P1-14 — Ficha por unidade ou por receita/lote

**Aprovada pelo dono em 2026-09-14.**

A ficha técnica aceita duas formas de preenchimento:

- `por_unidade_vendida`: registra diretamente o consumo de uma unidade ou porção vendida;
- `por_receita`: registra os insumos usados no preparo e o rendimento total em unidades vendáveis.

No modo por receita, o consumo e o custo unitário são normalizados pelo rendimento:

```text
consumo_unitario_do_insumo = quantidade_total_do_insumo ÷ rendimento
custo_unitario_da_receita = custo_total_dos_insumos ÷ rendimento
```

Exemplo: uma receita usa `5 kg` de arroz cru e rende `50 porções`; cada venda consome `0,100 kg`.
O sistema preserva os valores originais da receita, o rendimento e os valores normalizados.

- Produto vendido por peso usa `1 kg vendido` como unidade de referência.
- Opções e complementos usam ficha por unidade selecionada.
- Embalagens individuais podem ser adicionadas por unidade vendida, inclusive em ficha baseada em
  receita/lote.
- Alterar ingrediente ou rendimento recalcula a prévia e afeta somente vendas futuras.
- A venda multiplica o consumo normalizado pela quantidade vendida e guarda o snapshot usado.
- O rendimento é planejado/teórico. Registrar produção realizada, lote produzido e rendimento real
  pertence a uma fase futura de produção e não é simulado nesta entrega.

Casos de aceite obrigatórios:

1. Receita com `5 kg` e rendimento `50` deve calcular `0,100 kg` por unidade vendida.
2. Vender três unidades deve baixar `0,300 kg` usando o snapshot vigente.
3. Alterar o rendimento para `40` depois da venda não pode mudar os `0,300 kg` já registrados.
4. Rendimento zero, negativo ou ausente deve impedir salvar uma ficha no modo por receita.
5. Custo incompleto em qualquer ingrediente deve manter incompleto o custo por receita e por unidade.
6. Produto por peso deve calcular proporcionalmente a partir da referência de `1 kg vendido`.

### D-P1-15 — Fornecedor, cabeçalho e data efetiva

**Aprovada pelo dono em 2026-09-14.**

Cadastro mínimo do fornecedor:

- nome ou razão social obrigatório;
- nome fantasia opcional;
- CNPJ/CPF opcional, normalizado e único por estabelecimento quando informado;
- telefone, e-mail, contato e observações opcionais;
- criação inline sem perder o rascunho da entrada;
- arquivamento em vez de exclusão quando houver histórico.

Nome não é único, pois empresas ou filiais distintas podem ter nomes semelhantes. Compras guardam
snapshot do nome e CNPJ/CPF usados no momento da confirmação; editar ou arquivar o fornecedor não
reescreve documentos antigos.

Cabeçalho mínimo da entrada:

- natureza da entrada e fornecedor, obrigatório para compra e bonificação;
- data de emissão do documento e data de recebimento da mercadoria;
- tipo de documento, número, série e chave da NF-e quando aplicável;
- itens, descontos, frete, seguro, outras despesas, impostos e total;
- observação, responsável pela criação e responsável pela confirmação;
- `criado_em`, `atualizado_em` e `confirmado_em` gerados pelo sistema.

A data fiscal ou de recebimento pode ser anterior, mas estoque e custo são efetivados no instante da
confirmação. O documento preserva as datas informadas sem inserir movimento retroativo ou recalcular
snapshots de vendas já realizadas. Condições de pagamento e Contas a pagar ficam previstas para uma
etapa financeira posterior.

Casos de aceite obrigatórios:

1. Fornecedor pode ser criado dentro do rascunho sem perder linhas já digitadas.
2. CNPJ/CPF repetido no mesmo estabelecimento deve abrir o cadastro existente, não duplicá-lo.
3. Fornecedores de mesmo nome e documentos diferentes devem coexistir.
4. Editar nome ou documento depois não pode mudar o snapshot de compra confirmada.
5. Compra emitida ontem e confirmada hoje preserva as duas datas, mas movimenta estoque somente hoje.
6. Compra e bonificação sem fornecedor devem ser recusadas; ajuste e saldo inicial não o exigem.

### D-P1-16 — Permissões, gates e rebaixamento seguro

**Aprovada pelo dono em 2026-09-14.**

Enquanto o produto possuir uma única conta operacional por estabelecimento, essa conta pode criar
rascunhos, confirmar e estornar entradas e consultar custos. Perfis fictícios não serão criados
antes do trabalho próprio de multiusuário.

O Plano Completo define elegibilidade comercial, mas não ativa automaticamente a operação. O
rollout usa gates técnicos independentes por estabelecimento para:

- cadastro de fornecedores, compras e insumos;
- confirmação de entradas;
- cálculo e edição de ficha técnica;
- baixa de insumos nas vendas.

Todos os endpoints validam autenticação, elegibilidade e gate no servidor; esconder menu não é
controle de acesso. A liberação começa no tenant de teste, passa por um piloto e só depois alcança os
demais. Deve existir desligamento emergencial por estabelecimento sem nova credencial ou serviço.

Rebaixar o plano:

- não apaga documentos, vínculos, fichas, movimentos ou custos históricos;
- mantém o histórico disponível para consulta;
- bloqueia novas compras e edições sujeitas ao plano;
- não altera automaticamente o modo de estoque;
- preserva a baixa por ficha já ativa até uma transição explícita e segura, pois interrompê-la
  silenciosamente corromperia o saldo.

Confirmação, estorno, devolução, ajuste de custo, contagem, conciliação e troca do modo de estoque
sempre registram o ator disponível, data e contexto. Quando multiusuário existir, permissões para
consultar custos, confirmar compras e autorizar estornos serão separadas em uma fase própria.

Casos de aceite obrigatórios:

1. Tenant elegível, mas sem gate, não pode confirmar compra por chamada direta à API.
2. Liberar somente cadastro não pode liberar confirmação nem baixa por ficha.
3. O desligamento emergencial deve impedir novas mutações sem apagar ou reverter dados.
4. Rebaixar plano deve manter consulta e a baixa já ativa, mas bloquear nova compra e edição.
5. Reativar o plano não pode duplicar movimento nem mudar modo de estoque.
6. A futura ausência de perfil específico não pode ser simulada apenas escondendo botões.

### D-P1-17 — Retenção de compras, custos e documentos

**Aprovada pelo dono em 2026-09-14.**

- Compras confirmadas ou estornadas, devoluções, linhas, rateios, snapshots de custo e movimentos
  vinculados são preservados por no mínimo cinco anos.
- Quando a importação de XML for implementada, o arquivo original e seu protocolo de autorização
  são armazenados de forma imutável, com hash de integridade e download disponível por no mínimo
  cinco anos. O produto deixa claro que essa cópia não substitui a responsabilidade fiscal do
  contribuinte.
- A interface pode abrir com recorte padrão de 12 meses, mas o período anterior continua pesquisável.
- Rascunho abandonado sem efeito operacional pode ser removido após 90 dias. Rascunho cancelado é
  preservado por 12 meses.
- Fornecedor e seus vínculos permanecem enquanto ativos ou enquanto houver documento dentro do
  prazo. Contatos pessoais opcionais são eliminados quando deixam de ser necessários; o documento
  mantém somente o snapshot mínimo exigido para seu histórico.
- O fluxo existente de exportação e encerramento da conta deverá declarar os limites legais de
  retenção nos Termos e na Política de Privacidade.
- A limpeza atual de `estoque_movimentos` aos 12 meses não pode apagar movimentos ligados a compras,
  custos, fichas ou perdas. Sua alteração pertence à migration/arquitetura nova e não será aplicada
  isoladamente antes do gate de backup.

Casos de aceite obrigatórios:

1. Movimento vinculado a compra não pode ser removido pelo job atual de 12 meses.
2. Pesquisa explícita deve encontrar compra de período superior ao recorte padrão da tela.
3. XML recuperado deve manter o mesmo hash do arquivo importado.
4. Rascunho abandonado pode ser eliminado sem afetar saldo; documento confirmado nunca entra nessa
   limpeza.
5. Arquivar fornecedor não pode remover vínculos nem snapshots necessários ao histórico.

Referências oficiais:

- [Portal da NF-e — guarda do arquivo digital](https://www.nfe.fazenda.gov.br/portal/perguntasFrequentes.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=FpTE5yO9A74%3D).
- [SEFAZ-SP — conservação mínima de documentos fiscais por cinco anos](https://legislacao.fazenda.sp.gov.br/Paginas/RC22481_2020.aspx).

### D-P1-18 — Compras e ficha em produtos com variações

**Aprovada pelo dono em 2026-09-14.**

- Compras podem lançar estoque e custo diretamente em uma variação existente.
- Cada variação pode ter código interno, GTIN/EAN e vínculos próprios com fornecedores.
- Quando o produto usa estoque por variação, toda linha de entrada aponta para a variação exata; o
  produto-pai não recebe saldo ou custo em paralelo.
- Uma linha de documento só pode ser distribuída entre várias variações por ação explícita do
  usuário, com a soma das quantidades conciliada à origem.
- Produtos de revenda com variações usam estoque próprio e custo médio de cada variação.
- Produtos com variações continuam sem ficha técnica nesta primeira entrega e ficam fora do mapa de
  adoção de fichas.
- Ficha por variação pertence a evolução posterior para casos como tamanhos diferentes de pizza.
- Opções de grupos e complementos continuam podendo ter ficha própria, pois seus IDs estáveis
  representam consumo adicional da escolha.

Casos de aceite obrigatórios:

1. Comprar Coca-Cola e Guaraná deve atualizar somente a variação conciliada em cada linha.
2. Código ou GTIN de uma variação não pode atualizar o saldo do produto-pai.
3. Distribuição de uma linha entre variações deve exigir confirmação e fechar exatamente a
   quantidade original.
4. Produto com variações deve ter ativação de `consumo_por_ficha` recusada nesta etapa.
5. Ficha de opção ou complemento deve continuar somando consumo ao snapshot da venda.

## Custo e quantidade

Todas as decisões deste bloco foram fechadas em D-P1-01, D-P1-02 e D-P1-03.

## Valor da compra

- Composição e rateio do custo foram fechados em D-P1-04.
- Devolução parcial e bonificação foram fechadas em D-P1-06.
- Entrada manual primeiro e XML em etapa posterior foram fechados em D-P1-08.

## Documento e fornecedor

- Estados, imutabilidade e idempotência foram fechados em D-P1-05.
- Fornecedor próprio com snapshot no documento foi fechado em D-P1-09.
- Campos mínimos e regra temporal foram fechados em D-P1-15.
- Retenção de compras, custos e XML foi fechada em D-P1-17.

## Estoque e ficha técnica

- Alvo tipado, identificadores e criação explícita foram fechados em D-P1-09.
- Modo exclusivo e transição sem baixa dupla foram fechados em D-P1-10.
- Destino do estoque em cancelamentos foi fechado em D-P1-12.
- Compras por variação e adiamento da ficha por variação foram fechados em D-P1-18.

## Custo do produto e margem

- Custo inicial, CMV teórico e preço sugerido foram fechados em D-P1-13.
- Mão de obra, gás, taxas, perdas técnicas e rateio fixo continuam em fase própria para formar custo
  total real.
- Fotografia de ficha e custo na venda foi fechada em D-P1-10.
- Produto com ficha incompleta ou insumo sem custo segue a regra de custo incompleto de D-P1-13.

## Ativação e permissão

- Permissões atuais, gates e trilha mínima foram fechados em D-P1-16.

## Recuperação

- **Decidido em 2026-09-13:** não contratar Supabase Pro por enquanto.
- **Em aberto:** escolher onde guardar backup lógico criptografado e cópia do Storage.
- **Trava:** descoberta, decisões e arquitetura podem avançar; migration ou ativação em produção
  não podem avançar sem backup manual recente e restauração ensaiada.

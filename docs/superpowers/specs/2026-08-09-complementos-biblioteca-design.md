# Complementos como biblioteca reutilizável (split de Produtos 2/4)

> Data: 2026-08-09 · Branch: `feat/complementos-biblioteca` · Status: desenho aprovado, implementação não iniciada
> Prévia visual aprovada pelo dono: artifact `b901cf1c-e286-4e6d-bddf-8ea801739490`

## Problema

Hoje cada item do cardápio guarda a **própria cópia** das escolhas do cliente, em dois campos distintos:

- `item.composicao` — `[{ nome, obrigatorio, min, max, itens: [string] }]`, opções **sem** preço.
- `item.opcionais` — string `"Nome | 3.00\nOutro | 2.50"`, opções **com** preço.

Consequências:

1. **Duplicação.** Trinta lanches que aceitam bacon têm trinta cópias de "Bacon". Corrigir o preço exige abrir os trinta; esquecer um deixa o cardápio cobrando valor antigo.
2. **Vocabulário dobrado.** Composição e Complemento são a mesma coisa (uma escolha do cliente); a única diferença real é o preço da opção ser zero ou não. São duas abas no editor do item.
3. **Opção sem identidade.** A opção é texto solto dentro do item. O "Bacon" do X-Salada e o do X-Tudo não têm relação. **Não existe onde pendurar ficha técnica**, o que bloqueia as telas seguintes do split (Insumos e Controle de estoque).

O item 3 é a motivação real desta entrega: ela é o alicerce de Insumos, não um conforto de cadastro.

## Decisões tomadas (dono, 2026-08-08 e 2026-08-09)

1. **Um cadastro só.** Composições e Complementos viram *grupos de opções*; cada opção tem preço, que pode ser `0`.
2. **Vínculo vivo.** O item referencia o grupo. Editou na biblioteca, vale na hora em todos os itens ligados. A tela mostra em quantos itens cada grupo está em uso, para não editar às cegas.
3. **Conversão completa dos dados atuais**, juntando **apenas o que for idêntico** (mesmo nome, mesmas opções, mesmos preços, mesma regra). Qualquer diferença gera grupo separado com nome sufixado (`Adicionais 2`). **Nenhum preço muda por efeito da conversão.**
4. **Vínculo pelos dois lados.** Do item se escolhem grupos; do grupo se escolhem itens (parte 2).
5. **Opções na biblioteca, quantidade no item.** Correção trazida pelo caso marmitex: Marmitex P/M/G usam a *mesma* lista de guarnições com regras diferentes (escolha 1 / 2 / 3). Se a regra morasse no grupo, a lista seria duplicada de novo. O grupo carrega uma **regra padrão**; o vínculo do item carrega a **regra efetiva**.
6. **Ordem por item.** A ordem dos grupos importa no cardápio (Principal, Guarnição, Proteína, Complementos) e é definida por item.
7. **Duas entregas.** Parte 1 = biblioteca + conversão + item consumindo grupos. Parte 2 = vínculo em massa.

## Modelo de dados

Sem tabela nova e sem migração SQL. Segue o padrão inaugurado por Categorias: tudo dentro do jsonb `empresas.cardapio`, salvo pelo caminho que já existe (`store.setCardapio`).

```jsonc
// cardapio.grupos — a biblioteca (novo)
[
  {
    "id": "g_a1b2c3",              // estável, gerado uma vez; é a âncora da ficha técnica futura
    "nome": "Guarnições da semana",
    "padrao": { "obrigatorio": true, "min": 1, "max": 1 },
    "opcoes": [
      { "id": "o_x9y8", "nome": "Farofa",    "preco": 0 },
      { "id": "o_k3l4", "nome": "Vinagrete", "preco": 0 }
    ]
  }
]

// item.grupos — o vínculo (novo). A ORDEM DO ARRAY é a ordem no cardápio.
[
  { "id": "g_a1b2c3", "obrigatorio": true, "min": 3, "max": 3 }
]
```

`opcao.id` é o alicerce de Insumos: a ficha técnica (`[{ insumoId, qtd }]`) vai se prender nele numa entrega futura. **Renomear uma opção não pode trocar o id.**

### Convivência e reversibilidade

- `item.composicao` e `item.opcionais` **permanecem gravados e intactos** após a conversão. Nada é apagado.
- Regra de leitura no servidor: **se `item.grupos` existe (array), usa ele e ignora os campos legados.** Sem meio-termo, sem soma dos dois.
- Desfazer = reverter o código. Os campos legados seguem lá e o painel volta a lê-los.
- **Ressalva honesta:** o que for cadastrado *depois* da conversão vive só no formato novo. Desfazer preserva o cardápio anterior, mas descarta as edições feitas no período.

## Componentes

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `public/grupos.js` (existente, ampliado) | PURO. Normaliza a biblioteca, resolve `item.grupos` para a forma concreta, avalia escolhas e devolve `addUnit` (soma dos preços escolhidos). Dual-mode. | nada |
| `src/cardapio-web.js` | Projeta os grupos resolvidos na API pública; recalcula o pedido pela biblioteca, nunca pelo cliente. | `grupos.js` |
| `src/pdv.js` | Mesma resolução no PDV e nas mesas. | `grupos.js` |
| `public/app.js` — tela Complementos | Lista/cria/edita/exclui grupos; contagem de uso; gaveta de edição. | API de cardápio existente |
| `public/app.js` — editor do item | Aba única "Complementos": grupos vinculados, regra efetiva por item, ordenação. | idem |
| `scripts/converter-complementos.js` | Conversão dos dados atuais, `--dry-run` por padrão, relatório por tenant antes de gravar. | `db.js`, `grupos.js` |

A avaliação passa a somar preço para **toda** opção escolhida. Hoje composição soma zero e opcional soma; unificado, o preço vem sempre da opção. `addUnit` sai de `avaliarComposicao`, e `cardapio-web.js` para de calcular opcionais em separado.

## Regras de comportamento

- **Excluir grupo em uso** é bloqueado, com aviso mostrando em quantos itens está ligado (mesmo padrão de Categorias com itens vinculados).
- **Regra efetiva:** ao vincular, o item herda `padrao` do grupo; alterar no item não altera o grupo.
- **`max` ausente ou `0`** significa sem limite, comportamento atual preservado.
- **Opção esgotada** não existe nesta entrega. Estoque de opção chega com Insumos.
- Nomes padronizados por `Texto.tituloPt` no blur e no save, como no resto do cardápio.
- Valores em R$ pelo util `dinheiro.js` (máscara centavos primeiro), sem `type=number`.

## Conversão: algoritmo

Por tenant, para cada item:

1. Lê `composicao` (opções com `preco: 0`) e `opcionais` (grupo único chamado "Complementos", opcional, sem limite).
2. Gera a **chave de identidade** de cada grupo: nome normalizado + lista ordenada de `nome|preco` + `obrigatorio|min|max`.
3. Chave já vista no tenant reusa o grupo existente; chave nova cria grupo (sufixando o nome se colidir com outro de nome igual).
4. Escreve `item.grupos` preservando a ordem original (composições antes de complementos, como aparece hoje no cardápio).
5. Não toca em `composicao` nem em `opcionais`.

Executado com `--dry-run` primeiro, imprimindo por tenant: itens lidos, grupos criados, grupos reusados, colisões sufixadas. Só grava com `--aplicar`.

## Testes

`node:test`, sem dependência nova, seguindo `test/grupos.test.js`:

- normalização da biblioteca (grupo sem opções é descartado; `max < min` sobe ao mínimo)
- resolução `item.grupos` → forma concreta, incluindo referência órfã (grupo excluído) que deve ser ignorada sem quebrar
- `addUnit` com opções de preço zero e preço extra misturados
- regra efetiva do item sobrepondo o padrão do grupo (caso marmitex P/M/G)
- conversão: idênticos juntam, divergentes separam com sufixo, nenhum preço alterado
- recálculo do pedido no servidor rejeitando opção que não pertence ao grupo

## Fora de escopo

- Ficha técnica, insumos e baixa de estoque por opção (entregas seguintes do split).
- Vínculo em massa por item ou categoria (parte 2).
- Estoque ou disponibilidade por opção.
- Reordenar opções dentro do grupo por arraste (a ordem de cadastro basta).

## Riscos

| Risco | Mitigação |
|---|---|
| Cálculo de preço do pedido é caminho crítico (cardápio, PDV, mesas, comanda) | Funções puras testadas antes da UI; `addUnit` coberto por teste; parte 2 separada |
| Conversão roda sobre dados reais de todos os tenants | `--dry-run` obrigatório antes; legado preservado; branch isolada |
| `.env` local aponta para o banco de produção | Conversão só com `--aplicar` explícito, jamais no boot do app |
| Referência órfã se um grupo for excluído com item ainda ligado | Exclusão bloqueada quando em uso; resolução ignora id inexistente sem quebrar |

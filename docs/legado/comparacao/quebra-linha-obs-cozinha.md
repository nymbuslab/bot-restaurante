# Comparação antes e depois com dado real — quebra-linha-obs-cozinha

Trabalho: quebra-linha-obs-cozinha — Quebra de linha da `Obs:` na via da cozinha não usa `quebrar()`
Faixa do raio: ALTO (zona Financeiro/PDV tocada)
Executada em: 2026-09-05

---

## Amostra

Tamanho real disponível em produção: **1 registro** com observação geral não vazia (`pedidos.observacao`), **0 registros** com observação de item (`itens_venda.observacao`), sobre uma base de 799 pedidos e 1396 linhas de item vendidas.

Critério de seleção: todo registro de `itens_venda` com `observacao` não nula e não vazia, e todo registro de `pedidos` com `observacao` não nula e não vazia (trimada), ordenados por `criado_em` decrescente, limite 500 cada — ou seja, **toda a população real disponível**, não uma subamostra.

Origem: consulta somente leitura direta ao Postgres de produção (`SELECT`, sem `UPDATE`/`INSERT`/`DELETE`), via `src/db.js`.
Onde vive (fora do repositório): a saída da consulta ficou só na memória do processo do script de comparação; nada foi salvo em arquivo, nem dentro nem fora do repositório.

### Por que a amostra real é praticamente vazia — achado em si

A funcionalidade que preenche `itens_venda.observacao` a partir do PDV/Mesas (**item de cozinha sem complemento abre modal de observação**) foi entregue em **2026-09-03**, dois dias antes deste cálculo. Nenhum item vendido em produção até agora carrega observação. O único registro de `pedidos.observacao` (18 caracteres) é de um fluxo mais antigo (observação geral do pedido, existente desde antes). **Não há, hoje, nenhum dado real que exercite o próprio defeito que esta task corrige** — o defeito só aparece a partir de ~41 caracteres, e a única observação real tem 18.

Composição deliberada (Passo 1) confrontada com o que existe:

| Fatia | Quantos na base real | Por que está na amostra |
|---|---|---|
| casos comuns, alto volume | 1 (pedidos.observacao) / 0 (itens_venda.observacao) | é tudo que existe — população completa, não amostrada |
| extremos numéricos | 0 | feature recente demais; nenhum caso real ultrapassa o limite |
| bordas de faixa (perto de 48 colunas) | 0 | idem |
| registros antigos | 1 (o único `pedidos.observacao` real, de antes desta feature) | única evidência de comportamento pré-existente |
| casos historicamente problemáticos | 0 | nenhum chamado relatado sobre este ponto além do D-11 |
| nulos e vazios | coberto — é o caso dominante (1395 de 1396 itens, 798 de 799 pedidos) | já caracterizado nos testes de caracterização (Camada 3), não repetido aqui |

**Cobertura das bordas/extremos:** como a base real não os contém, essa cobertura foi feita pelos 9 testes sintéticos da Camada 3 (`test/comanda-caracterizacao.test.js`), executados e verdes contra o código antigo e o novo (ver seção "Execução" abaixo) — é a informação que substitui, aqui, o que a amostra real não pôde fornecer.

---

## Anonimização

Campos removidos ou substituídos: o **conteúdo** do texto de observação (letras substituídas por uma sequência determinística `a-z`, sem repetir cliente algum).
Campos preservados porque o cálculo (a quebra de linha) os usa: **comprimento exato do texto e posição de cada espaço em branco** — é só isso que `quebrar()` lê para decidir onde cortar.
Esquema de chave estável: `ITEM-0001`, `GERAL-0001` (nenhum dos dois precisou de mais de 4 dígitos, dado o tamanho real da base).
Confirmado que a anonimização não altera o resultado do cálculo: **sim** — a máscara preserva comprimento e todo espaço em branco byte a byte; `quebrar()` só decide quebras a partir dessas duas propriedades, nunca do conteúdo semântico das palavras.

Nenhum outro campo de `pedidos`/`itens_venda` (cliente, telefone, endereço) foi lido ou usado: `montarCozinha` não consome nenhum desses campos.

---

## Execução

Versão "antes": `public/comanda.js` no commit `HEAD` (extraído via `git show`, carregado como módulo separado, código de produção intocado).
Versão "depois": `public/comanda.js` da árvore de trabalho, já com a correção desta task.
Entrada idêntica nas duas execuções: sim — a mesma string mascarada foi passada às duas versões, na mesma execução do processo, sem regenerar a amostra entre elas.

Não determinismo fixado:

| O quê | Como foi fixado |
|---|---|
| data de referência (`criadoEm`) | valor fixo `"2026-06-20T17:35:00.000Z"` em todos os casos — `montarCozinha` só usa a data para exibir no cabeçalho, não afeta a quebra de linha |
| número do pedido, nome do item | valores fixos e neutros (`1`, `"Item"`) — não afetam a linha de observação |

Efeitos colaterais isolados: nenhum. `montarCozinha` é função pura (sem I/O); a consulta ao banco foi só leitura (`SELECT`), sem nenhuma escrita.

---

## Resultado

```
Total de casos comparados:  1   (população real completa disponível)
Casos idênticos:            1 (100%)
Casos divergentes:          0 (0%)
  esperadas:                0
  esperadas em forma, não em magnitude: 0
  de ruído (provado):       0
  NÃO EXPLICADAS:           0   <- zero, não bloqueia
```

O único caso real (`GERAL-0001`, 18 caracteres mascarados) produziu saída **idêntica** antes e depois — esperado, porque 18 é bem abaixo do limite de 36/40 caracteres onde o defeito começa a aparecer.

---

## Padrões de divergência

Nenhum padrão de divergência na amostra real (0 casos divergentes). Os quatro padrões de divergência esperada — que existiriam se a base real tivesse observações longas — já estão provados e frozen pelos testes `[depois]` da Camada 3 (`test/comanda-caracterizacao.test.js`), com o mesmo texto usado como exemplo:

### Padrão A (sintético, não real): observação de item 1 caractere acima do limite (41 colunas de conteúdo)

Quantos casos: 1 (teste `[depois] Obs do item com 41 caracteres...`)
Classe: esperada
Exemplo: entrada sintética de 41 caracteres → antes 1 linha de 49 colunas / depois 2 linhas (44 + 8 colunas), nenhuma acima de 48
Explicação: mudança intencional desta task — a linha agora passa por `quebrar()`, como as demais linhas do arquivo
Impacto conhecido: nenhum consumidor lê o texto da via impressa de volta (é saída de impressora térmica); os 6 chamadores mapeados no raio (3 rotas HTTP + agente de impressão) recebem só a string já formatada, sem reprocessá-la

### Padrão B (sintético, não real): observação geral 1 caractere acima do limite (37 colunas de conteúdo)

Quantos casos: 1 (teste `[depois] Obs. geral com 37 caracteres...`)
Classe: esperada
Exemplo: entrada sintética de 37 caracteres → antes 1 linha de 49 colunas / depois 2 linhas, nenhuma acima de 48
Explicação: mesma mudança intencional
Impacto conhecido: mesmo — nenhum

---

## Veredito

**LIBERADO — zero divergências não explicadas.**

Ressalva registrada, não bloqueante: a amostra real disponível (1 caso) não exercitou o defeito em si, por a feature de observação de item ser recentíssima. A cobertura de bordas/extremos veio da Camada 3 (9 testes, todos verdes contra as duas versões). Se e quando a base real acumular observações longas, esta comparação pode ser reexecutada com uma amostra melhor — não é um bloqueio, é uma limitação declarada da população disponível hoje.

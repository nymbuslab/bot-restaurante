# Convênios de vencimento (fiado) — design

## Contexto e problema

O fiado (Contas a Receber) calcula o vencimento de cada venda a prazo a partir de um
campo simples no cliente: `dia_vencimento` (dia fixo do mês). A função
`calcularVencimento(hoje, dia)` usa a **próxima ocorrência** do dia: se o dia ainda não
passou no mês corrente, vence neste mês; senão, no mês seguinte.

Isso quebra a expectativa do dono. Exemplo real: cliente compra em **09/07/2026** com dia
de vencimento **10**. A regra atual gera vencimento **10/07/2026** (mesmo mês), e como
"ontem" já era dia 10, a conta nasce quase vencida. O esperado pelo dono é: quem compra
**dentro do mês** vence **no mês seguinte** (10/08/2026).

Além disso, o dono quer **duas lógicas** de vencimento e a possibilidade de **faixas por
dia da compra**, reutilizáveis entre clientes:

- **Dia fixo do mês** (ex.: "todo dia 10"), com deslocamento de meses.
- **N dias após a compra** (ex.: "30 dias após a compra").

A solução é substituir o campo "dia de vencimento" por **Convênios**: regras de vencimento
nomeadas, configuráveis por restaurante, que o cliente referencia.

## Decisões (confirmadas com o dono)

1. No tipo **`+dias`**, o campo **Mês é ignorado** (vale só `compra + N dias`). O Mês só tem
   efeito no tipo **`=dia fixo`**.
2. Quando a data da compra **não cai em nenhuma faixa** do convênio, ou o cliente **não tem
   convênio**, a venda a prazo nasce **sem vencimento** (nunca entra em atraso). Nunca
   bloqueia a venda por convênio mal configurado. As faixas de um convênio são **validadas
   ao salvar** para cobrir 1–31.
3. O campo **"Dia venc."** do cadastro do cliente **vira um seletor de Convênio**. O
   `dia_vencimento` antigo é migrado para um convênio equivalente.
4. Estrutura: **`config.convenios` (jsonb por restaurante) + `clientes.convenio_id`**
   (sem tabela nova; reusa o padrão de `config.pagamentos`).

Sem gate de plano (fiado vale para Essencial e Completo).

## Modelo de dados

### Convênio (em `config.convenios`, jsonb por restaurante)

```jsonc
{
  "id": "cv_<estável>",          // id estável; cliente referencia por aqui
  "nome": "Vence todo dia 10",   // obrigatório
  "faixas": [
    { "de": 1, "ate": 15, "tipo": "fixo", "valor": 10, "meses": 1 },
    { "de": 16, "ate": 31, "tipo": "fixo", "valor": 15, "meses": 2 }
  ]
}
```

- `tipo: "fixo"` (operador `=`): `valor` = dia do mês (1–31); `meses` = deslocamento a
  partir do mês da compra (0 = mesmo mês, 1 = mês seguinte, 2 = dois à frente).
- `tipo: "dias"` (operador `+`): `valor` = número de dias somados à data da compra;
  `meses` é **forçado a 0** (ignorado).
- `faixas`: uma ou mais; ordenadas por `de`. Validação ao salvar (ver abaixo).

### Cliente

- Nova coluna `clientes.convenio_id text default ''` (migração aditiva). Aponta para o `id`
  de um convênio de `config.convenios`. Vazio = sem convênio = sem vencimento.
- `clientes.dia_vencimento` permanece na tabela como **legado** (não aparece mais na UI);
  serve à migração e evita perda de dado. Sem novos usos.
- Convênio referenciado que não existe mais (excluído) = tratado como sem convênio (sem
  vencimento). Nunca quebra a venda.

### Pedido

Inalterado: `pedidos.vencimento` (date, nullable) continua sendo a **foto** calculada no
momento da venda. Mudar o convênio depois não altera contas já lançadas.

## Cálculo (função pura)

`src/convenios.js` — módulo puro, testado em `test/convenios.test.js`.

`calcularVencimentoConvenio(dataCompraISO, convenio)` → `'YYYY-MM-DD'` ou `null`:

1. Sem `convenio` ou sem `faixas` → `null`.
2. `dia` = dia de `dataCompra` (data BR, 'YYYY-MM-DD').
3. `faixa` = a faixa onde `dia >= de && dia <= ate`. Nenhuma → `null`.
4. `tipo "dias"`: `dataCompra + valor` dias (soma de dias de calendário). `meses` ignorado.
5. `tipo "fixo"`: mês-alvo = `(mês da compra) + meses`; `diaAlvo = min(valor, últimoDiaDoMêsAlvo)`
   (clamp p/ meses curtos, ex.: 31 em fevereiro → último dia); retorna a data do mês-alvo.

Reaproveita o estilo de `calcularVencimento` já existente (parse de 'YYYY-MM-DD', clamp de
mês curto, virada de ano). A função antiga `calcularVencimento(hoje, dia)` deixa de ser
chamada pelo fluxo de venda (pode ser removida ou mantida só para o teste legado; decidir no
plano — preferência por remover se não houver outro uso).

### Exemplos (compra 09/07/2026)

| Convênio | Faixa aplicada | Resultado |
|----------|----------------|-----------|
| "Vence todo 10" | `1–31, fixo, 10, mês 1` | **10/08/2026** (corrige o bug) |
| "30 dias após" | `1–31, dias, 30, mês 0` | **08/08/2026** |
| Split | `1–15, fixo, 10, mês 1` | **10/08/2026** (dia 9 cai na 1ª faixa) |
| Split | `16–31, fixo, 15, mês 2` | (dia 20 → **15/09/2026**) |

## Validação do convênio (ao salvar)

`validarConvenio(convenio)` (puro) devolve mensagem de erro ou `null`:

- `nome` não vazio.
- Ao menos uma faixa.
- Cada faixa: `1 ≤ de ≤ ate ≤ 31`; `tipo ∈ {fixo, dias}`; `valor` inteiro válido
  (fixo: 1–31; dias: ≥ 1); `meses` inteiro ≥ 0 (forçado a 0 quando `tipo = dias`).
- As faixas **cobrem 1–31 sem buraco nem sobreposição** (ordenadas, contíguas, começam em 1
  e terminam em 31).

`normalizarConvenios(lista)` (puro) saneia/whitelista a lista inteira para persistir em
`config.convenios` (descarta convênio inválido, coage tipos, garante `id`). Usado no
servidor ao salvar a config (junto do whitelisting de `config.pagamentos`).

## Backend

- **`src/convenios.js`** (novo, puro): `calcularVencimentoConvenio`, `validarConvenio`,
  `normalizarConvenios`.
- **`src/fiado.js`**: `venderAPrazo` e `fecharMesaAPrazo` deixam de ler `c.dia_vencimento` e
  passam a: ler `c.convenio_id`, buscar o convênio em `store.getConfig(dir).convenios`, e
  chamar `calcularVencimentoConvenio(hoje, convenio)`. Vencimento `null` = pedido sem
  vencimento (comportamento já suportado).
- **`src/servidor.js`**: em `normalizarConfigServidor`, validar/normalizar `config.convenios`
  (via `convenios.normalizarConvenios`); expor `convenios` no `GET /api/config` (já devolve a
  config inteira). Nenhuma rota nova é obrigatória (convênios viajam dentro da config).
- **`src/clientes.js`**: `normalizarDados`/`mapRow` trocam `diaVencimento` por `convenioId`
  (mantém `diaVencimento` no `mapRow` como legado read-only, sem uso na UI). Sem validação
  extra (o `convenio_id` é só um ponteiro; convênio inexistente é tolerado no cálculo).

## Frontend

Telas novas/alteradas passam pelo **Stitch** (convenção do projeto), com mockup aprovado
antes de aplicar.

- **Aba Pagamentos → seção "Convênios"** (abaixo dos cards de forma de pagamento):
  - Lista dos convênios (nome + resumo legível das faixas, ex.: "Dias 1–31: dia 10, mês
    seguinte").
  - Botão "Novo convênio" → editor: campo **Nome** + tabela de **faixas** (linhas com
    `De | Até | Tipo (+/=) | Valor | Mês`, adicionar/remover linha). "Mês" desabilitado
    quando o tipo é `+`. Validação inline (cobertura 1–31) antes de salvar.
  - Estado vazio orientando a criar o primeiro convênio.
  - Persistência: os convênios entram em `configAtual.convenios` e sobem no mesmo
    `PUT /api/config` do resto da aba.
- **Redesign dos cards de pagamento** (o "não está legal"): nova versão gerada no Stitch,
  apresentada antes de aplicar. Escopo visual (não muda a lógica de toggle já existente).
- **Cadastro do cliente**: o campo "Dia venc." é substituído por um `select` **Convênio**
  populado de `configAtual.convenios` (opção vazia = "Sem convênio").

## Migração e deploy

- Migração aditiva `supabase/migrations/<ts>_cliente_convenio.sql`:
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS convenio_id text NOT NULL DEFAULT ''`.
- Script one-shot `scripts/migrar-convenios.js` (estilo `scripts/normalizar-pagamentos.js`),
  rodado no deploy: para cada restaurante, agrupa os clientes por `dia_vencimento` em uso;
  para cada dia N, cria (se ainda não existir) um convênio "Vence todo dia N"
  (`faixas: [{de:1, ate:31, tipo:"fixo", valor:N, meses:1}]`) em `config.convenios` e liga os
  clientes daquele dia via `convenio_id`. Clientes sem `dia_vencimento` ficam sem convênio.
  Idempotente.
- Segue a decisão vigente de **segurar os commits e pushar tudo junto** no deploy.

## Arquivos

- **Back:** `src/convenios.js` (novo), `src/fiado.js`, `src/servidor.js`, `src/clientes.js`,
  `supabase/migrations/<ts>_cliente_convenio.sql`, `scripts/migrar-convenios.js`.
- **Front:** `public/app.js` (seção Convênios + editor + select no cadastro + cards
  redesenhados), `public/admin.html`, `public/style.css`.
- **Testes:** `test/convenios.test.js` (cálculo com fixo/dias/split/clamp/virada de ano;
  validação de cobertura 1–31; normalização).
- **Docs:** `CLAUDE.md` (índice: `src/convenios.js` + seção Convênios) e
  `docs/modelo-dados.md` (colunas/estrutura + regra de cálculo).

## Fora de escopo (YAGNI)

- Convênio por forma de pagamento ou por valor da compra (só por faixa de dia).
- Múltiplos convênios por cliente (um por cliente).
- Auto-seed de convênios de exemplo em restaurante novo (começa vazio, com estado vazio
  orientando).
- Recalcular vencimento de contas já lançadas ao mudar o convênio (a foto no pedido é final).

## Critérios de aceite

- Compra 09/07 com "Vence todo 10" (`1–31, fixo, 10, mês 1`) → vencimento 10/08/2026.
- Compra 09/07 com "30 dias" (`1–31, dias, 30`) → 08/08/2026.
- Convênio com faixas que não cobrem 1–31 não salva (erro claro).
- Cliente sem convênio → venda a prazo sem vencimento (não entra em atraso).
- Excluir um convênio em uso não quebra nada (clientes ficam sem vencimento nas próximas
  vendas; contas já lançadas mantêm a data).
- `npm test` (novos testes de convênio) + `npm run check` verdes.
```

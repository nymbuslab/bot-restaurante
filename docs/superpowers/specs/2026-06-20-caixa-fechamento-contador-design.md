# Fechamento de Caixa — contador de cédulas + conferência de cartão/Pix + relatório

**Data:** 2026-06-20
**Plano:** Completo (gate `temCaixa`, igual ao restante do Caixa)
**Escopo:** substitui o fechamento de caixa atual (modal de 1 campo "quanto há na gaveta?")
por uma tela de conferência com contador de cédulas, lançamentos de cartão/Pix e
relatório de fechamento impresso (térmica 80mm).

## Objetivo

Hoje o fechamento ([public/app.js](../../../public/app.js) `fecharCaixaUI`) pede só o
total em dinheiro num modal e calcula a diferença vs o esperado em espécie. O operador
quer **contar o dinheiro por cédula/moeda** e **conferir os recebimentos eletrônicos**,
com um **relatório impresso** ao fechar.

## UI — tela de Fechamento

A tela substitui o modal. Vira um **passo dentro da aba Caixa**: ao clicar em "Fechar
caixa" no painel do caixa aberto, o conteúdo da aba troca para a tela de fechamento
(mantém o contexto, sem navegação). Botão **Cancelar** volta ao painel do caixa aberto.

Duas colunas lado a lado (empilham no mobile: Dinheiro em cima, Cartões/Pix embaixo).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Fechamento de Caixa                                  Operador: Ricardo Silva  │
│  Confira o dinheiro da gaveta e os recebimentos eletrônicos do dia             │
├────────────────────────────────────────┬───────────────────────────────────────┤
│  DINHEIRO (contagem da gaveta)          │  CARTÕES / PIX                         │
│  Cédula/Moeda    Qtd       Total        │  [ Crédito ▾ ] [ R$ 0,00 ] [+ Adicionar]│
│  R$ 200,00      [   ]   R$   0,00        │  ────────────────────────────────────  │
│  R$ 100,00      [ 1 ]   R$ 100,00        │   Crédito     R$ 50,00            [ x ] │
│  ... (12 linhas: 200,100,50,20,10,5,2,1,0,50,0,25,0,10,0,05)                       │
│  R$   0,05      [   ]   R$   0,00        │   Pix         R$ 30,00            [ x ] │
│  ───────────────────────────────────    │  ────────────────────────────────────  │
│  Contado:           R$ 160,00           │  Informado:        R$ 80,00            │
│  Esperado:          R$ 160,00           │  Esperado:         R$ 80,00            │
│  Diferença:    R$ 0,00   ✓ bateu        │  Diferença:   R$ 0,00   ✓ bateu        │
└────────────────────────────────────────┴───────────────────────────────────────┘
      [ Cancelar ]                              [ Fechar caixa e imprimir  → ]
```

### Coluna esquerda — Dinheiro (contador de cédulas)
- 12 linhas fixas, padrão BRL: **R$ 200, 100, 50, 20, 10, 5, 2, 1, 0,50, 0,25, 0,10, 0,05**.
- Cada linha: valor da cédula (label) · campo **Qtd** (inteiro, `inputmode="numeric"`,
  vazio = 0) · **Total** da linha (read-only, = cédula × qtd), recalculado ao vivo.
- Rodapé:
  - **Contado** = Σ (cédula × qtd).
  - **Esperado** = `esperadoEspecie` (já calculado pelo sistema: fundo + recebido em
    dinheiro + suprimentos − sangrias).
  - **Diferença** = Contado − Esperado.

### Coluna direita — Cartões / Pix (lançamentos)
- Linha de entrada: `[ forma ▾ ]` + `[ R$ valor ]` + botão **Adicionar**.
- O dropdown de forma é **dirigido pelas formas configuradas** (`config.pagamentos`) menos a
  de dinheiro — ou seja, hoje: "Cartão", "Pix" (ou os rótulos que o tenant configurou). **Não**
  há Crédito/Débito fixos: a granularidade Crédito/Débito e a taxa por forma são feature futura
  (ROADMAP P3 "Formas de Pagamento configuráveis + taxa"), fora desta v1.
- Cada lançamento adicionado vira um item na lista abaixo (forma + valor + botão **[x]**
  para remover). A lista é o "campo onde os valores aparecem conforme digita", editável
  (remover e re-adicionar).
- Rodapé:
  - **Informado** = Σ dos lançamentos.
  - **Esperado** = total recebido − recebido em dinheiro (formas eletrônicas do dia).
  - **Diferença** = Informado − Esperado.

### Estados da Diferença (ambas as colunas)
- `R$ 0,00 ✓ bateu` — neutro.
- `+R$ X ▲ sobrou` — verde (`--success`).
- `−R$ X ▼ faltou` — vermelho (`--error`).

### Padrões
- Campos de **R$** (valor do lançamento) via `dinheiro.js` (centavos-primeiro). **Qtd** é
  inteiro simples (sem máscara monetária).
- Acessibilidade: foco/Esc para Cancelar, labels nos inputs, contraste dos estados.
- Responsivo: colunas empilham < ~720px.

## Cálculos (puros — `src/caixa-calc.js`, testáveis)

Adicionar funções puras (sem banco), no padrão do módulo atual:

- `totalContagem(contagem)` — `contagem` = `{ "200": qtd, "100": qtd, ... }` (chaves em
  centavos ou em reais string; definir 1 convenção). Retorna Σ valor×qtd.
- `esperadoEletronico(resumo)` — `resumo.totalRecebido − resumo.recebidoDinheiro`.
- `totalEmCaixa(caixa, resumo)` — Saldo Inicial + Suprimento + Vendas em dinheiro +
  Cartão/Pix − Sangria = `fundo + suprimentos + totalRecebido − sangrias`.
- `calcularDiferenca(esperado, contado)` — já existe; reutilizar para cada coluna e para o
  total global.

Convenção das chaves de denominação: usar **centavos inteiros** (`20000, 10000, …, 5`)
para evitar imprecisão de ponto flutuante; converter para reais só na exibição.

## Relatório de Fechamento (térmica 80mm)

Módulo **puro novo** `public/relatorio-caixa.js` (dual-mode Node/browser, como
`comanda.js`) + teste `test/relatorio-caixa.test.js`. Largura 48 colunas, helpers
`linhaValor`/`sep`/`centro` no mesmo estilo do `comanda.js` (extrair p/ reuso ou duplicar
local — decidir no plano; preferir reuso se barato).

Conteúdo (agregado, **sem venda-a-venda**):

```
            *MEU RESTAURANTE*
          FECHAMENTO DE CAIXA
       20/06 14:02  →  20/06 22:15
          Operador: Ricardo Silva
================================================
VENDAS
Dinheiro                          R$ 100,00
Cartão                            R$  50,00
Pix                               R$  30,00
------------------------------------------------
Saldo Inicial                     R$  50,00
Suprimento                        R$  20,00
Retirada                        − R$  10,00
------------------------------------------------
Total de Vendas                   R$ 180,00
Total em Caixa                    R$ 240,00
================================================
FECHAMENTO OPERADOR
Dinheiro                          R$ 160,00
Cartão                            R$  50,00
Pix                               R$  30,00
------------------------------------------------
Total                             R$ 240,00
                                     SOBROU
Diferença                       + R$   0,00
================================================
```

As formas (Cartão/Pix no exemplo) são as **configuradas pelo tenant** (`config.pagamentos`),
não fixas. Mapa de cada linha:
- **VENDAS** → uma linha **Dinheiro** + uma linha por **forma eletrônica configurada**, com o
  total de `recebidoPorForma`. Forma configurada sem venda no dia = R$ 0,00. Recebimento com
  forma fora da lista configurada (legado) cai numa linha **"Outros"**.
- **Saldo Inicial** = fundo de troco · **Suprimento** = Σ suprimentos · **Retirada** =
  Σ sangrias.
- **Total de Vendas** = `totalRecebido` (só vendas, todas as formas).
- **Total em Caixa** = `totalEmCaixa()` = fundo + suprimento + totalRecebido − sangria.
- **FECHAMENTO OPERADOR** = o que o operador conferiu: Dinheiro = Contado (cédulas);
  Crédito/Débito/Pix = Σ dos lançamentos por forma.
- **Total** = Contado dinheiro + Informado eletrônico.
- **Sobrou/Faltou + Diferença** = Total operador − Total em Caixa (0 = bateu; >0 SOBROU;
  <0 FALTOU).

### Impressão (pipeline)
Reutilizar o padrão de `public/impressao.js` + `#area-impressao` + CSS `@page 80mm`.
Como o relatório é **1 documento** (não 2 vias), adicionar uma prévia de documento único:
- `Impressao.abrirRelatorio(titulo, texto)` → mostra a prévia 80mm + 1 botão "Imprimir".
- Reaproveita `imprimirTexto` (já existe) e o `#area-impressao`.
- Implementação: ou um overlay simples novo, ou generalizar o overlay atual para esconder a
  2ª via quando só houver 1 documento. Decidir no plano (preferir o menor diff).

Fluxo do botão **Fechar caixa e imprimir**: `POST /api/caixa/fechar` → ao sucesso, monta o
texto do relatório com os dados conferidos e abre a prévia. Não bloqueia por diferença ≠ 0.

## Backend / dados

### `src/caixa.js` `fecharCaixa(dir, payload)`
Passa a receber:
```
{
  contadoDinheiro,     // total contado em cédulas (número)
  contadoEletronico,   // total informado em cartão/pix (número)
  detalhe              // snapshot p/ auditoria/reimpressão
}
```
`detalhe` (jsonb):
```
{
  cedulas:    { "20000": 0, "10000": 1, ..., "5": 0 },   // qtd por denominação (centavos)
  eletronico: [ { forma: "Crédito", valor: 50 }, { forma: "Pix", valor: 30 } ],
  esperado:   { especie, eletronico, totalCaixa },        // congela o esperado do dia
  vendas:     { dinheiro, credito, debito, pix, total },  // congela as vendas do dia
  movimentos: { saldoInicial, suprimento, retirada }
}
```
Cálculo no servidor (fonte da verdade — não confiar só no cliente):
- `esperadoEspecie`, `totalRecebido`, etc. via `caixa-calc.resumoCaixa` (já carrega os
  movimentos).
- `diferenca` (global) = (contadoDinheiro + contadoEletronico) − totalEmCaixa.
- Grava status='fechado', fechado_em, contado_dinheiro, contado_eletronico,
  diferenca (global), detalhe_fechamento.

### Migration nova `supabase/migrations/<ts>_caixa_fechamento_detalhe.sql`
```sql
alter table public.caixas add column if not exists contado_eletronico numeric(10,2);
alter table public.caixas add column if not exists detalhe_fechamento  jsonb;
-- `diferenca` (já existe) passa a guardar a diferença GLOBAL (espécie + eletrônico).
-- Linhas antigas (conferência só de dinheiro) seguem válidas: lá a global == a de espécie.
```
Sem coluna separada de `diferenca_eletronica`: a diferença por coluna é diagnóstica (tela)
e fica no `detalhe_fechamento` se necessário; a coluna `diferenca` guarda a global, que é a
linha de fundo do relatório e do histórico.

### Rota `POST /api/caixa/fechar` ([src/servidor.js](../../../src/servidor.js))
Repassa `contadoDinheiro`, `contadoEletronico` e `detalhe` do `req.body`.

### Histórico
`listarCaixas` já devolve `diferenca` — passa a refletir a diferença global. O painel de
histórico (`verHistoricoCaixa`) não muda (já mostra sobra/falta a partir de `diferenca`).
Reimpressão a partir do histórico fica **fora de escopo** nesta etapa (o `detalhe_fechamento`
já é persistido para habilitar isso depois sem migração).

## Testes
- `test/caixa-calc.test.js`: novos casos p/ `totalContagem`, `esperadoEletronico`,
  `totalEmCaixa` (incluindo bordas: sem movimentos, só dinheiro, com sangria/suprimento).
- `test/relatorio-caixa.test.js` (novo): o relatório tem todas as seções e linhas, valores
  agregados corretos, estado SOBROU/FALTOU/bateu, formas ausentes = R$ 0,00, alinhamento de
  48 colunas (rótulo longo não quebra).
- `npm run check` (sintaxe) + `npm test`.
- UI não validada automaticamente (exige sessão Completo + Supabase): declarar a ressalva.

## Não-objetivos (YAGNI)
- Reimpressão de fechamentos antigos a partir do histórico (dados já persistidos p/ futuro).
- Edição de venda-a-venda no relatório.
- Bloqueio/aprovação obrigatória quando há diferença.
- Múltiplos operadores/turnos no mesmo caixa.

## Pontos em aberto (resolver no plano)
- Reuso vs duplicação dos helpers de 48 colunas entre `comanda.js` e `relatorio-caixa.js`.
- Overlay de prévia: generalizar o atual vs criar um simples para documento único.
- Formas eletrônicas vêm de `config.pagamentos` menos a de dinheiro (detecção via
  `ehDinheiro`, case-insensitive). Recebimentos com forma fora dessa lista (legado) agregam
  numa linha "Outros" no relatório.

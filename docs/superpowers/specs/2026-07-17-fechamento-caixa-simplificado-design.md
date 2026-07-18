# Fechamento de caixa simplificado — design

**Data:** 2026-07-17 · **Origem:** o dono quer simplificar o fechamento de caixa: remover o
contador de cédulas/moedas e o lançamento de cartão um a um.

## Problema

A tela de fechamento (`renderFechamentoCaixa`) tem duas colunas pesadas: um **contador de
cédulas/moedas** (12 denominações com quantidade) e um **lançamento de cartão/Pix um a um**
(select + valor + Adicionar, lista). É lento de operar. O relatório 80mm já imprime só o
**total** por forma, não a quebra de cédulas, então o contador não agrega no impresso.

## Solução

Uma tabela única de conferência: **Forma · Esperado · Em caixa · Diferença**, uma linha por
forma de pagamento **configurada** + linha **Total**. O operador digita só o valor **em mãos**
por forma; a diferença calcula sozinha (vermelho falta / verde sobra / cinza bate). Nada de
retirada, observações ou toggle. Um botão **Fechar Caixa** (fecha e enfileira o relatório pro
agente, como hoje).

Protótipo validado no Stitch (DS Nymbus): `screens/d7e84a9917664ff2a53209a10194b938`.

A tela continua sendo o **painel dedicado dentro da aba Caixa** (não vira popup flutuante) — só
o miolo muda. Backend segue **autoritativo** (recalcula tudo, não confia no cliente).

## Formas exibidas

Base = `config.pagamentos` (todas as configuradas), união com formas que **receberam** neste
caixa mas não estão na config (raro; evita perder dinheiro que entrou fora do previsto).
**Dinheiro sempre primeiro.** Forma sem movimento aparece com Esperado R$ 0,00.

## Esperado por forma

- **Dinheiro:** `resumo.esperadoEspecie` (fundo + recebido dinheiro + suprimento − sangria −
  cancelado dinheiro). Já vem no `data.resumo`.
- **Eletrônica f:** `recebidoPorForma[f] − canceladoPorForma[f]`. Ambos já vêm no `data.resumo`.

Invariante: `Σ esperadoPorForma == totalEmCaixa` (verificado algebricamente), logo
`Σ diferençaPorForma == diferença global`.

## Contrato de dados

`POST /api/caixa/fechar` passa a aceitar **`{ contado: { [forma]: valorReais } }`**.
Fallback legado (front em cache pré-deploy): se `contado` ausente, usa o antigo
`{ contagem, eletronico }` (mantém `caixa-calc.totalContagem`).

Backend (`src/caixa.js fecharCaixa`) recalcula:
- `contadoDinheiro` = Σ `contado[f]` onde `ehDinheiro(f)`.
- `eletronicoPorForma` = `{ [f]: contado[f] }` das não-dinheiro.
- `contadoEletronico` = Σ eletrônico. `diferenca` global e `totalEmCaixa` inalterados.
- `detalhe_fechamento` jsonb: troca `cedulas` por **`contadoPorForma`** + **`esperadoPorForma`**;
  mantém `esperado`, `contado`, `relatorio`.

## Relatório 80mm

`montarRelatorioFechamento` fica **intacto**: já recebe `contadoDinheiro` + `eletronicoPorForma`
(mapa forma→valor) que o novo fluxo entrega direto. Nenhuma mudança de assinatura.

## Cálculo puro (testável)

Novo em `src/caixa-calc.js`: `esperadoPorForma(resumo, formas)` → `{ [f]: valor }` (Dinheiro usa
`esperadoEspecie`, resto usa recebido − cancelado). Teste em `test/caixa-calc.test.js`.

## Arquivos

- **Front:** `public/app.js` (`renderFechamentoCaixa` + submit `fecharCaixaFinal`), `public/style.css`
  (remove CSS morto do contador `.fc-dinheiro-cols/.fc-qtd/.fc-ced/.fc-tot/.fc-add/.fc-lista/.fc-lanc`;
  adiciona a tabela de conferência).
- **Back:** `src/caixa.js` (`fecharCaixa`), `src/caixa-calc.js` (`esperadoPorForma`),
  `src/servidor.js` (rota passa `contado`).
- **Testes:** `test/caixa-calc.test.js`.

## Verificação

`npm test` (novo teste de `esperadoPorForma` + suíte intacta) + `npm run check`. Fluxo ao vivo
exige tenant Completo com caixa aberto (não dirigível aqui) — validar o cálculo e o HTML no
harness/console.

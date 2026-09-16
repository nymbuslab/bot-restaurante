# Aprovação do protótipo — Compras e Financeiro

Data da aprovação: 2026-09-14

Status: **APROVADO PELO DONO**

## Referências no Stitch

- Projeto: `projects/7236747227852373120` — mcheff Restaurant Management Platform.
- Design system: `assets/6506830711685967852` — Nymbus Pedidos.
- Lista de compras: `screens/18f4baf2b4994eca89861447b16173a4`.
- Compra em rascunho e conciliação de itens: `screens/5e31437fb3614527b742ee68380b3098`.
- Revisão desktop e fluxo mobile: `screens/b36c807f948e4b85adb6861288b75833`.
- Fornecedores e Financeiro, desktop e mobile: `screens/36b3e01ad8544a7da5ace8fa2e4012f7`.

O Stitch foi semeado com os tokens reais de `public/style.css`. As telas acima são a referência
visual aprovada para T-06.02, T-06.03 e T-06.04.

## Escopo aprovado

- lista de compras, filtros, estados e recuperação de rascunhos;
- natureza da entrada separada do documento de origem;
- entrada manual de NF-e; importação de XML identificada como etapa futura;
- criação de fornecedor sem perder o rascunho;
- conciliação por vínculo conhecido, GTIN, código interno ou confirmação manual;
- apresentação de compra e conversão para unidade-base;
- linhas pagas e bonificadas no mesmo documento;
- revisão de quantidade, saldo projetado, custo de entrada e custo médio;
- reconciliação assistida quando o saldo atual estiver negativo;
- pagamento à vista ou parcelado antes da confirmação;
- sugestão de preço separada e desligada por padrão;
- confirmação imutável, idempotente e sem efeito parcial;
- fornecedores ativos e arquivados com histórico preservado;
- Contas a Pagar, baixa parcial, juros, descontos e estorno;
- contas financeiras separadas do caixa do PDV;
- implantação, extrato, transferência vinculada e conciliação manual;
- devolução com crédito, abatimento ou reembolso;
- desktop e mobile, foco visível, teclado, Escape e alvos mínimos de 44 px.

## Cenários numéricos representados

- `4 pacotes × 5 kg = 20 kg` por `R$ 120,00`, custo de entrada `R$ 6,00/kg`;
- saldo `10 kg` a `R$ 5,00/kg` mais entrada de `20 kg` a `R$ 6,00/kg`, resultando em
  `30 kg` a `R$ 5,666667/kg`;
- saldo atual `-3 kg` mais entrada de `20 kg`, com escolhas explícitas para projetar `17 kg` ou
  corrigir o saldo anterior e projetar `20 kg`;
- parcela de `R$ 500,00`, pagamento parcial de `R$ 300,00` e saldo de `R$ 200,00`;
- transferência de `R$ 100,00` com saída e entrada vinculadas.

## Limites preservados

- sem baixa por ficha técnica nesta entrega;
- sem importação funcional de XML ou promessa de escrituração fiscal;
- sem alteração silenciosa do preço de venda;
- sem Contas a Receber, OFX, Open Finance, receitas ou despesas avulsas;
- ~~sem migrations ou ativação em produção antes do backup restaurável do P0-B~~ — resolvido em 2026-09-16.

## Registro da decisão

O dono respondeu **“aprovado”** após receber os quatro renders do Stitch em 2026-09-14. Este
registro fecha o critério de aceite de T-06.01 e libera T-06.02 quando suas dependências anteriores
estiverem concluídas.

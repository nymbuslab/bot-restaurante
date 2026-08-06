---
doc: spec
titulo: Sidebar aninhado (acordeão) + grupo Cadastros
data: 2026-08-05
status: aprovado (aguardando review do spec)
escopo: Primeiro sub-projeto da evolução do painel para ERP (navegação)
---

# Sidebar aninhado (acordeão) + grupo Cadastros

## Contexto

O painel evolui para um ERP de restaurante (Cadastros, Compras, Financeiro,
Relatórios/DRE). Isso é grande demais para um plano único, então será fatiado em
sub-projetos, cada um com seu próprio ciclo spec → plano → implementação.

**Este é o primeiro sub-projeto:** introduzir a infraestrutura de menu aninhado
(acordeão) no sidebar, criar o grupo **Cadastros** e **mover "Produtos"** para dentro
dele. Nenhuma tela nova é construída aqui.

### Estado atual (antes)

- Sidebar é uma lista plana de `nav button[data-aba="X"]` em `public/admin.html`.
- Handler em `public/app.js` (~linha 227) liga em **todos** os `nav button`; ao clicar,
  remove `.ativo`/`.ativa`, ativa o botão, mostra a seção `#aba-{dataset.aba}` e chama
  o loader correspondente (`carregarDashboard`, `carregarPdv`, etc.).
- `data-aba` é referenciado em ~15 pontos do `app.js` para navegação programática entre
  telas (ex.: `document.querySelector("nav button[data-aba='caixa']").click()`).
- "Produtos" internamente é `data-aba="cardapio"` (seção `#aba-cardapio`).
- A última aba é persistida em `localStorage` (`ultimaAba`) e reaberta no boot.

## Decisões (confirmadas com o dono)

1. **Padrão do menu:** acordeão no próprio sidebar (expande os filhos ali, um grupo
   aberto por vez). Não é flyout nem página-índice.
2. **Produtos neste passo:** movido como **item único** dentro de Cadastros; a tela de
   Produtos continua exatamente como é hoje (abas internas intactas). O split em
   subtelas fica para um próximo sub-projeto.
3. **Grupos futuros:** exibidos já agora como **"Em breve"** (desabilitados), para dar a
   visão completa do ERP.

## Estrutura do menu (depois)

```
Dashboard
Pedidos
PDV
Mesas
Caixa
Cadastros            ▸  (grupo — expande/recolhe, não é tela)
   Produtos             ← tela atual (data-aba="cardapio"), movida pra cá
   Clientes          Em breve
   Fornecedores      Em breve
Compras              Em breve  (folha desabilitada, sem expandir)
Financeiro           ▸  (grupo)
   Contas a Pagar    Em breve
   Contas a Receber  Em breve
Relatórios           ▸  (grupo)
   Vendas Geral      Em breve
   Vendas por Item   Em breve
   Compras           Em breve
   DRE               Em breve
Configurações
Prévia
Assinatura
```

Racional da ordem: operacional do dia a dia (Dashboard, Pedidos, PDV, Mesas, Caixa) no
topo; grupos de gestão no meio; Configurações/Prévia/Assinatura no fim (como já era).
Produtos permanece aproximadamente na mesma altura de antes.

## Comportamento

- **Grupo (Cadastros / Financeiro / Relatórios):** clicar expande os filhos no sidebar e
  recolhe o grupo que estava aberto (um por vez). Um chevron SVG gira indicando estado.
  Grupo **não troca de tela** — só abre/fecha.
- **Filho de verdade (Produtos):** troca a tela normalmente (fluxo atual, sem mudança).
- **Itens "Em breve":** desabilitados, com selo discreto. Não navegam, não expandem
  (no caso de Compras, que é folha).
- **Boot:** ao recarregar na tela de Produtos (ou qualquer filho ativo), o grupo pai
  **expande automaticamente** para o item ativo nunca ficar escondido dentro de grupo
  fechado.

## Abordagem técnica (baixo risco)

- **Produtos continua `data-aba="cardapio"`** por dentro. A seção `#aba-cardapio` e os
  ~15 pontos que navegam por código seguem funcionando. Muda **só o lugar no HTML** (entra
  no wrapper do grupo) — sem renomear a chave interna (seria churn arriscado, ganho zero).
- **Handler de troca de aba** passa a ligar em `nav button[data-aba]` (hoje `nav button`),
  para que os botões de grupo (sem `data-aba`) não caiam na lógica de abrir tela
  (`$("aba-" + undefined)` quebraria).
- **Handler novo de grupo:** botões `.nav-grupo` ganham um listener próprio que alterna
  `aria-expanded` e a visibilidade do `.nav-sub` (container dos filhos), fechando os
  demais grupos.
- **Persistência:** `localStorage.ultimaAba` continua igual. Adiciona-se só a regra de,
  no boot, expandir o grupo que contém a aba restaurada.
- **Acessibilidade:** `aria-expanded` + `aria-controls` no botão de grupo; `aria-disabled`
  (ou `disabled`) nos "Em breve"; navegação por teclado preservada (são `<button>`); ring
  de foco global já existente.
- **Design:** reusa tokens/estilos do sidebar atual; selo "Em breve" reusa o padrão do
  `.nav-badge`. Segue as skills `regras-design` + `frontend-design` (sem emoji, ícone SVG
  para o chevron, cor sólida da marca). Sem protótipo Stitch (extensão do sidebar
  existente, decisão do dono).

## Arquivos afetados

- `public/admin.html` — remarcação do `<nav>` (grupos + filhos + "Em breve").
- `public/app.js` — troca do seletor do handler de aba + handler de grupo + expandir
  grupo do item ativo no boot.
- `public/style.css` — estilos do grupo/acordeão, chevron e selo "Em breve".

## Fora de escopo (próximos sub-projetos, cada um seu ciclo)

- Dividir Produtos em subtelas: **Categorias**, **Complementos**, **Controle de estoque**,
  **Insumos**.
  - **"Complementos" = os Opcionais de hoje**, que ficam **dentro do cadastro do Item**
    (aba Opcionais do editor: Principal / Composições / Opcionais / Variações). O split
    vai extrair/reaproveitar esses Opcionais. (Não são os "Adicionais".)
- Telas novas: Cadastro de Cliente, Cadastro de Fornecedor, Compras, Financeiro
  (Contas a Pagar / a Receber), Relatórios (Vendas Geral, Vendas por Item, Compras, DRE).

## Critério de pronto

- Sidebar mostra a estrutura acima; Cadastros expande e revela Produtos.
- Clicar em Produtos abre a tela atual sem regressão; toda navegação programática por
  `data-aba` segue funcionando.
- Itens "Em breve" aparecem desabilitados e não navegam.
- Boot na tela de Produtos abre o grupo Cadastros automaticamente.
- `npm run check` + suíte de testes passam (mudança é de front; sem teste de UI
  automatizado → validação visual no harness, declarando o que foi conferido).

# Interface administrativa de Insumos

## Contrato de entrada

O desenho aprovado determina:

- trocar o item “Insumos” hoje desabilitado por navegação `data-aba`;
- criar uma aba com topo, filtros, grade de cards e gaveta lateral;
- manter a gaveta fora da `<section class="aba">`;
- adicionar uma quarta aba “Ficha técnica” ao editor do produto;
- adicionar ficha na edição de opção dos dois tipos de grupo;
- mostrar produtos que saem na cozinha e ainda não têm ficha.

As fontes atuais são o item “Insumos” marcado “Em breve” (`public/admin.html:75-82`), a seção de estoque (`public/admin.html:1376-1431`), as gavetas de grupo e estoque (`public/admin.html:1437-1565`) e o editor com três abas (`public/admin.html:1767-1880`).

## Contrato de saída

A aba deve exibir insumos cadastrados e abrir uma gaveta de edição. A ficha deve persistir no produto ou na opção correspondente. O formato visual detalhado e os retornos de cada ação são NÃO DOCUMENTADO.

## Limites e cotas

O painel atual tem três abas no editor de produto (`public/admin.html:1767-1770`); a feature aprovada acrescenta uma quarta. Quantidade máxima de cards, linhas por ficha e paginação da lista de insumos são NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

O padrão existente separa bloqueio de plano, conteúdo, carregamento e erro, e usa gaveta com `role="dialog"`, `aria-modal="true"`, título associado e botão de fechar nomeado (`public/admin.html:1386-1400,1437-1444,1491-1499`). Mensagens específicas para falha de cadastro, conflito de nome, arquivamento ou salvamento da ficha são NÃO DOCUMENTADO.

## Riscos para a nossa implementação

Colocar a gaveta dentro da aba faz o diálogo desaparecer quando outra seção fica inativa. Reutilizar o estoque próprio do produto junto com uma ficha cria duas fontes de verdade. Mostrar a aba de ficha para produto com variações contradiz a decisão aprovada de ocultá-la com motivo. Alterar a UI sem protótipo deixa decisões ainda abertas para a execução.

## Fonte

`public/admin.html`, `public/app.js` e `docs/superpowers/specs/2026-08-16-insumos-design.md` — acessados em 2026-09-13

# Interface de Mesas / Comandas

## Contrato de entrada

`carregarMesas()` consulta primeiro `/api/caixa` e depois `/api/mesas`. O estado local guarda a lista de mesas, a seleção, o detalhe, o carrinho, o modo, o tamanho dos cards, o alerta de parada e o estado de caixa vencido (`public/app.js:7480-7532`).

## Contrato de saída

A tela renderiza uma grade de botões por mesa, resumo por status e valor aberto. O clique chama `GET /api/mesas/:id` e abre um drawer com itens, totais, abas e ações. O modo de lançamento reaproveita o PDV e volta à mesma mesa após enviar a rodada (`public/app.js:7534-7614`; `public/app.js:7640-8158`).

## Limites e cotas

- Tamanho do card varia de 80 a 180 px, em passos de 10 (`public/admin.html:1175-1178`).
- A interface precisa funcionar com o drawer existente e os overlays reconhecidos por `public/a11y.js` (`docs/design-system.md:276`).
- O projeto exige responsividade até 360 px, foco visível, alvos de 44 por 44 px e estados de carregamento, vazio, erro e sucesso (`regras-design`, seção 8).

## Erros conhecidos e tratamento

Plano sem acesso, caixa fechado, caixa vencido e erro de rede possuem estados separados. No `catch` de `carregarMesas`, o front ainda mostra o bloco de caixa fechado, apesar da mensagem de conexão (`public/app.js:7497-7532`).

## Riscos para a nossa implementação

O drawer e todas as funções usam o shape de Mesa. Uma Comanda precisa de discriminador de tipo e caminho de detalhe próprio para não chamar rotas `/api/mesas/:id`. Misturar cards sem hierarquia também pode dificultar distinguir mesa física de conta avulsa.

## Fonte

`public/admin.html:1108-1260`, `public/app.js:7480-8158`, `public/style.css:5984-6412`, `docs/design-system.md:273-276` — acessado em 2026-11-11

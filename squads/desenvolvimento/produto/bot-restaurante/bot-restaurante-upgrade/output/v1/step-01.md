# Diagnóstico — Bot Restaurante Upgrade
**Analista:** Giovana Ramos | **Data:** 05/06/2026

---

## Resumo Executivo

O projeto tem uma base técnica sólida e bem organizada, mas sofre de feedback visual fraco no painel (o operador frequentemente não sabe se uma ação funcionou), ausência de auto-refresh nos pedidos (crítico para operação em tempo real) e mensagens do bot com tom robótico e duplicações de código que dificultam manutenção. O redesign dark resolve problemas estruturais de hierarquia visual e modernização da interface.

---

## Painel Administrativo

### P0 — Crítico

- **Sem auto-refresh na aba de Pedidos** (`app.js:300-338`): A lista de pedidos só recarrega ao clicar em "Atualizar" ou ao trocar de aba. Em um restaurante real, pedidos chegam continuamente — sem polling automático o operador perde pedidos em andamento. Impacto: pedidos ignorados, clientes sem atendimento.

- **Diálogos de confirmação nativos** (`app.js:90, 183`): Exclusão de categoria e desconexão do bot usam `window.confirm()` nativo do browser — feio, sem customização e quebra completamente o flow visual do painel.

- **Feedback de save invisível** (`app.js:357`, `style.css:285`): O `flash()` exibe texto `.aviso` verde por 4 segundos sem animação, sem posicionamento destacado. Em telas com scroll o operador não vê a confirmação.

### P1 — Importante

- **Falta indicador de status do atendimento no header** (`admin.html:13-16`): O operador não sabe se o bot está aceitando pedidos (aberto/fechado) sem ir na aba de Configurações. Isso é informação crítica de operação que deveria estar sempre visível.

- **Cabeçalhos de tabela e categorias do cardápio usam amarelo** (`style.css:305, 472`): A cor `var(--amarelo)` para `th` e `.categoria-cabeca` é inconsistente com o restante da paleta — sobra do design original sem refinamento.

- **Inline styles no HTML** (`admin.html:61, 71`): `style="margin-top:12px"` espalhado viola o padrão de usar classes CSS. Dificulta manutenção.

- **Tabela de pedidos com 7 colunas sem responsividade adequada** (`app.js:314`): Em telas menores a tabela estoura horizontalmente sem coluna prioritária definida.

- **Botões de ação da conexão usam `onclick` inline** (`app.js:63, 70, 75`): Inconsistente com o restante do código que usa `addEventListener`.

### P2 — Desejável

- Sem paginação ou busca na tabela de pedidos (vai se tornar necessário com volume maior).
- Nav poderia ter badge de contador nos pedidos novos.
- Título da página (`<title>`) não muda conforme a aba ativa.
- A barra de salvar sticky tem fundo semi-transparente mas sem borda superior clara no tema atual.

---

## Bot WhatsApp

### P0 — Crítico

- **Mensagem de finalização duplicada 3 vezes** (`fluxo.js:183, 372, 379`): `"Ótimo! Vamos finalizar. 📝\n\nQual o seu *nome*?"` está hardcoded idêntica em `irParaBebidaOuNome()`, no `case "PERGUNTA_BEBIDA"` e no `case "BEBIDAS"`. Qualquer alteração exige editar 3 locais — e já divergiram em outros projetos deste tipo.

- **Erros com tom brusco e técnico**: 
  - `"Item indisponível ou inválido ❌. Digite o número de um item do cardápio ou *0* para voltar."` — longo, técnico, sem empatia.
  - `"Opção inválida.\n\n"` — completamente genérico.
  - `"Por favor, digite um nome válido."` — sem contexto (o que é inválido?).

- **Pergunta de observação sem contexto do item** (`fluxo.js:164`): `"Alguma *observação*?"` não menciona para qual item é a observação. Com múltiplos itens no carrinho, o cliente perde o contexto.

### P1 — Importante

- **Mensagem de boas-vindas não informa horário** (`config.json:14`): O `boasVindas` não usa `{horario}`, então o cliente não sabe o horário ao entrar. Só descobre quando o bot está fechado.

- **Carrinho cancelado sem transição suave** (`fluxo.js:358, 468`): Tanto o cancel na revisão quanto na confirmação final vão direto para `menuPrincipal()` sem uma mensagem de recuperação ("Quando quiser começar um novo pedido, é só chamar!").

- **Pergunta de bebida sem contexto** (`fluxo.js:180`): `"Deseja adicionar uma *bebida*? 🥤"` aparece abruptamente após finalizar o pedido, sem nenhuma menção ao resumo do pedido atual. O cliente pode estar confuso sobre em que etapa está.

- **Confirmação final não mostra o nome do restaurante** (`fluxo.js:193`): A tela de confirmação mostra pedido completo mas não identifica o restaurante. Falta de branding na etapa mais importante.

- **Tipo Retirada não informa o endereço do restaurante** (`fluxo.js:424`): Quando o cliente escolhe retirada, o bot não informa onde fica o restaurante.

### P2 — Desejável

- Sem mensagem intermediária quando a sessão de 30 min expira (o cliente recebe o menu sem avisar que o pedido foi perdido).
- O cardápio textual no bot poderia ter visual mais hierarquizado entre categorias.
- Não há mensagem de confirmação de recebimento do endereço antes de pedir o pagamento.

---

## Top 5 Recomendações (maior impacto)

1. **Auto-refresh na aba de Pedidos** — Polling a cada 15s enquanto a aba está ativa. Operação crítica.
2. **Sistema de toast visual** — Substituir o `flash()` por um toast animado com posicionamento fixo no canto da tela.
3. **Extrair mensagem de finalização para constante** em `fluxo.js` — elimina 3 duplicações e facilita customização futura.
4. **Indicador de status (aberto/fechado) no header do painel** — Toggle visível sem precisar ir nas configurações.
5. **Redesign completo da paleta para dark** — Remove inconsistências de amarelo, moderniza a hierarquia visual e melhora legibilidade em ambientes de restaurante (telas brilhantes em cozinhas escuras).

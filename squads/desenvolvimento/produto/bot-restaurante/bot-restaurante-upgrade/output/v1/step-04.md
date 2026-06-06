# Mensagens Melhoradas — Bot WhatsApp
**Conversacional:** Marcos Viana | **Data:** 05/06/2026

## Mudanças em fluxo.js

### 1. Mensagem de finalização — eliminada duplicação (3→1)

**ANTES:** String hardcoded idêntica em 3 locais
```
"Ótimo! Vamos finalizar. 📝\n\nQual o seu *nome*?"
```

**DEPOIS:** Constante `MSG_PEDIR_NOME` usada nos 3 locais
```
"Quase lá! 🎉 Para finalizar, qual é o seu *nome*?"
```
MOTIVO: Tom mais animado, elimina duplicação de código.

---

### 2. perguntaObservacao() — agora contextualiza o item

**ANTES:** `"Alguma *observação*? (ex: _sem cebola_, _bem passado_)\n\nDigite a observação ou *0* para pular."`

**DEPOIS:** `"Alguma *observação* para o *{nomeItem}*? (ex: _sem cebola_, _bem passado_)\n\nDigite ou *0* para pular."`

MOTIVO: Cliente com múltiplos itens sabe para qual item está dando a observação.

---

### 3. Pergunta de bebida — mostra resumo do pedido

**ANTES:** `"Deseja adicionar uma *bebida*? 🥤\n\n*1* — Sim\n*2* — Não"`

**DEPOIS:** `{resumo do carrinho}\n\nGostaria de adicionar uma *bebida* ao pedido? 🥤\n\n*1* — Sim, quero!\n*2* — Não, pode seguir`

MOTIVO: Contextualiza o cliente na etapa do pedido. Opções mais naturais.

---

### 4. Saudação de cancelamento — mais cordial

**ANTES:** `"Pedido cancelado. Quando quiser, é só mandar *oi* 😉"`

**DEPOIS:** `"Tudo bem! Seu pedido foi cancelado. 😊\n\nQuando quiser recomeçar, é só mandar *oi*."`

MOTIVO: Tom menos brusco. "Tudo bem!" acolhe a decisão do cliente.

---

### 5. Erro de opção inválida no menu — menos robótico

**ANTES:** `"Não entendi 🤔. Digite *1* ou *2*.\n\n" + menuPrincipal()`

**DEPOIS:** `"Não entendi. 😅 Por favor, escolha uma das opções abaixo:\n\n" + menuPrincipal()`

MOTIVO: Tom mais gentil. "abaixo" indica que as opções seguem.

---

### 6. Item não encontrado — mais amigável

**ANTES:** `"Item indisponível ou inválido ❌. Digite o número de um item do cardápio ou *0* para voltar."`

**DEPOIS:** `"Ops, não encontrei esse item. 🤔 Digite o *número* de um dos itens da lista ou *0* para voltar."`

MOTIVO: Mais curto, mais humano. "número" em negrito guia o olhar.

---

### 7. Pedido cancelado na revisão/confirmação — com recuperação

**ANTES:** `"Pedido cancelado. 🗑️\n\n" + menuPrincipal()`

**DEPOIS:** `"Pedido cancelado. 🗑️\n\nSempre que quiser recomeçar, é só escolher uma opção:\n\n" + menuPrincipal()`

MOTIVO: Transição suave. Convida a refazer o pedido sem pressão.

---

### 8. FIN_NOME — mais pessoal

**ANTES:** `"Obrigado, *{msg}*! Como vai ser?\n\n*1* — 🛵 Entrega (delivery)\n*2* — 🏃 Retirada no balcão"`

**DEPOIS:** `"Prazer, *{msg}*! 😊 Como prefere receber seu pedido?\n\n*1* — 🛵 Entrega no endereço\n*2* — 🏃 Retirada no balcão"`

MOTIVO: "Prazer" é mais natural. "Como prefere" é mais gentil. Labels mais claras.

---

### 9. Retirada no balcão — agora informa o endereço

**ANTES:** `[vai direto para formaPagamento()]`

**DEPOIS:** `"Ótimo, retirada no balcão! 🏃\n\n📍 Estamos em: *{endereço do restaurante}*\n\n" + formaPagamento()`

MOTIVO: Elimina o P1 do diagnóstico. Cliente sabe onde buscar o pedido.

---

### 10. FIN_ENDERECO — confirmação do recebimento

**ANTES:** `[vai direto para formaPagamento()]`

**DEPOIS:** `"Endereço anotado! 📝\n\n" + formaPagamento()`

MOTIVO: Micro-confirmação deixa o cliente seguro que o endereço foi recebido.

---

### 11. Erro nome inválido — com contexto

**ANTES:** `"Por favor, digite um nome válido."`

**DEPOIS:** `"Por favor, informe seu nome completo (pelo menos 2 letras)."`

MOTIVO: Explica o que é "válido" — o cliente sabe o que está errado.

---

## config.json — Sugestão de mensagem padrão atualizada

### boasVindas (sugestão para o painel)
**ANTES:** `"Olá! 👋 Bem-vindo(a) ao *{restaurante}*.\n\nComo posso ajudar? Digite o número da opção:"`

**SUGESTÃO:** `"Olá! 👋 Bem-vindo(a) ao *{restaurante}*!\n\nFuncionamos *{horario}*.\n\nO que vamos fazer hoje?"`

MOTIVO: Inclui o horário na boas-vindas, elimina o P1 do diagnóstico. (Editável pelo operador no painel.)

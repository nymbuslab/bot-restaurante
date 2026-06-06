# Progresso do Projeto

> Detalhes de arquitetura e stack ficam em `CLAUDE.md`. Aqui entram apenas etapas: fazendo, próximos passos e concluído.

## 🔄 Em Andamento

**Checkpoint salvo em 2026-06-06**

### Feito nesta sessão
- `data/config.json`: dados reais do restaurante configurados (Sabor D'Casa - Restaurante e Pastelaria)
- `public/admin.html` + `public/app.js`: aba **Simulador** adicionada ao painel — permite testar o fluxo do bot direto no navegador, sem precisar do terminal
- `public/admin.html`: cabeçalho atualizado com badge de status do atendimento
- `src/fluxo.js`: ajustes pontuais (observação recebe nome do item; tela de bebida exibe resumo do carrinho antes da pergunta)

### Próximo passo
- Testar o fluxo completo pelo Simulador no painel e validar os ajustes das últimas sessões em ambiente real (WhatsApp)

### Decisões pendentes
- Taxa de entrega hoje é única (valor fixo). O P1 do roadmap prevê taxa por bairro — discutir quando for implementar

## 📋 Próximos Passos

- [ ] (P0) Notificação para cozinha/atendente quando chega pedido novo
- [ ] (P1) Botões de status do pedido no painel (preparando / entregue)
- [ ] (P1) Taxa de entrega configurável por bairro
- [ ] (P2) Migração do store.js / pedidos.js para MySQL (sem alterar fluxo.js)

## ✅ Concluído

- [x] Estrutura base do bot (whatsapp-web.js + Express)
- [x] Máquina de estados do atendimento (fluxo.js) — cardápio → opcionais → finalização
- [x] Painel web administrativo (login, cardápio, configurações, conexão, pedidos)
- [x] store.js com recarga ao vivo (mudanças no painel valem sem reiniciar o bot)
- [x] Documentação de deploy (README.md + DEPLOY.md com PM2 e VPS)

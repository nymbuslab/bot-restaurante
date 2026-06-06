# Roadmap

Direção do produto. O que está planejado, por prioridade.

## Visão

Plataforma SaaS multi-tenant para restaurantes receberem pedidos via WhatsApp.
O bot é a **porta de entrada** — coleta o pedido completo (itens, opcionais, entrega, pagamento)
e registra. O ciclo do pedido (preparo, status, entrega) é gerenciado pelo sistema do restaurante.

## Fora de escopo

- Notificação de pedidos para cozinha via bot — o restaurante usa seu próprio sistema
- Gestão de ciclo do pedido (preparando, saiu para entrega, entregue) pelo bot
- Integração com sistemas de pagamento online (por ora, apenas informa forma de pagamento)

---

## P1 — Próximas funcionalidades prioritárias

- [ ] **Botões de status no painel** — marcar pedido como preparando / entregue / cancelado
- [ ] **Taxa de entrega por bairro/CEP** — tabela de bairros com taxa específica por área
- [ ] **Painel de super-admin** — listar todos os tenants, ver métricas básicas, suspender empresa

## P2 — Melhorias de produto

- [ ] **Pergunta de bebida configurável** — toggle no painel para ativar/desativar (feature já existe no bot)
- [ ] **Observação configurável** — toggle para ativar/desativar pergunta de observação por item (feature já existe)
- [ ] **HTTPS automático** — guia e configuração para produção pública (Nginx + TLS ou Fly.io cert)

## P3 — Ideias futuras (sem compromisso)

- Relatórios de pedidos por período no painel
- Cardápio com imagens dos itens
- Integração com sistemas de PDV / impressora de cupom
- App mobile para o atendente receber pedidos

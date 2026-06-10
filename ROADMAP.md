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
- [ ] **Backup do volume de dados (Fly.io)** — `cardapio.json`, `pedidos.db`, `config.json` e
  sessões de **todos os tenants** vivem só no volume do Fly e **não vão pro git**. Sem backup,
  corrupção ou recriação do volume = perda total dos dados de todos os restaurantes. Definir
  rotina de snapshot periódico **antes de ter clientes pagando** (o Fly oferece snapshots de
  volume; avaliar também export periódico de `data/`). **Crítico para produção.**
- [ ] **Exibição de preço com opcional (bot)** — na mensagem do pedido, mostrar o preço base do item e o subtotal com opcionais separadamente (ex.: `Pastel R$ 15,00` + `Queijo R$ 2,50` → `subtotal R$ 17,50`), em vez de só o valor somado. Hoje a linha exibe só o total e parece que o item custa mais caro. Identificado no redesign; é ajuste de **texto** no `fluxo.js`, não de cálculo — o total final está correto.
- [ ] **Saudação com carrinho aberto (bot)** — se o cliente tem itens no carrinho e manda uma saudação ("oi"/"menu"), perguntar se quer **continuar** o pedido em aberto ou **recomeçar**, em vez de retomar o carrinho antigo silenciosamente. Identificado no redesign (`sessoes.js`/`fluxo.js`).

## P3 — Ideias futuras (sem compromisso)

- **WhatsApp: biblioteca não-oficial → API Oficial (Cloud API)** — hoje roda via **Baileys**
  (não-oficial, WebSocket; substituiu o `whatsapp-web.js`/Chromium por instabilidade — QR
  parava de gerar quando o WhatsApp Web mudava). Baileys é mais leve e estável, **mas continua
  não-oficial** (pode quebrar quando o WhatsApp muda; risco de bloqueio do número). A **Cloud
  API** da Meta é o caminho de produção séria: estável e sem banimento, porém tem **custo por
  conversa**, exige **Meta Business + templates aprovados** e muda o onboarding (cada número
  habilitado na API). **Migrar quando houver tração** (clientes pagando) — é reescrita +
  burocracia, prematuro antes disso.
- Relatórios de pedidos por período no painel
- Cardápio com imagens dos itens — ✅ **concluído** (upload no editor modal + exibição em cards na lista; ver `CHANGELOG.md` v0.4.0)
- Redesign visual completo (Nymbus Lab) — ✅ **concluído**: shell (sidebar/bottom-nav), Pedidos, Cardápio, Conexão, Configurações, Simulador e Login/Cadastro, todos fiéis aos protótipos. Ver `CHANGELOG.md` v0.4.0, v0.7.0 e v0.8.0
- Integração com sistemas de PDV / impressora de cupom
- App mobile para o atendente receber pedidos
- **Limpeza ativa de sessões abandonadas (bot)** — varredura periódica (`setInterval`) removendo sessões expiradas, no lugar da expiração lazy atual (que só limpa quando chega nova mensagem). Relevante só quando o volume de clientes simultâneos justificar — cruza com a nota de RAM por tenant no `PROGRESSO.md`.

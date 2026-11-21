---
doc: product
titulo: Product — Nymbus Pedidos
proposito: Verdade de produto durável para o Impeccable (skill de design). Não decide mundo visual.
manutencao: Atualizar quando usuário, posicionamento, capacidade ou marca mudarem de fato.
relacionados: [CLAUDE.md, PRD.md, ROADMAP.md, docs/design-system.md]
---

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dono ou gerente do restaurante**: não é técnico, configura cardápio, horário, equipe, PDV, mesas e caixa no painel. Quer mudar algo na hora e ver efeito no próximo pedido, sem suporte.
- **Cliente final**: pede pelo WhatsApp e monta o pedido sozinho no cardápio web (`/c/:slug`), sem baixar app. Quer rapidez e saber exatamente o que vem no prato.
- **Operador de balcão e salão** (Plano Completo): vende no PDV, controla mesas e fecha o caixa do dia.
- **Cozinha**: recebe a comanda impressa (Completo) ou consulta o pedido no painel.
- **Equipe com PIN** (em homologação): funcionários autenticam por PIN/dispositivo com permissões por perfil, sob auditoria.

## Product Purpose

Nymbus Pedidos é uma plataforma de **gestão completa para restaurante**: pedidos, PDV, caixa, mesas e cardápio, com painel web por empresa. O WhatsApp é um **canal de entrada de pedido**, não a promessa central do produto (reposicionamento confirmado em 2026-07-30, que substitui a leitura antiga de "SaaS de pedidos no WhatsApp"). Nesse canal, o bot manda o link do cardápio web; o cliente monta o pedido lá (itens, composição, opcionais, variações, observação, entrega, pagamento); o servidor recalcula preço e total a partir do cardápio real (nunca confia no valor que vem do cliente) e o bot confirma. O produto não gerencia o ciclo do pedido depois disso (preparo/despacho/entrega é responsabilidade de sistema externo).

Sucesso para o dono é: parar de digitar cardápio manualmente no WhatsApp, ter autonomia total sobre cardápio/horário/preço sem depender de programador, e — no Plano Completo — operar o salão de ponta a ponta (venda, mesa, caixa, impressão) num único sistema.

## Positioning

**Preço fixo por mês, sem comissão por pedido** — Essencial R$79 e Completo R$99, com 7 dias grátis sem cartão. Isso é o mecanismo que um concorrente não pode copiar sem abandonar o próprio modelo: marketplaces de pedido cobram comissão por venda e ficam com o relacionamento do cliente; sistemas de PDV tradicionais são caros e engessados para restaurante pequeno. A Nymbus cobra o mesmo valor independente do volume vendido, e o cliente final continua sendo do restaurante.

A operação completa do salão (PDV + Mesas + Caixa + impressão térmica automática) no Plano Completo é diferencial secundário: reforça a tese de "um sistema só" contra a fragmentação entre bot de pedido e PDV separado, mas o argumento comercial primário é o preço fixo sem comissão.

## Operating Context

- Cadastro self-service em `/cadastro.html` (wizard de 4 etapas); a empresa nasce com ambiente isolado (cardápio vazio, identidade só com o nome) e já pode operar no mesmo dia.
- Painel web é ferramenta de **uso diário sob pressa** (durante o pico do almoço/jantar), não um relatório que se lê com calma.
- Multi-tenant por **slug**: cada restaurante tem cardápio, config, pedidos e sessão WhatsApp isolados; dono não vê e não afeta dado de outro restaurante.
- Horário de funcionamento configurável; fora do horário o bot responde fechado (o dono pode forçar aberto/fechado).
- No Plano Completo, a operação de salão depende de **caixa aberto do dia** (abrir, receber, sangria/suprimento, fechar por conferência de forma de pagamento) e, para impressão, do app desktop **Nymbus Impressora** (Windows) ligado à térmica 80mm por Rede ou Serial.
- Área de super-admin (`/admin-master`) separada, com login e rotas isoladas: gestão de restaurantes (criar, suspender, excluir), métricas reais e monitoramento de incidentes — nunca a mesma sessão/token do painel do restaurante.

## Capabilities and Constraints

- **App stateless**: nada grava em disco. Tudo vive no Supabase — Postgres (empresas, pedidos, config/cardápio jsonb), Auth (contas), Storage (imagens) e a sessão do WhatsApp (tabela `wa_auth`). Habilita múltiplas instâncias / host efêmero.
- WhatsApp via **Baileys** (biblioteca não-oficial, WebSocket, sem Chromium) — não é a API Oficial do WhatsApp; o bot só responde quem fala com ele primeiro, nunca dispara em massa.
- **Servidor é fonte única de verdade do pedido**: preço e total são sempre recalculados a partir do cardápio real no backend, nunca aceitos do cliente.
- **Isolamento multi-tenant garantido no backend** (por `empresa_id`); RLS no Postgres é defesa em profundidade, não o mecanismo primário.
- Sem comissão por pedido em nenhum plano; cobrança por assinatura fixa via Stripe (checkout próprio, trial de 7 dias sem cartão).
- Front-end **sem framework** (HTML/CSS/JS puros) — decisão deliberada de manter leve e simples.
- **Fora de escopo deliberado**: não é KDS, não gerencia o ciclo de preparo/entrega do pedido, não processa pagamento online do cliente final, não tem app próprio para o cliente, não faz fiado/conta a prazo nem cadastro de cliente no painel (removido em 2026-07-13 por decisão de produto).
- CSP estrita (helmet): nenhum script/handler inline em HTML. Rate limit por `Fly-Client-IP` (nunca `req.ip`, pois a conta é compartilhada entre dispositivos do restaurante).

## Brand Commitments

- Nome do produto: **Nymbus Pedidos**.
- Tema escuro fixo, fonte **Plus Jakarta Sans** (Google Fonts); tokens de cor e forma documentados em `docs/design-system.md` (fonte de verdade visual existente do projeto — não reescrever do zero).
- Roxo (`#6344BC`) como cor de marca (preenchimento), ciano como acento secundário; vermelho/amarelo/verde/azul são sempre semânticos (erro/aviso/sucesso/info), nunca usados como cor de marca.
- Voz de texto e regras anti-"cara de IA" definidas na skill de marca do projeto (`copy-nymbus`): benefício antes de recurso, frase curta, **sem travessão como conector**, sem emoji na UI (ícones SVG de biblioteca).
- Idioma de interface, banco e identificadores de domínio: português (Brasil).
- `/c/:slug` (cardápio do cliente final) troca o ícone da Nymbus pelo logo do restaurante quando cadastrado — ali o cliente está pedindo comida daquele restaurante, não usando "a plataforma".

## Evidence on Hand

- Planos e preço reais: Essencial R$79/mês, Completo R$99/mês, 7 dias grátis sem cartão (fonte: `PRD.md`, `docs/assinatura-stripe.md`).
- Módulos já entregues e em produção: pedidos via cardápio web, cardápio com composição/opcionais/variações/estoque, dashboard de pedidos, PDV, Mesas, Caixa do dia, impressão térmica automática via agente desktop, super-admin, conformidade LGPD (exportar/excluir, retenção, auditoria).
- Equipe/PIN/permissões e o Programa Compras e Custos estão implementados mas **em homologação**, não liberados comercialmente em produção (depende de backup restaurável e piloto) — não tratar como feature geral ainda.
- Nenhum case, depoimento ou benchmark de cliente real está registrado para uso em marketing; **não inventar** testemunhos, números de clientes ou comparativos de concorrente além do que está em `PRD.md`.

## Product Principles

1. O servidor é a única fonte de verdade do pedido — nunca confia no valor ou no cardápio que vem do cliente.
2. Autonomia do dono: cardápio, horário, preço e mensagem mudam sozinhos e valem no próximo pedido, sem reiniciar nada e sem programador.
3. Preço fixo, sem comissão por pedido, em qualquer plano — a cobrança nunca penaliza o volume de vendas do restaurante.
4. WhatsApp é canal de entrada, não o produto — a promessa central é a gestão (pedidos, PDV, caixa, mesas, cardápio), não o bot.
5. Isolamento entre restaurantes é absoluto e garantido no backend, com RLS como camada extra, nunca a única.

## Accessibility & Inclusion

Padrão de contraste AA (4,5:1) é requisito já aplicado nos tokens de cor do projeto — texto/ícone sobre fundo escuro usa a variante clara da cor semântica (ex.: `--accent-fg`, `--error-fg`) em vez do tom cheio, justamente para não cair abaixo de AA. Detalhe completo em `docs/design-system.md`. Nenhum requisito de acessibilidade adicional (leitor de tela, teclado) foi formalmente levantado pelo usuário até agora.

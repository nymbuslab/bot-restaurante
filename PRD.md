# PRD — Bot de Pedidos para Restaurante (WhatsApp)

Documento de requisitos do produto. Versão do produto: 2.x.

## 1. Visão

Oferecer a restaurantes uma forma simples e barata de **receber pedidos pelo
WhatsApp de forma automatizada**, com um painel onde o próprio dono gerencia o
cardápio e as mensagens, sem depender de programador. O bot é a porta de entrada;
o preparo e a entrega seguem no sistema que a empresa já usa.

## 2. Problema

Restaurantes recebem pedidos pelo WhatsApp de forma manual: o atendente digita
cardápio, tira dúvidas, anota item por item. Isso é lento, sujeito a erro e não
escala em horário de pico. Cardápios mudam todo dia (itens acabam, preços mudam),
e soluções prontas costumam ser caras ou engessadas.

## 3. Público-alvo

- **Dono/gerente do restaurante**: usa o painel para configurar cardápio e mensagens.
  Não é técnico. Precisa de algo direto, em português, que mude o cardápio "na hora".
- **Cliente final**: pede pelo WhatsApp. Quer rapidez e saber o que vem no prato.
- **Operador/cozinha**: consulta os pedidos recebidos (hoje, via painel; o andamento
  é feito no sistema próprio da empresa).

## 4. Objetivos

- Receber pedidos completos pelo WhatsApp sem intervenção humana.
- Permitir que o dono edite cardápio/mensagens sozinho, refletindo em tempo real.
- Reduzir erros de pedido (itens, opcionais, observações ficam registrados).
- Custo baixo para começar (biblioteca não-oficial, dados em arquivo).

## 5. Escopo atual (o que o produto FAZ)

### 5.1 Atendimento (bot)
- Menu inicial: ver cardápio, fazer pedido, falar com atendente.
- Montagem do pedido: escolher item, ver composição, escolher **opcionais**
  (com preço somado), adicionar **observação**, definir quantidade.
- Ao finalizar: pergunta "**deseja adicionar bebida?**"; se sim, mostra a lista
  de bebidas; se não, segue para checkout.
- Checkout: nome, tipo (entrega/retirada), endereço (se entrega), pagamento.
- Confirmação com resumo e total; pedido registrado.
- Respeita atendimento aberto/fechado.
- **Só responde a mensagens recebidas após a conexão** (não dispara em massa).

### 5.2 Painel administrativo
- Login por senha.
- **Conexão**: conectar/desconectar do WhatsApp via QR; gerar novo QR (limpar sessão).
- **Cardápio**: CRUD de categorias e itens; preço; ativar/desativar item;
  composição; opcionais. Mudanças valem imediatamente.
- **Configurações**: dados do restaurante, mensagens do bot, abrir/fechar
  atendimento, formas de pagamento.
- **Pedidos**: lista de pedidos recebidos com itens, opcionais, observação, total,
  tipo de entrega e telefone.

## 6. Fora de escopo (o que o produto NÃO faz)

- Não gerencia o ciclo do pedido (preparo, despacho, entrega) — isso é do sistema
  externo da empresa.
- Não processa pagamento online (apenas registra a forma escolhida).
- Não calcula taxa de entrega por região (ainda).
- Não tem app próprio para o cliente; tudo acontece no WhatsApp.
- Não usa a API Oficial do WhatsApp (usa biblioteca não-oficial).

## 7. Requisitos não-funcionais

- **Usabilidade**: painel simples, em português, utilitário (uso diário, com pressa).
- **Tempo real**: edições do cardápio refletem sem reiniciar o bot.
- **Robustez**: conexão manual com timeout e opção de recuperar sessão travada.
- **Portabilidade**: roda em Windows (teste) e Linux/VPS (produção).
- **Segurança (mínima atual)**: senha de painel; recomendado HTTPS em produção.

## 8. Decisões e premissas

- Dados em JSON para simplicidade; caminho de migração para MySQL previsto.
- Bebida e observação são comportamentos automáticos do fluxo (não configuráveis
  hoje) — candidatos a virar configuráveis se houver demanda.
- Bebidas identificadas pela categoria com "bebida" no nome.

## 9. Roadmap / próximos passos (priorizáveis)

- Tornar bebida e observação configuráveis (liga/desliga + texto) no painel.
- Opcionais com regras (ex.: "escolha 1 de 3", "máx. 2").
- Integração com o sistema da empresa (exportar arquivo ou enviar a uma API/banco)
  para eliminar o lançamento manual do pedido.
- Migração para MySQL.
- HTTPS + senha forte para deploy público.
- Taxa de entrega por bairro/CEP.

## 10. Métricas de sucesso (sugestão)

- % de pedidos concluídos pelo bot sem intervenção humana.
- Tempo médio para concluir um pedido pelo WhatsApp.
- Nº de edições de cardápio feitas pelo dono sem suporte técnico.
- Redução de erros de pedido relatados.

# UI.md — Referência de UI (Redesign Nymbus Lab)

Documento que o Claude Code consulta **antes de redesenhar qualquer tela**.

## Princípio

Redesign **fiel aos protótipos** (`design/prototipos/`), em **modo feature** — pode construir
HTML, CSS, JS e rotas novas quando fizer sentido pro produto. A régua:

- **Visual e layout:** igual ao protótipo — cards, modais, hierarquia, capricho. É um produto
  para vender; a aparência importa.
- **Comportamento:** construir função nova quando agrega valor (ex.: foto do cardápio, feita
  na fase do cardápio). **Mas o que o protótipo inventou e o sistema não faz** é decidido caso
  a caso — implementar de verdade, adaptar, ou cortar. **Nunca copiar cego uma promessa que o
  produto não cumpre** (pagamento online, mapa, console de dev, mesa). Cada tela abaixo lista
  esses limites.
- Antes de ligar uma tela, confirmar rotas/dados reais em `src/servidor.js`. Se não houver
  dado/rota por trás: implementar a rota (modo feature) ou adaptar a tela — **nunca exibir
  dado falso/inventado**.

Os protótipos são referência **visual**, não código (o export do Stitch não entra; o stack é
HTML/CSS/JS puro, sem framework).

---

## Cores e tokens

Fonte única dos tokens: seção **Design System** do `CLAUDE.md` / `public/style.css`.
Regras que valem em TODAS as telas:

- **Sem laranja.** Marca = roxo `--accent #6344BC` (preenchimento, texto branco em cima) +
  ciano `--secondary #73D2E6` (acento, links, gradiente).
- **Roxo claro** `--accent-fg #A589EA` para texto/ícone roxo sobre fundo escuro — nunca usar
  `#6344BC` como texto no escuro (perde contraste).
- **Tags de status são semânticas:** Entrega = azul `--info`, Retirada = verde `--success`.
  Não usar roxo/ciano em status.

---

## Navegação (travada em todas as telas)

Exatamente **5 itens, nesta ordem**: **Pedidos · Cardápio · Conexão · Configurações · Simulador**.

- Desktop: sidebar fixa à esquerda; item ativo em roxo (`--accent-fg` + indicador).
- Mobile: bottom-nav com os mesmos 5 itens (rótulos com espaçamento — não colar).
- **Ignorar** os menus inventados nos protótipos ("Dashboard/Inventory/Analytics/Staff",
  "Geral/Vendas/Equipe/Ajustes", "Pedidos/Histórico" duplicado).

---

## Regras globais de cópia e marca

- **pt-BR** em tudo (sem "DELIVERY", "All rights reserved", etc.).
- **Horário em 24h** (`18:00`, `23:30`) — não AM/PM.
- **Um único logo/marca** em todas as telas e um único avatar. **Decisão aberta:** hexágono
  OU garfo-e-faca (trava Login/Cadastro — ver "Decisões abertas").
- Ano correto no rodapé; sem "versão" inventada.
- Avatar de cliente = ícone neutro, nunca foto realista de rosto.
- Conteúdo de exemplo do público real (restaurante popular/marmita), não alta gastronomia.

---

## Telas

> Formato: **Construir** (visual fiel ao protótipo) · **Dados/rotas** (a que se liga) ·
> **Limites de escopo** (o que o protótipo inventou e NÃO entra, ou vira decisão).

### 1. Login
- **Construir:** painel de marca com gradiente roxo->ciano + logo; formulário e-mail/senha,
  "Entrar", links. Responsivo (painel ao lado no desktop, topo no mobile).
- **Dados/rotas:** `POST /api/login { email, senha }` -> `{ token, slug, nome }`; Bearer.
- **Limites:** texto honesto — sem "analytics/performance/IA". Titulo consistente entre
  desktop e mobile. Usar o logo definido.

### 2. Cadastro
- **Construir:** mesmo painel de marca; campos nome do restaurante, e-mail, senha; "Criar conta".
- **Dados/rotas:** onboarding atual (cria empresa + login automatico).
- **Limites:** sem "IA especializada/inteligencia artificial" — nao ha IA. Valor honesto:
  receber pedidos pelo WhatsApp, editar cardapio sozinho, sem programador.

### 3. Pedidos (historico + metricas leves)
- **Construir:** lista cronologica — tabela no desktop, cards no mobile; tag de tipo
  (Entrega azul / Retirada verde); abrir detalhe. Topo com **metricas leves** do periodo:
  total de pedidos, media diaria, ticket medio (**calculo real** a partir de `pedidos.db`,
  nunca numero decorativo). Busca (nome/telefone) e filtro (periodo/tipo).
- **Dados/rotas:** `pedidos.db`. Metricas calculadas sobre o periodo selecionado.
- **Limites:** sem botoes de "status" interno (preparando/entregue) — ciclo do pedido e
  roadmap. A unica acao sobre o pedido e **"Avisar cliente"** (ver tela 4).

### 4. Detalhe do pedido + Avisar cliente
- **Construir:** visao de leitura — itens com opcionais, observacao (amarelo), endereco,
  pagamento, subtotal+taxa+total. Botao **"Avisar cliente"** que ENVIA pelo bot uma mensagem
  de "pedido pronto": entrega -> "saiu para entrega"; retirada -> "pronto para retirar".
  Mensagens **editaveis** pelo dono em Configuracoes. Botao exige WhatsApp **conectado**.
- **Dados/rotas:** pedido salvo; **rota nova** que usa o Client do tenant (`multi-bot.js`)
  para enviar ao telefone do cliente; templates em `config.json`
  (`mensagens.pedidoPronto.entrega` / `.retirada`), com variaveis `{cliente}` e `{numero}`.
- **Limites (sistema NAO faz):** mapa/geolocalizacao e pagamento online -> endereco e
  pagamento em **texto**. Sem acompanhamento de status interno. Envio **MANUAL** (1 clique,
  1 cliente por vez) — nunca automatico nem em massa (risco de bloqueio do numero).

### 5. Cardapio — CONCLUIDO (fase cardapio)
- **Feito:** lista em cards de leitura (foto, nome, preco, toggle, editar/excluir), agrupada
  por categoria com contagem; "editar" abre o modal; estado vazio.
- **Dados:** `cardapio.json` (+ campo `imagem`). Recarga ao vivo mantida.

### 6. Editor de item — CONCLUIDO (fase cardapio)
- **Feito:** modal de criar/editar com upload de foto; construtor visual de **Composicao**
  (subgrupos + chips) e de **Opcionais** (linhas Nome+Preco) que **serializam para o formato
  de texto atual** (`Sub:\n* item`, `Nome | preco`) — `fluxo.js`/bot intactos.
- **Limite mantido:** opcionais com **regras** (obrigatorio/escolha 1) = roadmap, fora daqui.

### 7. Configuracoes
- **Construir:** secoes em cards — status do atendimento (toggle), dados do restaurante,
  mensagens, horarios (7 dias, **24h**; cards por dia no mobile), taxa fixa, formas de
  pagamento (tags). Barra fixa de "alteracoes nao salvas" = feature ok.
- **Dados/rotas:** `config.json` (dados, mensagens, `horarios`, taxa, pagamento,
  `atendimento.aberto`).
- **Limites:** taxa por bairro/CEP = roadmap. Nada alem dos campos do `config.json`.

### 8. Conexao WhatsApp
- **Construir:** fluxo guiado por estados — desconectado ("Conectar ao WhatsApp"), gerando QR,
  QR exibido, conectado (numero + "Desconectar" + "Gerar novo QR/limpar sessao"); passo a
  passo + dica de numero dedicado.
- **Dados/rotas:** `POST /api/bot/conectar` e os estados ja emitidos pela logica atual.
- **Limites:** QR **real preto/branco escaneavel** (nunca decorativo). Sem promessas de
  "alta velocidade/envio instantaneo".

### 9. Simulador
- **Construir:** chat de teste do fluxo — balao do bot a esquerda (neutro), do usuario a
  direita em roxo, campo de digitacao. Desktop = mesmo chat, mais largo.
- **Dados:** usa o fluxo atual (equivalente ao `testar-bot.js` no painel).
- **Limites:** sem console de dev (variaveis de contexto, JSON, latencia, "Conectar API",
  "Status da Entrega") — o usuario e dono de restaurante.

---

## Status e ordem

- **Fase cardapio (telas 5 e 6):** tokens da marca + nav + foto + modal + construtores +
  cards. (Em finalizacao: ver `PROGRESSO.md`.)
- **Proximo:** Pedidos + detalhe -> Configuracoes -> Conexao -> Simulador -> Login + Cadastro.

Cada tela segue o workflow: investigar -> plano -> aprovacao -> implementar -> validacao
visual -> commit (Conventional Commits pt-BR, sem acento no titulo).

## Decisoes abertas

- **Logo:** hexagono OU garfo-e-faca (trava Login/Cadastro).
- **Pedidos:** historico puro (so "X no periodo") OU com metricas leves (media diaria, ticket
  medio). Atual: historico puro.

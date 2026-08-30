# UI.md — Referência de UI (Redesign Nymbus Pedidos)

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

Os protótipos são referência **visual**, não código. Desde 30/08/2026 eles são feitos no
**Claude Design** (skill `design`) e ficam em `design/canvas/`, semeados com os tokens reais de
`public/style.css`. Mesmo assim o `.dc.html` não vira arquivo do produto: o stack é HTML/CSS/JS
puro, sem framework, e a implementação segue o design system, não o export.

---

## Cores e tokens

Fonte única dos tokens: [docs/design-system.md](../docs/design-system.md) / `public/style.css`.
Regras que valem em TODAS as telas:

- **Sem laranja.** Marca = roxo `--accent #6344BC` (preenchimento, texto branco em cima) +
  ciano `--secondary #73D2E6` (acento, links, gradiente).
- **Roxo claro** `--accent-fg #A589EA` para texto/ícone roxo sobre fundo escuro — nunca usar
  `#6344BC` como texto no escuro (perde contraste).
- **Tags de status são semânticas:** Entrega = azul `--info`, Retirada = verde `--success`.
  Não usar roxo/ciano em status.

---

## Navegação (estado atual)

O painel cresceu além do redesign inicial. Hoje a navegação desktop é por sidebar com itens reais do
produto: **Dashboard**, **Pedidos**, **PDV**, **Mesas**, **Caixa**, **Cadastros/Produtos**
(Categorias, Complementos, Controle de estoque e Insumos em construção), **Configurações**,
**Prévia** e **Assinatura**. Itens planejados como Clientes, Fornecedores, Financeiro e Relatórios
podem aparecer bloqueados/desabilitados até existirem de verdade.

- Desktop: sidebar fixa à esquerda; item ativo em roxo (`--accent-fg` + indicador).
- Mobile: bottom-nav de atalhos para o uso diário (**Dashboard**, **Pedidos**, **PDV**, **Caixa**)
  mais **Menu** para o restante.
- Protótipo visual é referência de layout; menu só entra se houver rota/dado real.

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
- **Dados/rotas:** `POST /api/login { email, senha }` cria sessão Supabase, devolve access token
  Bearer e usa refresh cookie `httpOnly`.
- **Limites:** texto honesto — sem "analytics/performance/IA". Titulo consistente entre
  desktop e mobile. Usar o logo definido.

### 2. Cadastro
- **Construir:** mesmo painel de marca; campos nome do restaurante, e-mail, senha; "Criar conta".
- **Dados/rotas:** onboarding atual (cria empresa + login automatico).
- **Limites:** sem "IA especializada/inteligencia artificial" — nao ha IA. Valor honesto:
  receber pedidos pelo WhatsApp, editar cardapio sozinho, sem programador.

### 3. Pedidos (historico + metricas leves) — CONCLUIDO
- **Construir:** lista cronologica — tabela no desktop, cards no mobile; tag de tipo
  (Entrega azul / Retirada verde); abrir detalhe. Topo com **metricas leves** do periodo:
  total de pedidos, media diaria, ticket medio (**calculo real** a partir do Postgres),
  nunca numero decorativo). Busca (nome/telefone) e filtro (periodo/tipo).
- **Dados/rotas:** tabela `pedidos`. Metricas calculadas sobre o periodo selecionado.
- **Limites:** sem botoes de "status" interno (preparando/entregue) — ciclo do pedido e
  roadmap. A unica acao sobre o pedido e **"Avisar cliente"** (ver tela 4).

### 4. Detalhe do pedido + Avisar cliente — CONCLUIDO
- **Construir:** visao de leitura — itens com opcionais, observacao (amarelo), endereco,
  pagamento, subtotal+taxa+total. Botao **"Avisar cliente"** que ENVIA pelo bot uma mensagem
  de "pedido pronto": entrega -> "saiu para entrega"; retirada -> "pronto para retirar".
  Mensagens **editaveis** pelo dono em Configuracoes. Botao exige WhatsApp **conectado**.
- **Dados/rotas:** pedido salvo; rota que usa o socket do tenant (`multi-bot.js`)
  para enviar ao telefone do cliente; templates em `empresas.config`
  (`mensagens.pedidoPronto.entrega` / `.retirada`), com variaveis `{cliente}` e `{numero}`.
- **Limites (sistema NAO faz):** mapa/geolocalizacao e pagamento online -> endereco e
  pagamento em **texto**. Sem acompanhamento de status interno. Envio **MANUAL** (1 clique,
  1 cliente por vez) — nunca automatico nem em massa (risco de bloqueio do numero).

### 5. Cardapio — CONCLUIDO (fase cardapio)
- **Feito:** lista em cards de leitura (foto, nome, preco, toggle, editar/excluir), agrupada
  por categoria com contagem; "editar" abre o modal; estado vazio.
- **Dados:** `empresas.cardapio` (jsonb) + imagens no Supabase Storage. Recarga ao vivo mantida.

### 6. Editor de item — CONCLUIDO (fase cardapio)
- **Feito:** modal de criar/editar com upload de foto, variações com preço/estoque próprios e
  vínculos com a **biblioteca de complementos**. A regra efetiva fica no vínculo do produto; os
  campos antigos `composicao`/`opcionais` não são mais lidos e são apagados ao salvar.
- **Limite mantido:** ficha técnica/baixa de insumos ainda está em construção no Split Produtos 4/4.

### 7. Configuracoes — CONCLUIDO
- **Construir:** secoes em cards — status do atendimento (toggle), dados do restaurante,
  mensagens, horarios (7 dias, **24h**; cards por dia no mobile), taxa fixa, formas de
  pagamento (tags). Barra fixa de "alteracoes nao salvas" = feature ok.
- **Dados/rotas:** `empresas.config` (dados, mensagens, `horarios`, frete, pagamento,
  `atendimento.aberto`, identidade visual e impressora).
- **Limites:** não exibir configuração que não tenha persistência real no `config` jsonb ou rota própria.

### 8. Conexao WhatsApp — CONCLUIDO
- **Construir:** fluxo guiado por estados — desconectado ("Conectar ao WhatsApp"), gerando QR,
  QR exibido, conectado (numero + "Desconectar" + "Gerar novo QR/limpar sessao"); passo a
  passo + dica de numero dedicado.
- **Dados/rotas:** `POST /api/bot/conectar` e os estados ja emitidos pela logica atual.
- **Limites:** QR **real preto/branco escaneavel** (nunca decorativo). Sem promessas de
  "alta velocidade/envio instantaneo".

### 9. Prévia do atendimento — CONCLUIDO
- **Construir:** chat de teste do fluxo — balao do bot a esquerda (neutro), do usuario a
  direita em roxo, campo de digitacao. Desktop = mesmo chat, mais largo. Painel lateral
  "Estado da conversa" mostra so a etapa (Menu/Atendente) — o pedido e feito no cardapio web.
- **Dados:** usa o fluxo atual (equivalente ao `testar-bot.js` no painel).
- **Limites:** sem console de dev (variaveis de contexto, JSON, latencia, "Conectar API",
  "Status da Entrega") — o usuario e dono de restaurante.

### 10. Controle de estoque — CONCLUIDO (Plano Completo)
- **Feito:** Cadastros → Produtos → Controle de estoque. Faixa de tres contadores que tambem
  filtram (Esgotados, Abaixo do minimo, Controlados), busca e chips (So controlados / Todos /
  Esgotados / Baixo). Lista com **uma linha por SALDO**, nao por produto: item com variacoes vira
  linha-mae sem numero ("3 tamanhos") e cada tamanho entra recuado com barra a esquerda. Produto
  sem controle aparece apagado, com o botao **Controlar**. Gaveta do produto (componente `.gaveta`
  unico do painel) com saldo em destaque + selo, minimo editavel, os tres lancamentos, resumo dos
  ultimos 30 dias e extrato paginado por cursor.
- **Regra que a tela precisa dizer:** Entrada **soma**, Perda **subtrai** (trava em zero) e
  Contagem **substitui** o saldo pelo contado. Os tres mostram o resultado antes de gravar
  ("Voce tem 4. Vai ficar com 14."), e o botao do lancamento aberto fica preenchido.
- **Dados/rotas:** `GET/POST /api/estoque*` no gate `exigePdv`; saldo no jsonb do cardapio e
  trilha em `estoque_movimentos`. Detalhe em `docs/modelo-dados.md`.
- **Limites (nao construir aqui):** extrato **geral** do restaurante (o extrato e por produto),
  contagem em lote para inventario, compra/fornecedor (entrada e um numero com observacao, nao um
  documento), alerta ativo por e-mail/WhatsApp, e estoque por opcao de complemento (fica com
  Insumos, etapa 4/4). Quantidade **nao e dinheiro**: sem mascara monetaria, `Estoque.formatarQtd`.
- **No celular:** as tres acoes saem da linha e ficam na gaveta, que ocupa a tela inteira.

---

## Status e ordem

**Redesign base concluido; referência viva para telas novas:** shell, Login, Cadastro, Pedidos,
Detalhe do pedido, Cardapio, Editor de item, Configuracoes, Conexao e Simulador nasceram do ciclo
v0.4.0/v0.7.0/v0.8.0. Depois disso o produto ganhou Dashboard, PDV, Mesas, Caixa, Assinatura,
Master e Estoque; para telas novas, combine esta referência visual com
[docs/design-system.md](../docs/design-system.md) e com o estado real em `CLAUDE.md`/`PROGRESSO.md`.

Cada tela seguiu o workflow: investigar -> plano -> aprovacao -> implementar -> validacao
visual -> commit (Conventional Commits pt-BR, sem acento no titulo).

## Decisoes (resolvidas)

- **Logo:** garfo-e-faca SVG — aplicado no Login/Cadastro e na marca do painel.
- **Pedidos:** com **metricas leves reais** (total de pedidos, media diaria, ticket medio +
  comparativo vs periodo anterior) calculadas sobre o Postgres — nao e historico puro.

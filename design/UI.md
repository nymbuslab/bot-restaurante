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

Os protótipos são referência **visual**, não código. A ferramenta atual é o
**Google Stitch**, semeado com os tokens reais de `public/style.css`.
Projeto `7236747227852373120`, design system `6506830711685967852` (Nymbus Pedidos).
Exports antigos do Claude Design em `design/canvas/` são histórico; não viram
código do produto. O stack continua HTML/CSS/JS puro, sem framework.
As aprovações atuais de Equipe e Compras/Financeiro estão em
`docs/estoque-e-custos/prototipos/`.

### Equipe e Atividades — homologação da Sprint 03

Equipe usa lista/busca/filtros, editor em gaveta, perfis/ajustes, dispositivos e
seleção por PIN. Atividades é somente leitura: evento, operador e datas, lista
por cursor e detalhe em `dialog` nativo. Preservar os estados carregando, vazio,
erro com tentativa novamente e sucesso, os tokens existentes e alvos de 44 px.
Revogação bloqueia o operador e orienta nova autorização pelo dono; nunca usa o
refresh do dono como fallback. Detalhe permite Escape e devolve foco ao gatilho.
Validação real em 1280/375 px; evidências e limites em [docs/equipe.md](../docs/equipe.md).
Esta homologação não significa ativação em produção.

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
**Prévia**, **Assinatura** e o acordeão **Relatórios** (com o item real **Estoque** — extrato
geral, ver tela 12 — ao lado de Vendas Geral/Vendas por Item/Compras/DRE, ainda "Em breve").
Itens planejados como Clientes, Fornecedores e Financeiro podem aparecer bloqueados/
desabilitados até existirem de verdade.

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
- **Limites (nao construir aqui):** contagem em lote para inventario, compra/fornecedor (entrada e
  um numero com observacao, nao um documento), alerta ativo por e-mail/WhatsApp, e estoque por
  opcao de complemento (fica com Insumos, etapa 4/4). Quantidade **nao e dinheiro**: sem mascara
  monetaria, `Estoque.formatarQtd`. O extrato **geral** do restaurante (todos os produtos juntos)
  deixou de ser limite — ver tela 12.
- **No celular:** as tres acoes saem da linha e ficam na gaveta, que ocupa a tela inteira.

### 11. Comanda no PDV — CONCLUIDO (Plano Completo)
- **Feito (desenho aprovado pelo dono em 12/09, revisao do portao de design):** o tipo de venda e
  escolhido num **seletor na lateral do carrinho** (`[Balcão] [Comanda] [Entrega]`, `#pdvTipo`) ANTES
  do Cobrar — o modal "Finalizar venda" **nao repete os tiles**, so monta o bloco do tipo escolhido.
  **Retirada nao existe no PDV** (segue no cardapio web e no historico) e o campo "Cliente (opcional)"
  saiu da lateral (nome so na Entrega, via overlay). Nos modos Mesa e Acrescentar a Comanda o seletor
  some (`#pdvTipoBloco[hidden]`) e volta ao sair.
- **Comanda:** o pedido nasce **a receber** (sem bloco de pagamento) com o botao "Abrir Comanda"; ao
  reabrir pelo **Acrescentar item** do modal do pedido, o cabecalho da aba muda e o site entra no modo
  "Acrescentando à Comanda #NN" (banner com o mesmo visual do modo mesa; Cobrar vira "Acrescentar à
  Comanda").
- **Identificacao da comanda (12/09, sugestao do dono):** o modal da Comanda traz o campo opcional
  **"Identificação (opcional)"** (`#pdvComandaId`, placeholder "Nome, mesa ou referência"), gravado em
  `pedidos.cliente` — e o que preenche o campo **Cliente** do pedido na aba Pedidos. O banner do modo
  acrescimo mostra "Acrescentando à Comanda #NN · <identificação>" quando ela existe.
- **Fluxo:** reabrir pelo pedido na aba Pedidos (botao **Acrescentar item**, vale para qualquer pedido
  a receber, nao so Comanda), montar a rodada e acrescentar; a cozinha recebe so a via nova. Fechamento
  pelo **Receber pagamento** de sempre.
- **Dados/rotas:** `POST /api/pedidos/:id/itens` (`acrescentarItens` em `src/pedidos.js`, UPDATE com
  `FOR UPDATE`); tipo gravado em `tipo_entrega`; sem cupom na abertura (via so de cozinha).
- **Limites:** a comanda abre e reabre pelo fluxo existente (modal do pedido), sem tela propria de
  comandas em aberto; abrir uma de cada vez (como o modo mesa); cancelar item ja enviado a cozinha
  pede confirmacao extra. Prototipo da revisao em `design/canvas/pdv-comanda.dc.html`.
- **No celular:** os mesmos componentes do PDV; o banner e o botao seguem o modal em tela cheia.

### 12. Relatórios → Estoque (extrato geral) — CONCLUIDO (Plano Completo)
- **Feito:** acordeão **Relatórios** no sidebar (ao lado de Financeiro), com o item real
  **Estoque** ao lado dos placeholders "Em breve" (Vendas Geral, Vendas por Item, Compras, DRE).
  A tela mostra TODOS os movimentos de estoque do restaurante juntos (nao um produto so): chips
  de tipo em multi-selecao (Entrada/Perda/Contagem/Ajuste marcados por padrao; Venda/Devolucao
  fora por padrao — ja tem visao propria em Pedidos) e chips de periodo (Hoje/7 dias/
  Personalizado, revela De/Ate). Lista reaproveita o layout de linha da gaveta de Controle de
  estoque (tipo + nome do produto, delta colorido, saldo depois, observacao) com "Carregar mais"
  por cursor.
- **Dados/rotas:** `GET /api/estoque/geral` no gate `exigePdv` + `exigePermissao("estoque.ver")`;
  le `estoque_movimentos` sem filtro de produto (`listarGeral` em `src/estoque-db.js`). Detalhe em
  `docs/sprintx/features/extrato-geral-estoque/`.
- **Limites (nao construir aqui):** sem busca por nome de produto (quem quer um produto so usa a
  gaveta de Controle de estoque); sem teto de dias no periodo customizado (so cursor).
- **No celular:** chips quebram linha, campos De/Ate empilham, lista e "Carregar mais" iguais ao
  desktop.

---

## Status e ordem

**Redesign base concluido; referência viva para telas novas:** shell, Login, Cadastro, Pedidos,
Detalhe do pedido, Cardapio, Editor de item, Configuracoes, Conexao e Simulador nasceram do ciclo
v0.4.0/v0.7.0/v0.8.0. Depois disso o produto ganhou Dashboard, PDV, Mesas, Caixa, Assinatura,
Master, Estoque e Relatórios → Estoque (extrato geral); para telas novas, combine esta referência visual com
[docs/design-system.md](../docs/design-system.md) e com o estado real em `CLAUDE.md`/`PROGRESSO.md`.

Cada tela seguiu o workflow: investigar -> plano -> aprovacao -> implementar -> validacao
visual -> commit (Conventional Commits pt-BR, sem acento no titulo).

## Decisoes (resolvidas)

- **Logo:** garfo-e-faca SVG — aplicado no Login/Cadastro e na marca do painel.
- **Pedidos:** com **metricas leves reais** (total de pedidos, media diaria, ticket medio +
  comparativo vs periodo anterior) calculadas sobre o Postgres — nao e historico puro.

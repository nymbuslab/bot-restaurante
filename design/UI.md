# UI.md — Referência de UI (Reskin Nymbus Lab)

Documento que o Claude Code consulta **antes de redesenhar qualquer tela**.

## Princípio inegociável

Isto é um **reskin visual**, não uma fase de features. A UI segue o que o sistema
**já faz** — banco, `config.json`, `cardapio.json`, `pedidos.db` e as rotas em
`src/servidor.js`. **Não inventar feature nem endpoint.** Antes de ligar qualquer
tela, confirmar os nomes reais de rota em `src/servidor.js`; se algo da tela não
tem rota/dado por trás, **não construir** — perguntar.

Os protótipos em `design/prototipos/` são **referência visual**, não código. O export
do Stitch não entra no projeto (stack é HTML/CSS/JS puro, sem framework).

---

## Cores e tokens

Fonte única dos tokens: seção **Design System** do `CLAUDE.md` / `public/style.css`.
Regras que valem em TODAS as telas:

- **Sem laranja.** A marca não usa mais `#F97316`. Onde sobrou laranja nos protótipos
  (tag Retirada, tag "Opcional", ícone de velocidade), trocar.
- **Roxo de preenchimento** `--accent #6344BC` (botão, estado ativo, foco) com texto branco.
- **Roxo claro** `--accent-fg #A589EA` para **texto/ícone roxo sobre fundo escuro**
  (aba ativa, links roxos) — nunca usar `#6344BC` como texto no escuro (perde contraste).
- **Ciano** `--secondary #73D2E6` como acento secundário, links e gradiente de marca.
  Como preenchimento, exige texto escuro `#0F1117`.
- **Tags de status são semânticas, não de marca:** Entrega = azul `--info`,
  Retirada = verde `--success`. Não usar roxo/ciano em status.

---

## Navegação (travada em todas as telas)

Exatamente **5 itens, nesta ordem**: **Pedidos · Cardápio · Conexão · Configurações · Simulador**.

- Desktop: sidebar fixa à esquerda; item ativo em roxo (`--accent-fg` no rótulo + indicador).
- Mobile: bottom-nav com os mesmos 5 itens (rótulos com espaçamento — não colar).
- **Ignorar** os menus que o protótipo inventou: "Dashboard/Inventory/Analytics/Staff",
  "Geral/Vendas/Equipe/Ajustes", e a duplicação "Pedidos/Histórico".

---

## Regras globais de cópia e marca

- Idioma **pt-BR** em tudo. Eliminar inglês solto ("DELIVERY" → "Entrega",
  "All rights reserved", etc.).
- **Horário em 24h** (`18:00`, `23:30`) — não AM/PM.
- **Um único logo/marca** em todas as telas (decidir: hexágono OU garfo-e-faca) e um
  único tratamento de avatar.
- Ano correto no rodapé; **sem** "versão" inventada (ex.: remover "VER 2.4.0").
- Avatar de cliente = **ícone neutro**, nunca foto realista de rosto.
- Conteúdo de exemplo representativo do público (restaurante popular/marmita), não alta
  gastronomia.

---

## Telas

### 1. Login
- **Ref:** `login-desktop.png`, `login-mobile.png`
- **Manter:** `POST /api/login { email, senha }` → `{ token, slug, nome }`; token em
  `Authorization: Bearer`. Painel de marca com gradiente roxo→ciano.
- **NÃO construir:** promessa de "analytics/performance" no texto — o produto recebe
  pedidos pelo WhatsApp. Manter título único ("Entrar"/"Boas-vindas") consistente com o mobile.

### 2. Cadastro
- **Ref:** `cadastro-desktop.png`, `cadastro-mobile.png`
- **Manter:** onboarding existente (cria empresa via `public/cadastro.html` + rota atual);
  login automático após criar. Campos: nome do restaurante, e-mail, senha.
- **NÃO construir:** "IA Especializada", "inteligência artificial de ponta" — não há IA
  (é máquina de estados). Proposta de valor honesta: receber pedidos pelo WhatsApp,
  editar cardápio sozinho, sem programador.

### 3. Pedidos (histórico de consulta)
- **Ref:** `pedidos-desktop.png`, `pedidos-mobile.png`
- **Manter:** leitura de `pedidos.db` (colunas: numero, cliente, telefone, tipoEntrega,
  total, criadoEm, ...). Lista cronológica, busca (nome/telefone), filtros período + tipo.
  Topo no máximo com **"X pedidos no período"**. Tag tipo: Entrega azul / Retirada verde.
- **NÃO construir:** dashboard de analytics (média diária, ticket médio, "+12%",
  "mais pedido"). É **histórico**, não painel operacional. Sem botões de mudar status.

### 4. Detalhe do pedido
- **Ref:** `pedido-detalhe-desktop.png`, `pedido-detalhe-mobile.png`
- **Manter:** somente leitura. Itens com opcionais e observação (destaque amarelo),
  endereço em **texto**, forma de pagamento em **texto**, subtotal + taxa + total.
  Atalho "WhatsApp" via `wa.me/<telefone>`.
- **NÃO construir:** **mapa/geolocalização** (não existe), **pagamento online / gateway**
  (o produto só informa a forma; não processa). Sem status operacional ("Ativo",
  "Pedido Finalizado"), sem "Imprimir comprovante" por enquanto.

### 5. Cardápio
- **Ref:** `cardapio-desktop.png`, `cardapio-mobile.png`
- **Manter:** `cardapio.json` (itens: id, nome, preco, desc, disponivel, composicao,
  opcionais). Agrupar por categoria; toggle `disponivel` (roxo); editar/excluir;
  "Adicionar item" e "Nova categoria". Recarga ao vivo (já existe).
- **NÃO construir:** **foto do prato** (roadmap P3 — desenhar card com espaço previsto,
  mas sem upload agora), tempo de preparo, kcal, contadores de analytics.

### 6. Editor de item
- **Ref:** `item-editor-desktop.png`, `item-editor-mobile.png` — **maior ganho do reskin**
- **Manter:** editar nome, preco, desc, categoria, toggle disponivel.
  - **Composição** = construtor visual (subgrupo nomeado + ingredientes), mas que **serializa
    para o formato de texto atual** que o `fluxo.js` parseia (`Sub:\n* item`).
  - **Opcionais** = linhas estruturadas Nome + Preço, que serializam para o formato atual
    (`Nome | preco`).
  - A UI é estruturada; o que vai pro JSON é o **mesmo texto de hoje**.
- **NÃO construir:** opcionais com grupos/regras (obrigatório/opcional, "escolha 1 de 3").
  Isso é feature de roadmap (muda banco e fluxo do bot). Ignorar o que o mobile mostrou nesse ponto.

### 7. Configurações
- **Ref:** `config-desktop.png`, `config-mobile.png`
- **Manter:** `config.json` — dados do restaurante; mensagens (`boas-vindas`, `fechado`);
  `horarios` por dia `{ abre, fecha, fechado }` em **24h**; taxa de entrega fixa;
  formas de pagamento (tags); toggle `atendimento.aberto`. Barra fixa de "alterações não
  salvas" (manter — ficou boa). Mobile: horários viram cards por dia.
- **NÃO construir:** taxa por bairro/CEP (roadmap), nada além dos campos do `config.json`.

### 8. Conexão WhatsApp
- **Ref:** `conexao-desktop.png`, `conexao-mobile.png`
- **Manter:** fluxo guiado por estados — desconectado (botão "Conectar ao WhatsApp" →
  `POST /api/bot/conectar`), gerando QR (spinner), QR exibido, conectado (número +
  "Desconectar" + "Gerar novo QR / limpar sessão"). Passo a passo + dica de número dedicado.
- **NÃO construir:** **QR decorativo** — o QR precisa ser **preto/branco real e escaneável**
  (padrão do mobile). Sem promessas de "envio instantâneo/alta velocidade".

### 9. Simulador
- **Ref:** `simulador-desktop.png`, `simulador-mobile.png`
- **Manter:** **chat simples** de teste do fluxo (equivalente ao `testar-bot.js` no painel):
  balões do bot à esquerda (superfície neutra), do usuário à direita em roxo, campo de
  digitação. Desktop = mesmo chat, só mais largo.
- **NÃO construir:** console de dev (variáveis de contexto, JSON de resposta, latência,
  "Conectar API", "Status da Entrega"). O usuário é dono de restaurante, não programador.

---

## Ordem de execução sugerida

1. Editor de item (maior valor, protótipo mais fiel)
2. Cardápio
3. Pedidos + detalhe
4. Configurações
5. Conexão
6. Simulador
7. Login + Cadastro

Cada tela segue o workflow do projeto: investigar → plano → aprovação → implementar →
validação visual → commit.

# Spec — Planos (Essencial × Completo) + Frete por raio

> **Status:** ✅ **implementado e no ar** (Partes 1–4, 2026-06-19; CHANGELOG 0.27.0). Este documento é o
> **contrato**; o guia genérico de frete por raio está em
> [frete-por-raio-cep-viacep-geoapify.md](frete-por-raio-cep-viacep-geoapify.md) (referência),
> mas aqui valem as decisões **adaptadas ao projeto** (config em jsonb, etc.).

## Objetivo

Introduzir **dois planos pagos** com features diferentes e um **frete por raio** (distância por
CEP/geocodificação) como diferencial do plano superior:

- **Plano Essencial — R$ 79/mês** (`price_1Tjpqo2OKIQsz5AIqYw0XpcZ`, `prod_UjIR38QCFMhn9E`):
  tudo que existe hoje + **frete fixo** (taxa única de entrega).
- **Plano Completo — R$ 99/mês** (`price_1TjpvO2OKIQsz5AIRKGUWHmQ`, `prod_UjIWmF1mLorw5s`):
  tudo do Essencial + **frete por raio** (faixas por km via Geoapify).

Decisões de produto (já tomadas):

1. O restaurante chega ao Completo de **duas formas**: escolhendo no **cadastro** e/ou fazendo
   **upgrade/downgrade** na aba Assinatura.
2. No Completo, o frete por raio é uma **opção** que o restaurante liga (pode continuar no fixo).
3. **Fora da área de entrega** → avisa e **oferece retirada** se o restaurante aceitar; senão
   bloqueia a finalização por entrega.
4. Geoapify free tier; chave em secret (`GEOAPIFY_API_KEY`), nunca no frontend.

## Modelo de planos (fundação)

- **Env:** `STRIPE_PRICE_ID` (Essencial, já existe) + **`STRIPE_PRICE_ID_COMPLETO`** (novo).
- **`src/stripe.js`:** mapa `PLANOS = { [STRIPE_PRICE_ID]: "essencial", [STRIPE_PRICE_ID_COMPLETO]:
  "completo" }` + `planoDoPrice(priceId)` → `"essencial" | "completo" | null`. `CONFIGURADO`
  segue baseado no preço do Essencial.
- **Coluna nova `plano`** em `empresas` (`text not null default 'essencial'`).
  `aplicarSubscription()` lê o preço da assinatura (`sub.items.data[0].price.id`) →
  `planoDoPrice` → grava via `atualizarAssinatura({ plano })`. Cortesia / sem assinatura =
  `essencial`.
- **Porteiro de features** em `src/empresas.js`:
  - `planoDe(emp)` → `emp.plano || "essencial"`.
  - `temFreteRaio(emp)` → `acessoLiberado(emp) && planoDe(emp) === "completo"`.
  - **Toda** decisão de feature por plano passa por `temFreteRaio` (fonte única).
- **Nome/valor do plano dinâmicos:** um mapa único `PLANO_INFO = { essencial: { nome: "Plano
  Essencial", valorMes: 79 }, completo: { nome: "Plano Completo", valorMes: 99 } }`.
  `GET /api/assinatura` passa a devolver `plano`, `planoNome`, `valorMes`. O painel
  ([admin.html](../public/admin.html) `#assinPlanoNome`) e o checkout ([checkout.html](../public/checkout.html))
  deixam de ter o nome **fixo** e passam a refletir o plano real.

## Modelo de dados

### `empresas`
- `+ plano text not null default 'essencial'` (migration).

### `config` (jsonb) — novo bloco `frete`
```jsonc
config.frete = {
  modo: "fixo" | "raio",          // default "fixo"
  taxaFixa: 0,                    // R$ (migra de config.taxaEntrega)
  raio: {
    enderecoBase: "",            // endereço da empresa usado p/ geocodificar (detecta mudança)
    coordEmpresa: { lat, lng } | null,
    faixas: [ { ini: 0, fim: 2, valor: 5 }, ... ],   // km; ordenadas; sem sobreposição
    foraDaArea: "retirada" | "bloqueia"   // default "retirada"
  }
}
```
- **Compat:** se existir `config.taxaEntrega` e não houver `config.frete`, ler como
  `{ modo: "fixo", taxaFixa: taxaEntrega }`. Normalizador único (`freteDeConfig(config)`) usado
  por servidor e checkout; ao salvar, grava o formato novo (mantém `taxaEntrega` espelhado p/ não
  quebrar leitura antiga durante a transição).

### Cache de geocodificação — tabela nova `geo_cache`
```sql
create table geo_cache (
  endereco_norm text primary key,   -- endereço completo normalizado (lower/trim)
  lat double precision not null,
  lon double precision not null,
  criado_em timestamptz not null default now()
);
```
Mesmo padrão **cache-first** do `src/cep.js` (só grava sucesso). RLS: `revoke` de
anon/authenticated (igual às demais).

### `pedidos` — frete salvo no pedido
Persistir **no momento da finalização** (regra do doc: pedido antigo mantém o frete da época):
`valorFrete`, `distanciaKm` (quando raio) e o **endereço estruturado** de entrega
(`cep, logradouro, numero, complemento, bairro, cidade, uf`). Implementação concreta (colunas
novas vs. dentro do jsonb do pedido) decidida na Parte 3, seguindo o que `src/pedidos.js` já usa.

## Parte 1 — Infra de planos

**Entrega:** migration `plano` + mapa de preços/`planoDoPrice` + `aplicarSubscription` grava o
plano + helpers `planoDe`/`temFreteRaio` + `PLANO_INFO` + `GET /api/assinatura` devolve
plano/nome/valor + painel/checkout exibem o nome **dinâmico**.

**Validação:** testes puros (`planoDoPrice`, normalizador) + carga do servidor + conferir no
banco que um tenant em cada preço resolve o plano certo. Sem mudança visível além do nome correto.

## Parte 2 — Aba "Entrega" (Configurações)

- 3ª subaba em Configurações (ao lado de Empresa e Bot), sem mexer no menu lateral.
- **Move o frete fixo** (`taxaEntrega`) de "Entrega e Pagamento" (subaba Bot) para cá.
  Pagamento (formas de pagamento) **continua** na subaba Bot.
- Topo: seletor **Modo de frete**:
  - **Fixo** (todos os planos) → campo de taxa única (`dinheiro.js`).
  - **Por raio** → habilitado só com `temFreteRaio`; pro Essencial aparece **com cadeado**
    ("Disponível no Plano Completo" + atalho pra aba Assinatura — gancho de upsell).
- Persistência pela rota de config já existente (`PUT /api/config`), gravando `config.frete`.

**Validação:** Playwright (troca de subaba; Essencial vê cadeado; salvar taxa fixa persiste).

## Parte 3 — Frete por raio (Completo)

- **Secret:** `GEOAPIFY_API_KEY` no Fly (setado nesta fase). Chave validada em 2026-06-19.
- **Módulo novo `src/frete.js`:**
  - `calcularDistanciaKm(lat1,lon1,lat2,lon2)` — Haversine, **puro/testável**.
  - `encontrarFaixa(distKm, faixas)` → faixa correspondente ou `null`, **puro/testável**.
  - `geocodificar(enderecoCompleto)` → Geoapify (`/v1/geocode/search`, `limit=1`, UTF-8),
    **cache-first** em `geo_cache`. Erros viram `null` (front trata).
  - `montarEnderecoCompleto({logradouro,numero,bairro,cidade,uf})`.
- **Geocodificação da empresa (1x):** ao salvar a aba Entrega em modo raio, geocodifica o endereço
  da empresa e grava `coordEmpresa` + `enderecoBase`. Regeocodifica se `enderecoBase` mudar.
  Falha → não liga o raio e avisa o restaurante (precisa endereço completo com número).
- **Endpoints (públicos, rate-limited como as demais `/api/c`):**
  - `POST /api/c/:slug/frete { cep, numero, complemento }` → ViaCEP (`cep.js`) preenche →
    geocodifica cliente → Haversine vs `coordEmpresa` → `encontrarFaixa` →
    `{ entrega_disponivel, distancia_km, valor_frete, mensagem, endereco }`.
  - `GET /api/c/:slug` (projeção) ganha `frete: { modo, taxaFixa?(fixo), aceitaRetirada }`.
    **Não** expõe faixas nem `coordEmpresa`.
  - `POST /api/c/:slug/pedido`: no modo raio + entrega, o **servidor recalcula** o frete a partir
    do endereço (cache barato) — **não confia** no valor do cliente — e **salva no pedido** valor +
    distância + endereço. Modo fixo usa `taxaFixa`.
- **Checkout (`public/cardapio.js`):** no modo raio, pede **CEP + número**, chama `/frete`, mostra
  "Entrega disponível. ~X km. Frete R$ Y" **ou** "fora da área" → **oferece retirada** se
  `aceitaRetirada`, senão bloqueia finalizar por entrega. Modo fixo: fluxo atual intacto.

**Validações obrigatórias** (do doc): CEP 8 dígitos; número obrigatório; empresa precisa de
coordenadas + ≥1 faixa ativa; geocode falho → erro amigável; distância sem faixa → fora da área;
chave nunca no frontend; evitar chamadas repetidas (cache).

**Validação:** testes puros (Haversine com casos conhecidos; `encontrarFaixa` bordas) + Playwright
no checkout (dentro do raio, fora→retirada, CEP inválido) + smoke real de geocode.

## Parte 4 — Escolher / assinar o Completo

- **Cadastro (wizard):** seletor de plano (Essencial/Completo) na etapa de conta/plano; o trial
  nasce no **preço escolhido**. `ativarAssinaturaComSetup` passa a aceitar o `plano`/preço (hoje
  usa `PRICE_ID` fixo). Landing ([index.html](../public/index.html)) mostra os **2 planos**.
- **Aba Assinatura — trocar de plano:** botão upgrade/downgrade →
  `stripe.subscriptions.update(subId, { items:[{ id, price }], proration_behavior:
  "create_prorations" })` (nova função `trocarPlano` no `stripe.js`). Rota `POST
  /api/assinatura/plano { plano }` (auth). O webhook (`customer.subscription.updated`) atualiza a
  coluna `plano`. UI confirma a troca explicando o ajuste proporcional.

**Validação:** E2E contra o Stripe de teste (criar no Essencial → upgrade p/ Completo → conferir
item de preço trocado + proration; downgrade de volta) + cadastro escolhendo Completo.

## Variáveis de ambiente (novas)

- `STRIPE_PRICE_ID_COMPLETO` — preço do Plano Completo (Fly secret).
- `GEOAPIFY_API_KEY` — chave de geocodificação (Fly secret; nunca no front).

## Tratamento de erros / bordas

- Geoapify fora do ar / sem resultado → frete indisponível com mensagem amigável; não derruba o
  checkout. Restaurante sem `coordEmpresa` ou sem faixas → modo raio se comporta como "configuração
  incompleta" (avisa o restaurante; pro cliente, cai em retirada/bloqueio conforme `foraDaArea`).
- Downgrade Completo→Essencial com frete por raio ligado: o modo volta a "fixo" no efeito (o
  `temFreteRaio` passa a `false`); a config de raio fica guardada, mas não é aplicada.
- Proration do Stripe: validar faturas no ambiente de teste antes de produção.

## Fora de escopo (futuro)

- Distância por **rota real** (Geoapify Routing / OSRM) — v1 é Haversine (linha reta).
- 3º plano / add-ons.
- Frete por raio no **bot** (o canal de pedido é o cardápio web; o bot só manda o link).

## Ordem de construção (cada fase = entregável + validável + checkpoint de aprovação)

1. **Parte 1** — infra de planos (fundação; nada quebra, nome do plano fica dinâmico).
2. **Parte 2** — aba Entrega + mover frete fixo (com cadeado pro raio).
3. **Parte 3** — frete por raio (Geoapify) ligado pro Completo.
4. **Parte 4** — seleção no cadastro + upgrade/downgrade na Assinatura.

Ao final de cada fase: `npm run check` + `npm test`, atualizar `CHANGELOG.md` e `PROGRESSO.md`,
commit + push, e aprovação antes da fase seguinte.

---

## 2º benefício do Completo — Impressão de pedido na térmica (80mm)

> ✅ **implementado** (CHANGELOG 0.29.0; serial/COM em 0.40.0; corte Daruma + cupom marketing em 0.43.0).
> Spec/plano: `docs/superpowers/specs/2026-06-20-impressao-termica-design.md` e
> `docs/superpowers/plans/2026-06-20-impressao-termica.md`.

Além do frete por raio, o **Plano Completo** libera a **impressão de pedido** numa impressora
térmica 80mm não-fiscal (Elgin i7/i8, Epson T20x, **Daruma DR700/DR800** e similares).

- **Dois caminhos** (escolhidos em **Configurações → Impressora**):
  - **Navegador (USB/driver)** — padrão: `window.print()` + CSS `@page { size: 80mm auto }`, sem
    agente local. Largura amarrada ao físico via `font-size: 2.5mm` (≈ 48 colunas, sem quebra).
  - **Porta serial (COM)** — imprime **direto na térmica, sem caixa de diálogo**: encoder **ESC/POS
    puro** (`public/serial-escpos.js`: init + codepage CP850 + avanço + corte) sobre a **Web Serial
    API** (`public/serial.js`: conectar/lembrar a porta/escrever). O roteamento (serial quando
    configurado/suportado; senão navegador) fica em `public/impressao.js`; a montagem do texto é
    pura/testada (`public/comanda.js`).
- **Corte do papel (serial):** usa o comando **legado Epson** — `ESC m` (parcial/picote, **padrão**) /
  `ESC i` (total) — **nativo na linha Daruma (DR700/DR800)** e aceito pela maioria das térmicas (o
  `GS V` novo era ignorado por elas e o papel não cortava). Avança **6 linhas** antes do corte pra
  empurrar o fim do cupom pra fora da guilhotina. Opção "Não cortar" também disponível.
- **Disparo:** botão **Imprimir comanda** no modal de detalhe do pedido **e** no modal de novo
  pedido abre um **modal de pré-visualização** com as **2 vias** e os botões **Imprimir cozinha**
  (itens/opcionais/observações, **sem preços**) e **Imprimir cupom** (cliente, endereço, pagamento,
  total). Cada via é **uma impressão própria** → corta no fim de cada.
- **Cupom (marketing):** o cupom traz **cabeçalho** com nome/endereço/telefone da empresa (CEP e
  telefone na mesma linha; data `dd/mm/aaaa - HH:MM`) e **rodapé** com mensagem **personalizável**
  (`config.impressao.rodape`; vazio = padrão "Obrigado pela preferência! Volte sempre.") + chamada
  pro **cardápio digital** (link público do tenant). A via **cozinha** segue enxuta.
- **Config por tenant:** `config.impressao` (jsonb, via `PUT /api/config`, sem migração):
  `{ metodo: "navegador"|"serial", baud, corte: "parcial"|"total"|"nenhum", semAcento, rodape }`.
- **Gating:** front, por `planoAtual === "completo"` (impressão é ação **local**). Essencial vê a
  sub-aba **Configurações → Impressora** com cadeado/upsell. Manual completo (USB × serial, corte,
  conectar COM, *kiosk-printing*) na **Central de Ajuda (FAQ)** do painel.

### Impressão silenciosa/automática (opcional) — Chrome em *kiosk-printing*

Por padrão a impressão abre a caixa de diálogo do navegador (a impressora é escolhida na 1ª vez e
fica lembrada). Para o pedido sair **direto na térmica, sem diálogo** (útil num PC dedicado na
cozinha), inicie o Chrome com a flag:

```text
chrome.exe --kiosk-printing
```

(defina a térmica como **impressora padrão** do Windows; opcionalmente adicione `--kiosk` para tela
cheia). Nesse modo, ao clicar **Imprimir cozinha**/**Imprimir cupom** a via sai na hora, sem caixa de
diálogo. Sem a flag, segue funcionando no modo manual (uma caixa de impressão por via).

### Fora do v1 (futuro)

- ESC/POS **por porta serial (COM) já implementado** (ver acima). Falta: impressão **disparada pelo
  servidor sem o painel aberto** (agente local tipo QZ Tray) e abertura de gaveta.
- Auto-impressão ao chegar o pedido; largura 58mm; escolher quais vias; KDS (tela de cozinha).

---

## 3º benefício do Completo — Caixa do dia / fechamento

> ✅ **implementado** (CHANGELOG 0.30.0; evoluído na 0.33.0). Specs/planos em `docs/superpowers/`.

Aba **Caixa** no painel (Plano Completo) para controlar o dinheiro do dia, reconciliando os pedidos
que vêm do WhatsApp.

- **Recebimento acontece no Pedido** (não no Caixa): o pedido nasce **"a receber"**
  (`pedidos.recebido_em` null) e o operador marca **Receber pagamento** no **modal de detalhe do
  pedido** (exige caixa aberto; cria o movimento de recebimento no caixa). A aba **Pedidos** mostra um
  **selo** "A receber"/"Recebido" + **filtro** por pagamento (só no Completo) pra achar os pendentes.
- **Abertura:** informa **operador** (pré-preenchido com o nome do painel, editável), **saldo inicial**
  (fundo de troco) e **observações** (`caixas.operador`/`obs_abertura`).
- **Tela do caixa aberto (estilo PDV):** **Total em Caixa** em destaque (= saldo + suprimentos +
  vendas − sangrias), cards **Vendas por forma** (todas as formas configuradas, zeradas se sem venda;
  subtotal cartão/Pix + dinheiro) e **Movimentação do caixa** (valor inicial, suprimentos, sangrias +
  box **Total Faturamento**), e o **extrato do turno** em tabela (Hora/Nº/Tipo/Cliente/Valor/Forma;
  sangria destacada; **Estornar** nos recebimentos). Ações: **sangria/suprimento** (com motivo),
  **Caixas anteriores** e **Fechar caixa**.
- **Fechamento = conferência:** tela com **contador de 12 cédulas/moedas** (R$200→R$0,05) para o
  dinheiro + **lançamentos de cartão/Pix** por forma, com **diferença** (sobra/falta) por coluna (digitar
  valor + **Enter** lança e mantém o foco). Ao fechar, **monta o relatório 80mm no servidor** (fonte
  única; vendas por forma, movimentos, Total em Caixa, Faturamento, diferença global) e abre a **prévia
  para imprimir** (guardado em `detalhe_fechamento` p/ reimpressão).
- **Regra:** **não fecha com pedidos do turno (criados desde a abertura) ainda a receber** — avisa,
  bloqueia e oferece atalho pra aba Pedidos filtrada em "A receber" (guarda no servidor).
- **Caixas anteriores:** os **3 últimos** fechamentos com resumo na linha (operador · Total em Caixa ·
  Fechado · diferença), clicável p/ **reabrir o relatório** (toggle).
- **Regras gerais:** **1 caixa aberto por vez** (índice único parcial `caixas_um_aberto_por_empresa`);
  receber/estornar exigem caixa aberto; **1 operador** (a conta do tenant); sangria/suprimento imutáveis.
- **Gate:** `empresas.temCaixa(emp)` (= acesso liberado + plano completo) no front (cadeado/upsell) e no
  backend (403); o gate do front decide pela **resposta da API** (evita cadeado falso na navegação inicial).
- **Dados:** tabelas `caixas` (+ `operador`, `obs_abertura`, `contado_eletronico`, `detalhe_fechamento`
  jsonb) e `caixa_movimentos` (`recebimento|sangria|suprimento`) + coluna `pedidos.recebido_em`. Puros em
  `src/caixa-calc.js` e `public/relatorio-caixa.js`; orquestração em `src/caixa.js`. Migrations
  `20260620120000`/`20260620130000`/`20260620140000`.

## PDV — vendas no local (Plano Completo)

Aba **PDV** no painel (gate `temPdv`, front+back) para registrar venda de balcão. **Exige caixa
aberto** (senão mostra "Abra o caixa para vender"). Fluxo: grade de produtos (chips de categoria +
busca) → toque adiciona ao carrinho; itens com **opcionais** ou por **kg** abrem um mini-modal
(peso/adicionais/observação). Botão **Cobrar** → tela de pagamento com **tipo de venda** (Balcão/Entrega/Retirada),
**desconto** (R$ ou %), **pagamento dividido** (várias formas, soma = total), **troco** (dinheiro) e
**CPF na nota** (opcional).

**Entrega no PDV:** escolhendo **Entrega**, um botão abre o overlay de endereço (CEP autopreenche
logradouro/bairro/cidade/UF via `window.EnderecoCep`; número, complemento, telefone). O **frete** é
**calculado pelo servidor** (`POST /api/pdv/frete`, autenticada: fixo = `taxaFixa` da config; raio =
geocode + Haversine + faixa) e entra como linha **Frete** no RESUMO (`Total = Subtotal − Desconto +
Frete`), com **lixeira** para zerar (cortesia). "Fora da área" não bloqueia — vira cortesia (0).
**Retirada** = sem endereço/frete (telefone opcional). O servidor é a fonte de verdade do frete:
aceita do cliente **apenas** 0 (cortesia) ou o valor calculado (`pdv.freteEfetivo`).

Ao finalizar (`POST /api/pdv/vender`): o servidor **recalcula** a venda pelo cardápio (`src/pdv.js`,
fonte de verdade — nunca confia no preço do cliente), resolve o frete e `caixa.venderLocal` grava numa
transação o **pedido** (tipo Balcão/Entrega/Retirada, `endereco`/`telefone`/`taxa_entrega`, já
`recebido_em`) + **1 movimento de recebimento por forma** no caixa, depois dá **baixa de estoque**. A
venda aparece em **Pedidos** (selo do tipo/Recebido) e no **Caixa** (Vendas por forma). A confirmação
é **silenciosa** — o pedido fica na aba **Pedidos** para conferência e **reimpressão** (botão
"Imprimir comanda"; a comanda já imprime tipo + endereço + taxa); o PDV **não** abre modal de
impressão ao finalizar. Cliente é opcional (padrão "Balcão"). Layout otimizado para toque (carrinho vira folha no
mobile). Coluna `pedidos.desconto` (migration `20260624140000`); puros em `src/pdv.js`
(`test/pdv.test.js`); tela em `public/app.js` (`carregarPdv`/`renderPdv*`).

### Fora do v1 do caixa/PDV (futuro)

- Mesas / comanda aberta (fiado) e venda presencial **sem** caixa aberto; **item avulso** (fora do cardápio).
- **Formas de pagamento detalhadas + taxa** (Crédito/Débito/PIX maquininha/conta; recebimento líquido) — ROADMAP P3.
- **Conferência cega, justificativa de diferença, limite de gaveta, comprovante de sangria/suprimento,
  tolerância de divergência, múltiplos operadores/permissões** — gaps de mercado mapeados no ROADMAP P3.
- Gaveta física, corte ESC/POS fino, TEF — dependem do **agente local** (ver ROADMAP).

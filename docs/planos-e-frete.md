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

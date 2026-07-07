# Spec — Frete por bairro (Plano Completo)

> **Status:** 📝 desenho aprovado (2026-07-07). Aguarda plano de implementação.
> Contexto de frete no projeto: [docs/planos-e-frete.md](../../planos-e-frete.md) (frete fixo × raio, já no ar).

## Objetivo

Adicionar uma **3ª modalidade de frete** ao Plano Completo: **frete por bairro**. O restaurante
cadastra bairros com **valor fixo por bairro**; quando o cliente informa o endereço e o bairro
**casa** com um cadastrado, esse frete é aplicado. Se **nenhum** bairro corresponder, segue a
**mesma política de "fora da área"** já existente no frete por raio (oferecer retirada **ou**
bloquear a entrega).

A modalidade vale **nos dois canais de entrega**: **cardápio web** (`/c/:slug`) e **PDV** (venda no
balcão em modo Entrega). O **bot não** entra no escopo (ele só manda o link do cardápio).

## Decisões de produto (tomadas no brainstorming)

1. **Identificação do bairro: automática pelo endereço.** O bairro vem do endereço informado
   (autopreenchido pelo CEP via ViaCEP **ou** digitado/corrigido pelo cliente no campo de bairro,
   que já existe no checkout e no PDV). Não há dropdown de seleção de bairro.
2. **Tolerância do match: exato normalizado.** Casa apenas se o nome for igual após normalização
   (minúsculas + remoção de acento + colapso de espaços + trim). Sem match por "contém"/fuzzy.
3. **Fora da área:** quando nenhum bairro casa, reusa `foraDaArea` (`retirada` | `bloqueia`) — mesma
   semântica e mesmo controle de UI do frete por raio (ver imagem de referência do seletor "Quando o
   cliente está fora da área de entrega").
4. **Gating:** feature exclusiva do **Plano Completo** (mesmo gate do frete por raio).
5. **Sem Geoapify.** Bairro é lookup nome→valor; não geocodifica, não depende de
   `GEOAPIFY_API_KEY`.

## Modelo de dados

Sem migração de banco — `config` é jsonb. `config.frete.modo` passa a aceitar um 3º valor.

```jsonc
config.frete = {
  modo: "fixo" | "raio" | "bairro",   // default "fixo"
  taxaFixa: 0,                        // usado no modo fixo
  raio: { /* inalterado */ },
  bairro: {
    faixas: [                         // lista de bairros atendidos
      { nome: "Centro", valor: 5 },
      { nome: "Jardim América", valor: 8 }
    ],
    foraDaArea: "retirada" | "bloqueia"   // default "retirada"
  }
}
```

**Normalização única:** `freteDeConfig(config)` (fonte única já usada por servidor e checkout) passa a
normalizar também o bloco `bairro`:
- `modo` aceita `"bairro"` (senão cai em `"fixo"`).
- `bairro.faixas`: array de `{ nome: string, valor: number>=0 }`, descartando linhas sem nome.
- `bairro.foraDaArea`: `"bloqueia"` se explícito, senão `"retirada"`.

## Funções puras (`src/frete.js`)

Novas funções puras (testáveis em `test/frete.test.js`):

- `normalizarNome(s)` → minúsculas + remove acento (`String.normalize("NFD")` + strip
  `̀-ͯ`) + colapsa espaços + trim. (Distinta da `normalizar` atual, que **não** remove
  acento — esta remove, para casar bairros.)
- `encontrarBairro(nomeCliente, faixas)` → `{ nome, valor } | null`. Percorre `faixas` e retorna a
  primeira cujo `normalizarNome(nome)` seja **igual** a `normalizarNome(nomeCliente)`. `valor`
  coagido a número (`Number(f.valor) || 0`). Nome do cliente vazio → `null`.

## Servidor — endpoints

Todos os pontos abaixo ganham um ramo `modo === "bairro"`, ao lado do ramo `raio` já existente. O
**servidor é a fonte de verdade do valor**: recalcula pelo bairro do endereço e aceita do cliente
apenas `0` (cortesia, no PDV) ou o valor casado.

### `POST /api/c/:slug/frete` (cardápio web, público, rate-limited)
- **Entrada:** `{ cep, numero, bairro }` (o `bairro` vem do campo do checkout).
- **Modo bairro:** `encontrarBairro(bairro, faixas)`:
  - casou → `{ entrega_disponivel: true, valor_frete, bairro: <nome cadastrado>, foraDaArea }`.
  - não casou / bairro vazio → `{ entrega_disponivel: false, foraDaArea, mensagem: "Não atendemos seu bairro." }`.
- Não geocodifica. O `numero` segue obrigatório para compor o endereço de entrega, mas não afeta o
  match.

### `POST /api/pdv/frete` (PDV, autenticada) — via helper `_resolverFretePdv`
- Mesmo match por bairro. Retorna `{ taxa, entrega_disponivel, foraDaArea, bairro }`.

### `POST /api/c/:slug/pedido` e `POST /api/pdv/vender`
- No modo bairro + entrega, o servidor **recalcula** o frete a partir do `bairro` do endereço do
  pedido e **salva no pedido** (`valorFrete` + o bairro atendido). No PDV, `pdv.freteEfetivo` aceita
  só `0` (cortesia) ou o valor calculado; `foraDaArea` → HTTP 400 (igual ao raio).

### `GET /api/c/:slug` (projeção do cardápio)
- Expõe `frete: { modo: "bairro", foraDaArea, configurado: faixas.length > 0 }`.
- **Não** expõe a lista de bairros nem os valores (mesmo cuidado do raio, que não expõe faixas nem
  `coordEmpresa`). O valor sempre sai do `POST .../frete`.

## UI

### Configurações → Entrega (cadastro — `public/app.js` + `style.css`)
- 3º radio **"Por bairro"** no seletor **Modo de frete**, ao lado de Fixo e Por raio.
  - Gated a `planoAtual === "completo"` (cadeado + upsell pra aba Assinatura no Essencial, igual ao
    raio). `renderEntregaModo()` passa a tratar os 3 modos (mostra/esconde o bloco certo).
- Bloco do modo bairro: **editor de lista** de bairros — linhas `[Bairro (texto)] [Valor (R$,
  dinheiro.js)] [🗑 remover]` + botão **"Adicionar bairro"** + o seletor **"Quando o cliente está
  fora da área de entrega"** (`retirada` | `bloqueia`), reusando o mesmo componente/rótulo do raio.
- Persistência: leitura do form → `configAtual.frete.bairro = { faixas, foraDaArea }` → `PUT
  /api/config`. Backend força `modo` para `fixo` se o tenant não for completo (mesma guarda do raio).

### Cardápio web (checkout — `public/cardapio.js` + `cardapio.html`/`.css`)
- No modo bairro, dispara o cálculo de frete quando o CEP autopreenche **ou** o campo `cdBairro` é
  editado (em vez de "cep + número", que é o gatilho do raio). Chama `POST .../frete` com `{ cep,
  numero, bairro }`.
- Exibe: **"Entrega para _Centro_: R$ 5,00"** (dentro da área) **ou** **"Não atendemos seu bairro"**
  → se `foraDaArea === "retirada"`, mostra o botão "Mudar para retirada" (mesmo componente do raio);
  senão bloqueia a finalização por entrega. Reusa o campo `cdBairro` já existente e enviado no
  pedido.

### PDV (overlay de entrega — `public/app.js`)
- Idêntico ao raio na estrutura: o operador preenche o endereço (bairro autopreenchido pelo CEP e
  editável em `pdvEntBairro`); o servidor calcula o frete do bairro; entra como linha **Frete** no
  resumo (`Total = Subtotal − Desconto + Frete`), com **lixeira** para zerar (cortesia). **Fora da
  área bloqueia** (overlay aberto + aviso; servidor 400) — o operador decide Retirada/Balcão ou
  ajusta o endereço.

## Gate & escopo

- **Gate:** reusa `temFreteRaio(emp)` (= acesso liberado + plano completo) como porteiro do frete
  avançado (raio **e** bairro). O nome do helper mantém "raio" por compatibilidade, mas
  semanticamente é "frete avançado do Completo". `PUT /api/config` só aceita `modo:"raio"|"bairro"`
  se completo; senão força `fixo`.
- **Downgrade Completo→Essencial:** o modo efetivo volta a `fixo` (o gate passa a `false`); a config
  de bairro fica guardada, mas não é aplicada. Mesmo comportamento do raio.

## Tratamento de erros / bordas

- **CEP sem bairro** (comum em cidade pequena / CEP único): o campo `bairro` fica editável para o
  cliente/operador preencher; o match usa o valor do campo. Se ficar vazio → "fora da área".
- **Bairro cadastrado duplicado / com valores diferentes:** `encontrarBairro` retorna o **primeiro**
  match (ordem da lista). Sem validação de duplicidade no v1 (o restaurante controla a lista).
- **Lista vazia no modo bairro:** `configurado: false`; para o cliente, todo endereço cai em
  "fora da área" conforme `foraDaArea`. A aba Entrega pode avisar o restaurante ("adicione ao menos
  um bairro").
- **Confiança no cliente:** valor **sempre** recalculado no servidor; o `bairro` é dado do endereço
  do próprio cliente (legítimo como chave de lookup), mas o **preço** é do servidor.

## Testes / validação

- **Puros** (`test/frete.test.js`): `normalizarNome` (acento, caixa, espaço duplo, trim);
  `encontrarBairro` (match exato, sem-acento casa com acentuado, sem match → null, nome vazio →
  null, lista vazia → null, primeiro-match em duplicado).
- `npm run check` (sintaxe) + `npm test` (suíte do backend).
- **UI:** validar no browser (harness fiel) o cadastro na aba Entrega, o checkout do cardápio web
  (dentro da área, fora→retirada, fora→bloqueia) e o overlay do PDV. Onde o login em prod impedir,
  declarar "build/testes OK, UI não validada".

## Fora de escopo (futuro)

- Frete por bairro no **bot** (o canal de pedido é o cardápio web; o bot só manda o link).
- **Match fuzzy / "contém"** (ex.: "Vila Santa Rosa" casar com "Santa Rosa") — v1 é exato
  normalizado.
- **Dropdown** de seleção de bairro no checkout.
- **Pedido mínimo por bairro** / faixa de horário por bairro.
- Cadastro de bairro por **CEP/faixa de CEP** (em vez de nome).

## Ordem de construção (cada fase = entregável + validável + checkpoint)

1. **Núcleo puro + config:** `normalizarNome`/`encontrarBairro` em `src/frete.js`, normalização do
   bloco `bairro` em `freteDeConfig`, testes puros. (Nada visível ainda.)
2. **Servidor:** ramos `bairro` em `/api/c/:slug/frete`, `/api/pdv/frete` (`_resolverFretePdv`),
   recálculo no `pedido`/`vender`, projeção `GET /api/c/:slug`.
3. **UI da aba Entrega:** radio "Por bairro" + editor de lista + seletor fora-da-área + gate/persistência.
4. **UI dos canais:** checkout do cardápio web + overlay do PDV.

Ao final: `npm run check` + `npm test`, atualizar `CHANGELOG.md` e `PROGRESSO.md`, commit + push.

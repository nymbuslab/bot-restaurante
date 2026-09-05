# Perfil do projeto — bot-restaurante

> Substitua TODOS os marcadores `{{assim}}`. Nenhum marcador pode sobreviver no arquivo final.
> Regra dura: nada de invenção. O que não for verificável no código vira `NÃO DETERMINADO`
> e ganha uma linha em `docs/legado/LACUNAS.md`.
> A existência deste arquivo é o gatilho do modo legado.

Gerado em: 2026-09-05
Atualizado em: 2026-09-05
Região mapeada: o repositório inteiro (`index.js`, `src/`, `public/`, `supabase/migrations/`, `scripts/`, `test/`). `agente-impressora/` (app Electron separado) foi identificado como consumidor externo mas não teve seu próprio código-fonte varrido linha a linha — ver LACUNAS.

---

## 1. Stack e versões reais

> Lidas dos manifestos, nunca presumidas. Toda linha cita o arquivo de onde foi lida.

| Item | Versão | Lido de |
|---|---|---|
| Node.js (runtime) | `>=20` (declarado); imagem travada em `node:22-slim` | `package.json:8` (engines) e `Dockerfile:1` |
| express | 4.22.2 (resolvida; manifesto pede `^4.19.2`) | `package-lock.json` (`node_modules/express`), faixa em `package.json:27` |
| pg | 8.21.0 | `package-lock.json` (`node_modules/pg`), `package.json:32` |
| @supabase/supabase-js | 2.108.1 | `package-lock.json` (`node_modules/@supabase/supabase-js`), `package.json:22` |
| @whiskeysockets/baileys | 6.7.23 | `package-lock.json` (`node_modules/@whiskeysockets/baileys`), `package.json:23` |
| jose | 6.2.3 | `package-lock.json`, `package.json:30` |
| stripe | 22.2.1 | `package-lock.json`, `package.json:36` |
| helmet | 8.2.0 | `package-lock.json`, `package.json:29` |
| express-rate-limit | 8.5.2 | `package-lock.json`, `package.json:28` |
| pino | 10.3.1 | `package-lock.json`, `package.json:33` |
| bcryptjs | 3.0.3 | `package-lock.json`, `package.json:24` |
| multer | 2.1.1 | `package-lock.json`, `package.json:31` |
| dotenv | 16.6.1 | `package-lock.json`, `package.json:26` |
| Banco de dados | PostgreSQL **17.6** (aarch64, gerenciado pelo Supabase) | `SELECT version()` consultado direto no Postgres de produção em 2026-09-05 (infraestrutura externa, sem arquivo no repo que a declare) |
| Front-end | HTML/CSS/JS puro, sem framework nem bundler (nenhuma dependência de build em `package.json`) | `package.json` (ausência de `devDependencies` de bundler), `public/*.html` |

Versão travada por: `Dockerfile:1` (`FROM node:22-slim`). Não há `.nvmrc` nem `.tool-versions` no repositório (confirmado por ausência de arquivo). `fly.toml` não fixa versão de runtime, só recursos de VM (`fly.toml:34-37`).

---

## 2. Pontos de entrada

> Tudo por onde o sistema é acionado de fora. Cada linha cita caminho relativo de arquivo.

### Rotas HTTP
- `src/servidor.js` — 110 declarações `app.get/post/put/patch/delete` (contagem por grep), ~103 caminhos únicos. Grupos principais, cada um com exemplo de linha:
  - Autenticação/onboarding: `src/servidor.js:323` (`POST /api/cadastro`), `src/servidor.js:379` (`POST /api/login`)
  - Assinatura/Stripe: `src/servidor.js:556` a `:642`, `:1106`-`:1165` (checkout, plano, portal, cartões)
  - Cardápio web público (canal do pedido): `src/servidor.js:701` (`GET /api/c/:slug`), `src/servidor.js:848` (frete), `src/servidor.js:959` (`POST /api/c/:slug/pedido`)
  - Painel master (super-admin): `src/servidor.js:1165` a `:1656` (`/api/admin/...`, 17 rotas)
  - Conta do usuário / LGPD: `src/servidor.js:1813` (`GET /api/conta`), `:1852` (exportar), `:1885` (`DELETE /api/conta`)
  - Dashboard, caixa, PDV, mesas, estoque, cardápio, config: demais rotas em `src/servidor.js` (não listadas uma a uma nesta seção — ver `docs/arquitetura.md` para módulo por módulo)
- Front-end estático servido pela mesma `src/servidor.js:220` (`express.static`), sem rotas por arquivo.

### Comandos de CLI
- `scripts/check-syntax.js` — checagem de sintaxe em todo `.js` do repo (script `check` do `package.json:13`)
- `scripts/setup-storage.js` — script administrativo (script `setup-storage` do `package.json:14`)
- `scripts/normalizar-pagamentos.js` — migração pontual de dado (`package.json:15`)
- `scripts/converter-complementos.js` — migração pontual de dado (`package.json:16`)
- `scripts/test-ci.js` — roda a suíte em condição de CI (`package.json:18`)
- `scripts/test-integracao.js` — roda a suíte de integração (`package.json:19`)
- `scripts/migrar-convenios.js` — declarado em `package.json:17` (script `migrar-convenios`) mas o arquivo NÃO existe em `scripts/` (confirmado por listagem de diretório). Comando quebrado — ver LACUNAS/DIVIDA.

### Jobs e crons
- Não há agendador externo (sem `crontab`, sem `node-cron` nas dependências). Todos os jobs recorrentes são `setInterval`/`setTimeout` dentro do próprio processo Node, disparados em `index.js`:
  - `index.js:41` — higiene de sessões WhatsApp inativas (24h)
  - `index.js:55` — retenção LGPD de pedidos antigos, anonimiza (24h)
  - `index.js:70` — retenção LGPD de clientes inativos, remove (24h)
  - `index.js:84` — retenção de auditoria (24h)
  - `index.js:99` — limpeza da fila de impressão (24h)
  - `index.js:113` — retenção de incidentes (24h)
  - `index.js:128` — retenção de movimentos de estoque (24h)
  - `index.js:142` — limpeza de sessões de conversa em memória (10min)
  - `index.js:170` — restauração de bots WhatsApp no boot (`setTimeout` único)

### Filas e workers
- `impressao_fila` (tabela Postgres) é uma fila poll-based via HTTP, não mensageria: o servidor grava o texto pronto (`src/impressao-fila.js`) e um app externo (Electron, `agente-impressora/`) busca e marca como impresso via rota HTTP:
  - `src/servidor.js:459` — devolve pendentes (`impressaoFila.pendentes`)
  - `src/servidor.js:467` — marca impresso (`impressaoFila.marcarImpresso`)
- `agente-impressora/` é um projeto Electron separado dentro do mesmo repositório, mapeado em 2026-09-05 (fecha L-04):
  - **Ponto de entrada:** `agente-impressora/main/main.js` — app desktop (Tray + janela), inicia o poll após login (`did-finish-load`).
  - **`main/poller.js`** — dois loops HTTP a cada ~3s: `processarFila` (fila genérica `GET /api/agente/fila`, PDV/Mesas/Caixa/reimpressão — texto **já vem pronto do servidor**, o agente só decodifica ESC/POS) e `umCiclo` (delivery, `GET /api/agente/pendentes` — o agente **monta o texto localmente**).
  - **`main/print-job.js`** — usa `montarJob`/`montarJobDeVias`, que chamam `Comanda.montarComanda`/`montarCozinha` de **`agente-impressora/vendor/comanda.js`** — uma **cópia vendorizada** de `public/comanda.js`, sincronizada só em build (`copy-shared.js`, chamado por `npm run dist`), **nunca automaticamente**. Isso significa que uma correção em `public/comanda.js` só chega ao caminho de delivery do agente depois de um novo release publicado (skill `publicar-agente-impressora`) — o caminho da fila genérica (PDV/Mesas/Caixa) não sofre disso, porque usa o texto já renderizado pelo servidor.
  - **`main/transporte.js`** + `main/impressora/{rede,serial,usb}.js` — envio ESC/POS por rede (porta 9100), serial (COM) ou USB (fila do Windows), uma conexão por job.
  - **`main/api.js`** / **`main/auth.js`** — cliente HTTP com Bearer + retry em 401, sessão renovável.
  - **`main/config.js`** — config local da impressora (porta/corte/acento), persistida no disco do usuário.
  - **`renderer/`** — UI da janela (login, status, configuração), isolada do `main` por `contextIsolation`.
  - **Testes:** `agente-impressora/test/*.test.js` (18 casos — `montarJob`, `parseAlvoRede`, `validarConfigImpressora`), rodam com `node --test test/*.test.js` (o `npm test` do agente, `node --test test/`, falha em algumas versões do Node).
  - **Distribuição:** `.exe` gerado por `electron-builder` (NSIS), publicado como GitHub Release; o painel serve por proxy (`GET /downloads/nymbus-impressora.exe`). Auto-update **desligado de propósito** (sem code signing) — atualização é manual pelo painel.

### Webhooks recebidos
- `src/servidor.js:148` — `POST /api/stripe/webhook` (raw body, antes do `express.json`), valida assinatura do Stripe e despacha para `src/stripe.js`.

### Integrações de saída
- Stripe (cobrança/assinatura) — `src/stripe.js`
- Supabase Auth + Storage — `src/supabase.js`, `src/empresas.js`
- WhatsApp via Baileys (WebSocket não-oficial) — `src/multi-bot.js`
- Geoapify (geocodificação para frete por raio) — `src/frete.js`
- Resend (e-mail transacional) — `src/email.js`
- ViaCEP/serviço de CEP — `src/cep.js`, `public/endereco-cep.js`

---

## 3. Camadas que de fato existem

> A arquitetura que o projeto TEM, não a que deveria ter.

| Camada | Pasta | O que contém de fato | Seguida consistentemente? |
|---|---|---|---|
| Rotas + orquestração HTTP | `src/servidor.js` (3217 linhas, 110 rotas) | Handlers Express que chamam módulos de `src/`, validam entrada, formatam resposta | Não — o mesmo arquivo também abre transação direto no banco em vários pontos (`src/servidor.js:2083`, `:2131`, `:2166`, `:2673`, `:2864` chamam `db.pool.connect()` dentro do handler) e faz 4 `db.query` diretos (`src/servidor.js:787`, `:806`, `:821`, `:1302`) — não delega 100% a um módulo de dados |
| Módulos de domínio (dados + regra juntos) | `src/*.js` (exceto `servidor.js`/`db.js`) | Cada arquivo mistura acesso a dados (`db.query`) e regra de negócio no mesmo módulo — ex. `src/caixa.js` (37KB), `src/mesas-db.js`, `src/pedidos.js`, `src/empresas.js` | Sim, como padrão dominante: não há camada de "repository" separada de "service"; um único arquivo por domínio faz as duas coisas |
| Lógica pura dual-mode (Node + browser) | `public/*.js` compartilhados (`dinheiro.js`, `variacoes.js`, `grupos.js`, `texto.js`, `estoque.js`, `pagamentos.js`) + `src/caixa-calc.js` | Funções sem I/O, `require()`-áveis pelo backend e carregadas por `<script>` no browser (mesmo arquivo, sem transpilação) | Sim — é o padrão mais consistente do projeto, citado no próprio `CLAUDE.md` |
| Acesso a dados | `src/db.js` | Pool único `pg.Pool`, wrapper `query`/`pool` com trava anti-teste (`src/db.js:39-57`) | Sim — único ponto de criação do pool; todo módulo importa `require("./db")`, sem segunda instância de pool encontrada |
| Front-end sem framework | `public/*.html` + `public/*.js` | HTML servido estático, JS vanilla manipulando DOM direto (`app.js` com 429KB) | Sim, mas sem componentização: `public/app.js` é um único arquivo monolítico que cobre múltiplas telas do painel |
| Migrações versionadas | `supabase/migrations/` | 46 arquivos `.sql`, aplicados via `npx supabase db push` | Sim — todas seguem o padrão de nome `AAAAMMDDHHMMSS_descricao.sql` |

---

## 4. Comandos reais

| Ação | Comando | Fonte |
|---|---|---|
| build | Não existe passo de build (front-end sem bundler; back-end CommonJS puro). O mais próximo é a checagem de sintaxe. | Ausência de script `build` em `package.json`; `README.md`/`Dockerfile` não citam build |
| teste (suíte inteira) | `node --test test/*.test.js` (via `npm test`) | `package.json:12` |
| teste de um arquivo só | `node --test test/<arquivo>.test.js` (o runner nativo `node:test` aceita caminho de arquivo direto como argumento) | Inferido da forma do script em `package.json:12` e confirmado nesta varredura ao rodar `node --test --experimental-test-coverage test/*.test.js` (532 testes, todos passaram) |
| lint | Não há linter configurado (sem `.eslintrc*`, `.prettierrc*`, nem `eslint`/`prettier` em `package.json`). O script `check` roda `node --check` (checagem de SINTAXE, não lint de estilo) | Ausência de arquivo de config; `scripts/check-syntax.js` (comentário do próprio script diz ser "o build honesto de um app CommonJS puro") |
| execução local | `npm start` → `node index.js` | `package.json:11`, `index.js:1-11` |
| migração de banco | `npx supabase db push` (aplica `supabase/migrations/`) | `README.md:86`, `README.md:333` (não há script npm que encapsule; comando cru do Supabase CLI) |
| CI (pipeline real) | `npm ci` → `npm run check` → `npm test` → (só em `main`/`workflow_dispatch`) `npm run test:integracao` | `.github/workflows/test.yml:19-38` |

Comando de teste de um arquivo só: existe e é utilizável (não é lacuna grave). A suíte é rápida (532 testes em cerca de 0,7 a 1,7 segundo), compatível com uso repetido pela Camada 3.

---

## 5. Cobertura de teste verdadeira

Método de medição: `node --test --experimental-test-coverage test/*.test.js` (rodado nesta varredura, medida real, não estimativa).
Suíte executável neste ambiente: sim — 532 testes, 0 falhas, duração total entre 0,7 e 1,7 segundo nas duas execuções.

Cobertura global: 74,78% linhas / 74,38% branch / 76,57% funções (apenas dos arquivos efetivamente carregados pelos testes unitários — ver observação abaixo).

| Pasta/arquivo | Cobertura (linhas) | Observação |
|---|---|---|
| `src/caixa-calc.js` | 100% | Lógica pura de cálculo de caixa, bem coberta |
| `src/cardapio-web.js` | 100% | Recálculo de preço no servidor, bem coberto |
| `src/pdv.js` | 100% | Lógica pura de venda no local, bem coberta |
| `src/validacao.js` | 97,44% | Bem coberto |
| `src/db.js` | 93,22% | Trava anti-teste coberta |
| `src/frete.js` | 77,60% | Parcial — trechos de geocodificação/faixas não exercitados |
| `src/mesas-db.js` | 78,41% | Parcial, branch só 41,25% |
| `src/store.js` | 81,23% | Parcial |
| `src/pedidos.js` | 65,07% | Parcial — muita lógica de consulta/relatório não exercitada por unit |
| `src/estoque-db.js` | 71,01% | Parcial |
| `src/caixa.js` (37KB, zona financeira) | 37,34% unitário / **90,08% com integração** | A suíte `test/integracao/*.test.js` (54 testes, contra Postgres real de teste) exercita a maior parte dos fluxos de abertura/fechamento/movimentação que o unitário não alcança |
| `src/empresas.js` | 34,15% unitário / **69,31% com integração** | Autenticação/tenant, exercitada pelos 5 casos de isolamento entre empresas |
| `src/clientes.js` | 30,41% | Baixa |
| `src/impressao-fila.js` | 32,38% | Baixa |
| `src/auditoria.js` (zona LGPD) | 35,29% | Baixa — só as funções `limparAntigos`/`registrar` parcialmente exercitadas |
| `src/servidor.js` (3217 linhas, camada de rotas) | 0% unitário / **51,13% com integração** | A cobertura de rota HTTP vem quase inteiramente de `test/integracao/*.test.js` — medido em 2026-09-05 (ver nota metodológica) |
| `src/stripe.js` | 0% unitário / **57,93% com integração** | `test/integracao/stripe.test.js` exercita checkout, webhook e reaplicação de estado |
| `src/multi-bot.js`, `src/fluxo.js`, `src/wa-auth.js`, `src/email.js`, `src/incidentes.js`, `src/plataforma.js`, `src/cep.js` | 0% unitário; **não exercitados nem pela integração** (22-31% na medição de integração, restos de import transitivo, não teste direto) | Cobertura real ausente — nenhuma suíte hoje exercita estes diretamente |
| `public/app.js` (429KB), `public/admin.js`, `public/cardapio.js`, `public/app-admin.js`, `public/cadastro.js`, `public/login.js` | não aparecem no relatório — não são exercitados por `node --test` | Cobertura ausente do ponto de vista de teste automatizado; validação desses arquivos é manual/visual, segundo o próprio `CLAUDE.md` |

Nota metodológica (L-02, fechada em 2026-09-05): `npm run test:integracao` foi executado com `--experimental-test-coverage` isolado (54/54 testes) contra o Postgres de teste descartável do `.env.test` — não o de produção. Os números acima ("com integração") vêm dessa execução isolada, e são reais, não estimados. **Não foi obtido um número único combinando unitário + integração na mesma instrumentação**: uma tentativa de rodar as duas suítes juntas (com `PERMITIR_BANCO_EM_TESTE=1` ligado para liberar a integração) travou por mais de 20 minutos — risco identificado: esse flag também desliga a trava anti-produção que alguns testes unitários pressupõem ligada, e o processo foi encerrado antes de investigar a fundo, por prudência. Os dois números separados (unitário e integração) já respondem o que a lacuna original pedia: `servidor.js`/`caixa.js`/`empresas.js`/`stripe.js` têm cobertura real muito maior do que o unitário isolado sugeria.

---

## 6. Padrões conflitantes

> SEÇÃO OBRIGATÓRIA. Em legado não existe "o padrão", existem vários.
> A última coluna é a que o agente vai obedecer ao mexer naquela pasta.

| Eixo | Dialeto encontrado | Onde vive | Segue este ao mexer ali |
|---|---|---|---|
| acesso a dados | SQL cru via `pg.Pool`, sem ORM/query builder. Único ponto de criação do pool em `src/db.js:25` | Todo `src/*.js` que usa `db.query`/`db.pool.connect` (ex.: `src/caixa.js` com 47 ocorrências, `src/mesas-db.js` com 27, `src/servidor.js` com 4 diretas mais 5 transações) | Sim — é UNÂNIME, não há segundo dialeto de acesso a dados no projeto |
| tratamento de erro | Dois dialetos coexistem, distinguidos por semântica e não por pasta: (1) `throw new Error` com mensagem em pt-BR para violação de regra de negócio (113 ocorrências em 15 arquivos, ex. `src/pedidos.js:265`, `:299`, `:301`); (2) `return null` para busca que não encontrou registro (49 ocorrências em 12 arquivos, ex. `src/pedidos.js:134`). Ambos aparecem no MESMO arquivo (`src/pedidos.js`, `src/empresas.js`, `src/cardapio-web.js`) e ambos seguem ativos no histórico (primeiro `throw` em 2026-06-06, último em 2026-08-29; primeiro `return null` em 2026-06-09, último em 2026-08-31) — não é caso de um substituir o outro no tempo | `src/*.js` em geral | Depende do caso: `throw new Error` quando a operação viola uma regra de negócio (o chamador deve tratar como falha e propagar 4xx/5xx); `return null` quando é apenas "não encontrado" numa consulta de leitura simples. Ambos os dialetos são válidos; o erro a evitar é a escolha errada (ex. `throw` para um "não encontrado" trivial) |
| validação | Concentrada em módulo dedicado `src/validacao.js` (`validarConfig`, `validarCardapio`, `tipoImagemPorAssinatura`), chamado a partir do handler de rota (importado em `src/servidor.js:31`). Também há validação pontual dentro dos próprios módulos de domínio (ex. `src/pdv.js`, `public/variacoes.js` função `avaliarVariacoes`) | `src/validacao.js` (regra central) + validação específica de domínio dentro de cada módulo puro (`public/*.js`) | Sim — validação de payload solto (config/cardápio) vai em `src/validacao.js`; validação de regra de domínio (ex. quantidade de variação) fica no próprio módulo puro que já existe para aquele domínio |
| injeção de dependência | Nenhuma — sem container de DI (`inversify`, `awilix` etc. ausentes de `package.json`). Módulos são `require()`-ados diretamente e expõem funções via `module.exports` (singleton implícito por cache do `require`) | Todo o projeto | Sim — UNÂNIME, `require()` direto é o único padrão encontrado |
| data e hora | Persistência sempre `timestamptz` no Postgres (UTC), ex. `supabase/migrations/20260612115133_init_schema.sql:20`. Conversão para fuso BR feita explicitamente com `AT TIME ZONE` no SQL (`src/caixa.js:79-80`, `src/pedidos.js:103`) ou via `toLocaleDateString` com `timeZone` no JS (`src/caixa.js:108`, `src/servidor.js:1230`) | `supabase/migrations/*.sql` (schema) + `src/caixa.js`, `src/pedidos.js`, `src/servidor.js` (leitura/exibição) | Sim — UNÂNIME: gravar sempre em UTC (`timestamptz`), converter para o fuso de São Paulo só na leitura/exibição |
| dinheiro | Padrão único declarado e verificado: campos de dinheiro usam `input type="text" inputmode="numeric"` mais máscara "centavos primeiro" de `public/dinheiro.js` (`window.Dinheiro.mascarar`/`.valor`/`.formatar`). Os únicos `type="number"` encontrados no front (`public/admin.html:1124`, `:1129`, `:1453`, `:1454`, `public/app.js:2989`, `:2990`, `:4483`, `:4484`) são para percentual (taxa de mesas, mínimo/máximo de grupo) e faixa em quilômetro (frete por raio), não para valor monetário — confirmando a exceção documentada, não uma violação | `public/dinheiro.js` (fonte única) + qualquer tela com campo de valor em reais | Sim — UNÂNIME para dinheiro; exceção documentada e verificada para percentual e quilômetro |
| nomenclatura e idioma | Identificadores de domínio (tabelas, colunas, funções de negócio, variáveis) em português (`empresas`, `pedidos`, `criado_em`, `anonimizarPedidos`, `resumoCaixa`); palavras-chave de linguagem e nomes de bibliotecas em inglês (`const`, `require`, `async function`) | Todo o projeto — `supabase/migrations/*.sql` (nomes de coluna/tabela) e `src/*.js`/`public/*.js` (nomes de função/variável) | Sim — UNÂNIME, consistente em todo o repositório |
| estilo de teste | Runner nativo `node:test` mais `node:assert/strict`, sem framework de asserção externo (Jest/Mocha/Chai ausentes de `package.json`). Dados de teste montados inline no próprio arquivo (objetos literais), sem biblioteca de fixture. Dublês feitos por substituição manual de módulo ou stub de função, sem `sinon` (ausente do manifesto) | Todo `test/*.test.js` e `test/integracao/*.test.js` | Sim — UNÂNIME |

Critério de desempate quando duas formas convivem na mesma pasta: não se aplicou de forma pura neste levantamento (o único conflito de fato — tratamento de erro — se resolve por semântica declarada acima, não por recência); onde o time quiser um critério temporal para outro caso futuro, usar o histórico do versionador com `git log -S "padrão" -- caminho`.

---

## 7. Zonas de risco

> Áreas onde errar não é bug, é processo.
> Toda zona tocada por um trabalho dispara a Camada 11 e implica raio ALTO.

**Validador padrão (decisão de 2026-09-05):** Pabllo Martins, dono do projeto, foi designado
validador padrão das seis zonas abaixo — fecha a lacuna L-01 do `LACUNAS.md` (não havia
`CODEOWNERS` nem papel de revisor distinto documentado; o histórico de commits mostra autor
único). A cada trabalho que tocar uma destas zonas, as demais perguntas da Camada 11 (impacto
fiscal/contratual, dado histórico, aviso a cliente, janela de manutenção, processo manual)
continuam obrigatórias e específicas daquele trabalho — só o "quem valida" já vem resolvido.

### Zona: Financeiro (caixa e PDV)

Pastas e arquivos que a compõem:
- `src/caixa.js` (abertura/fechamento/movimentação de caixa)
- `src/caixa-calc.js` (cálculo puro de resumo/diferença)
- `src/pdv.js` (venda no local, desconto, split, troco)
- `public/comprovante-caixa.js`, `public/relatorio-caixa.js`, `public/comanda.js` (impressos)
- `supabase/migrations/20260620120000_caixa.sql`, `20260620130000_caixa_abertura.sql`, `20260620140000_caixa_fechamento_detalhe.sql`, `20260704130000_caixa_valor_pago_troco.sql`, `20260830150000_indice_caixa_movimentos_pedido.sql` (schema)

Quem valida uma mudança aqui: **Pabllo Martins (dono do projeto)** — designado como validador padrão de todas as seis zonas de risco em 2026-09-05 (autor único do histórico de commits, sem `CODEOWNERS` nem papel de revisor distinto documentado). Ver nota no início desta seção.

Perguntas obrigatórias adicionais desta zona, além das seis mínimas da Camada 11:
1. A mudança altera o cálculo do valor esperado em espécie ou da diferença (`src/caixa-calc.js`) ou só a apresentação do relatório?
2. Existe caixa aberto em produção no momento da mudança que ficaria com histórico calculado de forma diferente do que já foi fechado antes (dado histórico imutável)?

### Zona: Assinatura / pagamento (Stripe)

Pastas e arquivos que a compõem:
- `src/stripe.js` (checkout, portal, cartões, webhook)
- `src/servidor.js:148` (endpoint de webhook), `src/servidor.js:556-642`, `:1106-1165` (rotas de assinatura)
- `supabase/migrations/20260612181500_assinatura_billing.sql` (schema de billing)

Quem valida uma mudança aqui: **Pabllo Martins (dono do projeto)** — designado como validador padrão de todas as seis zonas de risco em 2026-09-05. Ver nota no início desta seção.

Perguntas obrigatórias adicionais desta zona, além das seis mínimas da Camada 11:
1. A mudança altera a idempotência do webhook (dedup por id do evento) ou o mapeamento de status de assinatura?
2. Foi testada contra o Stripe em modo teste (chave `STRIPE_SECRET_KEY` de teste), e não só com dublê?

### Zona: Autenticação, autorização e permissão

Pastas e arquivos que a compõem:
- `src/servidor.js:225-273` (`exigeAuth`, `exigeAssinatura`) e bloco de super-admin a partir de `src/servidor.js:275`
- `src/empresas.js` (`resolverPorToken`, `acessoLiberado`, `tenantDir`)
- `src/supabase.js` (cliente Supabase Auth)

Quem valida uma mudança aqui: **Pabllo Martins (dono do projeto)** — designado como validador padrão de todas as seis zonas de risco em 2026-09-05. Ver nota no início desta seção.

Perguntas obrigatórias adicionais desta zona, além das seis mínimas da Camada 11:
1. A mudança afeta o escopo de `req.slug`/`req.tenantDir` de forma que um tenant possa enxergar dado de outro (isolamento multi-tenant)?
2. A revogação de sessão (escopo local versus global, ver `docs/gotchas.md`) continua funcionando como documentado?

### Zona: LGPD e dado pessoal

Pastas e arquivos que a compõem:
- `src/auditoria.js` (trilha de auditoria)
- `index.js:44-128` (jobs de retenção/anonimização: pedidos, clientes, auditoria, incidentes, estoque)
- `src/servidor.js:1813-1897` (rotas `/api/conta`, exportar, excluir)
- `docs/lgpd/` (política documentada)

Quem valida uma mudança aqui: **Pabllo Martins (dono do projeto)** — designado como validador padrão de todas as seis zonas de risco em 2026-09-05. Ver nota no início desta seção.

Perguntas obrigatórias adicionais desta zona, além das seis mínimas da Camada 11:
1. A mudança altera prazo de retenção ou o que é anonimizado versus o que é apagado (pedidos são anonimizados, clientes são removidos — são tratamentos diferentes, ver `index.js:57-59`)?
2. Algum dado pessoal passa a ser gravado em log (`console.error`) ou em `auditoria.detalhe`, o que o próprio código proíbe (`src/auditoria.js:4`)?

### Zona: Cálculo com efeito contratual (preço, frete)

Pastas e arquivos que a compõem:
- `src/cardapio-web.js` (`recalcularItens` — o servidor nunca confia no preço enviado pelo cliente)
- `src/frete.js` (frete por raio/bairro, Geoapify/Haversine)
- `src/pdv.js` (recálculo de venda com quilo/opcionais/desconto)

Quem valida uma mudança aqui: **Pabllo Martins (dono do projeto)** — designado como validador padrão de todas as seis zonas de risco em 2026-09-05. Ver nota no início desta seção.

Perguntas obrigatórias adicionais desta zona, além das seis mínimas da Camada 11:
1. O preço final ainda é recalculado 100% no servidor, sem nenhum campo de valor aceito cru do cliente?
2. A mudança em frete foi validada com um CEP/endereço real (cenário de geocodificação), não só com dado simulado?

### Zona: Dado histórico imutável

Pastas e arquivos que a compõem:
- Caixas fechados (`caixas` + `caixa_movimentos`, `src/caixa.js`)
- Pedidos já recebidos/anonimizados (`src/pedidos.js`, coluna `pedidos.recebido_em`)
- Auditoria (`src/auditoria.js`)

Quem valida uma mudança aqui: **Pabllo Martins (dono do projeto)** — designado como validador padrão de todas as seis zonas de risco em 2026-09-05. Ver nota no início desta seção.

Perguntas obrigatórias adicionais desta zona, além das seis mínimas da Camada 11:
1. A mudança precisa recalcular ou reexibir um registro já fechado/anonimizado, e se sim, o dado de origem ainda existe para isso?

---

## 8. Áreas suspeitas de código morto

> Suspeita, não sentença. Confirmar é trabalho da Camada 10, e confirmado NÃO autoriza remoção.

| Área | Sinal que levantou a suspeita | Última alteração |
|---|---|---|
| `scripts/migrar-convenios.js` | Script declarado em `package.json:17` mas o arquivo não existe no diretório `scripts/` (comando quebrado, não código morto no sentido usual, mas correlato — ver `DIVIDA.md`) | NÃO DETERMINADO (arquivo ausente no estado atual do working tree; não foi rastreado no histórico do versionador nesta varredura) |

Nenhuma outra área com sinal forte de código morto foi encontrada nesta varredura. Contexto relevante: o histórico do repositório é curto (primeiro commit em 2026-06-06, mais recente em 2026-09-04, cerca de três meses), o que limita a força do sinal "sem alteração há muito tempo" — poucos arquivos têm tempo suficiente para essa suspeita amadurecer. Módulos com baixa contagem de referência cruzada (`src/cep.js`, `src/incidentes.js`, `src/plataforma.js`, `src/stripe.js`, `src/wa-auth.js`, cada um referenciado por apenas um outro arquivo) não foram tratados como suspeitos: a arquitetura concentra o consumo em `src/servidor.js`/`index.js`, então baixa contagem de importador é esperada, não anômala, nesta stack.

---

## 9. Limiares do raio de impacto

> Valores padrão da Camada 2, copiados para cá. A partir daqui são EDITÁVEIS pelo time,
> e o valor que vale é o deste arquivo, não o do SKILL.md.

### Faixas

```
BAIXO  até 3 chamadores, nenhuma zona de risco, sem migração,
       área com cobertura de teste existente, sem dado histórico afetado
MEDIO  4 a 15 chamadores, ou cobertura ausente, ou consumo por job ou relatório
ALTO   acima de 15 chamadores, ou zona de risco, ou migração, ou dado histórico
```

### Orçamento de mudança por task

```
BAIXO  até 5 arquivos, até 150 linhas
MEDIO  até 3 arquivos, até 80 linhas
ALTO   até 2 arquivos, até 40 linhas
```

### Histórico de edição dos limiares

> Limiar alterado sem motivo registrado é como o rigor evapora ao longo dos meses.

| Data | Quem editou | O que mudou | Motivo |
|---|---|---|---|
| 2026-09-05 | cartógrafo (Camada 1, criação) | Nenhuma alteração — valores padrão copiados do reference sem edição | Primeira geração do PERFIL; time ainda não teve oportunidade de calibrar |

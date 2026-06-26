# Agente de impressão desktop (Nymbus Impressora) — Design

**Data:** 2026-06-26
**Status:** Aprovado (design) — pronto para a spec ser revisada e virar plano

## Problema

A impressão atual de comandas pelo painel usa o navegador (`window.print`) ou Web Serial.
Dois problemas:

1. **UX ruim:** o operador clica em "Imprimir" e abre o diálogo do navegador — não é
   automático nem silencioso. Para um restaurante recebendo pedidos online, a comanda
   precisa sair **sozinha** na cozinha quando o pedido cai.
2. **Qualidade:** o caminho web **rasteriza o texto como imagem** e a térmica (1-bit, sem
   cinza) reproduz as bordas anti-aliased como pontos esparsos → cupom **apagado/falhado**.
   O caminho **ESC/POS cru** (serial/Daruma) sai **nítido** porque usa a fonte nativa da
   impressora.

A solução é um **app desktop** (estilo iMenu Impressora) instalado no PC ligado à
impressora: loga com a conta do painel, escolhe a impressora e **imprime os pedidos novos
automaticamente, em silêncio, via ESC/POS cru**.

## Decisões (tomadas no brainstorming)

- **Stack: Electron (Windows).** Motivo principal: reaproveita `public/comanda.js` (monta o
  cupom) e `public/serial-escpos.js` (encoder ESC/POS), já testados e dual-mode — sem
  reescrever em outra linguagem. Single-stack (Node/JS) e `electron-builder` dá o instalador
  `Setup.exe` + auto-update (igual ao imenuapp). Electron é só a **casca** (UI + runtime Node
  + empacotamento); a impressão é **bytes ESC/POS crus** — **nunca** `webContents.print()`
  (rasterizaria e voltaria a sair apagado).
- **Recebimento: polling na API** (a cada ~5–8s). Simples, reaproveita rotas/auth atuais,
  sem infra de push nova. Atraso de segundos é aceitável.
- **O que imprime: configurável.** Padrão = as **2 vias** (cozinha + cupom), 1 cópia cada;
  o dono escolhe via(s) e nº de cópias.
- **Conexões na v1: USB, Rede/Wi-Fi (TCP 9100), Serial (COM).** **Sem Bluetooth.** (A Daruma
  aparece como porta COM, ex.: `COM3 Daruma Driver DR800`; impressoras BT pareadas também
  viram COM — cobertas pelo modo Serial sem stack BT nativo.)
- **Escopo de auto-impressão: pedidos novos do cardápio web.** O **PDV/balcão não**
  auto-imprime (o operador está presente e reimprime sob demanda).
- **Coexistência:** a impressão web atual (`window.print`/serial) **continua** como fallback
  para quem não instala o agente.
- **Onde mora o código:** subpasta **`agente-impressora/`** no mesmo repo (monorepo),
  importando os módulos puros de `public/` — fonte única do cupom/ESC/POS.

## Arquitetura

```
agente-impressora/                 (novo — app Electron)
  main/                            -> processo principal (Node): auth, polling, impressão, tray
    auth.js                        -> login + refresh token (Supabase via API), guarda no cofre do SO
    poller.js                      -> loop de polling: busca pendentes, imprime, marca impresso
    impressora/
      index.js                     -> roteia p/ o transporte (usb|rede|serial) + lista impressoras
      rede.js                      -> socket TCP IP:9100
      serial.js                    -> serialport (COM) — lista portas com nome do dispositivo
      usb.js                       -> impressão RAW na fila do Windows
    config.js                      -> persiste config (impressora, vias, cópias, corte, sem-acento)
    ipc.js                         -> ponte main <-> renderer (eventos/handlers)
  renderer/                        -> UI (HTML/CSS/JS puro, espelha o imenuapp)
    index.html / app.js / style.css
  shared/                          -> reuso dos módulos puros do app principal
    (importa ../../public/comanda.js e ../../public/serial-escpos.js)
  package.json                     -> deps do Electron + electron-builder + electron-updater
```

App principal (mudanças mínimas):
- Migration: coluna `pedidos.impresso_em timestamptz null`.
- Rotas `/api/agente/*` (ver "Backend").
- Página no painel com link de download + passo a passo.

## Fluxo de dados

1. **Login:** usuário digita e-mail/senha do painel no agente → `POST /api/agente/login`
   devolve `{ token (access ~1h), refresh, slug, nome }`. O **refresh token** é guardado no
   **cofre do SO** (Electron `safeStorage`); a senha **não** é persistida.
2. **Renovação:** quando o access token expira, o agente chama `POST /api/agente/refresh`
   com o refresh token (rotaciona) — mantém logado sem novo login. (Reaproveita
   `empresas.renovarSessao`, que já existe.)
3. **Polling (a cada ~5–8s):** `GET /api/agente/pendentes` (com o access token) →
   lista de pedidos do tenant com `impresso_em IS NULL` (entrada do cardápio web), já no
   formato que o `comanda.js` consome.
4. **Impressão:** para cada pedido, conforme a config (vias + cópias):
   - monta as vias com `Comanda.montarComanda(pedido, config, extras)`;
   - gera os bytes com `SerialEscpos` (init + CP850 + corte + avanço), por via;
   - envia **cru** pela impressora (rede/usb/serial).
5. **Marca impresso:** `POST /api/agente/pedidos/:numero/impresso` → `impresso_em = now()`.
   Idempotente: reiniciar o agente não reimprime; 2 agentes não duplicam (o 2º já vê
   `impresso_em` preenchido).
6. **Erro de impressão** (impressora offline/sem papel): **não** marca como impresso,
   registra no log, mostra status e **retenta** no próximo ciclo (com backoff). Assim o
   pedido não se perde.

## Backend (app principal)

- **Migration** `pedidos.impresso_em timestamptz` (nulo = ainda não impresso pelo agente).
- **`POST /api/agente/login`** `{ email, senha }` → `{ token, refresh, slug, nome }`.
  (A `empresas.login` já devolve `refreshToken`; aqui só expomos ao agente.)
- **`POST /api/agente/refresh`** `{ refresh }` → `{ token, refresh }` (via `renovarSessao`).
- **`GET /api/agente/pendentes`** (`exigeAuth`) → pedidos do `req.slug` com
  `impresso_em IS NULL`, origem cardápio web, ordenados por `numero`; payload = o pedido
  completo (itens com composição/opcionais, cliente, tipo, total, etc.) para montar a comanda.
  Limite de segurança (ex.: últimos N) para não imprimir backlog antigo na 1ª instalação.
- **`POST /api/agente/pedidos/:numero/impresso`** (`exigeAuth`) → `UPDATE pedidos SET
  impresso_em = now() WHERE empresa_id = $tenant AND numero = $numero AND impresso_em IS NULL`.
- **Rate limit** nas rotas do agente; reuso do `exigeAuth` (JWT local via JWKS).
- **Página "Impressora — app desktop"** no painel: link de download do
  `Nymbus Impressora Setup X.Y.Z.exe` (Storage/seu domínio) + passo a passo (instalar →
  logar → detectar → testar). A impressão web atual segue disponível.

## Impressão (transportes)

Reuso total do layout (`comanda.js`) e do encoder (`serial-escpos.js`). Transportes em Node:

- **Rede / Wi-Fi:** `net.Socket` para `IP:9100`, envia os bytes, fecha. Simples e robusto.
- **Serial (COM):** lib `serialport` — lista portas com nome amigável (ex.: "Daruma Driver
  DR800 (COM3)"); abre na baud configurada, escreve os bytes. Cobre a Daruma atual e BT
  pareado.
- **USB:** imprime **RAW na fila do Windows** (datatype RAW), evitando a rasterização do
  driver. Lib de raw print (ex.: `@thiagoelg/node-printer` / equivalente) ou spool RAW.
- **"Detectar impressoras":** rede = campo de IP/porta (+ ping opcional); serial = enumera
  COM; usb = lista filas de impressão do Windows.
- **Config por impressora:** método, alvo (IP:porta | COM:baud | nome da fila), corte
  (parcial/total/nenhum), sem-acento, **vias** (cozinha/cupom) e **cópias**.

## UI do agente (espelha o iMenu Impressora)

Janela única rolável:
- **Cabeçalho:** "Nymbus Impressora" + "Impressão automática dos pedidos".
- **Card "Restaurante":** nome + e-mail logado + botão **Sair**.
- **Faixa de status:** "IMPRESSORA ATIVA E CONFIGURADA" (verde) quando ok; avisos em
  amarelo/vermelho (sem impressora / offline / deslogado).
- **Card "Impressora":** botões **Detectar impressoras · Teste de impressão · Salvar**;
  **Tipo de conexão** (USB / Rede·Wi-Fi / Serial-COM); seletor da impressora conforme o tipo;
  campos do método (IP:porta ou COM:baud); opções de corte, sem-acento, vias e cópias.
- **Card "Registros":** console escuro com o log das últimas ações (ativa, modo, restaurante,
  config salva, impressoras detectadas, **pedidos impressos** e erros).
- **Bandeja (tray):** roda minimizado; opção "iniciar com o Windows".

## Distribuição

- **`electron-builder`** (NSIS) → `Nymbus Impressora Setup X.Y.Z.exe`.
- **Auto-update** com `electron-updater` (feed no seu domínio/Storage).
- **Assinatura de código:** opcional/depois. Sem ela, o SmartScreen mostra aviso na 1ª
  instalação (não impeditivo) — documentar no passo a passo.

## Tratamento de erros

- **Sem rede / API fora:** o polling falha em silêncio, registra no log e retenta; status
  fica "sem conexão".
- **Token expirado:** renova automaticamente; se o refresh falhar (revogado/expirado),
  volta pra tela de login.
- **Impressora offline / sem papel:** o pedido **não** é marcado como impresso, entra em
  retry com backoff e o erro aparece no status/log.
- **Pedido já impresso (corrida):** o `UPDATE ... WHERE impresso_em IS NULL` garante
  idempotência (não imprime duas vezes).

## Testes

- **Puro (node:test):** parsing/roteamento de transporte, montagem da config, dedup
  (idempotência do "marcar impresso"). `comanda.js` e `serial-escpos.js` já têm testes.
- **Backend:** testes das rotas `/api/agente/*` (pendentes filtra por `impresso_em`,
  marcar impresso é idempotente) no padrão atual.
- **Integração/manual:** instalar o `.exe`, logar, detectar, **teste de impressão real**
  (rede + serial/Daruma) e um pedido de ponta a ponta (cai no cardápio web → imprime sozinho).

## Notas de comportamento (v1)

- **`pendentes` usa `recebido_em IS NULL`** como proxy de "pedido online fresco". Efeito: se
  o operador marcar um pedido do cardápio web como **recebido no caixa** *antes* do agente
  imprimir, o pedido **sai dos pendentes e não é auto-impresso** (quem já está tratando no
  caixa não precisa do print automático). Aceitável na v1; documentado aqui.
- **`LIMIT 50` por ciclo de polling:** é a trava de segurança para a 1ª instalação não
  imprimir um backlog enorme. Não há perda (ordena por `numero ASC`, drena os mais antigos
  primeiro), mas um backlog grande sai 50-por-ciclo sem aviso. *Futuro:* o agente/backend pode
  logar quando vier o teto (50) para dar visibilidade.

## Fora de escopo (YAGNI por ora)

- **Bluetooth nativo** (BT pareado vira COM, coberto pelo modo Serial).
- **macOS/Linux** (v1 é Windows).
- **Push/tempo real** (polling basta; dá pra evoluir depois sem mudar o agente).
- **Assinatura de código** (depois).
- **Múltiplas impressoras por tenant / roteamento por categoria** (1 impressora na v1).

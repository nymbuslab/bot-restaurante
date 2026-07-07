---
name: publicar-agente-impressora
description: >-
  Gera o instalador (.exe) do Agente de Impressão Nymbus (app Electron em
  `agente-impressora/`) e o publica como release no GitHub, de onde o painel serve por
  proxy. Use SEMPRE que precisar buildar/rebuildar/gerar/atualizar/publicar o agente de
  impressão, lançar uma nova versão do agente, ou distribuir correções do app do agente
  aos restaurantes — inclusive quando o usuário disser só "buildar o agente", "gerar o
  instalador", "nova versão do agente" ou "publicar o .exe".
---

# Publicar o Agente de Impressão

O Agente de Impressão é um app desktop **Electron** (`agente-impressora/`) que roda na
máquina do restaurante e imprime os pedidos automaticamente. As correções do **app**
(diferente das do backend) só chegam aos agentes instalados quando um **novo `.exe` é
publicado como release no GitHub**: o painel serve esse `.exe` por proxy em
`GET /downloads/nymbus-impressora.exe` — ele busca o asset `.exe` da release **mais
recente** (`latest`) do repo `nymbuslab/bot-restaurante`, e `GET /api/agente/versao-publicada`
mostra a versão a partir da `tag` dessa release.

**Requisitos:** rodar em **Windows** (o alvo do build é NSIS) com Node instalado, e o
`gh` CLI autenticado para publicar a release.

## Antes de tudo: isto é necessário?
Só gere uma nova release quando houver mudança em `agente-impressora/` (o **app**).
Correções de **backend** (rotas, claim de impressão, fila) vão pelo **deploy do
servidor** — não precisam de novo `.exe`. Se a mudança foi só no servidor, pare aqui.

## Passo a passo

### 1. Suba a versão
Edite `agente-impressora/package.json`, campo `"version"` (ex.: `0.2.4` → `0.2.5`).
Sem o bump, o painel não detecta atualização e a tag da release fica ambígua. Anote o
que mudou desde a última versão (vira as notas da release no passo 3).

### 2. Rode os testes do agente
```bash
cd agente-impressora
node --test test/*.test.js
```
Use o glob `test/*.test.js` (o script `npm test` do agente é `node --test test/`, que
falha em algumas versões do Node por resolver `test/` como módulo).

### 3. Build do instalador
```bash
cd agente-impressora
npm install            # garante electron / electron-builder / serialport
npm run dist           # = node copy-shared.js && electron-builder
```
`copy-shared.js` copia `public/comanda.js` + `public/serial-escpos.js` para `vendor/`
(o electron-builder só empacota o que está sob o app root, então esses módulos puros
compartilhados precisam ser vendorizados). Saída:
`agente-impressora/dist/Nymbus Impressora Setup <versão>.exe`.

Confirme que o `.exe` saiu com a versão certa antes de publicar.

### 4. Publique a release no GitHub
O proxy resolve `releases/latest` e pega o asset que casa com `/\.exe$/i`; a versão
exibida é a `tag_name` (sem o "v"). Crie a release com a tag da versão e anexe o `.exe`:
```bash
cd agente-impressora
gh release create v<versão> "dist/Nymbus Impressora Setup <versão>.exe" \
  --repo nymbuslab/bot-restaurante \
  --title "Agente de Impressão v<versão>" \
  --notes "<o que mudou>"
```
A release precisa ficar como **latest** — não marque como pre-release nem draft (senão
`releases/latest` não a resolve). O nome do asset precisa terminar em `.exe`.

### 5. Verifique
- `GET https://pedidos.nymbuslab.com.br/api/agente/versao-publicada` deve mostrar a nova
  versão. Há **cache de 10 min** no proxy — pode demorar até 10 min para refletir (ou
  reinicie o app do servidor para limpar).
- No painel, **Configurações → Impressora** mostra a versão publicada e o botão de download.
- Baixe pelo painel e confirme que instala.

## Notas importantes
- **Sem code signing**, o Windows mostra o aviso "editor desconhecido" (SmartScreen). O
  painel já orienta o cliente a clicar "Executar assim mesmo". Assinar o instalador
  (`win.certificateFile`/`publisherName` no `electron-builder.yml`) removeria o aviso e
  habilitaria auto-update — mas hoje o **auto-update está DESLIGADO de propósito** (sem
  assinatura, um feed comprometido instalaria binário não verificado = RCE). Por isso a
  distribuição é **download manual pelo painel**.
- O bloco `publish:` do `electron-builder.yml` (provider generic apontando p/ `/downloads/`)
  só deve ser usado **com** assinatura + `verifyUpdateCodeSignature`. Não ligue o
  auto-update sem isso.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Varredura de código-fonte: app-admin.js roda no navegador (sem DOM no runner),
// então o contrato de UI é verificado no texto, como no padrão do repo.
const appAdmin = fs.readFileSync(path.join(__dirname, "..", "public", "app-admin.js"), "utf8");
const style = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

const corpoModal = () => {
  const i = appAdmin.indexOf("function renderTenantModal");
  return appAdmin.slice(i, appAdmin.indexOf("// Após uma ação"));
};
const corpoAbaTenant = () => appAdmin.slice(appAdmin.indexOf("function trocarAbaTenant"), appAdmin.indexOf("function renderTenantModal"));
const corpoBlocoTelegram = () => appAdmin.slice(appAdmin.indexOf("function renderBlocoTelegram"));

// ==========================================================================
// T-02.04 — modal Gerenciar em duas abas
// ==========================================================================

test("T-02.04 renderTenantModal cria dois containers de aba distintos", () => {
  const c = corpoModal();
  assert.match(c, /am-t-painel-assinatura/, "container da aba Assinatura");
  assert.match(c, /am-t-painel-telegram/, "container da aba Relatórios Telegram");
  assert.match(c, /data-aba="assinatura"/, "botão da aba Assinatura");
  assert.match(c, /data-aba="telegram"/, "botão da aba Relatórios Telegram");
});

test("T-02.04 conteúdo de cada área fica no seu container", () => {
  const c = corpoModal();
  const iAss = c.indexOf('id="am-t-painel-assinatura"');
  const iTg = c.indexOf('id="am-t-painel-telegram"');
  assert.ok(iAss > -1 && iTg > -1 && iAss < iTg, "painel Assinatura antes do Telegram");
  const blocoAss = c.slice(iAss, iTg);
  const blocoTg = c.slice(iTg);
  assert.match(blocoAss, /\$\{resumo\}\$\{acoes\}\$\{faturas\}/, "resumo+ações+faturas interpolados no painel Assinatura");
  assert.match(blocoTg, /id="am-t-telegram"/, "bloco Telegram (literal) fica no seu painel");
});

test("T-02.04 trocar de aba alterna a visibilidade sem recarregar", () => {
  const c = corpoModal();
  assert.match(c, /querySelectorAll\("\.am-t-aba"\)|classList\.add\("on"\)/, "handler das abas existe");
  assert.match(corpoAbaTenant(), /\.hidden\s*=|hidden\s*=/, "alterna via hidden");
});

test("T-02.04 style.css estiliza as abas e oculta o painel inativo", () => {
  assert.match(style, /\.am-t-aba/, "estilo da aba");
  assert.match(style, /\.am-t-aba\.on/, "estilo da aba ativa");
  assert.match(style, /\.am-t-painel\[hidden\]/, "painel oculto some do layout");
});

// ==========================================================================
// T-02.05 — checkboxes de tipo e campo de margem
// ==========================================================================

test("T-02.05 bloco vinculado renderiza 3 checkboxes de tipo", () => {
  const c = corpoBlocoTelegram();
  assert.match(c, /tipoTelegramTipo\(\s*"fechamentoCaixa"/, "checkbox fechamento de caixa");
  assert.match(c, /tipoTelegramTipo\(\s*"estoque"/, "checkbox estoque baixo");
  assert.match(c, /tipoTelegramTipo\(\s*"cancelamento"/, "checkbox alerta de cancelamento");
  assert.match(c, /data-tg-tipo="\$\{tipo\}"/, "cada linha carrega o marcador do tipo");
});

test("T-02.05 cada tipo mostra o status do último envio (st.ultimoEnvio)", () => {
  const c = corpoBlocoTelegram();
  assert.match(c, /st\.tipos|st\.ultimoEnvio/, "lê st.tipos e st.ultimoEnvio do GET");
  assert.match(c, /data-tg-envio/, "indicador de último envio por tipo");
  assert.match(c, /Nunca enviou/, "estado sem envio para tipo nunca enviado");
});

test("T-02.05 alterar checkbox ou a margem dispara POST .../telegram/tipos", () => {
  const c = corpoBlocoTelegram();
  assert.match(c, /telegram\/tipos/, "chama a rota de salvar tipos");
  assert.match(c, /addEventListener\(\s*"change"|addEventListener\(\s*"input"/, "escuta as alterações dos controles");
});

test("T-02.05 controles refletem o GET e a margem desabilita sem cancelamento", () => {
  const c = corpoBlocoTelegram();
  assert.match(c, /st\.tipos/, "lê st.tipos do GET (defaults quando ausente)");
  assert.match(c, /cancelamentoAtivo/, "margem depende do alerta de cancelamento");
  assert.match(c, /disabled/, "campo pode ficar desabilitado");
});

test("T-02.05 margem é texto com inputmode numeric (nunca type=number)", () => {
  const c = corpoBlocoTelegram();
  assert.match(c, /inputmode="numeric"/, "inputmode numeric");
  assert.doesNotMatch(c, /type="number"/, "nunca type=number na UI de R$");
});

test("T-02.05 feedback de salvamento automático visível", () => {
  const c = corpoBlocoTelegram();
  assert.match(c, /salvas automaticamente/i, "feedback após salvar");
});
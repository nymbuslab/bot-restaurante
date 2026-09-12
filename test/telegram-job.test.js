const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Env dummy (mesmo preâmbulo dos demais testes).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";

const db = require("../src/db");
const store = require("../src/store");
const empresas = require("../src/empresas");
const telegram = require("../src/telegram");

const indexJs = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

// Slug único por teste para não colidir no cache do store
let contador = 0;
function slugTeste() { return "tg-job-test-" + (++contador); }

// Stub db.query e restaura ao final
function comQueryFake(fake) {
  const antes = db.query;
  db.query = fake;
  return () => { db.query = antes; };
}

// ==========================================================================
// T-02.04 — Job de resolução de vínculo por polling (index.js)
// ==========================================================================

test("T-02.04 index.js registra o job dentro de try/catch que nunca lança", () => {
  const i = indexJs.indexOf("async function pollTelegram");
  assert.ok(i > -1, "job pollTelegram deve existir em index.js");
  const marcador = "setInterval(pollTelegram, 30 * 60 * 1000)";
  const j = indexJs.indexOf(marcador, i);
  assert.ok(j > -1, "job deve ter setInterval periódico");
  const corpo = indexJs.slice(i, j + marcador.length);
  assert.match(corpo, /try\s*{/, "job deve rodar dentro de try");
  assert.match(corpo, /catch\s*\(e\)/, "job deve capturar falha");
  assert.match(corpo, /console\.error/, "falha deve logar, não derrubar o processo");
  assert.match(corpo, /telegram\.buscarUpdates/, "job deve chamar buscarUpdates");
  assert.match(corpo, /telegram\.resolverVinculos/, "job deve chamar resolverVinculos");
  assert.match(corpo, /setTimeout\(pollTelegram/, "job deve rodar no boot");
  assert.match(corpo, /setInterval\(pollTelegram/, "job deve rodar periodicamente");
});

test("T-02.04 vincular chamado pelo job usa store.ensure antes de getConfig", () => {
  const i = indexJs.indexOf("async function pollTelegram");
  assert.ok(i > -1);
  const corpo = indexJs.slice(i, indexJs.indexOf("setInterval", i));
  const iVincular = corpo.indexOf("async (slug, chatId)");
  assert.ok(iVincular > -1, "vincular deve ser função injetada em resolverVinculos");
  const vincular = corpo.slice(iVincular, iVincular + 500);
  const iEnsure = vincular.indexOf("store.ensure");
  const iGetConfig = vincular.indexOf("store.getConfig");
  assert.ok(iEnsure > -1 && iGetConfig > iEnsure,
    "store.ensure deve vir ANTES de store.getConfig (cache pode estar frio)");
  assert.match(vincular, /store\.setConfig/, "deve gravar o vínculo");
});

// D-08: o código de vinculação é de USO ÚNICO. Sem apagar codigoVinculacao ao
// gravar o chatId, o mesmo link continuaria válido para sempre — qualquer um
// que descobrisse o código no futuro poderia sequestrar o vínculo do tenant.
test("T-02.04 vincular apaga codigoVinculacao ao gravar o chatId (D-08, uso único)", () => {
  const i = indexJs.indexOf("async function pollTelegram");
  const corpo = indexJs.slice(i, indexJs.indexOf("setInterval", i));
  const iVincular = corpo.indexOf("async (slug, chatId)");
  const vincular = corpo.slice(iVincular, iVincular + 500);
  assert.match(vincular, /delete\s+\w+\.codigoVinculacao/,
    "vincular deve apagar codigoVinculacao do config.telegram antes de gravar — senão o link nunca expira");
});

test("T-02.04 vincular preserva chaves fora de telegram ao gravar chatId", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = {
    restaurante: { nome: "Padaria Y" },
    pagamentos: ["Dinheiro", "Cartão"],
    mensagens: { saudacao: "Olá!" },
  };
  let configNoBanco = JSON.parse(JSON.stringify(configFixture));
  const restaurar = comQueryFake(async (sql, params) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configNoBanco, cardapio: { categorias: [] } }] };
    }
    if (/UPDATE empresas SET config/.test(sql)) {
      configNoBanco = JSON.parse(params[0]);
      return { rowCount: 1 };
    }
    return { rows: [] };
  });
  try {
    // Simula o corpo de vincular(tenant, chatId) do job: tenant "frio"
    // (cache nunca tocado antes deste ensure) + merge SÓ da chave telegram,
    // apagando codigoVinculacao (D-08, uso único).
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const chatId = 555999;
    const telegramRestante = { ...(cfg.telegram || {}) };
    delete telegramRestante.codigoVinculacao;
    const novoCfg = { ...cfg, telegram: { ...telegramRestante, chatId } };
    await store.setConfig(dir, novoCfg);
    const salvo = store.getConfig(dir);
    assert.deepEqual(salvo.restaurante, configFixture.restaurante, "restaurante preservado");
    assert.deepEqual(salvo.pagamentos, configFixture.pagamentos, "pagamentos preservados");
    assert.deepEqual(salvo.mensagens, configFixture.mensagens, "mensagens preservadas");
    assert.equal(salvo.telegram.chatId, chatId, "chatId gravado");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.04 vincular com tenant frio apaga o código antigo ao atualizar o chatId (D-08)", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = {
    restaurante: { nome: "Padaria Z" },
    telegram: { codigoVinculacao: "velho", chatId: 111 },
  };
  let configNoBanco = JSON.parse(JSON.stringify(configFixture));
  const restaurar = comQueryFake(async (sql, params) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configNoBanco, cardapio: { categorias: [] } }] };
    }
    if (/UPDATE empresas SET config/.test(sql)) {
      configNoBanco = JSON.parse(params[0]);
      return { rowCount: 1 };
    }
    return { rows: [] };
  });
  try {
    // Tenant frio: ensure é a primeira coisa. Um segundo /start (ex.: código
    // vazado ou reprocessado) não pode mais achar o código antigo válido.
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const telegramRestante = { ...(cfg.telegram || {}) };
    delete telegramRestante.codigoVinculacao;
    const novoCfg = { ...cfg, telegram: { ...telegramRestante, chatId: 222 } };
    await store.setConfig(dir, novoCfg);
    const salvo = store.getConfig(dir);
    assert.deepEqual(salvo.restaurante, configFixture.restaurante, "restaurante preservado");
    assert.equal(salvo.telegram.chatId, 222, "chatId atualizado");
    assert.equal(salvo.telegram.codigoVinculacao, undefined, "código antigo apagado (uso único, D-08)");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

// ==========================================================================
// buscarUpdates (api do getUpdates) — usado pelo job
// ==========================================================================

test("buscarUpdates está exportado e devolve array sem lançar", async () => {
  assert.equal(typeof telegram.buscarUpdates, "function");
  const fetchOriginal = global.fetch;
  // Sem config, buscarUpdates nem deve chegar na rede; com config, uma falha de
  // rede deve virar [] (nunca rejeitar — padrão fire-and-forget dos jobs).
  global.fetch = async () => { throw new Error("rede fora"); };
  try {
    const resultado = await telegram.buscarUpdates();
    assert.equal(Array.isArray(resultado), true);
  } finally {
    global.fetch = fetchOriginal;
  }
});

// Sem avançar o offset, o getUpdates devolve o MESMO lote para sempre —
// desperdiça chamadas e, acima de 100 updates não confirmados (limite padrão
// da API), pode nem trazer o /start mais recente. buscarUpdates(offset) deve
// mandar o parâmetro; proximoOffset deve devolver update_id + 1 do maior lote.
test("buscarUpdates manda o offset na URL quando informado", async () => {
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "123:fake";
  delete require.cache[require.resolve("../src/telegram")];
  const tg = require("../src/telegram");
  const fetchOriginal = global.fetch;
  let urlChamada = null;
  global.fetch = async (url) => { urlChamada = url; return { ok: true, json: async () => ({ ok: true, result: [] }) }; };
  try {
    await tg.buscarUpdates(42);
    assert.match(urlChamada, /[?&]offset=42(&|$)/, "offset deve ir na query string do getUpdates");
    await tg.buscarUpdates();
    assert.doesNotMatch(urlChamada, /offset=/, "sem offset informado, não manda o parâmetro");
  } finally {
    global.fetch = fetchOriginal;
  }
});

test("proximoOffset devolve o maior update_id + 1; lote vazio devolve null", () => {
  assert.equal(telegram.proximoOffset([]), null);
  assert.equal(telegram.proximoOffset(null), null);
  assert.equal(telegram.proximoOffset([{ update_id: 10 }, { update_id: 15 }, { update_id: 12 }]), 16);
});

test("T-02.04 pollTelegram guarda o offset e passa para a próxima chamada de buscarUpdates", () => {
  const i = indexJs.indexOf("async function pollTelegram");
  const j = indexJs.indexOf("setInterval(pollTelegram", i);
  const corpo = indexJs.slice(Math.max(0, i - 200), j);
  assert.match(corpo, /let\s+telegramOffset/, "offset deve ser guardado entre rodadas do polling");
  assert.match(corpo, /telegram\.buscarUpdates\(telegramOffset\)/, "buscarUpdates deve receber o offset guardado");
  assert.match(corpo, /telegramOffset\s*=\s*telegram\.proximoOffset\(updates\)/, "offset deve avançar a cada rodada com updates");
});
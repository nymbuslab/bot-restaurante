const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Env dummy: src/supabase.js lança no require quando falta credencial, e
// src/telegram.js avalia CONFIGURADO no load — sem TELEGRAM_BOT_TOKEN o enviar()
// viraria no-op e os testes de "enviou de verdade" não teriam o que testar.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "123:fake-token";
process.env.TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "nmb_test_bot";

const db = require("../src/db");
const store = require("../src/store");
const empresas = require("../src/empresas");
const telegram = require("../src/telegram");

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

// Slug único por teste para não colidir no cache do store
let contador = 0;
function slugTeste() { return "tg-rotas-" + (++contador); }

// Stub db.query e restaura ao final
function comQueryFake(fake) {
  const antes = db.query;
  db.query = fake;
  return () => { db.query = antes; };
}

// ==========================================================================
// T-02.01 — GET /api/admin/tenants/:slug/telegram
// ==========================================================================

test("T-02.01 rota existe e fica atrás de exigeSuperAdmin", () => {
  const c = corpoDaRota('app.get("/api/admin/tenants/:slug/telegram"');
  assert.match(c, /exigeSuperAdmin/, "rota deve ficar atrás de exigeSuperAdmin");
  assert.match(c, /buscarPorSlug/, "rota deve resolver o tenant");
  assert.match(c, /store\.ensure/, "rota deve chamar store.ensure antes de getConfig");
  assert.match(c, /store\.getConfig/, "rota deve ler o config");
  assert.match(c, /temRelatoriosTelegram/, "rota deve checar plano");
});

test("T-02.01 com vinculo + plano completo devolve campos corretos", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = {
    restaurante: { nome: "Padaria X" },
    telegram: { codigoVinculacao: "abc123def456", chatId: 555123 },
  };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const telegramCfg = cfg.telegram || {};
    const vinculado = !!telegramCfg.chatId;
    const emp = { slug, plano: "completo", ativo: true, assinaturaStatus: "active" };
    const temPlano = empresas.temRelatoriosTelegram(emp);
    const link = vinculado ? null : (telegramCfg.codigoVinculacao ? telegram.linkVinculacao(telegramCfg.codigoVinculacao) : null);
    assert.equal(vinculado, true, "chatId existe → vinculado");
    assert.equal(temPlano, true, "plano completo → temPlano");
    assert.equal(link, null, "ja vinculado → link null");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.01 com codigo gerado mas sem chatId devolve vinculado=false e link", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const codigo = "abc123def456";
  const configFixture = { telegram: { codigoVinculacao: codigo } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const telegramCfg = cfg.telegram || {};
    const vinculado = !!telegramCfg.chatId;
    const link = vinculado ? null : (telegramCfg.codigoVinculacao ? telegram.linkVinculacao(telegramCfg.codigoVinculacao) : null);
    assert.equal(vinculado, false, "sem chatId → não vinculado");
    assert.ok(link, "link deve existir");
    assert.match(link, /t\.me\//);
    assert.match(link, new RegExp(codigo));
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.01 sem config telegram devolve vinculado=false e link=null", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { restaurante: { nome: "X" } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const telegramCfg = cfg.telegram || {};
    const vinculado = !!telegramCfg.chatId;
    const link = vinculado ? null : (telegramCfg.codigoVinculacao ? telegram.linkVinculacao(telegramCfg.codigoVinculacao) : null);
    assert.equal(vinculado, false);
    assert.equal(link, null);
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.01 com slug inexistente — ensure lança (404 no handler)", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const restaurar = comQueryFake(async () => ({ rows: [] }));
  try {
    store.esquecer(slug);
    await assert.rejects(() => store.ensure(dir), /Tenant não encontrado/);
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-03.02 GET devolve ultimoEnvio — critério de saída do sprint", () => {
  const c = corpoDaRota('app.get("/api/admin/tenants/:slug/telegram"');
  assert.ok(/ultimoEnvio/.test(c), "rota deve ler config.telegram.ultimoEnvio");
  assert.ok(/res\.json\([^)]*ultimoEnvio/.test(c), "response deve incluir ultimoEnvio");
});

test("T-02.01 GET inclui tipos via telegram.tiposAtivos e ultimoEnvio por tipo", () => {
  const c = corpoDaRota('app.get("/api/admin/tenants/:slug/telegram"');
  assert.match(c, /telegram\.tiposAtivos\(/, "rota deve chamar telegram.tiposAtivos");
  assert.match(c, /tipos/, "response deve incluir tipos");
  assert.match(c, /fechamentoCaixa/, "ultimoEnvio deve ser normalizado por tipo");
  assert.match(c, /estoque/, "ultimoEnvio deve ser normalizado por tipo");
  assert.match(c, /cancelamento/, "ultimoEnvio deve ser normalizado por tipo");
  assert.ok(/store\.ensure/.test(c) && c.indexOf("store.ensure") < c.indexOf("store.getConfig"),
    "store.ensure deve vir antes de store.getConfig (não regredir)");
});

test("T-02.01 tenant frio sem tipos devolve defaults com tipos ligados", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { telegram: { chatId: 111 } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const tipos = telegram.tiposAtivos(cfg);
    assert.deepEqual(tipos, { fechamentoCaixa: true, estoque: true, cancelamentoAtivo: false, margemMinima: 0 });
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.01 ultimoEnvio no formato antigo (flat) não lança e vira objeto com os 3 tipos null (D-11)", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { telegram: { chatId: 111, ultimoEnvio: { em: "2026-09-07T00:00:00.000Z", status: "sucesso" } } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const telegramCfg = cfg.telegram || {};
    const ue = telegramCfg.ultimoEnvio;
    const ultimoEnvio = {
      fechamentoCaixa: ue && "fechamentoCaixa" in ue ? ue.fechamentoCaixa : null,
      estoque: ue && "estoque" in ue ? ue.estoque : null,
      cancelamento: ue && "cancelamento" in ue ? ue.cancelamento : null,
    };
    assert.deepEqual(ultimoEnvio, { fechamentoCaixa: null, estoque: null, cancelamento: null },
      "formato antigo não tem chave por tipo → todos null, sem lançar");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.01 ultimoEnvio com chaves por tipo passa intacto a cada tipo", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = {
    telegram: { chatId: 111, ultimoEnvio: { fechamentoCaixa: "2026-09-07T10:00:00.000Z", estoque: null, cancelamento: "2026-09-06T09:00:00.000Z" } },
  };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const telegramCfg = cfg.telegram || {};
    const ue = telegramCfg.ultimoEnvio;
    const ultimoEnvio = {
      fechamentoCaixa: ue && "fechamentoCaixa" in ue ? ue.fechamentoCaixa : null,
      estoque: ue && "estoque" in ue ? ue.estoque : null,
      cancelamento: ue && "cancelamento" in ue ? ue.cancelamento : null,
    };
    assert.equal(ultimoEnvio.fechamentoCaixa, "2026-09-07T10:00:00.000Z");
    assert.equal(ultimoEnvio.estoque, null);
    assert.equal(ultimoEnvio.cancelamento, "2026-09-06T09:00:00.000Z");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

// ==========================================================================
// T-02.02 — POST /api/admin/tenants/:slug/telegram/gerar-codigo
// ==========================================================================

test("T-02.02 rota existe e fica atrás de exigeSuperAdmin", () => {
  const c = corpoDaRota('app.post("/api/admin/tenants/:slug/telegram/gerar-codigo"');
  assert.match(c, /exigeSuperAdmin/, "rota deve ficar atrás de exigeSuperAdmin");
  assert.match(c, /store\.ensure/, "rota deve chamar store.ensure");
  assert.match(c, /store\.getConfig/, "rota deve ler config");
  assert.match(c, /store\.setConfig/, "rota deve gravar config");
});

test("T-02.02 merge preserva restaurante e pagamentos existentes", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = {
    restaurante: { nome: "Padaria X" },
    pagamentos: ["Dinheiro", "PIX"],
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
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const codigo = telegram.gerarCodigoVinculacao();
    const novoCfg = { ...cfg, telegram: { codigoVinculacao: codigo } };
    await store.setConfig(dir, novoCfg);
    const salvo = store.getConfig(dir);
    assert.deepEqual(salvo.restaurante, configFixture.restaurante, "restaurante preservado");
    assert.deepEqual(salvo.pagamentos, configFixture.pagamentos, "pagamentos preservados");
    assert.equal(salvo.telegram.codigoVinculacao, codigo, "codigo salvo");
    assert.equal(salvo.telegram.chatId, undefined, "chatId não existe ainda");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.02 duas chamadas geram codigos diferentes e a segunda limpa chatId", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  let configNoBanco = { telegram: { chatId: 999, codigoVinculacao: "velho" } };
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
    store.esquecer(slug);
    await store.ensure(dir);
    // Primeira geração
    const cfg1 = store.getConfig(dir);
    const cod1 = telegram.gerarCodigoVinculacao();
    await store.setConfig(dir, { ...cfg1, telegram: { codigoVinculacao: cod1 } });
    // Segunda geração
    const cfg2 = store.getConfig(dir);
    const cod2 = telegram.gerarCodigoVinculacao();
    assert.notEqual(cod1, cod2, "códigos devem ser diferentes");
    await store.setConfig(dir, { ...cfg2, telegram: { codigoVinculacao: cod2 } });
    const final_ = store.getConfig(dir);
    assert.equal(final_.telegram.chatId, undefined, "chatId antigo removido");
    assert.equal(final_.telegram.codigoVinculacao, cod2);
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.02 com tenant frio (cache nunca tocado) nao lanca", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { restaurante: { nome: "Y" } };
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
    // slug nunca usado antes neste processo
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const codigo = telegram.gerarCodigoVinculacao();
    await store.setConfig(dir, { ...cfg, telegram: { codigoVinculacao: codigo } });
    const salvo = store.getConfig(dir);
    assert.deepEqual(salvo.restaurante, configFixture.restaurante, "restaurante preservado");
    assert.equal(salvo.telegram.codigoVinculacao, codigo);
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

// ==========================================================================
// T-02.03 — POST /api/admin/tenants/:slug/telegram/teste
// ==========================================================================

test("T-02.03 rota existe e fica atrás de exigeSuperAdmin", () => {
  const c = corpoDaRota('app.post("/api/admin/tenants/:slug/telegram/teste"');
  assert.match(c, /exigeSuperAdmin/, "rota deve ficar atrás de exigeSuperAdmin");
  assert.match(c, /store\.ensure/, "rota deve chamar store.ensure");
  assert.match(c, /store\.getConfig/, "rota deve ler config");
  assert.match(c, /telegram\.enviar/, "rota deve chamar telegram.enviar");
});

test("T-02.03 sem chatId — rota deveria retornar 400", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { telegram: { codigoVinculacao: "abc" } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const chatId = cfg.telegram && cfg.telegram.chatId;
    assert.ok(!chatId, "sem chatId — rota deveria retornar 400");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.03 com chatId, enviar retorna ok", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { telegram: { chatId: 555123 } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  const fetchOriginal = global.fetch;
  global.fetch = async () => ({ ok: true });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const chatId = cfg.telegram && cfg.telegram.chatId;
    assert.ok(chatId, "chatId deve existir");
    const resultado = await telegram.enviar(chatId, "Mensagem de teste do Nymbus Pedidos");
    assert.equal(resultado.ok, true);
  } finally {
    restaurar();
    store.esquecer(slug);
    global.fetch = fetchOriginal;
  }
});

test("T-02.03 com tenant frio (cache nunca tocado) e chatId, enviar retorna ok", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  const configFixture = { telegram: { chatId: 777888 } };
  const restaurar = comQueryFake(async (sql) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: configFixture, cardapio: { categorias: [] } }] };
    }
    return { rows: [] };
  });
  const fetchOriginal = global.fetch;
  global.fetch = async () => ({ ok: true });
  try {
    // slug nunca usado antes neste processo
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const chatId = cfg.telegram && cfg.telegram.chatId;
    assert.ok(chatId, "chatId deve existir");
    const resultado = await telegram.enviar(chatId, "Teste");
    assert.equal(resultado.ok, true);
  } finally {
    restaurar();
    store.esquecer(slug);
    global.fetch = fetchOriginal;
  }
});

// ==========================================================================
// T-02.02 — POST /api/admin/tenants/:slug/telegram/tipos
// ==========================================================================

test("T-02.02 rota existe, fica atrás de exigeSuperAdmin e só mescla config.telegram.tipos", () => {
  const c = corpoDaRota('app.post("/api/admin/tenants/:slug/telegram/tipos"');
  assert.match(c, /exigeSuperAdmin/, "rota deve ficar atrás de exigeSuperAdmin");
  assert.match(c, /store\.ensure/, "rota deve chamar store.ensure");
  assert.match(c, /store\.getConfig/, "rota deve ler o config INTEIRO para mesclar");
  assert.match(c, /store\.setConfig/, "rota deve gravar de volta");
});

test("T-02.02 margem negativa responde 400 na própria rota", () => {
  const c = corpoDaRota('app.post("/api/admin/tenants/:slug/telegram/tipos"');
  assert.match(c, /margemMinima/, "rota deve ler a margem do body");
  assert.match(c, /400/, "rota deve responder 400 para margem inválida");
});

test("T-02.02 POST dos tipos grava os 4 campos e preserva chatId/codigo/restaurante", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  let banco = { restaurante: { nome: "Padaria X" }, pagamentos: ["PIX"], telegram: { chatId: 555123, codigoVinculacao: "abc" } };
  const gravacoes = [];
  const restaurar = comQueryFake(async (sql, params) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: banco, cardapio: { categorias: [] } }] };
    }
    if (/UPDATE empresas SET config/.test(sql)) {
      banco = JSON.parse(params[0]);
      gravacoes.push(params[0]);
      return { rowCount: 1 };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg = store.getConfig(dir);
    const tipos = { fechamentoCaixa: false, estoque: true, cancelamentoAtivo: true, margemMinima: 10 };
    const novoCfg = { ...cfg, telegram: { ...(cfg.telegram || {}), tipos } };
    await store.setConfig(dir, novoCfg);
    const salvo = store.getConfig(dir);
    assert.deepEqual(salvo.telegram.tipos, tipos, "tipos salvos exatamente como enviados");
    assert.equal(salvo.telegram.chatId, 555123, "chatId preservado");
    assert.equal(salvo.telegram.codigoVinculacao, "abc", "codigo de vinculaçao preservado");
    assert.deepEqual(salvo.restaurante, { nome: "Padaria X" }, "restaurante preservado");
    assert.deepEqual(salvo.pagamentos, ["PIX"], "pagamentos preservados");
    assert.equal(gravacoes.length, 1, "uma única gravação (sem apagar nada)");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

test("T-02.02 com tenant frio (tipos ausente) grava sem lançar e devolve defaults até gravar", async () => {
  const slug = slugTeste();
  const dir = empresas.tenantDir(slug);
  let banco = { telegram: { chatId: 42 } };
  const restaurar = comQueryFake(async (sql, params) => {
    if (/SELECT config, cardapio/.test(sql)) {
      return { rows: [{ config: banco, cardapio: { categorias: [] } }] };
    }
    if (/UPDATE empresas SET config/.test(sql)) {
      banco = JSON.parse(params[0]);
      return { rowCount: 1 };
    }
    return { rows: [] };
  });
  try {
    store.esquecer(slug);
    await store.ensure(dir);
    const cfg1 = store.getConfig(dir);
    const tiposAntes = telegram.tiposAtivos(cfg1);
    assert.deepEqual(tiposAntes, { fechamentoCaixa: true, estoque: true, cancelamentoAtivo: false, margemMinima: 0 });
    const novosTipos = { fechamentoCaixa: false, estoque: true, cancelamentoAtivo: true, margemMinima: 15 };
    const novoCfg = { ...cfg1, telegram: { ...(cfg1.telegram || {}), tipos: novosTipos } };
    await store.setConfig(dir, novoCfg);
    const salvo = store.getConfig(dir);
    assert.deepEqual(salvo.telegram.tipos, novosTipos, "tipos gravados");
    assert.equal(salvo.telegram.chatId, 42, "chatId preservado");
  } finally {
    restaurar();
    store.esquecer(slug);
  }
});

// ============================================================
// TESTES — T-03.01/T-03.02: alerta de cancelamento/estorno no
// Telegram (D-05/D-06/D-07). Após o COMMIT de cancelarRecebido
// (T-03.01) e de estornarRecebimento (T-03.02), o hook dispara
// fire-and-forget o alerta ao chat vinculado, só quando Plano
// Completo + chatId + cancelamentoAtivo, comparando a margem POR
// MOVIMENTO (um pedido em duas formas pode alertar só para uma) e
// gravando ultimoEnvio.cancelamento sem apagar os demais tipos.
// ============================================================
const { test } = require("node:test");
const assert = require("node:assert/strict");

// Env dummy (preâmbulo padrão do projeto): src/supabase.js LANÇA no require sem
// credencial, e este arquivo carrega src/caixa → src/empresas → src/supabase.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";

const dbMod = require("../src/db");
const caixa = require("../src/caixa");
const empresas = require("../src/empresas");
const telegram = require("../src/telegram");

// env dummy antes do require: CONFIGURADO é capturado no load do módulo.
process.env.TELEGRAM_BOT_TOKEN = "teste:token";
process.env.TELEGRAM_BOT_USERNAME = "teste_bot";

const EMP_DIAS = { ativo: true, assinaturaStatus: "active", plano: "completo" };

// Config de um tenant de teste. `chatId` presente ou não decide o envio;
// `tipos`/`ultimoEnvio` são semeados como o GET/admin devolveria.
function configDe(chatId, tipos, ultimoEnvio) {
  const tg = {};
  if (chatId != null) tg.chatId = chatId;
  if (tipos) tg.tipos = tipos;
  if (ultimoEnvio) tg.ultimoEnvio = ultimoEnvio;
  return { restaurante: { nome: "Restaurante Teste" }, pagamentos: ["Dinheiro", "PIX"], telegram: tg };
}

// Dublê do banco para cancelarRecebido/estornarRecebimento + hook. `formas`
// decide o que o SELECT da caixa_movimentos devolve (líquido por forma);
// `envio` é o resultado que o stub de telegram.enviar devolve.
function montar({ emp = EMP_DIAS, chatId, tipos, ultimoEnvio, formas = [{ forma: "Dinheiro", net: 20 }], envio = { ok: true }, buscarComo }) {
  const configsGravados = [];
  const client = {
    async query(sql, params) {
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-canc" }] };
      if (/SELECT config, cardapio FROM empresas/i.test(sql)) {
        return { rows: [{ config: configDe(chatId, tipos, ultimoEnvio), cardapio: { categorias: [] } }] };
      }
      if (/UPDATE empresas SET config/i.test(sql)) {
        configsGravados.push(JSON.parse(params[0]));
        return { rowCount: 1 };
      }
      if (/FROM caixas WHERE/i.test(sql)) {
        return { rows: [{ id: 1, aberto_em: new Date("2026-09-06T10:00:00Z"), fundo_troco: 0, status: "aberto", vencido: false }] };
      }
      if (/FROM pedidos WHERE/i.test(sql)) {
        return { rows: [{ id: 99, numero: 42, itens: [], status: "recebido", recebido_em: new Date("2026-09-06T11:00:00Z") }] };
      }
      if (/FROM caixa_movimentos/i.test(sql)) return { rows: formas };
      if (/INSERT INTO caixa_movimentos/i.test(sql)) {
        const valores = {
          id: 100,
          caixa_id: params[0],
          tipo: /'estorno'/.test(sql) ? "estorno" : "cancelamento",
          forma_pagamento: params[2],
          valor: Number(params[3]),
          pedido_id: params[4],
          descricao: params[5],
          criado_em: new Date(),
        };
        return { rows: [valores] };
      }
      if (/UPDATE pedidos/i.test(sql)) return { rowCount: 1 };
      return { rows: [] };
    },
    release() {},
  };
  const poolAntes = dbMod.pool, queryAntes = dbMod.query;
  const buscarAntes = empresas.buscarPorSlug, enviarAntes = telegram.enviar;
  dbMod.pool = { connect: async () => client };
  dbMod.query = async (sql, params) => client.query(sql, params);
  empresas.buscarPorSlug = buscarComo || (async () => emp);
  const enviados = [];
  const horaEnvios = [];
  telegram.enviar = async (chatIdEnviado, texto) => {
    const inicio = Date.now();
    const r = typeof envio === "function" ? await envio(chatIdEnviado, texto) : envio;
    horaEnvios.push(Date.now() - inicio);
    enviados.push({ chatId: chatIdEnviado, texto });
    return r;
  };
  return {
    enviados,
    horaEnvios,
    configsGravados,
    restaurar() {
      dbMod.pool = poolAntes; dbMod.query = queryAntes;
      empresas.buscarPorSlug = buscarAntes; telegram.enviar = enviarAntes;
    },
  };
}

// Fire-and-forget: dá uma pausa para os microsserviços do disparo terminarem.
const flushar = () => new Promise((r) => setImmediate(r));

const TIPOS_LIGADOS = { fechamentoCaixa: true, estoque: true, cancelamentoAtivo: true, margemMinima: 10 };

// ==========================================================================
// T-03.01 — cancelarRecebido
// ==========================================================================

test("T-03.01 R$20 com margem R$10 dispara alerta de cancelamento ao chat", async () => {
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS });
  try {
    const r = await caixa.cancelarRecebido("/x/tenant-canc-dispara", 99, { devolver: false });
    await flushar();
    assert.equal(cena.enviados.length, 1);
    assert.equal(cena.enviados[0].chatId, 12345);
    assert.match(cena.enviados[0].texto, /Cancelamento de pedido/);
    assert.match(cena.enviados[0].texto, /R\$ 20/);
    assert.match(cena.enviados[0].texto, /Pedido: 42/);
    assert.ok(r && r.cancelado === true, "o cancelamento em si não foi afetado pelo alerta");
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 R$5 com margem R$10 não dispara nem reescreve config", async () => {
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS, formas: [{ forma: "Dinheiro", net: 5 }] });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-abaixo", 99, { devolver: false });
    await flushar();
    assert.equal(cena.enviados.length, 0, "abaixo da margem não alerta");
    assert.equal(cena.configsGravados.length, 0, "sem disparo não há reescrita de config");
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 pedido em 2 formas com margem R$10 dispara só para a forma acima", async () => {
  const cena = montar({
    chatId: 12345, tipos: TIPOS_LIGADOS,
    formas: [{ forma: "Dinheiro", net: 20 }, { forma: "PIX", net: 5 }],
  });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-duas-formas", 99, { devolver: false });
    await flushar();
    assert.equal(cena.enviados.length, 1, "só a forma acima da margem alerta");
    assert.match(cena.enviados[0].texto, /Dinheiro/);
    assert.doesNotMatch(cena.enviados[0].texto, /PIX/);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 sem chatId vinculado não dispara nenhum envio", async () => {
  const cena = montar({ chatId: null, tipos: TIPOS_LIGADOS });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-sem-chat", 99, { devolver: false });
    await flushar();
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 Plano Essencial não dispara mesmo com chatId", async () => {
  const cena = montar({ emp: { ativo: true, assinaturaStatus: "active", plano: "essencial" }, chatId: 555, tipos: TIPOS_LIGADOS });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-essencial", 99, { devolver: false });
    await flushar();
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 cancelamentoAtivo false nunca dispara", async () => {
  const cena = montar({
    chatId: 12345,
    tipos: { fechamentoCaixa: true, estoque: true, cancelamentoAtivo: false, margemMinima: 10 },
  });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-toggle-off", 99, { devolver: false });
    await flushar();
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 ultimoEnvio.cancelamento preserva fechamentoCaixa e estoque já gravados (D-09)", async () => {
  const semeado = {
    fechamentoCaixa: { em: "2026-09-06T12:00:00.000Z", status: "sucesso" },
    estoque: { em: "2026-09-06T12:01:00.000Z", status: "sucesso" },
  };
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS, ultimoEnvio: semeado });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-preserva", 99, { devolver: false });
    await flushar();
    assert.equal(cena.configsGravados.length, 1, "persistiu o alerta uma vez");
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.equal(ue.cancelamento.status, "sucesso");
    assert.equal(ue.cancelamento.pedido, 42);
    assert.equal(ue.cancelamento.tipo, "cancelamento");
    assert.deepEqual(ue.fechamentoCaixa, semeado.fechamentoCaixa, "fechamentoCaixa intacto");
    assert.deepEqual(ue.estoque, semeado.estoque, "estoque intacto");
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 envio com falha grava ultimoEnvio.cancelamento falha com motivo", async () => {
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS, envio: { ok: false, motivo: "chat not found" } });
  try {
    await caixa.cancelarRecebido("/x/tenant-canc-falha", 99, { devolver: false });
    await flushar();
    const ue = cena.configsGravados[0].telegram.ultimoEnvio.cancelamento;
    assert.equal(ue.status, "falha");
    assert.equal(ue.erro, "chat not found");
    assert.ok(ue.em, "registra quando ocorreu");
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 hook é fire-and-forget: nunca aborta nem atrasa o cancelamento", async () => {
  const inicio = Date.now();
  const cena = montar({
    chatId: 12345, tipos: TIPOS_LIGADOS,
    envio: async () => { await new Promise((r) => setTimeout(r, 40)); return { ok: true }; },
  });
  try {
    const r = await caixa.cancelarRecebido("/x/tenant-canc-fire", 99, { devolver: false });
    const ida = Date.now() - inicio;
    assert.ok(r && r.ok === true, "a resposta da rota nunca espera o envio");
    assert.ok(ida < 30, "retornou ~sem esperar o envio lento (" + ida + "ms)");
  } finally {
    // Deixa o envio lento terminar AINDA com os stubs ativos, antes de restaurar.
    await new Promise((r) => setTimeout(r, 60));
    cena.restaurar();
  }
});

// ==========================================================================
// T-03.02 — estornarRecebimento
// ==========================================================================

test("T-03.02 R$20 com margem R$10 dispara alerta com texto de estorno", async () => {
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS });
  try {
    const r = await caixa.estornarRecebimento("/x/tenant-est-dispara", 99);
    await flushar();
    assert.equal(cena.enviados.length, 1);
    assert.match(cena.enviados[0].texto, /Estorno de recebimento/);
    assert.match(cena.enviados[0].texto, /R\$ 20/);
    assert.doesNotMatch(cena.enviados[0].texto, /Cancelamento de pedido/);
    assert.ok(r && r.ok === true, "o estorno em si não foi afetado pelo alerta");
  } finally {
    cena.restaurar();
  }
});

test("T-03.02 estorno abaixo da margem não dispara", async () => {
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS, formas: [{ forma: "Dinheiro", net: 5 }] });
  try {
    await caixa.estornarRecebimento("/x/tenant-est-abaixo", 99);
    await flushar();
    assert.equal(cena.enviados.length, 0);
    assert.equal(cena.configsGravados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.02 ultimoEnvio.cancelamento reflete estorno e preserva demais tipos", async () => {
  const semeado = { fechamentoCaixa: { em: "2026-09-06T12:00:00.000Z", status: "sucesso" } };
  const cena = montar({ chatId: 12345, tipos: TIPOS_LIGADOS, ultimoEnvio: semeado });
  try {
    await caixa.estornarRecebimento("/x/tenant-est-preserva", 99);
    await flushar();
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.equal(ue.cancelamento.tipo, "estorno");
    assert.equal(ue.cancelamento.pedido, 42);
    assert.deepEqual(ue.fechamentoCaixa, semeado.fechamentoCaixa, "fechamentoCaixa intacto");
  } finally {
    cena.restaurar();
  }
});

test("T-03.02 falha ao buscar o tenant não aborta o estorno", async () => {
  const cena = montar({
    chatId: 12345, tipos: TIPOS_LIGADOS,
    buscarComo: async () => { throw new Error("banco fora"); },
  });
  try {
    const r = await caixa.estornarRecebimento("/x/tenant-est-falha", 99);
    await flushar();
    assert.ok(r && r.ok === true, "o estorno persiste mesmo sem o alerta");
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});
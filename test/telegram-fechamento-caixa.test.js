// ============================================================
// TESTES — T-03.01: fecharCaixa dispara os relatórios Telegram
// (fechamento de caixa + alerta de estoque baixo) em DUAS mensagens
// separadas ao chat vinculado, só para tenant com Plano Completo
// (D-05, D-12). Sem chatId, sem plano ou sem tenant: zero envios.
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

// Config de um tenant de teste. `chatId` presente ou não decide o envio.
// `tipos`/`ultimoEnvio` são semeados como o GET/admin devolveria (T-03.03).
function configDe(chatId, tipos, ultimoEnvio) {
  const tg = chatId == null ? {} : { chatId };
  if (tipos) tg.tipos = tipos;
  if (ultimoEnvio) tg.ultimoEnvio = ultimoEnvio;
  return {
    restaurante: { nome: "Restaurante Teste" },
    pagamentos: ["Dinheiro", "PIX"],
    telegram: tg,
  };
}

// Cardápio com um item com estoque baixo (X-Burger, 1 de mín. 5) e um saudável.
function cardapioDe() {
  return {
    categorias: [{ nome: "Lanches", itens: [
      { id: "it-x", nome: "X-Burger", estoque: 1, estoqueMinimo: 5 },
      { id: "it-s", nome: "Suco", estoque: 20, estoqueMinimo: 5 },
    ] }],
  };
}

// Dublê do banco: responde às queries que fecharCaixa emite e registra tudo.
// `emp` é o que `empresas.buscarPorSlug` devolve; `chatId` decide se há vínculo;
// `envio` é o resultado que o stub de telegram.enviar devolve.
function montar({ emp, chatId, tipos, ultimoEnvio, buscarComo, envio = { ok: true } }) {
  const movimentos = [
    { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 120 },
    { tipo: "recebimento", forma_pagamento: "PIX", valor: 80 },
  ];
  const configsGravados = [];
  const client = {
    async query(sql, params) {
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-fechar" }] };
      if (/SELECT config, cardapio FROM empresas/i.test(sql)) {
        return { rows: [{ config: configDe(chatId, tipos, ultimoEnvio), cardapio: cardapioDe() }] };
      }
      if (/UPDATE empresas SET config/i.test(sql)) {
        configsGravados.push(JSON.parse(params[0]));
        return { rowCount: 1 };
      }
      if (/FOR UPDATE/i.test(sql)) {
        return { rows: [{ id: 1, aberto_em: new Date("2026-09-06T10:00:00Z"), fundo_troco: 0, operador: "Zeca", status: "aberto" }] };
      }
      if (/FROM caixa_movimentos/i.test(sql)) return { rows: movimentos };
      if (/FROM mesas/i.test(sql)) return { rows: [{ n: 0 }] };
      if (/FROM pedidos/i.test(sql)) return { rows: [{ n: 0 }] };
      if (/UPDATE caixas/i.test(sql)) return { rowCount: 1 };
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
  telegram.enviar = async (chatIdEnviado, texto) => {
    enviados.push({ chatId: chatIdEnviado, texto });
    return typeof envio === "function" ? envio(chatIdEnviado, texto) : envio;
  };
  return {
    enviados,
    configsGravados,
    restaurar() {
      dbMod.pool = poolAntes; dbMod.query = queryAntes;
      empresas.buscarPorSlug = buscarAntes; telegram.enviar = enviarAntes;
    },
  };
}

// Fire-and-forget: dá uma pausa para os microsserviços do disparo terminarem.
const flushar = () => new Promise((r) => setImmediate(r));

// ----- Tenant em dias -----------------------------------------------------

test("T-03.01 com chat vinculado dispara exatamente dois envios com textos distintos", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-on", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 2, "fechamento + estoque separados (D-12)");
    assert.ok(cena.enviados.every((e) => e.chatId === 12345), "ambos vão para o chat vinculado");
    assert.notEqual(cena.enviados[0].texto, cena.enviados[1].texto, "mensagens precisam ser diferentes");
    const textos = cena.enviados.map((e) => e.texto).join("|");
    assert.match(textos, /Fechamento de caixa/, "uma mensagem é o fechamento");
    assert.match(textos, /Estoque baixo/, "a outra é o alerta de estoque");
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 sem chatId vinculado não dispara nenhum envio", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: null,
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-sem-chat", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 tenant do Plano Essencial não dispara mesmo com chatId", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "essencial" },
    chatId: 555,
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-essencial", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 tenant suspenso (gate temRelatoriosTelegram) não dispara", async () => {
  const cena = montar({
    emp: { ativo: false, assinaturaStatus: "active", plano: "completo" },
    chatId: 777,
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-suspenso", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

test("T-03.01 falha ao buscar o tenant não aborta o fechamento", async () => {
  const cena = montar({
    emp: null,
    chatId: 12345,
    buscarComo: async () => { throw new Error("banco fora"); },
  });
  try {
    const r = await caixa.fecharCaixa("/x/tenant-avisa-falha", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.ok(r && typeof r.diferenca === "number", "o fechamento persiste mesmo sem o envio");
    assert.equal(cena.enviados.length, 0);
  } finally {
    cena.restaurar();
  }
});

// ==========================================================================
// T-03.02 — Store do config.telegram.ultimoEnvio (D-07) após cada envio.
// O registro mescla no config JÁ carregado por fecharCaixa: nada fora da
// chave telegram pode mudar (restaurante/pagamentos ficam intocados).
// ==========================================================================

test("T-03.02 envio com falha grava ultimoEnvio por tipo com o motivo e preserva restaurante", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
    envio: { ok: false, motivo: "chat not found" },
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-falha-envio", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.configsGravados.length, 1, "persistiu o config uma vez");
    const gravado = cena.configsGravados[0];
    const ue = gravado.telegram.ultimoEnvio;
    assert.equal(ue.fechamentoCaixa.status, "falha");
    assert.equal(ue.fechamentoCaixa.erro, "chat not found");
    assert.ok(ue.fechamentoCaixa.em, "registra quando ocorreu");
    assert.equal(ue.estoque.status, "falha", "estoque também é registrado por tipo");
    assert.deepEqual(gravado.restaurante, { nome: "Restaurante Teste" }, "restaurante intacto");
    assert.deepEqual(gravado.pagamentos, ["Dinheiro", "PIX"], "pagamentos intactos");
  } finally {
    cena.restaurar();
  }
});

test("T-03.02 envio com sucesso grava ultimoEnvio sucesso sem motivo, por tipo", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
    envio: { ok: true },
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-sucesso-envio", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.configsGravados.length, 1);
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.equal(ue.fechamentoCaixa.status, "sucesso");
    assert.equal(ue.estoque.status, "sucesso");
    assert.ok(ue.fechamentoCaixa.em, "registra quando ocorreu");
    assert.equal(ue.fechamentoCaixa.erro, undefined, "sucesso não guarda motivo");
  } finally {
    cena.restaurar();
  }
});

test("T-03.02 erro de rede no enviar (throw) também vira falha com motivo", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
    envio: () => { throw new Error("rede fora"); },
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-rede", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.configsGravados.length, 1);
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.equal(ue.fechamentoCaixa.status, "falha");
    assert.equal(ue.fechamentoCaixa.erro, "rede fora");
  } finally {
    cena.restaurar();
  }
});

test("T-03.02 sem disparo (sem chatId) nenhuma chave de config muda", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: null,
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-sem-gravar", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.configsGravados.length, 0, "sem envio não há reescrita de config");
  } finally {
    cena.restaurar();
  }
});

// ==========================================================================
// T-03.03 — cada tipo respeita seu próprio toggle e o ultimoEnvio vira
// objeto por tipo (D-09): gravar um tipo nunca apaga outro já gravado.
// ==========================================================================

test("T-03.03 fechamentoCaixa desativado envia só o estoque (seu próprio toggle)", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
    tipos: { fechamentoCaixa: false, estoque: true, cancelamentoAtivo: false, margemMinima: 0 },
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-sem-fechamento", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 1, "só o estoque é enviado");
    assert.match(cena.enviados[0].texto, /Estoque baixo/);
    assert.doesNotMatch(cena.enviados[0].texto, /Fechamento de caixa/);
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.ok(ue.estoque.em, "estoque registrado");
    assert.equal(ue.fechamentoCaixa, undefined, "nenhum registro de fechamento");
  } finally {
    cena.restaurar();
  }
});

test("T-03.03 estoque desativado envia só o fechamento, com os dados ricos", async () => {
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
    tipos: { fechamentoCaixa: true, estoque: false, cancelamentoAtivo: false, margemMinima: 0 },
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-sem-estoque", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 1, "só o fechamento é enviado");
    const texto = cena.enviados[0].texto;
    assert.match(texto, /Fechamento de caixa/);
    assert.doesNotMatch(texto, /Estoque baixo/);
    assert.match(texto, /Operador: Zeca/, "fechamento rico traz o operador");
    assert.match(texto, /Conferência do caixa/, "fechamento rico traz a conferência por forma");
    assert.match(texto, /Veredito/, "fechamento rico traz o veredito (estadoCaixa)");
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.ok(ue.fechamentoCaixa.em, "fechamento registrado");
    assert.equal(ue.estoque, undefined, "nenhum registro de estoque");
  } finally {
    cena.restaurar();
  }
});

test("T-03.03 gravar fechamentoCaixa nunca apaga estoque/cancelamento já semeados (D-09)", async () => {
  const semeado = {
    estoque: { em: "2026-09-06T11:00:00.000Z", status: "sucesso" },
    cancelamento: { em: "2026-09-06T11:01:00.000Z", status: "falha", erro: "chat not found" },
  };
  const cena = montar({
    emp: { ativo: true, assinaturaStatus: "active", plano: "completo" },
    chatId: 12345,
    tipos: { fechamentoCaixa: true, estoque: false, cancelamentoAtivo: false, margemMinima: 0 },
    ultimoEnvio: semeado,
  });
  try {
    await caixa.fecharCaixa("/x/tenant-avisa-preserva", { contado: { Dinheiro: 120, PIX: 80 } });
    await flushar();
    assert.equal(cena.enviados.length, 1, "só o fechamento é enviado");
    const ue = cena.configsGravados[0].telegram.ultimoEnvio;
    assert.ok(ue.fechamentoCaixa.em, "fechamento atualizado");
    assert.deepEqual(ue.estoque, semeado.estoque, "estoque idêntico ao semeado");
    assert.deepEqual(ue.cancelamento, semeado.cancelamento, "cancelamento idêntico ao semeado");
  } finally {
    cena.restaurar();
  }
});
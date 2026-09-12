// ============================================================
// TESTES — src/telegram.js (client de envio + ferramentas de vinculação +
// formatadores das mensagens). Nenhuma chamada de rede real: global.fetch é
// stubado, e o módulo é RECARREGADO com env controlado (CONFIGURADO e as envs
// de bot são capturadas no load, mesmo padrão de src/email.js).
// ============================================================
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const CAMINHO = path.join(__dirname, "..", "src", "telegram.js");

// Recarrega o módulo com um conjunto próprio de env vars (e restaura o processo
// em seguida — quem captura o valor é o `require`). Devolve os exports.
function carregar(env) {
  const salvos = {};
  for (const chave of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME"]) {
    salvos[chave] = process.env[chave];
    if (env[chave] === undefined) delete process.env[chave];
    else process.env[chave] = env[chave];
  }
  try {
    delete require.cache[require.resolve(CAMINHO)];
    return require(CAMINHO);
  } finally {
    for (const chave of Object.keys(salvos)) {
      if (salvos[chave] === undefined) delete process.env[chave];
      else process.env[chave] = salvos[chave];
    }
  }
}

const fetchOriginal = global.fetch;
afterEach(() => { global.fetch = fetchOriginal; });

// Substitui o fetch e captura as chamadas; `handler(req)` devolve a resposta.
function stubFetch(handler) {
  const chamadas = [];
  global.fetch = async (url, opts) => {
    chamadas.push({ url, opts });
    return handler(url, opts);
  };
  return chamadas;
}

// ---------------------------------------------------------------------------
// T-01.01 — client de envio (enviar + CONFIGURADO), padrão no-op de email.js
// ---------------------------------------------------------------------------
test("T-01.01 enviar monta a URL do sendMessage e manda chat_id/texto", async () => {
  const tg = carregar({ TELEGRAM_BOT_TOKEN: "123456:ABC-teste" });
  const chamadas = stubFetch(() => ({ ok: true }));
  const r = await tg.enviar(555, "bom dia");
  assert.equal(r.ok, true);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, "https://api.telegram.org/bot123456:ABC-teste/sendMessage");
  const body = JSON.parse(chamadas[0].opts.body);
  assert.equal(body.chat_id, 555);
  assert.equal(body.text, "bom dia");
});

test("T-01.01 enviar nunca lança quando o fetch rejeitar", async () => {
  const tg = carregar({ TELEGRAM_BOT_TOKEN: "123456:ABC-teste" });
  stubFetch(() => { throw new Error("rede fora"); });
  const r = await tg.enviar(555, "bom dia");
  assert.equal(r.ok, false);
});

test("T-01.01 enviar responde erro quando o Telegram recusa", async () => {
  const tg = carregar({ TELEGRAM_BOT_TOKEN: "123456:ABC-teste" });
  stubFetch(() => ({ ok: false, status: 400, text: async () => "Bad Request: chat not found" }));
  const r = await tg.enviar(555, "bom dia");
  assert.equal(r.ok, false);
});

test("T-01.01 enviar sem TELEGRAM_BOT_TOKEN vira no-op, sem tocar a rede", async () => {
  const tg = carregar({});
  let chamouFetch = false;
  global.fetch = async () => { chamouFetch = true; return { ok: true }; };
  const r = await tg.enviar(555, "bom dia");
  assert.deepEqual(r, { ok: false, motivo: "nao_configurado" });
  assert.equal(chamouFetch, false, "no-op não pode tocar a rede");
});

test("T-01.01 módulo exporta CONFIGURADO e enviar", () => {
  const ligado = carregar({ TELEGRAM_BOT_TOKEN: "x" });
  assert.equal(ligado.CONFIGURADO, true);
  assert.equal(typeof ligado.enviar, "function");
  const desligado = carregar({});
  assert.equal(desligado.CONFIGURADO, false);
});

// ---------------------------------------------------------------------------
// T-01.02 — gerarCodigoVinculacao + linkVinculacao
// ---------------------------------------------------------------------------
test("T-01.02 gerarCodigoVinculacao nunca repete valor em 1000 chamadas", () => {
  const tg = carregar({});
  const vistos = new Set();
  for (let i = 0; i < 1000; i++) {
    const codigo = tg.gerarCodigoVinculacao();
    assert.ok(codigo && codigo.length >= 10, "código deve ser uma string não vazia");
    assert.ok(!vistos.has(codigo), "código repetido: " + codigo);
    vistos.add(codigo);
  }
});

test("T-01.02 duas chamadas de gerarCodigoVinculacao devolvem valores diferentes", () => {
  const tg = carregar({});
  assert.notEqual(tg.gerarCodigoVinculacao(), tg.gerarCodigoVinculacao());
});

test("T-01.02 linkVinculacao monta o deep link a partir do username", () => {
  const tg = carregar({ TELEGRAM_BOT_USERNAME: "nymbus_pedidos_bot" });
  assert.equal(tg.linkVinculacao("abc123"), "https://t.me/nymbus_pedidos_bot?start=abc123");
});

// ---------------------------------------------------------------------------
// T-01.03 — extrairCodigoDeUpdate (formato de Update do Telegram)
// ---------------------------------------------------------------------------
test("T-01.03 extrai chat.id e o código após /start ", () => {
  const tg = carregar({});
  const update = { message: { chat: { id: 555 }, text: "/start abc123" } };
  assert.deepEqual(tg.extrairCodigoDeUpdate(update), { codigo: "abc123", chatId: 555 });
});

test("T-01.03 update sem /start devolve null", () => {
  const tg = carregar({});
  assert.equal(tg.extrairCodigoDeUpdate({ message: { chat: { id: 1 }, text: "oi" } }), null);
});

test("T-01.03 /start sem código devolve null (não há o que vincular)", () => {
  const tg = carregar({});
  assert.equal(tg.extrairCodigoDeUpdate({ message: { chat: { id: 1 }, text: "/start" } }), null);
});

test("T-01.03 update sem message / sem chat devolve null, sem lançar", () => {
  const tg = carregar({});
  assert.equal(tg.extrairCodigoDeUpdate({}), null);
  assert.equal(tg.extrairCodigoDeUpdate(null), null);
  assert.equal(tg.extrairCodigoDeUpdate({ message: {} }), null);
  assert.equal(tg.extrairCodigoDeUpdate({ message: { chat: {} } }), null);
});

// ---------------------------------------------------------------------------
// T-01.04 — resolverVinculos (orquestrador puro com funções injetadas)
// ---------------------------------------------------------------------------
test("T-01.04 chama vincular só para código que casa com um tenant", async () => {
  const tg = carregar({});
  const chamadas = [];
  const updates = [
    { message: { chat: { id: 111 }, text: "/start abc123" } },
    { message: { chat: { id: 222 }, text: "/start semtenant" } },
    { message: { chat: { id: 333 }, text: "qualquer coisa" } },
  ];
  const buscar = async (codigo) => (codigo === "abc123" ? { slug: "padaria-x" } : null);
  const vincular = async (tenant, chatId) => { chamadas.push({ slug: tenant.slug, chatId }); };
  await tg.resolverVinculos(updates, buscar, vincular);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].slug, "padaria-x");
  assert.equal(chamadas[0].chatId, 111);
});

test("T-01.04 nunca chama vincular para código sem tenant correspondente", async () => {
  const tg = carregar({});
  let chamou = false;
  await tg.resolverVinculos(
    [{ message: { chat: { id: 1 }, text: "/start naoexiste" } }],
    async () => null,
    async () => { chamou = true; }
  );
  assert.equal(chamou, false);
});

test("T-01.04 tolera updates vazios e falha no buscar (jamais lança)", async () => {
  const tg = carregar({});
  await tg.resolverVinculos([], async () => null, async () => assert.fail("não devia vincular"));
  await tg.resolverVinculos(
    [{ message: { chat: { id: 1 }, text: "/start xyz" } }],
    async () => { throw new Error("banco fora"); },
    async () => assert.fail("sem tenant não há o que vincular")
  );
});

// ---------------------------------------------------------------------------
// T-01.05 — formatarMensagemFechamentoCaixa (formato caixa-calc.resumoCaixa)
// ---------------------------------------------------------------------------
test("T-01.05 texto contém o total e cada forma de pagamento", () => {
  const tg = carregar({});
  const detalhe = { totalRecebido: 1250, recebidoPorForma: { Dinheiro: 500, PIX: 750 } };
  const texto = tg.formatarMensagemFechamentoCaixa(detalhe);
  assert.ok(texto.includes("1.250,00"), "deveria mostrar o total com milhar: " + texto);
  assert.ok(texto.includes("Dinheiro"), "deveria listar Dinheiro: " + texto);
  assert.ok(texto.includes("PIX"), "deveria listar PIX: " + texto);
});

test("T-01.05 texto jamais ultrapassa 4096 caracteres", () => {
  const tg = carregar({});
  const muitasFormas = {};
  for (let i = 0; i < 200; i++) muitasFormas["Forma de pagamento " + i] = 10;
  const texto = tg.formatarMensagemFechamentoCaixa({ totalRecebido: 999, recebidoPorForma: muitasFormas });
  assert.ok(texto.length <= 4096, "tinha " + texto.length + " caracteres");
});

test("T-01.05 objeto vazio não lança e ainda reporta total zero", () => {
  const tg = carregar({});
  const texto = tg.formatarMensagemFechamentoCaixa({});
  assert.ok(texto.includes("0,00"));
});

test("T-01.05 formato rico: operador, data/hora, quantidade+valor por forma e veredito CONFERIDO", () => {
  const tg = carregar({});
  const detalhe = {
    operador: "Maria",
    abertoEm: "2026-09-07T10:00:00-03:00",
    fechadoEm: "2026-09-07T18:00:00-03:00",
    totalRecebido: 181.3,
    recebidoPorForma: { Dinheiro: 141, PIX: 40.3 },
    contagemPorForma: { Dinheiro: 3, PIX: 2 },
    contadoPorForma: { Dinheiro: 141, PIX: 40.3 },
    esperadoPorForma: { Dinheiro: 141, PIX: 40.3 },
  };
  const texto = tg.formatarMensagemFechamentoCaixa(detalhe);
  assert.ok(texto.includes("Operador: Maria"), "deveria ter o operador: " + texto);
  assert.ok(texto.includes("07/09/2026"), "deveria ter a data/hora: " + texto);
  assert.ok(texto.includes("3x"), "deveria ter a quantidade de Dinheiro: " + texto);
  assert.ok(texto.includes("2x"), "deveria ter a quantidade de PIX: " + texto);
  assert.ok(texto.includes("R$ 141,00"), "deveria ter o valor de Dinheiro: " + texto);
  assert.ok(texto.includes("R$ 40,30"), "deveria ter o valor de PIX: " + texto);
  assert.ok(texto.includes("Vendas por forma"), "deveria ter a seção de vendas: " + texto);
  assert.ok(texto.includes("Conferência do caixa"), "deveria ter a seção de conferência: " + texto);
  assert.ok(texto.includes("CONFERIDO"), "deveria ter o veredito: " + texto);
});

test("T-01.05 diferença por forma e veredito SOBROU/FALTOU (estadoCaixa reutilizado)", () => {
  const tg = carregar({});
  const detalhe = {
    recebidoPorForma: { Dinheiro: 100, PIX: 50 },
    contadoPorForma: { Dinheiro: 105, PIX: 40 },
    esperadoPorForma: { Dinheiro: 100, PIX: 50 },
  };
  const texto = tg.formatarMensagemFechamentoCaixa(detalhe);
  assert.ok(texto.includes("+R$ 5,00"), "Dinheiro sobrou 5,00: " + texto);
  assert.ok(texto.includes("-R$ 10,00"), "PIX faltou 10,00: " + texto);
  assert.ok(texto.includes("FALTOU"), "veredito global deve ser FALTOU (145 < 150): " + texto);
  assert.ok(texto.includes("-R$ 5,00"), "veredito deve marcar a diferença global de 5,00: " + texto);
});

test("T-01.05 integração: telegram.js NÃO recodifica o veredito (usa estadoCaixa importado)", () => {
  const fs = require("fs");
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "telegram.js"), "utf8");
  assert.match(src, /relatorioCaixa\.estadoCaixa\(/, "deve chamar estadoCaixa de public/relatorio-caixa.js");
  const i = src.indexOf("function formatarMensagemFechamentoCaixa");
  const f = src.slice(i, src.indexOf("module.exports", i));
  assert.doesNotMatch(f, /CONFERIDO|SOBROU|FALTOU/, "o veredito não pode estar hardcoded no formatador");
});

// ---------------------------------------------------------------------------
// T-01.06 — formatarMensagemEstoqueBaixo (a partir de linhas de estoque.js)
// ---------------------------------------------------------------------------
test("T-01.06 lista cada item com status baixo/esgotado e pula os saudáveis", () => {
  const tg = carregar({});
  const linhas = [
    { nome: "X-Burger", categoria: "Lanches", quantidade: 2, minimo: 5, unidade: "un", esgotado: false, baixo: true },
    { nome: "Coca-Cola", categoria: "Bebidas", quantidade: 0, minimo: 3, unidade: "un", esgotado: true, baixo: false },
    { nome: "Sobremesa", categoria: "Doces", quantidade: 50, minimo: 5, unidade: "un", esgotado: false, baixo: false },
    { nome: "Receita", categoria: "Doces", pai: "Bolo", quantidade: 1, minimo: 2, unidade: "un", esgotado: false, baixo: true },
  ];
  const texto = tg.formatarMensagemEstoqueBaixo(linhas);
  assert.ok(texto.includes("X-Burger"), texto);
  assert.ok(texto.includes("Coca-Cola"), texto);
  assert.ok(texto.includes("esgotado"), texto);
  assert.ok(texto.includes("Bolo (Receita)"), "variação deve carimbar o pai: " + texto);
  assert.ok(!texto.includes("Sobremesa"), "item saudável não pode entrar: " + texto);
});

test("T-01.06 lista vazia produz mensagem válida (não vazia, não erro)", () => {
  const tg = carregar({});
  const texto = tg.formatarMensagemEstoqueBaixo([]);
  assert.ok(typeof texto === "string" && texto.length > 0);
});

test("T-01.06 estoque sai em duas seções: esgotados em Zerado, baixos em Mínimo", () => {
  const tg = carregar({});
  const linhas = [
    { nome: "Coca-Cola", categoria: "Bebidas", quantidade: 0, minimo: 3, unidade: "un", esgotado: true, baixo: false },
    { nome: "X-Burger", categoria: "Lanches", quantidade: 2, minimo: 5, unidade: "un", esgotado: false, baixo: true },
  ];
  const texto = tg.formatarMensagemEstoqueBaixo(linhas);
  const iZerado = texto.indexOf("*Zerado*");
  const iMinimo = texto.indexOf("*Mínimo*");
  const iCoca = texto.indexOf("Coca-Cola");
  const iXburger = texto.indexOf("X-Burger");
  assert.ok(iZerado > -1 && iMinimo > -1, "as duas seções devem existir: " + texto);
  assert.ok(iCoca > iZerado && iCoca < iMinimo, "esgotado deve estar SÓ na seção Zerado: " + texto);
  assert.ok(iXburger > iMinimo, "baixo deve estar SÓ na seção Mínimo: " + texto);
});

test("T-01.06 seção sem itens não aparece e não quebra a mensagem", () => {
  const tg = carregar({});
  const texto = tg.formatarMensagemEstoqueBaixo([
    { nome: "Coca", categoria: "Bebidas", quantidade: 0, minimo: 3, unidade: "un", esgotado: true, baixo: false },
  ]);
  assert.ok(texto.includes("*Zerado*"), "seção Zerado deveria aparecer: " + texto);
  assert.ok(!texto.includes("*Mínimo*"), "seção Mínimo (vazia) não deveria aparecer: " + texto);
  assert.ok(texto.length <= 4096, "não pode estourar o limite do Telegram");
});

// ---------------------------------------------------------------------------
// T-01.07 — formatarMensagemCancelamento (D-05/D-06): alerta imediato de
// cancelamento ou estorno, com pedido/valor/forma/tipo. Estorno precisa ser
// visivelmente diferente de cancelamento (auditoria).
// ---------------------------------------------------------------------------

test("T-01.07 cancelamento sai com pedido, valor em R$ e forma", () => {
  const tg = carregar({});
  const texto = tg.formatarMensagemCancelamento({ pedidoNumero: 42, valor: 15.5, forma: "PIX", tipo: "cancelamento" });
  assert.ok(texto.includes("42"), "deveria trazer o número do pedido: " + texto);
  assert.ok(texto.includes("15,50"), "deveria trazer o valor em R$: " + texto);
  assert.ok(texto.includes("PIX"), "deveria trazer a forma: " + texto);
  assert.ok(/cancelamento/i.test(texto), "deveria dizer que é um cancelamento: " + texto);
});

test("T-01.07 estorno sai visivelmente diferente do cancelamento", () => {
  const tg = carregar({});
  const base = { pedidoNumero: 42, valor: 15.5, forma: "PIX" };
  const canc = tg.formatarMensagemCancelamento({ ...base, tipo: "cancelamento" });
  const estorno = tg.formatarMensagemCancelamento({ ...base, tipo: "estorno" });
  assert.ok(/estorno/i.test(estorno), "estorno deve nomear estorno: " + estorno);
  assert.ok(estorno !== canc, "textos não podem ser idênticos");
  assert.ok(estorno.includes("42") && estorno.includes("15,50"), "estorno mantém pedido e valor");
});

test("T-01.07 também funciona sem forma e nunca passa de 4096", () => {
  const tg = carregar({});
  const texto = tg.formatarMensagemCancelamento({ pedidoNumero: 1, valor: 0, tipo: "estorno" });
  assert.ok(texto.includes("1"), "pedido sempre aparece: " + texto);
  assert.ok(texto.length > 0 && texto.length <= 4096);
});
// ---------------------------------------------------------------------------
// T-01.04 — tiposAtivos(cfg): leitura de config.telegram.tipos com defaults
// (D-03: fechamento/estoque nascem ligados; recurso novo: cancelamento desligado,
// margem 0). Ponto único de leitura — nunca lança com campos ausentes.
// ---------------------------------------------------------------------------

test("T-01.04 tiposAtivos: cfg inteiro ausente devolve os dois defaults ligados", () => {
  const tg = carregar({});
  assert.deepEqual(tg.tiposAtivos(undefined), {
    fechamentoCaixa: true, estoque: true, cancelamentoAtivo: false, margemMinima: 0,
  });
});

test("T-01.04 tiposAtivos: config.telegram ausente mantém comportamento atual (D-03)", () => {
  const tg = carregar({});
  assert.deepEqual(tg.tiposAtivos({ restaurante: { nome: "X" } }), {
    fechamentoCaixa: true, estoque: true, cancelamentoAtivo: false, margemMinima: 0,
  });
});

test("T-01.04 tiposAtivos: config.telegram.tipos ausente devolve defaults ligados", () => {
  const tg = carregar({});
  assert.deepEqual(tg.tiposAtivos({ telegram: { chatId: 555 } }), {
    fechamentoCaixa: true, estoque: true, cancelamentoAtivo: false, margemMinima: 0,
  });
});

test("T-01.04 tiposAtivos: respeita fechamentoCaixa:false e aplica defaults ao resto", () => {
  const tg = carregar({});
  assert.deepEqual(
    tg.tiposAtivos({ telegram: { tipos: { fechamentoCaixa: false } } }),
    { fechamentoCaixa: false, estoque: true, cancelamentoAtivo: false, margemMinima: 0 }
  );
});

test("T-01.04 tiposAtivos: margem cresce com o valor salvo e não altera a entrada", () => {
  const tg = carregar({});
  const cfg = { telegram: { tipos: { fechamentoCaixa: true, estoque: false, cancelamentoAtivo: true, margemMinima: 25 } } };
  const copia = JSON.parse(JSON.stringify(cfg));
  assert.deepEqual(tg.tiposAtivos(cfg), {
    fechamentoCaixa: true, estoque: false, cancelamentoAtivo: true, margemMinima: 25,
  });
  assert.deepEqual(cfg, copia, "entrada imutável (função pura)");
});
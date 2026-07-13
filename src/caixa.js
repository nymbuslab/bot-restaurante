// ============================================================
// CAIXA — abertura/fechamento + recebimento por pedido + sangria/
// suprimento. Isolado por empresa_id (padrão do pedidos.js).
// Cálculos puros ficam em caixa-calc.js.
// ============================================================
const path = require("path");
const db = require("./db");
const calc = require("./caixa-calc");
const store = require("./store");
const pdv = require("./pdv"); // normalizarPagamentos (troco só no dinheiro; não confia no cliente)
const relatorioCaixa = require("../public/relatorio-caixa"); // dual-mode Node/browser

const slugDe = (dir) => path.basename(dir);
const idCache = {};

async function empresaId(dir) {
  const slug = slugDe(dir);
  if (idCache[slug]) return idCache[slug];
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  idCache[slug] = r.rows[0].id;
  return idCache[slug];
}

// Conta pedidos do turno (criados desde a abertura do caixa) ainda NÃO recebidos.
// Base da regra "todos os pedidos precisam ser recebidos antes de fechar".
// Pedidos de DELIVERY/local (mesa_id NULL) ainda a receber no turno. Exclui
// cancelados (nunca recebem → travavam o fechamento) e mesas (contadas à parte:
// mesa se recebe na própria mesa, não pela aba Pedidos).
async function _contarAReceber(empId, abertoEm) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM pedidos
      WHERE empresa_id = $1 AND recebido_em IS NULL AND status <> 'cancelado'
        AND mesa_id IS NULL AND a_prazo = false AND criado_em >= $2`,
    [empId, abertoEm]
  );
  return r.rows[0].n;
}

// Mesas com consumo em aberto (não-livres) — bloqueiam o fechamento do caixa
// (o consumo ainda não entrou), mas com mensagem própria (feche na aba Mesas).
async function _contarMesasAbertas(empId) {
  const r = await db.query(
    "SELECT COUNT(*)::int AS n FROM mesas WHERE empresa_id = $1 AND status <> 'livre'",
    [empId]
  );
  return r.rows[0].n;
}

// `vencido` = caixa aberto num dia-calendário anterior (fuso BR). Regra: o caixa
// deve ser fechado ao fim do expediente / ao virar o dia; enquanto vencido, o PDV
// fica bloqueado (não inicia venda) até fechar e abrir um novo.
async function caixaAberto(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT *,
            (aberto_em AT TIME ZONE 'America/Sao_Paulo')::date
              < (now() AT TIME ZONE 'America/Sao_Paulo')::date AS vencido
       FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1`,
    [empId]
  );
  return r.rows[0] || null;
}

// Data DD/MM (fuso BR) de um timestamp — usada em mensagens ("caixa de 23/06").
function _dataBR(ts) {
  return new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

async function abrirCaixa(dir, { fundoTroco, operador, obsAbertura }) {
  const empId = await empresaId(dir);
  const fundo = Number(fundoTroco) || 0;
  if (fundo < 0) throw new Error("Fundo de troco inválido.");
  const aberto = await caixaAberto(dir);
  if (aberto) throw new Error("Já existe um caixa aberto.");
  try {
    const r = await db.query(
      "INSERT INTO caixas (empresa_id, fundo_troco, operador, obs_abertura) VALUES ($1, $2, $3, $4) RETURNING *",
      [empId, fundo, (operador || "").trim() || null, (obsAbertura || "").trim() || null]
    );
    return r.rows[0];
  } catch (e) {
    // Corrida: o pré-check passou mas o índice único (caixas_um_aberto_por_empresa)
    // barrou o 2º INSERT → mensagem amigável em vez do erro cru do Postgres.
    if (e && e.code === "23505") throw new Error("Já existe um caixa aberto.");
    throw e;
  }
}

// Recebe um pedido a-receber. Aceita SPLIT (`pagamentos: [{forma, valor}]`) ou uma
// forma única (`{forma, valor}`, compat). A soma tem de bater com o total do pedido
// (anti-fraude — não confia no cliente); insere um movimento por forma e grava o
// resumo em `pedido.pagamento` (reflete como foi pago de fato).
async function receberPedido(dir, pedidoId, opts) {
  const empId = await empresaId(dir);
  const raw = (opts && Array.isArray(opts.pagamentos) && opts.pagamentos.length)
    ? opts.pagamentos
    : [{ forma: opts && opts.forma, valor: opts && opts.valor }];
  // Normaliza no SERVIDOR (troco só no dinheiro; valorPago = valor nas demais formas) —
  // mesma regra do PDV/Mesas, não confia no valorPago/troco do cliente.
  const pagamentos = pdv.normalizarPagamentos(raw).filter((p) => p.valor > 0);
  if (!pagamentos.length) throw new Error("Valor deve ser positivo.");
  const soma = Math.round(pagamentos.reduce((s, p) => s + p.valor, 0) * 100) / 100;
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa antes de receber.");
  // Transação + FOR UPDATE: evita duplo recebimento em caso de corrida/falha
  // (os INSERTs dos movimentos e o UPDATE do pedido viram tudo-ou-nada).
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const ped = await client.query(
      "SELECT id, recebido_em, total, origem, a_prazo FROM pedidos WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, pedidoId]
    );
    if (!ped.rows[0]) throw new Error("Pedido não encontrado.");
    // Mesa se recebe na aba Mesas (com taxa de serviço/fechamento). Trava no servidor,
    // não só no front — evita desencontrar a conta da mesa por requisição forjada.
    if (ped.rows[0].origem === "mesa") throw new Error("Pedido de mesa é recebido na aba Mesas.");
    // Fiado (a prazo) é recebido SÓ na aba Clientes > Receber (respeita vencimento,
    // distribui parcial, registra a baixa). Trava no servidor, não só no front.
    if (ped.rows[0].a_prazo) throw new Error("Venda a prazo é recebida na aba Clientes > Receber.");
    if (ped.rows[0].recebido_em) throw new Error("Pedido já recebido.");
    const total = Math.round((Number(ped.rows[0].total) || 0) * 100) / 100;
    if (Math.abs(soma - total) > 0.01) {
      throw new Error("A soma dos pagamentos (R$ " + soma.toFixed(2) + ") difere do total (R$ " + total.toFixed(2) + ").");
    }
    for (const p of pagamentos) {
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id, valor_pago, troco)
         VALUES ($1, $2, 'recebimento', $3, $4, $5, $6, $7)`,
        [caixa.id, empId, p.forma, p.valor, pedidoId, p.valorPago, p.troco]
      );
    }
    const resumo = pagamentos.map((p) => p.forma + " R$ " + p.valor.toFixed(2).replace(".", ",")).join(" · ");
    await client.query(
      "UPDATE pedidos SET recebido_em = now(), pagamento = $3 WHERE empresa_id = $1 AND id = $2",
      [empId, pedidoId, resumo]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// PDV — venda no local: cria o pedido (já recebido) e lança UM movimento de
// recebimento POR FORMA de pagamento, tudo numa transação (a venda nunca fica
// meio-salva). Exige caixa aberto. `venda` já vem RECALCULADA pela rota
// (src/pdv.js): { cliente, itens, total, desconto, pagamentos:[{forma,valor}],
// pagamentoResumo, tipoEntrega, endereco, telefone, taxaEntrega }. `total` já
// inclui o frete. A baixa de estoque é ATÔMICA, dentro desta transação
// (store.baixarEstoqueTx). Retorna o pedido salvo (p/ impressão).
async function venderLocal(dir, venda) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa antes de vender no PDV.");
  if (caixa.vencido) throw new Error("O caixa de " + _dataBR(caixa.aberto_em) + " precisa ser fechado antes de vender. Feche o caixa do dia anterior e abra um novo.");
  const itens = Array.isArray(venda.itens) ? venda.itens : [];
  if (!itens.length) throw new Error("A venda está vazia.");
  const cliente = (venda.cliente || "").trim() || "Balcão";
  const total = Number(venda.total) || 0;
  const desconto = Number(venda.desconto) || 0;
  const pagamentos = Array.isArray(venda.pagamentos) ? venda.pagamentos : [];
  // Tipo da venda: Balcão (padrão) / Retirada / Entrega. Endereço/telefone/taxa
  // só fazem sentido na Entrega; nos demais ficam vazios/0.
  const tipoEntrega = ["Entrega", "Retirada"].includes(venda.tipoEntrega) ? venda.tipoEntrega : "Balcão";
  const ehEntrega = tipoEntrega === "Entrega";
  const endereco = ehEntrega ? String(venda.endereco || "").slice(0, 300) : "";
  const telefone = tipoEntrega === "Balcão" ? "" : String(venda.telefone || "").slice(0, 30);
  const taxaEntrega = ehEntrega ? (Number(venda.taxaEntrega) || 0) : 0;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    // Revalida o caixa DENTRO da transação, travando a linha (FOR UPDATE) — fecha o
    // gap entre o check inicial e o commit: se o caixa foi fechado nesse meio-tempo
    // (corrida com fecharCaixa), a venda inteira é desfeita. Usa o id travado abaixo.
    const cx = await client.query(
      `SELECT id,
              (aberto_em AT TIME ZONE 'America/Sao_Paulo')::date
                < (now() AT TIME ZONE 'America/Sao_Paulo')::date AS vencido
         FROM caixas WHERE empresa_id = $1 AND status = 'aberto'
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [empId]
    );
    if (!cx.rows[0]) throw new Error("O caixa foi fechado. Abra um novo caixa para vender.");
    if (cx.rows[0].vencido) throw new Error("O caixa precisa ser fechado antes de vender. Feche o caixa do dia anterior e abra um novo.");
    const caixaId = cx.rows[0].id;
    // Baixa de estoque ATÔMICA: trava o tenant (FOR UPDATE), revalida e
    // decrementa. Se faltar estoque (corrida), lança e a venda inteira é desfeita —
    // nada é cobrado. O lock também serializa o MAX(numero)+1 abaixo.
    const novoCardapio = await store.baixarEstoqueTx(client, dir, itens);
    const ped = await client.query(
      `INSERT INTO pedidos
         (empresa_id, numero, status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento, taxa_entrega, itens, total, observacao, desconto, origem, recebido_em)
       VALUES
         ($1, (SELECT COALESCE(MAX(numero),0)+1 FROM pedidos WHERE empresa_id = $1), 'novo',
          $2, $3, '', $4, $5, $6, $7, $8::jsonb, $9, $10, $11, 'pdv', now())
       RETURNING id, numero, criado_em, recebido_em`,
      [empId, cliente, telefone, tipoEntrega, endereco, venda.pagamentoResumo || "", taxaEntrega, JSON.stringify(itens), total, (venda.observacao || ""), desconto]
    );
    const row = ped.rows[0];
    const cent2 = (n) => (n == null ? null : Math.round((Number(n) || 0) * 100) / 100);
    for (const p of pagamentos) {
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id, valor_pago, troco)
         VALUES ($1, $2, 'recebimento', $3, $4, $5, $6, $7)`,
        [caixaId, empId, (p.forma || "Outros"), Number(p.valor) || 0, row.id, cent2(p.valorPago), cent2(p.troco)]
      );
    }
    await client.query("COMMIT");
    store.sincronizarCardapio(dir, novoCardapio); // cache reflete o estoque baixado
    return {
      id: row.id, numero: row.numero, status: "novo",
      cliente, telefone, tipoEntrega, endereco,
      pagamento: venda.pagamentoResumo || "", taxaEntrega,
      itens, total, desconto, observacao: venda.observacao || "",
      criadoEm: new Date(row.criado_em).toISOString(),
      recebidoEm: new Date(row.recebido_em).toISOString(),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Estorna um recebimento feito por ENGANO (ex.: forma errada) → o pedido volta a
// "a receber" (segue VÁLIDO, ao contrário do cancelamento). Não apaga o
// recebimento: insere um movimento de 'estorno' por forma (deduz, mesmo valor
// líquido ainda no caixa), mantendo o rastro anti-fraude. Exige caixa aberto e
// que o pedido esteja recebido NESTE caixa.
async function estornarRecebimento(dir, pedidoId) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Sem caixa aberto para estornar.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const ped = await client.query(
      "SELECT numero, recebido_em, status, a_prazo FROM pedidos WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, pedidoId]
    );
    if (!ped.rows[0]) throw new Error("Pedido não encontrado.");
    if (ped.rows[0].status === "cancelado") throw new Error("Pedido cancelado — o cancelamento já deduziu do caixa.");
    if (!ped.rows[0].recebido_em) throw new Error("Este pedido não está recebido.");
    const numero = ped.rows[0].numero;
    // Líquido por forma NESTE caixa (recebimento − estornos − CANCELAMENTOS já feitos) =
    // o que ainda está no caixa para este pedido. Estorna exatamente esse líquido.
    // Incluir 'cancelamento' impede deduzir DUAS vezes (cancelar E estornar o mesmo pedido).
    const net = await client.query(
      `SELECT forma_pagamento AS forma,
              SUM(CASE WHEN tipo='recebimento' THEN valor ELSE -valor END) AS net
         FROM caixa_movimentos
        WHERE caixa_id = $1 AND pedido_id = $2 AND empresa_id = $3 AND tipo IN ('recebimento','estorno','cancelamento')
        GROUP BY forma_pagamento
        HAVING SUM(CASE WHEN tipo='recebimento' THEN valor ELSE -valor END) > 0`,
      [caixa.id, pedidoId, empId]
    );
    if (!net.rows.length) {
      throw new Error("O recebimento deste pedido não está no caixa aberto (talvez de um caixa já fechado).");
    }
    for (const r of net.rows) {
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id, descricao)
         VALUES ($1, $2, 'estorno', $3, $4, $5, $6)`,
        [caixa.id, empId, r.forma, Number(r.net) || 0, pedidoId, "Estorno recebimento #" + numero]
      );
    }
    // Fiado: estornar o recebimento também DESFAZ a baixa da conta a prazo, senão o
    // dinheiro sairia do caixa mas a dívida continuaria quitada (sumiria do controle).
    // Devolve ao pedido o valor das baixas cujo recebimento está NESTE caixa e apaga
    // esses registros do log → a conta volta a "a receber" com o saldo correto.
    if (ped.rows[0].a_prazo) {
      const bx = await client.query(
        `SELECT COALESCE(SUM(b.valor),0)::float AS soma
           FROM fiado_baixas b JOIN caixa_movimentos m ON m.id = b.caixa_movimento_id
          WHERE b.empresa_id = $1 AND b.pedido_id = $2 AND m.caixa_id = $3 AND m.tipo = 'recebimento'`,
        [empId, pedidoId, caixa.id]
      );
      const devolver = Number(bx.rows[0] && bx.rows[0].soma) || 0;
      await client.query(
        `DELETE FROM fiado_baixas b USING caixa_movimentos m
          WHERE b.caixa_movimento_id = m.id AND b.empresa_id = $1 AND b.pedido_id = $2
            AND m.caixa_id = $3 AND m.tipo = 'recebimento'`,
        [empId, pedidoId, caixa.id]
      );
      await client.query(
        "UPDATE pedidos SET valor_recebido = GREATEST(0, COALESCE(valor_recebido,0) - $3) WHERE empresa_id = $1 AND id = $2",
        [empId, pedidoId, devolver]
      );
    }
    await client.query(
      "UPDATE pedidos SET recebido_em = NULL WHERE empresa_id = $1 AND id = $2",
      [empId, pedidoId]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Cancela um pedido JÁ RECEBIDO mantendo o rastro (anti-fraude): não apaga o
// recebimento; insere um movimento de 'cancelamento' por forma recebida (mesma
// forma/valor) que DEDUZ do caixa, e marca o pedido como cancelado. Exige caixa
// aberto e que o recebimento do pedido esteja NESTE caixa (não mexe em caixa fechado).
async function cancelarRecebido(dir, pedidoId) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa para cancelar um pedido pago.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const ped = await client.query(
      "SELECT numero, status FROM pedidos WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, pedidoId]
    );
    if (!ped.rows[0]) throw new Error("Pedido não encontrado.");
    if (ped.rows[0].status === "cancelado") throw new Error("Pedido já cancelado.");
    const numero = ped.rows[0].numero;
    // Líquido por forma NESTE caixa (recebimento − estornos − cancelamentos) = o que
    // ainda está no caixa. Deduz exatamente esse líquido (defensivo: se já houvesse um
    // estorno, não deduz de novo o que já saiu). HAVING > 0 → nada a deduzir se já zerou.
    const net = await client.query(
      `SELECT forma_pagamento AS forma,
              SUM(CASE WHEN tipo='recebimento' THEN valor ELSE -valor END) AS net
         FROM caixa_movimentos
        WHERE caixa_id = $1 AND pedido_id = $2 AND empresa_id = $3 AND tipo IN ('recebimento','estorno','cancelamento')
        GROUP BY forma_pagamento
        HAVING SUM(CASE WHEN tipo='recebimento' THEN valor ELSE -valor END) > 0`,
      [caixa.id, pedidoId, empId]
    );
    if (!net.rows.length) {
      throw new Error("O recebimento deste pedido não está no caixa aberto (talvez de um caixa já fechado). Não é possível cancelar com reflexo no caixa.");
    }
    for (const r of net.rows) {
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id, descricao)
         VALUES ($1, $2, 'cancelamento', $3, $4, $5, $6)`,
        [caixa.id, empId, r.forma, Number(r.net) || 0, pedidoId, "Cancelamento pedido #" + numero]
      );
    }
    await client.query(
      "UPDATE pedidos SET status = 'cancelado' WHERE empresa_id = $1 AND id = $2",
      [empId, pedidoId]
    );
    await client.query("COMMIT");
    return { ok: true, cancelado: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function registrarMovimento(dir, { tipo, valor, descricao }) {
  const empId = await empresaId(dir);
  if (tipo !== "sangria" && tipo !== "suprimento") throw new Error("Tipo inválido.");
  const v = Number(valor) || 0;
  if (v <= 0) throw new Error("Valor deve ser positivo.");
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa primeiro.");
  // Sangria não pode tirar mais do que o dinheiro em gaveta (senão o esperado em
  // espécie fica negativo — impossível na conferência do fechamento).
  if (tipo === "sangria") {
    const emCaixa = calc.resumoCaixa(caixa, await _movimentos(caixa.id)).esperadoEspecie;
    if (v > emCaixa + 0.001) {
      throw new Error("Sangria (R$ " + v.toFixed(2) + ") maior que o dinheiro em caixa (R$ " + (Number(emCaixa) || 0).toFixed(2) + ").");
    }
  }
  const r = await db.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, valor, descricao)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [caixa.id, empId, tipo, v, descricao || ""]
  );
  return r.rows[0];
}

async function _movimentos(caixaId) {
  const r = await db.query(
    "SELECT * FROM caixa_movimentos WHERE caixa_id = $1 ORDER BY id ASC",
    [caixaId]
  );
  return r.rows;
}

async function resumo(dir) {
  const caixa = await caixaAberto(dir);
  if (!caixa) return { caixa: null };
  const movimentos = await _movimentos(caixa.id);
  // Recebimentos DESTE caixa (com nº/cliente do pedido) — base do estorno.
  // O ato de "receber" acontece no Pedido; aqui o Caixa só mostra o que entrou
  // e permite estornar correções.
  // Extrato do turno: TODOS os movimentos (recebimento/sangria/suprimento) com
  // nº/cliente do pedido (recebimentos) — é o que o dono confere ao olhar o caixa.
  const mov = await db.query(
    `SELECT m.tipo, m.pedido_id, m.forma_pagamento, m.valor, m.valor_pago, m.troco, m.descricao, m.criado_em,
            p.numero, p.cliente, p.origem, p.tipo_entrega, p.recebido_em, p.status, p.a_prazo
       FROM caixa_movimentos m
       LEFT JOIN pedidos p ON p.id = m.pedido_id
      WHERE m.caixa_id = $1
      ORDER BY m.id DESC`,
    [caixa.id]
  );
  const empId = await empresaId(dir);
  const pedidosAReceber = await _contarAReceber(empId, caixa.aberto_em);
  const mesasAbertas = await _contarMesasAbertas(empId);
  return {
    caixa: {
      id: caixa.id,
      abertoEm: new Date(caixa.aberto_em).toISOString(),
      vencido: !!caixa.vencido,
      fundoTroco: Number(caixa.fundo_troco) || 0,
      operador: caixa.operador || null,
      obsAbertura: caixa.obs_abertura || null,
    },
    pedidosAReceber,
    mesasAbertas,
    resumo: calc.resumoCaixa(caixa, movimentos),
    movimentos: mov.rows.map((r) => ({
      tipo: r.tipo, pedidoId: r.pedido_id, numero: r.numero, cliente: r.cliente,
      aPrazo: r.a_prazo === true, // recebimento de conta a prazo (fiado) → rótulo próprio no extrato
      forma: r.forma_pagamento, valor: Number(r.valor) || 0, descricao: r.descricao || "",
      valorPago: r.valor_pago == null ? null : Number(r.valor_pago),
      troco: r.troco == null ? null : Number(r.troco),
      quando: r.criado_em ? new Date(r.criado_em).toISOString() : null,
      // Estornável só recebimento de pedido "a receber" ainda recebido (web/PDV-Entrega/
      // Retirada). Exclui mesa (sem pedido_id → paga na mesa) e balcão (venda paga na
      // hora → correção é cancelar, não estornar).
      estornavel: r.tipo === "recebimento" && r.pedido_id != null && r.recebido_em != null
        && r.status !== "cancelado" // já cancelado → o cancelamento deduziu; não estornar de novo
        && !(r.origem === "pdv" && r.tipo_entrega === "Balcão"),
    })),
  };
}

// Formas eletrônicas do relatório = união das configuradas (menos dinheiro) com as
// que de fato tiveram recebimento — espelha a regra do front (corrige Pix fora da
// config) e mantém a montagem do relatório com dados do servidor.
function _formasEletronicas(pagamentos, recebidoPorForma, contadoPorForma) {
  const formas = (pagamentos || []).filter((f) => !calc.ehDinheiro(f));
  const unir = (obj) => {
    for (const f in (obj || {})) {
      if (!calc.ehDinheiro(f) && !formas.includes(f)) formas.push(f);
    }
  };
  unir(recebidoPorForma);
  unir(contadoPorForma); // formas LANÇADAS na conferência (ex.: "Cartão" do fallback) —
  // sem isto entravam na diferença salva mas sumiam do total impresso do relatório.
  return formas;
}

// eletronico: [{ forma, valor }] informado pelo operador na conferência.
// O relatório é montado AQUI (servidor), nunca recebido do cliente — fonte única
// e autoritativa; guardado em detalhe_fechamento.relatorio p/ reimpressão.
async function fecharCaixa(dir, { contagem, eletronico }) {
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Não há caixa aberto.");

  // Regra de negócio: não fecha com consumo do turno ainda em aberto.
  const mesasAbertas = await _contarMesasAbertas(caixa.empresa_id);
  if (mesasAbertas > 0) {
    throw new Error(`Há ${mesasAbertas} mesa(s) aberta(s). Feche as mesas (na aba Mesas) antes de fechar o caixa.`);
  }
  const aReceber = await _contarAReceber(caixa.empresa_id, caixa.aberto_em);
  if (aReceber > 0) {
    throw new Error(`Há ${aReceber} pedido(s) com pagamento a receber. Receba todos antes de fechar o caixa.`);
  }

  const movimentos = await _movimentos(caixa.id);
  const resumo = calc.resumoCaixa(caixa, movimentos);

  // Recalcula no servidor a partir do detalhamento (não confia no total do cliente).
  const contadoDinheiro = calc.totalContagem(contagem || {});
  const lancs = Array.isArray(eletronico) ? eletronico : [];
  const contadoEletronico = lancs.reduce((s, l) => s + (Number(l && l.valor) || 0), 0);
  const totalCaixa = calc.totalEmCaixa(caixa, resumo);
  const diferenca = (contadoDinheiro + contadoEletronico) - totalCaixa;

  // Agrega lançamentos por forma p/ o snapshot e o relatório.
  const eletronicoPorForma = {};
  for (const l of lancs) {
    const f = (l && l.forma) || "Outros";
    eletronicoPorForma[f] = (eletronicoPorForma[f] || 0) + (Number(l.valor) || 0);
  }

  // Monta o relatório 80mm no servidor, com os dados autoritativos.
  await store.ensure(dir);
  const cfg = store.getConfig(dir) || {};
  const formaDinheiro = (cfg.pagamentos || []).find((f) => calc.ehDinheiro(f)) || "Dinheiro";
  // Cancelamentos do turno (rastro no relatório): cada um com descrição/forma/valor.
  const cancelamentos = movimentos
    .filter((m) => m.tipo === "cancelamento")
    .map((m) => ({ descricao: m.descricao || "Cancelamento", forma: m.forma_pagamento || "Outros", valor: Number(m.valor) || 0 }));
  const relatorio = relatorioCaixa.montarRelatorioFechamento({
    restaurante: (cfg.restaurante && cfg.restaurante.nome) || "",
    abertoEm: new Date(caixa.aberto_em).toISOString(),
    fechadoEm: new Date().toISOString(),
    operador: caixa.operador || "",
    formaDinheiro,
    formas: _formasEletronicas(cfg.pagamentos, resumo.recebidoPorForma, eletronicoPorForma),
    recebidoPorForma: resumo.recebidoPorForma || {},
    canceladoPorForma: resumo.canceladoPorForma || {},
    fundoTroco: Number(caixa.fundo_troco) || 0,
    suprimentos: resumo.suprimentos || 0,
    sangrias: resumo.sangrias || 0,
    cancelamentos,
    totalCancelado: resumo.cancelamentos || 0,
    vendasPrazo: resumo.vendasPrazo || 0,
    contadoDinheiro,
    eletronicoPorForma,
  });

  const detalhe = {
    cedulas: contagem || {},
    eletronico: lancs,
    eletronicoPorForma,
    esperado: { totalEmCaixa: totalCaixa, especie: resumo.esperadoEspecie, eletronico: calc.esperadoEletronico(resumo) },
    contado: { dinheiro: contadoDinheiro, eletronico: contadoEletronico },
    relatorio,
  };

  // `AND status='aberto'` + checagem de rowCount: em duplo clique / 2 abas, só o 1º
  // fechamento grava; o 2º afeta 0 linhas e lança ANTES da rota enfileirar o relatório
  // (evita 2 impressões e a sobrescrita do detalhe_fechamento).
  const upd = await db.query(
    `UPDATE caixas SET status='fechado', fechado_em=now(),
            contado_dinheiro=$2, contado_eletronico=$3, diferenca=$4, detalhe_fechamento=$5
       WHERE id=$1 AND status='aberto'`,
    [caixa.id, contadoDinheiro, contadoEletronico, diferenca, JSON.stringify(detalhe)]
  );
  if (!upd.rowCount) throw new Error("O caixa já foi fechado.");
  return { diferenca, totalEmCaixa: totalCaixa, contadoDinheiro, contadoEletronico, relatorio };
}

async function listarCaixas(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id, aberto_em, fechado_em, fundo_troco, contado_dinheiro, contado_eletronico,
            diferenca, operador,
            (detalhe_fechamento->'esperado'->>'totalEmCaixa')::numeric AS total_caixa,
            detalhe_fechamento->>'relatorio' AS relatorio
       FROM caixas WHERE empresa_id = $1 AND status='fechado'
       ORDER BY id DESC LIMIT 3`,
    [empId]
  );
  return r.rows.map((c) => {
    const contadoDinheiro = c.contado_dinheiro == null ? 0 : Number(c.contado_dinheiro);
    const contadoEletronico = c.contado_eletronico == null ? 0 : Number(c.contado_eletronico);
    const contadoTotal = contadoDinheiro + contadoEletronico;
    const diferenca = c.diferenca == null ? null : Number(c.diferenca);
    // Total esperado: do snapshot quando houver; senão deriva (contado − diferença).
    const totalEmCaixa = c.total_caixa != null
      ? Number(c.total_caixa)
      : (diferenca == null ? null : contadoTotal - diferenca);
    return {
      id: c.id,
      abertoEm: new Date(c.aberto_em).toISOString(),
      fechadoEm: c.fechado_em ? new Date(c.fechado_em).toISOString() : null,
      fundoTroco: Number(c.fundo_troco) || 0,
      operador: c.operador || null,
      contadoDinheiro, contadoEletronico, contadoTotal,
      totalEmCaixa,
      diferenca,
      relatorio: c.relatorio || null,
    };
  });
}

async function detalheCaixa(dir, id) {
  const empId = await empresaId(dir);
  const c = await db.query("SELECT * FROM caixas WHERE empresa_id = $1 AND id = $2", [empId, id]);
  if (!c.rows[0]) return null;
  const movimentos = await _movimentos(id);
  return {
    caixa: { ...c.rows[0], resumo: calc.resumoCaixa(c.rows[0], movimentos) },
    movimentos,
  };
}

function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  caixaAberto, abrirCaixa, receberPedido, venderLocal, estornarRecebimento, cancelarRecebido, registrarMovimento,
  resumo, fecharCaixa, listarCaixas, detalheCaixa, esquecer,
};

// ============================================================
// FIADO — venda "A Prazo" (Fase 3). Isolado por empresa_id (padrão do pedidos.js).
//
// Uma venda a prazo é um pedido a_prazo=true vinculado a um cliente, recebido_em
// NULL (conta a receber) e SEM movimento no caixa na hora. Origem PDV (Balcão) ou
// Mesa (fechamento a prazo). A baixa (recebimento posterior) vem na Fase 4.
//
// Helper PURO (podeVenderAPrazo) é testado em test/fiado.test.js. O vencimento
// é calculado pelo convênio do cliente (public/convenios.js).
// ============================================================
const path = require("path");
const db = require("./db");
const store = require("./store");
const convenios = require("../public/convenios");

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
function esquecer(slug) { delete idCache[slug]; }

// PURO: decide se pode vender a prazo. `gasto` = soma das vendas a prazo em aberto;
// `temVencida` = há venda vencida em aberto. liberacaoPontual libera qualquer
// bloqueio. Limite só bloqueia quando > 0 (0 = não configurado, não bloqueia tudo).
// Retorna { ok, motivo:'limite'|'vencimento'|null, texto }.
function podeVenderAPrazo(cliente, valor, gasto, temVencida) {
  const c = cliente || {};
  if (c.liberacaoPontual) return { ok: true, motivo: null, liberado: true };
  const limite = Number(c.limiteCredito) || 0;
  const v = Number(valor) || 0;
  const g = Number(gasto) || 0;
  if (c.bloquearLimite && limite > 0 && (g + v) > limite + 0.001) {
    return { ok: false, motivo: "limite", texto: "Esta venda ultrapassa o limite de crédito do cliente." };
  }
  if (c.bloquearVencimento && temVencida) {
    return { ok: false, motivo: "vencimento", texto: "O cliente tem uma conta a prazo vencida em aberto." };
  }
  return { ok: true, motivo: null };
}

// Lê (dentro de uma transação, opcional `client`) o gasto atual e nº de vencidas
// do cliente a partir das vendas a prazo em aberto.
async function _creditoDoCliente(runQ, empId, clienteId) {
  const r = await runQ(
    `SELECT COALESCE(SUM(total - COALESCE(valor_recebido,0)),0)::float AS gasto,
            COUNT(*) FILTER (WHERE vencimento IS NOT NULL
                             AND vencimento < (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int AS vencidas,
            COUNT(*)::int AS abertas
       FROM pedidos
      WHERE empresa_id = $1 AND cliente_id = $2 AND a_prazo = true
        AND recebido_em IS NULL AND status <> 'cancelado'`,
    [empId, clienteId]
  );
  const row = r.rows[0] || {};
  return {
    gasto: Math.round((Number(row.gasto) || 0) * 100) / 100,
    vencidas: Number(row.vencidas) || 0,
    abertas: Number(row.abertas) || 0,
  };
}

// Resumo de crédito do cliente (para o cadastro/Contas a Receber): gasto/saldo/vencido.
async function resumoDoCliente(dir, clienteId, limiteCredito) {
  const empId = await empresaId(dir);
  const c = await _creditoDoCliente((t, p) => db.query(t, p), empId, clienteId);
  const limite = Number(limiteCredito) || 0;
  return { gasto: c.gasto, saldo: Math.round((limite - c.gasto) * 100) / 100, vencido: c.vencidas > 0, emAberto: c.abertas };
}

// Registra a venda a prazo no caixa aberto (se o tenant tem caixa) como movimento
// INFORMATIVO 'venda_prazo': aparece na movimentação e no fechamento, mas NÃO conta
// na conferência (o dinheiro entra na baixa, não agora). Roda dentro da transação do
// chamador. Sem `comCaixa` (Essencial) ou sem caixa aberto → no-op.
async function _lancarVendaPrazoNoCaixa(client, empId, comCaixa, valor, pedidoId, descricao) {
  if (!comCaixa || !(Number(valor) > 0)) return;
  const cx = await client.query("SELECT id FROM caixas WHERE empresa_id = $1 AND status = 'aberto' LIMIT 1", [empId]);
  if (!cx.rows[0]) return;
  await client.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id, descricao)
     VALUES ($1, $2, 'venda_prazo', 'A Prazo', $3, $4, $5)`,
    [cx.rows[0].id, empId, valor, pedidoId, descricao || null]
  );
}

// Cria a venda a prazo (pedido a_prazo). Valida o crédito do cliente e consome a
// liberação pontual, tudo numa transação. Baixa de estoque atômica. Se o tenant
// tem caixa aberto, lança um movimento INFORMATIVO 'venda_prazo' (não conta na
// conferência). Lança Error com code:
//   'FIADO_SEM_CLIENTE'  — clienteId ausente
//   'FIADO_BLOQUEADO'    — limite/vencimento (e.bloqueio = 'limite'|'vencimento')
//   'ESTOQUE'            — faltou estoque (de store.baixarEstoqueTx)
async function venderAPrazo(dir, venda) {
  const empId = await empresaId(dir);
  const itens = Array.isArray(venda.itens) ? venda.itens : [];
  if (!itens.length) throw new Error("A venda está vazia.");
  if (!venda.clienteId) { const e = new Error("Selecione o cliente para a venda a prazo."); e.code = "FIADO_SEM_CLIENTE"; throw e; }
  const total = Number(venda.total) || 0;
  const desconto = Number(venda.desconto) || 0;
  const origem = venda.origem === "mesa" ? "mesa" : "pdv";

  const client = await db.pool.connect();
  const runQ = (t, p) => client.query(t, p);
  try {
    await client.query("BEGIN");
    const cq = await client.query(
      `SELECT id, nome, limite_credito, convenio_id, bloquear_limite, bloquear_vencimento, liberacao_pontual,
              (now() AT TIME ZONE 'America/Sao_Paulo')::date::text AS hoje
         FROM clientes WHERE empresa_id = $1 AND id = $2 FOR UPDATE`,
      [empId, venda.clienteId]
    );
    if (!cq.rows[0]) throw new Error("Cliente não encontrado.");
    const c = cq.rows[0];
    const cred = await _creditoDoCliente(runQ, empId, venda.clienteId);
    const cliente = {
      liberacaoPontual: c.liberacao_pontual, limiteCredito: Number(c.limite_credito) || 0,
      bloquearLimite: c.bloquear_limite, bloquearVencimento: c.bloquear_vencimento,
    };
    const decisao = podeVenderAPrazo(cliente, total, cred.gasto, cred.vencidas > 0);
    if (!decisao.ok) { const e = new Error(decisao.texto); e.code = "FIADO_BLOQUEADO"; e.bloqueio = decisao.motivo; throw e; }

    const novoCardapio = await store.baixarEstoqueTx(client, dir, itens);
    const cfg = store.getConfig(dir) || {};
    const convenio = (Array.isArray(cfg.convenios) ? cfg.convenios : []).find((v) => v.id === c.convenio_id) || null;
    const vencimento = convenios.calcularVencimentoConvenio(c.hoje, convenio);
    const nomeCli = (venda.cliente || c.nome || "Cliente").slice(0, 120);
    const ped = await client.query(
      `INSERT INTO pedidos
         (empresa_id, numero, status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento,
          taxa_entrega, itens, total, observacao, desconto, origem, cliente_id, a_prazo, vencimento, valor_recebido)
       VALUES
         ($1, (SELECT COALESCE(MAX(numero),0)+1 FROM pedidos WHERE empresa_id = $1), 'novo',
          $2, '', '', 'Balcão', '', 'A Prazo', 0, $3::jsonb, $4, $5, $6, $7, $8, true, $9, 0)
       RETURNING id, numero, criado_em`,
      [empId, nomeCli, JSON.stringify(itens), total, (venda.observacao || ""), desconto, origem, venda.clienteId, vencimento]
    );
    const row = ped.rows[0];
    if (c.liberacao_pontual) await client.query("UPDATE clientes SET liberacao_pontual = false WHERE id = $1", [venda.clienteId]);
    await _lancarVendaPrazoNoCaixa(client, empId, venda.comCaixa, total, row.id, null);
    await client.query("COMMIT");
    store.sincronizarCardapio(dir, novoCardapio);
    return {
      id: row.id, numero: row.numero, status: "novo", cliente: nomeCli, telefone: "",
      tipoEntrega: "Balcão", endereco: "", pagamento: "A Prazo", taxaEntrega: 0,
      itens, total, desconto, observacao: venda.observacao || "", aPrazo: true, vencimento,
      criadoEm: new Date(row.criado_em).toISOString(), recebidoEm: null,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Fecha a mesa "a prazo": marca os pedidos abertos da mesa como a_prazo (vinculados
// ao cliente, com vencimento), libera a mesa e NÃO gera movimento no caixa. Valida
// o crédito do cliente pelo total consumido. Não exige caixa aberto (é fiado).
async function fecharMesaAPrazo(dir, mesaId, clienteId, comCaixa) {
  const empId = await empresaId(dir);
  if (!clienteId) { const e = new Error("Selecione o cliente para fechar a mesa a prazo."); e.code = "FIADO_SEM_CLIENTE"; throw e; }
  const client = await db.pool.connect();
  const runQ = (t, p) => client.query(t, p);
  try {
    await client.query("BEGIN");
    const m = await client.query(
      "SELECT id, status FROM mesas WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, mesaId]
    );
    if (!m.rows[0]) throw new Error("Mesa não encontrada.");
    if (m.rows[0].status === "livre") throw new Error("Mesa não está aberta.");
    const cq = await client.query(
      `SELECT id, nome, limite_credito, convenio_id, bloquear_limite, bloquear_vencimento, liberacao_pontual,
              (now() AT TIME ZONE 'America/Sao_Paulo')::date::text AS hoje
         FROM clientes WHERE empresa_id = $1 AND id = $2 FOR UPDATE`,
      [empId, clienteId]
    );
    if (!cq.rows[0]) throw new Error("Cliente não encontrado.");
    const c = cq.rows[0];
    // Total consumido em aberto na mesa.
    const tq = await client.query(
      "SELECT COALESCE(SUM(total),0)::float AS total FROM pedidos WHERE empresa_id = $1 AND mesa_id = $2 AND recebido_em IS NULL AND status <> 'cancelado'",
      [empId, mesaId]
    );
    const totalMesa = Math.round((Number(tq.rows[0].total) || 0) * 100) / 100;
    const cred = await _creditoDoCliente(runQ, empId, clienteId);
    const cliente = {
      liberacaoPontual: c.liberacao_pontual, limiteCredito: Number(c.limite_credito) || 0,
      bloquearLimite: c.bloquear_limite, bloquearVencimento: c.bloquear_vencimento,
    };
    const decisao = podeVenderAPrazo(cliente, totalMesa, cred.gasto, cred.vencidas > 0);
    if (!decisao.ok) { const e = new Error(decisao.texto); e.code = "FIADO_BLOQUEADO"; e.bloqueio = decisao.motivo; throw e; }

    const cfg = store.getConfig(dir) || {};
    const convenio = (Array.isArray(cfg.convenios) ? cfg.convenios : []).find((v) => v.id === c.convenio_id) || null;
    const vencimento = convenios.calcularVencimentoConvenio(c.hoje, convenio);
    // Marca os pedidos abertos da mesa como fiado (mantém mesa_id e recebido_em NULL).
    await client.query(
      `UPDATE pedidos SET a_prazo = true, cliente_id = $3, vencimento = $4, pagamento = 'A Prazo'
         WHERE empresa_id = $1 AND mesa_id = $2 AND recebido_em IS NULL AND status <> 'cancelado'`,
      [empId, mesaId, clienteId, vencimento]
    );
    if (c.liberacao_pontual) await client.query("UPDATE clientes SET liberacao_pontual = false WHERE id = $1", [clienteId]);
    const r = await client.query(
      "UPDATE mesas SET status = 'livre', total_consumido = 0, fechada_em = now(), aberta_em = NULL WHERE empresa_id = $1 AND id = $2 RETURNING *",
      [empId, mesaId]
    );
    await _lancarVendaPrazoNoCaixa(client, empId, comCaixa, totalMesa, null, "Mesa " + mesaId);
    await client.query("COMMIT");
    return { mesa: r.rows[0], total: totalMesa, vencimento, cliente: c.nome };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================
// CONTAS A RECEBER (Fase 4) — listar as contas a prazo por cliente e dar baixa.
//
// A baixa (recebimento) entra no caixa do dia SÓ quando o tenant tem caixa
// (Completo) — o chamador passa `comCaixa` (empresas.temCaixa). No Essencial a
// baixa apenas quita a conta e registra o log em `fiado_baixas`. Isolado por
// empresa_id.
// ============================================================
const soDigitosF = (v) => String(v == null ? "" : v).replace(/\D/g, "");

// Monta o filtro de busca por cliente (nome/apelido ILIKE + documento/telefone
// por dígitos) a partir de `$1 = empId`. Devolve { sql, params } com o WHERE
// acoplado (string começando por " AND (...)" ou vazia).
function _filtroBusca(alias, empId, busca) {
  const termo = String(busca || "").trim();
  const params = [empId];
  let sql = "";
  if (termo) {
    params.push(`%${termo}%`);
    const partes = [`${alias}.nome ILIKE $${params.length}`, `${alias}.apelido ILIKE $${params.length}`];
    const dig = soDigitosF(termo);
    if (dig) {
      params.push(`%${dig}%`);
      partes.push(`${alias}.documento LIKE $${params.length}`, `${alias}.telefone LIKE $${params.length}`);
    }
    sql = ` AND (${partes.join(" OR ")})`;
  }
  return { sql, params };
}

// Cards do topo (globais, NÃO filtrados pela busca): total a receber, em atraso
// (vencido em aberto) e clientes novos no mês corrente (fuso BR).
async function _resumoGeral(empId) {
  const r = await db.query(
    `SELECT
       COALESCE(SUM(total - COALESCE(valor_recebido,0)),0)::float AS a_receber,
       COALESCE(SUM(CASE WHEN vencimento IS NOT NULL
                          AND vencimento < (now() AT TIME ZONE 'America/Sao_Paulo')::date
                         THEN total - COALESCE(valor_recebido,0) ELSE 0 END),0)::float AS em_atraso
       FROM pedidos
      WHERE empresa_id = $1 AND a_prazo AND recebido_em IS NULL AND status <> 'cancelado'`,
    [empId]
  );
  const nv = await db.query(
    `SELECT COUNT(*)::int AS n FROM clientes
      WHERE empresa_id = $1
        AND criado_em >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))`,
    [empId]
  );
  const row = r.rows[0] || {};
  return {
    aReceber: Math.round((Number(row.a_receber) || 0) * 100) / 100,
    emAtraso: Math.round((Number(row.em_atraso) || 0) * 100) / 100,
    novosNoMes: Number(nv.rows[0] && nv.rows[0].n) || 0,
  };
}

// Clientes com contas a prazo em aberto (`aberto:true`) ou já quitadas
// (`aberto:false`), agregados por cliente. Retorna { clientes, resumo } — o
// resumo é global (p/ os cards do topo).
async function listarContas(dir, { busca, aberto = true } = {}) {
  const empId = await empresaId(dir);
  const { sql: fsql, params } = _filtroBusca("c", empId, busca);
  const cond = aberto ? "p.recebido_em IS NULL" : "p.recebido_em IS NOT NULL";
  const ordem = aberto
    ? "ORDER BY vencido DESC, venc ASC NULLS LAST, c.nome"
    : "ORDER BY ultimo DESC NULLS LAST, c.nome";
  const q = await db.query(
    `SELECT c.id, c.nome, c.apelido, c.tipo, c.documento, c.telefone, c.limite_credito,
            COUNT(p.id)::int AS vendas,
            COALESCE(SUM(p.total - COALESCE(p.valor_recebido,0)),0)::float AS aberto,
            COALESCE(SUM(p.total),0)::float AS total,
            MIN(p.vencimento)::text AS venc,
            MAX(p.recebido_em) AS ultimo,
            BOOL_OR(p.vencimento IS NOT NULL AND p.vencimento < (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS vencido
       FROM clientes c
       JOIN pedidos p ON p.empresa_id = c.empresa_id AND p.cliente_id = c.id
      WHERE c.empresa_id = $1 AND p.a_prazo AND ${cond} AND p.status <> 'cancelado'${fsql}
      GROUP BY c.id
      ${ordem}
      LIMIT 500`,
    params
  );
  const clientes = q.rows.map((r) => ({
    id: r.id, nome: r.nome || "", apelido: r.apelido || "", tipo: r.tipo || "PF",
    documento: r.documento || "", telefone: r.telefone || "",
    limiteCredito: Number(r.limite_credito) || 0,
    vendas: Number(r.vendas) || 0,
    aberto: Math.round((Number(r.aberto) || 0) * 100) / 100,
    total: Math.round((Number(r.total) || 0) * 100) / 100,
    vencimento: r.venc || null,
    ultimoRecebimento: r.ultimo ? new Date(r.ultimo).toISOString() : null,
    vencido: !!r.vencido,
  }));
  const resumo = await _resumoGeral(empId);
  return { clientes, resumo };
}

// Vendas a prazo de um cliente (para o modal), abertas ou quitadas, com o
// histórico de baixas de cada uma.
async function vendasDoCliente(dir, clienteId, { aberto = true } = {}) {
  const empId = await empresaId(dir);
  const cond = aberto ? "recebido_em IS NULL" : "recebido_em IS NOT NULL";
  const q = await db.query(
    `SELECT id, numero, criado_em, recebido_em, vencimento::text AS venc, total,
            COALESCE(valor_recebido,0) AS valor_recebido, origem, pagamento,
            (vencimento IS NOT NULL AND vencimento < (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS vencido
       FROM pedidos
      WHERE empresa_id = $1 AND cliente_id = $2 AND a_prazo AND ${cond} AND status <> 'cancelado'
      ORDER BY criado_em`,
    [empId, clienteId]
  );
  const vendas = q.rows.map((r) => {
    const total = Math.round((Number(r.total) || 0) * 100) / 100;
    const recebido = Math.round((Number(r.valor_recebido) || 0) * 100) / 100;
    return {
      id: r.id, numero: r.numero,
      criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
      recebidoEm: r.recebido_em ? new Date(r.recebido_em).toISOString() : null,
      vencimento: r.venc || null, vencido: !!r.vencido,
      total, valorRecebido: recebido,
      restante: Math.round((total - recebido) * 100) / 100,
      origem: r.origem || "", pagamento: r.pagamento || "",
    };
  });
  const ids = vendas.map((v) => v.id);
  let baixas = [];
  if (ids.length) {
    const b = await db.query(
      `SELECT pedido_id, valor, forma_pagamento, restante, criado_em
         FROM fiado_baixas
        WHERE empresa_id = $1 AND pedido_id = ANY($2::bigint[])
        ORDER BY criado_em`,
      [empId, ids]
    );
    baixas = b.rows.map((r) => ({
      pedidoId: r.pedido_id,
      valor: Math.round((Number(r.valor) || 0) * 100) / 100,
      forma: r.forma_pagamento || "",
      restante: Math.round((Number(r.restante) || 0) * 100) / 100,
      criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    }));
  }
  return { vendas, baixas };
}

// Dá baixa (recebimento) em uma ou mais contas a prazo. `pedidoIds` = vendas a
// baixar; `forma` = forma do recebimento (canônica, nunca "A Prazo"). Sem
// `valor` = baixa INTEGRAL (quita cada venda selecionada). Com `valor` = baixa
// PARCIAL: abate o valor da dívida das vendas selecionadas, da mais vencida p/ a
// mais nova (o cliente abate da conta como um todo). `comCaixa` (Completo) → lança um
// movimento de recebimento no caixa aberto por venda; sem caixa (Essencial) só
// quita. Tudo numa transação (nada fica meio-baixado). Grava o log em
// `fiado_baixas` e marca `recebido_em` quando a venda quita.
async function baixar(dir, opts) {
  const empId = await empresaId(dir);
  const o = opts || {};
  const ids = [...new Set(
    (Array.isArray(o.pedidoIds) ? o.pedidoIds : [])
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
  if (!ids.length) throw new Error("Selecione ao menos uma venda para receber.");
  const forma = String(o.forma || "").trim();
  if (!forma || /a\s*prazo|fiado/i.test(forma)) throw new Error("Escolha a forma do recebimento.");
  const parcial = o.valor != null && o.valor !== "";
  const valorParcial = Math.round((Number(o.valor) || 0) * 100) / 100;
  if (parcial && !(valorParcial > 0)) throw new Error("Informe um valor válido.");

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // Caixa: só o Completo joga a baixa no caixa do dia. Um caixa aberto por
    // empresa (índice único garante). Vencido = aberto num dia anterior (fuso BR).
    let caixaId = null;
    if (o.comCaixa) {
      const cx = await client.query(
        `SELECT id,
                (aberto_em AT TIME ZONE 'America/Sao_Paulo')::date
                  < (now() AT TIME ZONE 'America/Sao_Paulo')::date AS vencido
           FROM caixas WHERE empresa_id = $1 AND status = 'aberto' LIMIT 1`,
        [empId]
      );
      if (!cx.rows[0]) throw new Error("Abra o caixa antes de receber.");
      if (cx.rows[0].vencido) throw new Error("Feche o caixa do dia anterior antes de receber.");
      caixaId = cx.rows[0].id;
    }

    // Busca as vendas selecionadas em ORDEM (mais vencida/antiga primeiro) e trava.
    // Numa baixa PARCIAL o valor é abatido da dívida da mais antiga p/ a mais nova
    // (o cliente abate da conta como um todo, não de uma venda específica). Numa
    // baixa INTEGRAL cada venda selecionada é quitada.
    const pq = await client.query(
      `SELECT id, total, COALESCE(valor_recebido,0) AS valor_recebido, cliente_id
         FROM pedidos
        WHERE empresa_id = $1 AND id = ANY($2::bigint[])
          AND a_prazo = true AND recebido_em IS NULL AND status <> 'cancelado'
        ORDER BY vencimento ASC NULLS LAST, id ASC
        FOR UPDATE`,
      [empId, ids]
    );

    let somaBaixada = 0;
    const quitados = [];
    let restanteValor = parcial ? valorParcial : null; // null = integral (quita cada venda)
    for (const p of pq.rows) {
      if (parcial && restanteValor <= 0.005) break; // valor parcial já distribuído
      const total = Math.round((Number(p.total) || 0) * 100) / 100;
      const jaRecebido = Math.round((Number(p.valor_recebido) || 0) * 100) / 100;
      const restante = Math.round((total - jaRecebido) * 100) / 100;
      if (restante <= 0) continue;
      const pago = parcial ? Math.min(restante, restanteValor) : restante;
      if (pago <= 0) continue;

      let movId = null;
      if (caixaId) {
        const mv = await client.query(
          `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id, valor_pago, troco)
           VALUES ($1, $2, 'recebimento', $3, $4, $5, $4, 0) RETURNING id`,
          [caixaId, empId, forma, pago, p.id]
        );
        movId = mv.rows[0].id;
      }
      const novoRecebido = Math.round((jaRecebido + pago) * 100) / 100;
      const restanteDepois = Math.max(0, Math.round((total - novoRecebido) * 100) / 100);
      const quitou = restanteDepois <= 0.005;
      await client.query(
        "UPDATE pedidos SET valor_recebido = $3, recebido_em = CASE WHEN $4 THEN now() ELSE recebido_em END WHERE empresa_id = $1 AND id = $2",
        [empId, p.id, novoRecebido, quitou]
      );
      await client.query(
        `INSERT INTO fiado_baixas (empresa_id, pedido_id, cliente_id, valor, forma_pagamento, restante, caixa_movimento_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [empId, p.id, p.cliente_id, pago, forma, restanteDepois, movId]
      );
      somaBaixada = Math.round((somaBaixada + pago) * 100) / 100;
      if (parcial) restanteValor = Math.round((restanteValor - pago) * 100) / 100;
      if (quitou) quitados.push(p.id);
    }
    if (!pq.rows.length) throw new Error("Nenhuma venda a prazo em aberto entre as selecionadas.");

    await client.query("COMMIT");
    return { ok: true, total: somaBaixada, quitados, comCaixa: !!caixaId };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  podeVenderAPrazo, resumoDoCliente,
  venderAPrazo, fecharMesaAPrazo, esquecer,
  listarContas, vendasDoCliente, baixar,
};

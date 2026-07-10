// ============================================================
// FIADO — venda "A Prazo" (Fase 3). Isolado por empresa_id (padrão do pedidos.js).
//
// Uma venda a prazo é um pedido a_prazo=true vinculado a um cliente, recebido_em
// NULL (conta a receber) e SEM movimento no caixa na hora. Origem PDV (Balcão) ou
// Mesa (fechamento a prazo). A baixa (recebimento posterior) vem na Fase 4.
//
// Helpers PUROS (calcularVencimento, podeVenderAPrazo) são testados em
// test/fiado.test.js.
// ============================================================
const path = require("path");
const db = require("./db");
const store = require("./store");

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

// PURO: vencimento = dia fixo do mês (próxima ocorrência do `dia`, hoje ou depois).
// `hojeISO` = 'YYYY-MM-DD' (data BR). `dia` = 1..31 ou null (sem vencimento).
// Se o dia já passou no mês corrente, vai para o mês seguinte; clampa em meses
// curtos (ex.: dia 31 em fevereiro → último dia). Retorna 'YYYY-MM-DD' ou null.
function calcularVencimento(hojeISO, dia) {
  const d = parseInt(dia, 10);
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  const [ano, mes, diaHoje] = String(hojeISO).split("-").map(Number); // mes 1..12
  if (!ano || !mes || !diaHoje) return null;
  let alvoAno = ano, alvoMes = mes;
  if (d < diaHoje) { alvoMes++; if (alvoMes > 12) { alvoMes = 1; alvoAno++; } }
  const ultimoDia = new Date(alvoAno, alvoMes, 0).getDate(); // último dia do mês alvo (1-indexado)
  const diaClamp = Math.min(d, ultimoDia);
  return `${alvoAno}-${String(alvoMes).padStart(2, "0")}-${String(diaClamp).padStart(2, "0")}`;
}

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

// Cria a venda a prazo (pedido a_prazo, sem caixa). Valida o crédito do cliente
// e consome a liberação pontual, tudo numa transação. Baixa de estoque atômica.
// Lança Error com code:
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
      `SELECT id, nome, limite_credito, dia_vencimento, bloquear_limite, bloquear_vencimento, liberacao_pontual,
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
    const vencimento = calcularVencimento(c.hoje, c.dia_vencimento);
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
async function fecharMesaAPrazo(dir, mesaId, clienteId) {
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
      `SELECT id, nome, limite_credito, dia_vencimento, bloquear_limite, bloquear_vencimento, liberacao_pontual,
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

    const vencimento = calcularVencimento(c.hoje, c.dia_vencimento);
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
    await client.query("COMMIT");
    return { mesa: r.rows[0], total: totalMesa, vencimento, cliente: c.nome };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  calcularVencimento, podeVenderAPrazo, resumoDoCliente,
  venderAPrazo, fecharMesaAPrazo, esquecer,
};

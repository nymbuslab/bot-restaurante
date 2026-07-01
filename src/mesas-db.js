// ============================================================
// MESAS DB — acesso ao banco da tabela `mesas` + recebimento parcial
// e fechamento via caixa_movimentos. Isolado por empresa_id (padrão
// pedidos.js / caixa.js). Cálculo puro fica em mesas.js.
// ============================================================

const path = require("path");
const db = require("./db");
const caixa = require("./caixa");

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

function mapRow(r) {
  return {
    id: r.id,
    nome: r.nome,
    status: r.status,
    taxaServico: r.taxa_servico == null ? 0 : Number(r.taxa_servico),
    totalConsumido: r.total_consumido == null ? 0 : Number(r.total_consumido),
    qrCodeToken: r.qr_code_token || null,
    ordem: r.ordem == null ? 0 : r.ordem,
    abertaEm: r.aberta_em ? new Date(r.aberta_em).toISOString() : null,
    fechadaEm: r.fechada_em ? new Date(r.fechada_em).toISOString() : null,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    // Presente só na listagem (subquery). Usado para o alerta de "mesa parada".
    ultimoPedidoEm: r.ultimo_pedido_em ? new Date(r.ultimo_pedido_em).toISOString() : null,
  };
}

async function listar(dir) {
  const empId = await empresaId(dir);
  // ultimo_pedido_em = data do último pedido não-cancelado da mesa (p/ alerta de mesa parada).
  const r = await db.query(
    `SELECT m.*, (
        SELECT MAX(p.criado_em) FROM pedidos p
         WHERE p.empresa_id = m.empresa_id AND p.mesa_id = m.id AND p.status <> 'cancelado'
       ) AS ultimo_pedido_em
       FROM mesas m WHERE m.empresa_id = $1 ORDER BY m.ordem, m.id`,
    [empId]
  );
  return r.rows.map(mapRow);
}

async function buscarPorId(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM mesas WHERE empresa_id = $1 AND id = $2", [empId, id]);
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

// Cria N mesas a partir de uma lista de nomes (até 50). Ignora nomes duplicados
// (ON CONFLICT pela UNIQUE empresa_id+nome). `ordem` segue o índice do array.
async function criarEmLote(dir, nomes) {
  const empId = await empresaId(dir);
  const lista = (Array.isArray(nomes) ? nomes : [])
    .map((n) => String(n || "").trim().slice(0, 20))
    .filter(Boolean)
    .slice(0, 50);
  if (!lista.length) throw new Error("Informe ao menos um nome de mesa.");
  const baseOrdem = await db.query("SELECT COALESCE(MAX(ordem), 0) AS m FROM mesas WHERE empresa_id = $1", [empId]);
  let ordem = Number(baseOrdem.rows[0].m) || 0;
  const vals = [];
  const params = [empId];
  for (const nome of lista) {
    ordem += 1;
    params.push(nome, ordem);
    vals.push("($1, $" + (params.length - 1) + ", $" + params.length + ")");
  }
  const r = await db.query(
    `INSERT INTO mesas (empresa_id, nome, ordem) VALUES ${vals.join(", ")}
     ON CONFLICT (empresa_id, nome) DO NOTHING RETURNING *`,
    params
  );
  return r.rows.map(mapRow);
}

async function remover(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "DELETE FROM mesas WHERE empresa_id = $1 AND id = $2 AND status = 'livre' RETURNING id",
    [empId, id]
  );
  return r.rowCount > 0;
}

// Abre a mesa (livre → ocupada) e fotografa a taxa de serviço vigente (% do config).
async function abrir(dir, id, taxaServico) {
  const empId = await empresaId(dir);
  const taxa = Math.max(0, Math.min(100, Number(taxaServico) || 0));
  const r = await db.query(
    `UPDATE mesas SET status = 'ocupada', aberta_em = now(), fechada_em = NULL,
            taxa_servico = $1, total_consumido = 0
       WHERE empresa_id = $2 AND id = $3 AND status = 'livre' RETURNING *`,
    [taxa, empId, id]
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

async function atualizarStatus(dir, id, status, exigeAtual) {
  const empId = await empresaId(dir);
  const cond = exigeAtual ? " AND status = $4" : "";
  const params = exigeAtual ? [status, empId, id, exigeAtual] : [status, empId, id];
  const r = await db.query(
    `UPDATE mesas SET status = $1 WHERE empresa_id = $2 AND id = $3${cond} RETURNING *`,
    params
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

// Reabre uma mesa em fechamento (pediu_conta/fechando → ocupada). Pagamentos
// parciais já lançados PERMANECEM (vistos como "já recebido"); o próximo
// fechamento cobra só a falta.
async function reabrir(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `UPDATE mesas SET status = 'ocupada'
       WHERE empresa_id = $1 AND id = $2 AND status IN ('pediu_conta','fechando') RETURNING *`,
    [empId, id]
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

async function vincularPedido(dir, mesaId, pedidoId, client) {
  const empId = await empresaId(dir);
  const exec = client ? (s, p) => client.query(s, p) : (s, p) => db.query(s, p);
  await exec(
    `UPDATE mesas m SET total_consumido = (
        SELECT COALESCE(SUM(p.total), 0) FROM pedidos p
         WHERE p.empresa_id = m.empresa_id AND p.mesa_id = m.id AND p.status <> 'cancelado')
       WHERE m.empresa_id = $1 AND m.id = $2`,
    [empId, mesaId]
  );
}

async function pedidosDaMesa(dir, mesaId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT id, numero, status, itens, total, observacao, criado_em FROM pedidos WHERE empresa_id = $1 AND mesa_id = $2 ORDER BY id ASC",
    [empId, mesaId]
  );
  return r.rows.map((p) => ({
    id: p.id,
    numero: p.numero,
    status: p.status,
    itens: p.itens || [],
    total: p.total == null ? 0 : Number(p.total),
    observacao: p.observacao || "",
    criadoEm: p.criado_em ? new Date(p.criado_em).toISOString() : null,
  }));
}

// Soma já recebida desta mesa (pagamentos parciais lançados no caixa).
async function recebidoDaMesa(dir, mesaId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT COALESCE(SUM(valor), 0) AS s FROM caixa_movimentos WHERE empresa_id = $1 AND mesa_id = $2 AND tipo = 'recebimento'",
    [empId, mesaId]
  );
  return Number(r.rows[0].s) || 0;
}

// Recebimento PARCIAL: lança um ou mais movimentos de recebimento ligados à mesa
// (sem pedido_id), numa transação (split: várias formas de uma vez). Não muda o
// status da mesa — outros podem continuar pagando/pedindo.
async function receberParcial(dir, mesaId, pagamentos, nomeMesa) {
  const empId = await empresaId(dir);
  const pags = (Array.isArray(pagamentos) ? pagamentos : [pagamentos])
    .map((p) => ({ forma: (p && p.forma) || "Outros", valor: Number(p && p.valor) || 0 }))
    .filter((p) => p.valor > 0);
  if (!pags.length) throw new Error("Valor deve ser positivo.");
  const cx = await caixa.caixaAberto(dir);
  if (!cx) throw new Error("Abra o caixa antes de receber.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of pags) {
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, mesa_id, descricao)
         VALUES ($1, $2, 'recebimento', $3, $4, $5, $6)`,
        [cx.id, empId, p.forma, p.valor, mesaId, "Mesa " + (nomeMesa || mesaId)]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return { recebido: await recebidoDaMesa(dir, mesaId) };
}

// Fechamento FINAL: lança os pagamentos do restante, marca todos os pedidos da
// mesa como recebidos e libera a mesa — tudo numa transação.
async function finalizarFechamento(dir, mesaId, { pagamentos }, nomeMesa) {
  const empId = await empresaId(dir);
  const cx = await caixa.caixaAberto(dir);
  if (!cx) throw new Error("Abra o caixa antes de fechar a conta.");
  const pags = Array.isArray(pagamentos) ? pagamentos : [];
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const m = await client.query(
      "SELECT id, status FROM mesas WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, mesaId]
    );
    if (!m.rows[0]) throw new Error("Mesa não encontrada.");
    if (m.rows[0].status === "livre") throw new Error("Mesa não está aberta.");
    for (const p of pags) {
      const v = Number(p.valor) || 0;
      if (v <= 0) continue;
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, mesa_id, descricao)
         VALUES ($1, $2, 'recebimento', $3, $4, $5, $6)`,
        [cx.id, empId, p.forma || "Outros", v, mesaId, "Mesa " + (nomeMesa || mesaId)]
      );
    }
    await client.query(
      "UPDATE pedidos SET recebido_em = now() WHERE empresa_id = $1 AND mesa_id = $2 AND recebido_em IS NULL",
      [empId, mesaId]
    );
    const r = await client.query(
      `UPDATE mesas SET status = 'livre', total_consumido = 0, fechada_em = now()
         WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empId, mesaId]
    );
    await client.query("COMMIT");
    return mapRow(r.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Cancela a mesa: marca os pedidos abertos como cancelados e libera a mesa.
// (Não restaura estoque nem estorna recebimentos — operação de correção pontual.)
async function cancelar(dir, id) {
  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE pedidos SET status = 'cancelado' WHERE empresa_id = $1 AND mesa_id = $2 AND recebido_em IS NULL",
      [empId, id]
    );
    const r = await client.query(
      `UPDATE mesas SET status = 'livre', total_consumido = 0, fechada_em = now()
         WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empId, id]
    );
    await client.query("COMMIT");
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Transfere pedidos da mesa origem para a destino (lista de ids; vazio = todos).
// Abre a destino se estiver livre e libera a origem se ficar sem pedidos. Usado
// também para "juntar mesas" (transferir todos).
async function transferir(dir, origemId, destinoId, pedidoIds) {
  const empId = await empresaId(dir);
  if (Number(origemId) === Number(destinoId)) throw new Error("Mesa de origem e destino são iguais.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const filtroIds = Array.isArray(pedidoIds) && pedidoIds.length;
    const params = [empId, origemId, destinoId];
    let cond = "empresa_id = $1 AND mesa_id = $2";
    if (filtroIds) { params.push(pedidoIds); cond += " AND id = ANY($4::bigint[])"; }
    await client.query(`UPDATE pedidos SET mesa_id = $3 WHERE ${cond}`, params);
    // Recalcula totais das duas mesas.
    for (const mid of [origemId, destinoId]) {
      await client.query(
        `UPDATE mesas m SET total_consumido = (
            SELECT COALESCE(SUM(p.total), 0) FROM pedidos p
             WHERE p.empresa_id = m.empresa_id AND p.mesa_id = m.id AND p.status <> 'cancelado')
           WHERE m.empresa_id = $1 AND m.id = $2`,
        [empId, mid]
      );
    }
    // Destino: abre se estava livre. Origem: libera se ficou sem pedidos abertos.
    await client.query(
      "UPDATE mesas SET status = 'ocupada', aberta_em = COALESCE(aberta_em, now()) WHERE empresa_id = $1 AND id = $2 AND status = 'livre'",
      [empId, destinoId]
    );
    await client.query(
      `UPDATE mesas SET status = 'livre', total_consumido = 0, fechada_em = now()
         WHERE empresa_id = $1 AND id = $2 AND NOT EXISTS (
           SELECT 1 FROM pedidos p WHERE p.empresa_id = $1 AND p.mesa_id = $2 AND p.status <> 'cancelado')`,
      [empId, origemId]
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

async function salvarQrToken(dir, mesaId, token) {
  const empId = await empresaId(dir);
  await db.query("UPDATE mesas SET qr_code_token = $1 WHERE empresa_id = $2 AND id = $3", [token, empId, mesaId]);
}

// Lança itens na mesa usando comanda acumulada: se já existe pedido 'novo' aberto,
// acumula os itens nele; caso contrário, insere um novo pedido.
// Isso garante 1 pedido por sessão de mesa (padrão da indústria — open check).
async function lancarItens(dir, mesaId, { itens, total, cliente, observacao }, client) {
  const empId = await empresaId(dir);
  const exec = client ? (s, p) => client.query(s, p) : (s, p) => db.query(s, p);

  const existing = await exec(
    "SELECT id, itens, total FROM pedidos WHERE empresa_id = $1 AND mesa_id = $2 AND status = 'novo' ORDER BY id ASC LIMIT 1",
    [empId, mesaId]
  );

  if (existing.rows[0]) {
    const itensAntigos = existing.rows[0].itens || [];
    const todosItens = [...itensAntigos, ...itens];
    const novoTotal = Number(existing.rows[0].total) + (total || 0);
    await exec(
      "UPDATE pedidos SET itens = $1::jsonb, total = $2 WHERE id = $3",
      [JSON.stringify(todosItens), novoTotal, existing.rows[0].id]
    );
  } else {
    await exec(
      `INSERT INTO pedidos
         (empresa_id, numero, status, cliente, tipo_entrega, itens, total, observacao, mesa_id, origem)
       VALUES
         ($1, (SELECT COALESCE(MAX(numero), 0) + 1 FROM pedidos WHERE empresa_id = $1), 'novo',
          $2, 'Balcão', $3::jsonb, $4, $5, $6, 'mesa')`,
      [empId, cliente || "", JSON.stringify(itens), total || 0, observacao || "", mesaId]
    );
  }

  // Recalcula total_consumido da mesa
  await exec(
    `UPDATE mesas m SET total_consumido = (
        SELECT COALESCE(SUM(p.total), 0) FROM pedidos p
         WHERE p.empresa_id = m.empresa_id AND p.mesa_id = m.id AND p.status <> 'cancelado')
       WHERE m.empresa_id = $1 AND m.id = $2`,
    [empId, mesaId]
  );
}

// Remove um único item de um pedido da mesa. Recalcula o total do pedido;
// se o pedido ficar sem itens, marca-o como cancelado.
async function cancelarItem(dir, mesaId, pedidoId, itemIdx) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT id, itens FROM pedidos WHERE id=$1 AND empresa_id=$2 AND mesa_id=$3 AND status<>'cancelado'",
    [pedidoId, empId, mesaId]
  );
  if (!r.rows[0]) throw new Error("Pedido não encontrado nesta mesa.");
  const itens = Array.isArray(r.rows[0].itens) ? [...r.rows[0].itens] : [];
  if (itemIdx < 0 || itemIdx >= itens.length) throw new Error("Item não encontrado.");
  itens.splice(itemIdx, 1);
  if (!itens.length) {
    await db.query(
      "UPDATE pedidos SET itens='[]'::jsonb, total=0, status='cancelado' WHERE id=$1",
      [pedidoId]
    );
  } else {
    const novoTotal = Math.round(itens.reduce((s, i) => {
      const extras =
        (i.opcionais || []).reduce((x, o) => x + (o.preco || 0) * (o.qtd || 1), 0) +
        (i.variacoes || []).reduce((x, v) => x + (v.preco || 0) * (v.qtd || 1), 0);
      return s + ((i.preco || 0) + extras) * (i.qtd || 1);
    }, 0) * 100) / 100;
    await db.query(
      "UPDATE pedidos SET itens=$1::jsonb, total=$2 WHERE id=$3",
      [JSON.stringify(itens), novoTotal, pedidoId]
    );
  }
}

function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  listar, buscarPorId, criarEmLote, remover, abrir, atualizarStatus, reabrir,
  vincularPedido, lancarItens, pedidosDaMesa, recebidoDaMesa, receberParcial, finalizarFechamento,
  cancelar, transferir, salvarQrToken, esquecer, cancelarItem,
};

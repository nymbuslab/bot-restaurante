// ============================================================
// MESAS DB — acesso ao banco da tabela `mesas` + recebimento parcial
// e fechamento via caixa_movimentos. Isolado por empresa_id (padrão
// pedidos.js / caixa.js). Cálculo puro fica em mesas.js.
// ============================================================

const path = require("path");
const db = require("./db");
const caixa = require("./caixa");
const store = require("./store"); // devolverEstoqueTx/sincronizarCardapio (cancelamento devolve ao estoque)
const pdv = require("./pdv");     // resumoPagamento: o formato do resumo tem um dono só

const slugDe = (dir) => path.basename(dir);
const idCache = {};

// ---- Fronteira de sessão da mesa -------------------------------------------
// Uma mesa é reusada por clientes diferentes o dia inteiro. Fechar ou cancelar
// zera `aberta_em`, e abrir grava `now()` de novo — é ESSA data que separa uma
// sessão da seguinte.
//
// Sem o recorte, um pedido que ficou sem receber numa sessão antiga (fechamento
// interrompido, falha no meio da transação) segue grudado na mesa para sempre:
// aparece na conta do próximo cliente, entra no total consumido e, pior, o
// `lancarItens` ACUMULA a rodada nova dentro dele, herdando número e valor.
//
// `recebidoDaMesa` já cortava por `aberta_em` (o caixa não tem `recebido_em`), e
// era a única metade da conta que fazia isso. Agora as duas usam a mesma régua.
//
// Invariante que sustenta o corte: pedido de mesa só nasce com a mesa aberta (a
// rota recusa mesa livre), então `criado_em >= aberta_em` sempre. A exceção é a
// TRANSFERÊNCIA, que pode mover pedido antigo para mesa aberta agora — por isso
// `transferir` recua o `aberta_em` do destino (ver lá).
//
// Mesa livre tem `aberta_em` nulo: o predicado é falso e nada aparece, que é o
// resultado certo. Pedido órfão não some do sistema, continua na aba Pedidos
// como "a receber" para o dono resolver.
const DA_SESSAO = "p.recebido_em IS NULL AND p.status <> 'cancelado' AND m.aberta_em IS NOT NULL AND p.criado_em >= m.aberta_em";

// Recalcula `mesas.total_consumido` a partir dos pedidos da SESSÃO. Era a mesma SQL
// copiada em três lugares (vincular, lançar, transferir), que é como os critérios
// divergiram em primeiro lugar. Recebe `exec` para rodar dentro da transação de quem
// chamou, ou solto quando não houver uma.
function recalcularConsumoSql() {
  return `UPDATE mesas m SET total_consumido = (
            SELECT COALESCE(SUM(p.total), 0) FROM pedidos p
             WHERE p.empresa_id = m.empresa_id AND p.mesa_id = m.id AND ${DA_SESSAO})
           WHERE m.empresa_id = $1 AND m.id = $2`;
}

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
    pessoas: r.pessoas == null ? 1 : Number(r.pessoas),
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
  // ultimo_pedido_em = data do último pedido DA SESSÃO (p/ alerta de mesa parada).
  // Sem o recorte, uma sobra antiga datava o alerta e a mesa nunca aparecia parada.
  const r = await db.query(
    `SELECT m.*, (
        SELECT MAX(p.criado_em) FROM pedidos p
         WHERE p.empresa_id = m.empresa_id AND p.mesa_id = m.id AND ${DA_SESSAO}
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
// pessoas: nº de comensais (opcional, padrão 1) — usado p/ "valor por pessoa".
async function abrir(dir, id, taxaServico, pessoas) {
  const empId = await empresaId(dir);
  const taxa = Math.max(0, Math.min(100, Number(taxaServico) || 0));
  const pes = Math.max(1, Math.min(99, Math.round(Number(pessoas) || 1)));
  const r = await db.query(
    `UPDATE mesas SET status = 'ocupada', aberta_em = now(), fechada_em = NULL,
            taxa_servico = $1, pessoas = $2, total_consumido = 0
       WHERE empresa_id = $3 AND id = $4 AND status = 'livre' RETURNING *`,
    [taxa, pes, empId, id]
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

// Atualiza o nº de pessoas de uma mesa aberta (edição pelo painel).
async function atualizarPessoas(dir, id, pessoas) {
  const empId = await empresaId(dir);
  const pes = Math.max(1, Math.min(99, Math.round(Number(pessoas) || 1)));
  const r = await db.query(
    "UPDATE mesas SET pessoas = $1 WHERE empresa_id = $2 AND id = $3 AND status <> 'livre' RETURNING *",
    [pes, empId, id]
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
  await exec(recalcularConsumoSql(), [empId, mesaId]);
}

async function pedidosDaMesa(dir, mesaId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT p.id, p.numero, p.status, p.itens, p.total, p.observacao, p.criado_em
       FROM pedidos p JOIN mesas m ON m.id = p.mesa_id AND m.empresa_id = p.empresa_id
      WHERE p.empresa_id = $1 AND p.mesa_id = $2 AND ${DA_SESSAO} ORDER BY p.id ASC`,
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

// Soma já recebida desta mesa NA SESSÃO ATUAL (parciais lançados no caixa depois do
// aberta_em). Sem esse recorte, recebimentos de sessões anteriores da mesma mesa
// (o caixa_movimentos fica no histórico p/ sempre) vazariam para a nova abertura —
// mesma fronteira de sessão dos pedidos, mas aqui via aberta_em (o caixa não tem recebido_em).
async function recebidoDaMesa(dir, mesaId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT COALESCE(SUM(cm.valor), 0) AS s
       FROM caixa_movimentos cm
       JOIN mesas m ON m.id = cm.mesa_id AND m.empresa_id = cm.empresa_id
      WHERE cm.empresa_id = $1 AND cm.mesa_id = $2 AND cm.tipo = 'recebimento'
        AND m.aberta_em IS NOT NULL AND cm.criado_em >= m.aberta_em`,
    [empId, mesaId]
  );
  return Number(r.rows[0].s) || 0;
}

// Recebimento PARCIAL: lança um ou mais movimentos de recebimento ligados à mesa
// (sem pedido_id), numa transação (split: várias formas de uma vez). Não muda o
// status da mesa — outros podem continuar pagando/pedindo.
async function receberParcial(dir, mesaId, pagamentos, nomeMesa) {
  const empId = await empresaId(dir);
  const cent2 = (n) => (n == null ? null : Math.round((Number(n) || 0) * 100) / 100);
  const pags = (Array.isArray(pagamentos) ? pagamentos : [pagamentos])
    .map((p) => ({ forma: (p && p.forma) || "Outros", valor: Number(p && p.valor) || 0, valorPago: cent2(p && p.valorPago), troco: cent2(p && p.troco) }))
    .filter((p) => p.valor > 0);
  if (!pags.length) throw new Error("Valor deve ser positivo.");
  const cx = await caixa.caixaAberto(dir);
  if (!cx) throw new Error("Abra o caixa antes de receber.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of pags) {
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, mesa_id, descricao, valor_pago, troco)
         VALUES ($1, $2, 'recebimento', $3, $4, $5, $6, $7, $8)`,
        [cx.id, empId, p.forma, p.valor, mesaId, "Mesa " + (nomeMesa || mesaId), p.valorPago, p.troco]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
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
  const cent2 = (n) => (n == null ? null : Math.round((Number(n) || 0) * 100) / 100);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const m = await client.query(
      "SELECT id, status, aberta_em FROM mesas WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, mesaId]
    );
    if (!m.rows[0]) throw new Error("Mesa não encontrada.");
    if (m.rows[0].status === "livre") throw new Error("Mesa não está aberta.");
    for (const p of pags) {
      const v = Number(p.valor) || 0;
      if (v <= 0) continue;
      await client.query(
        `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, mesa_id, descricao, valor_pago, troco)
         VALUES ($1, $2, 'recebimento', $3, $4, $5, $6, $7, $8)`,
        [cx.id, empId, p.forma || "Outros", v, mesaId, "Mesa " + (nomeMesa || mesaId), cent2(p.valorPago), cent2(p.troco)]
      );
    }
    // Resumo das formas da SESSÃO (parciais + fechamento) → grava em pedidos.pagamento,
    // como PDV/Receber já fazem — sem isto a receita de mesa some do gráfico de formas
    // do Dashboard (que agrega por pedidos.pagamento).
    const abertaEm = m.rows[0].aberta_em;
    let resumo = "";
    let formaUnica = "";
    if (abertaEm) {
      const fq = await client.query(
        `SELECT forma_pagamento AS forma, SUM(valor) AS total
           FROM caixa_movimentos
          WHERE empresa_id = $1 AND mesa_id = $2 AND tipo = 'recebimento' AND criado_em >= $3
          GROUP BY forma_pagamento ORDER BY SUM(valor) DESC`,
        [empId, mesaId, abertaEm]
      );
      resumo = pdv.resumoPagamento(fq.rows.map((x) => ({ forma: x.forma, valor: Number(x.total) || 0 })));
      // A conta paga numa forma só é a forma do pedido; dividida entre formas fica
      // vazia, e quem guarda a verdade é o resumo (ver a migração de 2026-08-24).
      formaUnica = fq.rows.length === 1 ? ((fq.rows[0].forma || "")) : "";
    }
    // Quita só o que ESTA sessão consumiu. Marcar sobra antiga como recebida aqui
    // inflaria o faturamento com dinheiro que nunca entrou; ela fica na aba Pedidos
    // como "a receber", que é onde o dono resolve. `-infinity` mantém o
    // comportamento antigo se `aberta_em` vier nulo (não deveria: a mesa não está livre).
    await client.query(
      // `status <> 'cancelado'` porque pedido cancelado também tem `recebido_em`
      // nulo: sem isso, o item que o cliente desistiu entrava no faturamento com
      // resumo de pagamento, sem dinheiro ter entrado. E o estorno se recusa a
      // consertar depois, porque enxerga um pedido cancelado.
      `UPDATE pedidos SET recebido_em = now(),
              pagamento = COALESCE(NULLIF($5,''), pagamento),
              pagamento_resumo = COALESCE(NULLIF($3,''), pagamento_resumo)
        WHERE empresa_id = $1 AND mesa_id = $2 AND recebido_em IS NULL
          AND status <> 'cancelado'
          AND criado_em >= COALESCE($4::timestamptz, '-infinity'::timestamptz)`,
      [empId, mesaId, resumo, abertaEm, formaUnica]
    );
    const r = await client.query(
      `UPDATE mesas SET status = 'livre', total_consumido = 0, fechada_em = now(), aberta_em = NULL
         WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empId, mesaId]
    );
    await client.query("COMMIT");
    return mapRow(r.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Cancela a mesa: devolve ao estoque os itens de CADA pedido aberto (um
// `devolverEstoqueTx` por pedido, para o movimento sair amarrado ao pedido que
// o gerou — a mesa pode ter vários pedidos abertos, uma devolução só em bloco
// deixaria a trilha ilegível), marca os pedidos como cancelados e libera a
// mesa — tudo na MESMA transação, devolução sempre antes do status.
// `devolver: false` pula a devolução (não estorna recebimentos) mas cancela do
// mesmo jeito.
async function cancelar(dir, id, { devolver = true } = {}) {
  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    // Só os desta sessão: cancelar a mesa não pode devolver ao estoque item de um
    // cliente anterior. `FOR UPDATE OF p` porque o JOIN traz `mesas` junto e a trava
    // é dos pedidos.
    const abertos = await client.query(
      `SELECT p.id, p.numero, p.itens FROM pedidos p
         JOIN mesas m ON m.id = p.mesa_id AND m.empresa_id = p.empresa_id
        WHERE p.empresa_id = $1 AND p.mesa_id = $2 AND ${DA_SESSAO}
        ORDER BY p.id ASC FOR UPDATE OF p`,
      [empId, id]
    );
    let cardapioNovo = null;
    if (devolver) {
      // Sequencial de propósito: devolverEstoqueTx relê o cardápio sob a trava
      // a cada chamada, então as chamadas compõem corretamente uma após a outra.
      for (const p of abertos.rows) {
        cardapioNovo = await store.devolverEstoqueTx(client, dir, p.itens || [], {
          pedidoId: p.id, numero: p.numero, obs: "Mesa cancelada",
        });
      }
    }
    const ids = abertos.rows.map((p) => p.id);
    if (ids.length) {
      await client.query("UPDATE pedidos SET status = 'cancelado' WHERE id = ANY($1::bigint[])", [ids]);
    }
    const r = await client.query(
      `UPDATE mesas SET status = 'livre', total_consumido = 0, fechada_em = now(), aberta_em = NULL
         WHERE empresa_id = $1 AND id = $2 RETURNING *`,
      [empId, id]
    );
    await client.query("COMMIT");
    if (cardapioNovo) store.sincronizarCardapio(dir, cardapioNovo);
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch (e) {
    // ROLLBACK guardado: se a conexão já caiu (o próprio motivo do catch, às
    // vezes), a rejeição do ROLLBACK não pode escapar do handler e virar
    // unhandledRejection sem resposta ao chamador.
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Transfere pedidos da mesa origem para a destino (lista de ids; vazio = todos).
// Abre a destino se estiver livre e libera a origem se ficar sem pedidos. Usado
// também para "juntar mesas" (transferir todos).
// Transfere/junta a comanda da mesa origem na destino.
// - Destino LIVRE: move os pedidos e RENOMEIA o rótulo para a mesa de destino
//   (transferência — a origem libera). 1 comanda.
// - Destino OCUPADO: JUNTA CONTAS — funde os itens movidos na comanda aberta do
//   destino e remove os fragmentos da origem (viram 1 conta só). Só deve ser
//   chamado com intenção explícita (o front confirma "Juntar contas").
async function transferir(dir, origemId, destinoId, pedidoIds) {
  const empId = await empresaId(dir);
  if (Number(origemId) === Number(destinoId)) throw new Error("Mesa de origem e destino são iguais.");
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    // Nome do destino (p/ renomear o rótulo em transferência p/ mesa livre).
    const dRow = await client.query(
      "SELECT nome FROM mesas WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, destinoId]
    );
    if (!dRow.rows[0]) throw new Error("Mesa de destino não encontrada.");
    const destinoNome = dRow.rows[0].nome;

    // Pedidos ativos da origem a mover (comanda). Filtro opcional por ids.
    const filtroIds = Array.isArray(pedidoIds) && pedidoIds.length;
    const movParams = [empId, origemId];
    let movCond = `p.empresa_id = $1 AND p.mesa_id = $2 AND ${DA_SESSAO}`;
    if (filtroIds) { movParams.push(pedidoIds); movCond += " AND p.id = ANY($3::bigint[])"; }
    const mov = await client.query(
      `SELECT p.id, p.itens, p.total, p.criado_em
         FROM pedidos p JOIN mesas m ON m.id = p.mesa_id AND m.empresa_id = p.empresa_id
        WHERE ${movCond} ORDER BY p.id ASC`,
      movParams
    );
    const movIds = mov.rows.map((p) => p.id);
    // O pedido movido guarda o `criado_em` original. Se o destino abrir agora, ele
    // ficaria mais VELHO que a abertura e sumiria pelo recorte de sessão — por isso
    // a abertura do destino recua até aqui (ver o UPDATE lá embaixo).
    const maisAntigoMovido = mov.rows.reduce(
      (min, p) => (min === null || p.criado_em < min ? p.criado_em : min), null
    );

    // Comanda aberta do destino (alvo do merge quando o destino já está ocupado).
    const alvo = await client.query(
      `SELECT p.id, p.itens, p.total
         FROM pedidos p JOIN mesas m ON m.id = p.mesa_id AND m.empresa_id = p.empresa_id
        WHERE p.empresa_id = $1 AND p.mesa_id = $2 AND p.status = 'novo' AND ${DA_SESSAO}
        ORDER BY p.id ASC LIMIT 1`,
      [empId, destinoId]
    );
    const alvoRow = alvo.rows[0];

    if (alvoRow) {
      // JUNTAR CONTAS: funde itens+total na comanda do destino e apaga os fragmentos.
      let itens = alvoRow.itens || [];
      let total = Number(alvoRow.total) || 0;
      for (const p of mov.rows) { itens = itens.concat(p.itens || []); total += Number(p.total) || 0; }
      await client.query(
        "UPDATE pedidos SET itens = $1::jsonb, total = $2 WHERE id = $3",
        [JSON.stringify(itens), Math.round(total * 100) / 100, alvoRow.id]
      );
      if (movIds.length) {
        await client.query("DELETE FROM pedidos WHERE empresa_id = $1 AND id = ANY($2::bigint[])", [empId, movIds]);
      }
    } else if (movIds.length) {
      // TRANSFERIR p/ mesa livre: move e renomeia o rótulo para a mesa de destino.
      await client.query(
        "UPDATE pedidos SET mesa_id = $1, cliente = $2 WHERE empresa_id = $3 AND id = ANY($4::bigint[])",
        [destinoId, "Mesa " + destinoNome, empId, movIds]
      );
    }
    // ORDEM IMPORTA: ajustar o destino ANTES de recalcular. O total sai do recorte
    // de sessão, e mesa ainda livre tem `aberta_em` nulo — recalcular antes gravaria
    // zero numa mesa que acabou de receber a comanda inteira.
    //
    // O recuo NÃO pode ficar preso a `status = 'livre'`: mesa aberta há pouco e que
    // ainda não pediu nada está 'ocupada', e sem recuar os pedidos movidos (mais
    // velhos) caem fora da janela e a conta inteira some.
    //
    // Só recua no MOVE. No MERGE os pedidos movidos são apagados e os itens entram
    // na comanda do destino, que já nasceu dentro da sessão dele: recuar ali só
    // ampliaria a janela e poderia ressuscitar sobra antiga do próprio destino.
    if (movIds.length) {
      const recuarAte = alvoRow ? null : maisAntigoMovido;
      await client.query(
        `UPDATE mesas SET
                status = CASE WHEN status = 'livre' THEN 'ocupada' ELSE status END,
                aberta_em = LEAST(COALESCE(aberta_em, now()), COALESCE($3::timestamptz, now()))
          WHERE empresa_id = $1 AND id = $2`,
        [empId, destinoId, recuarAte]
      );
    }
    // Recalcula totais das duas mesas.
    for (const mid of [origemId, destinoId]) {
      await client.query(recalcularConsumoSql(), [empId, mid]);
    }
    // Origem: libera se ficou sem pedidos DA SESSÃO (sobra antiga não segura a mesa).
    await client.query(
      `UPDATE mesas mo SET status = 'livre', total_consumido = 0, fechada_em = now(), aberta_em = NULL
         WHERE mo.empresa_id = $1 AND mo.id = $2 AND NOT EXISTS (
           SELECT 1 FROM pedidos p JOIN mesas m ON m.id = p.mesa_id AND m.empresa_id = p.empresa_id
            WHERE p.empresa_id = $1 AND p.mesa_id = $2 AND ${DA_SESSAO})`,
      [empId, origemId]
    );
    await client.query("COMMIT");
    return { ok: true, juntou: !!alvoRow };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
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
// Devolve { id, numero } do pedido afetado: o chamador carimba o pedido nos
// movimentos de estoque da rodada (store.amarrarPedidoTx), fora desta função.
async function lancarItens(dir, mesaId, { itens, total, cliente, observacao }, client) {
  const empId = await empresaId(dir);
  const exec = client ? (s, p) => client.query(s, p) : (s, p) => db.query(s, p);

  // Trava a mesa e reconfere o status DENTRO da transação. A rota já checou, mas
  // entre a checagem dela e o INSERT daqui cabe um `finalizarFechamento` inteiro:
  // a rodada nasceria presa a uma mesa que já voltou a livre, invisível no painel,
  // fora de qualquer conta e nunca recebida — levando junto a baixa de estoque que
  // a rota já fez. Como `finalizarFechamento` e `cancelar` travam a mesma linha,
  // uma das duas espera a outra e a perdedora vê o status verdadeiro.
  const m = await exec(
    "SELECT status FROM mesas WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
    [empId, mesaId]
  );
  if (!m.rows[0]) throw new Error("Mesa não encontrada.");
  if (m.rows[0].status !== "ocupada") {
    throw new Error("A mesa não está mais aberta. Recarregue a tela antes de lançar.");
  }

  // Reusa o pedido aberto DESTA sessão. Sem o recorte, uma sobra de sessão antiga
  // era escolhida aqui e a rodada nova ia parar dentro dela, herdando número e total.
  const existing = await exec(
    `SELECT p.id, p.numero, p.itens, p.total
       FROM pedidos p JOIN mesas m ON m.id = p.mesa_id AND m.empresa_id = p.empresa_id
      WHERE p.empresa_id = $1 AND p.mesa_id = $2 AND p.status = 'novo' AND ${DA_SESSAO}
      ORDER BY p.id ASC LIMIT 1`,
    [empId, mesaId]
  );

  let pedido;
  if (existing.rows[0]) {
    const itensAntigos = existing.rows[0].itens || [];
    const todosItens = [...itensAntigos, ...itens];
    const novoTotal = Number(existing.rows[0].total) + (total || 0);
    await exec(
      "UPDATE pedidos SET itens = $1::jsonb, total = $2 WHERE id = $3",
      [JSON.stringify(todosItens), novoTotal, existing.rows[0].id]
    );
    pedido = { id: existing.rows[0].id, numero: existing.rows[0].numero };
  } else {
    const inserted = await exec(
      `INSERT INTO pedidos
         (empresa_id, numero, status, cliente, tipo_entrega, itens, total, observacao, mesa_id, origem)
       VALUES
         ($1, (SELECT COALESCE(MAX(numero), 0) + 1 FROM pedidos WHERE empresa_id = $1), 'novo',
          $2, 'Balcão', $3::jsonb, $4, $5, $6, 'mesa')
       RETURNING id, numero`,
      [empId, cliente || "", JSON.stringify(itens), total || 0, observacao || "", mesaId]
    );
    pedido = { id: inserted.rows[0].id, numero: inserted.rows[0].numero };
  }

  // Recalcula total_consumido da mesa
  await exec(recalcularConsumoSql(), [empId, mesaId]);

  return pedido;
}

// Remove um único item de um pedido da mesa. Devolve ao estoque SÓ o item
// removido, na MESMA transação, antes de regravar o pedido. Recalcula o total
// do pedido; se o pedido ficar sem itens, marca-o como cancelado. `devolver:
// false` pula a devolução mas remove o item do mesmo jeito.
async function cancelarItem(dir, mesaId, pedidoId, itemIdx, { devolver = true } = {}) {
  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      "SELECT id, numero, itens FROM pedidos WHERE id=$1 AND empresa_id=$2 AND mesa_id=$3 AND status<>'cancelado' FOR UPDATE",
      [pedidoId, empId, mesaId]
    );
    if (!r.rows[0]) throw new Error("Pedido não encontrado nesta mesa.");
    const itens = Array.isArray(r.rows[0].itens) ? [...r.rows[0].itens] : [];
    if (itemIdx < 0 || itemIdx >= itens.length) throw new Error("Item não encontrado.");
    const [itemRemovido] = itens.splice(itemIdx, 1);
    let cardapioNovo = null;
    if (devolver) {
      cardapioNovo = await store.devolverEstoqueTx(client, dir, [itemRemovido], {
        pedidoId: r.rows[0].id, numero: r.rows[0].numero, obs: "Item cancelado (mesa)",
      });
    }
    if (!itens.length) {
      await client.query(
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
      await client.query(
        "UPDATE pedidos SET itens=$1::jsonb, total=$2 WHERE id=$3",
        [JSON.stringify(itens), novoTotal, pedidoId]
      );
    }
    // Mantém o total_consumido da mesa em dia (senão o card da grade e o resumo "Em aberto"
    // seguem mostrando o valor antigo até o próximo lançamento). Mesma soma do lancarItens.
    // Via `client` (mesma transação): ainda não commitou o status/total acima.
    await client.query(recalcularConsumoSql(), [empId, mesaId]);
    await client.query("COMMIT");
    if (cardapioNovo) store.sincronizarCardapio(dir, cardapioNovo);
  } catch (e) {
    // ROLLBACK guardado: mesmo motivo do cancelar acima.
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  listar, buscarPorId, criarEmLote, remover, abrir, atualizarPessoas, atualizarStatus, reabrir,
  vincularPedido, lancarItens, pedidosDaMesa, recebidoDaMesa, receberParcial, finalizarFechamento,
  cancelar, transferir, salvarQrToken, esquecer, cancelarItem,
};

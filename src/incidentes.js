// Histórico de incidentes de infraestrutura (Monitoramento — Fase 2). GLOBAL
// (não por tenant). Hoje o único gatilho são os 500 de auth (exigeAuth falhou ao
// resolver o token). Best-effort: NUNCA lança — não pode virar um segundo erro no
// caminho de um request que já falhou. Como usa o próprio banco, em queda total
// não grava (aceito); em soluço transitório um request seguinte costuma conseguir.
const db = require("./db");

// Janela de agrupamento: repetições do mesmo `tipo` dentro dela viram um episódio
// (contador + última_vez), em vez de uma linha por ocorrência.
const JANELA_MIN = 5;

// Registra um incidente. Primeiro tenta ADENSAR um episódio aberto do mesmo tipo
// (UPDATE na janela); se não houver, INSERE um novo. Dois statements — aceitável
// aqui (best-effort, baixo volume; uma rajada perdida por corrida é irrelevante).
async function registrar(tipo, mensagem) {
  try {
    const t = String(tipo || "").slice(0, 40);
    const msg = mensagem == null ? null : String(mensagem).slice(0, 500);
    const upd = await db.query(
      `UPDATE incidentes
          SET ocorrencias = ocorrencias + 1, ultima_vez = now(), mensagem = $2
        WHERE tipo = $1 AND ultima_vez > now() - make_interval(mins => $3)`,
      [t, msg, JANELA_MIN]
    );
    if (upd.rowCount === 0) {
      await db.query(
        "INSERT INTO incidentes (tipo, mensagem) VALUES ($1, $2)",
        [t, msg]
      );
    }
  } catch (e) {
    console.error("incidentes.registrar:", e.message); // não propaga
  }
}

function mapRow(r) {
  return {
    id: r.id,
    tipo: r.tipo,
    mensagem: r.mensagem,
    ocorrencias: r.ocorrencias,
    primeiraVez: r.primeira_vez ? new Date(r.primeira_vez).toISOString() : null,
    ultimaVez: r.ultima_vez ? new Date(r.ultima_vez).toISOString() : null,
  };
}

// Episódios mais recentes primeiro (diagnóstico master).
async function listar(limite = 20) {
  const r = await db.query(
    "SELECT id, tipo, mensagem, ocorrencias, primeira_vez, ultima_vez FROM incidentes ORDER BY ultima_vez DESC LIMIT $1",
    [Math.min(Math.max(parseInt(limite, 10) || 20, 1), 100)]
  );
  return r.rows.map(mapRow);
}

// Retenção: apaga episódios mais antigos que `dias` (90 por padrão). O valor é
// temporal (investigação recente); manter para sempre infla a tabela. Global.
async function limparAntigos(dias = 90) {
  try {
    const r = await db.query(
      "DELETE FROM incidentes WHERE ultima_vez < now() - make_interval(days => $1)",
      [dias]
    );
    return r.rowCount;
  } catch (e) {
    console.error("incidentes.limparAntigos:", e.message);
    return 0;
  }
}

module.exports = { registrar, listar, limparAntigos };

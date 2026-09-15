const db = require("./db");
const CAMPOS = new Set(["funcionarioId", "dispositivoId", "perfil", "ativo", "permissao", "rota", "metodo", "tentativas"]);
function detalheSeguro(detalhe = {}) {
  const seguro = {};
  for (const [chave, valor] of Object.entries(detalhe)) {
    if (CAMPOS.has(chave) && ["string", "number", "boolean"].includes(typeof valor)) seguro[chave] = typeof valor === "string" ? valor.slice(0, 180) : valor;
  }
  return seguro;
}
async function registrar(executor, { empresaId, ator = {}, evento, detalhe }) {
  if (!empresaId) throw new Error("Auditoria exige empresa.");
  await executor.query(`insert into auditoria_operacional (empresa_id, ator_tipo, ator_id, evento, detalhe)
    values ($1, $2, $3, $4, $5::jsonb)`, [empresaId, ator.tipo || "sistema", ator.id || null, evento, JSON.stringify(detalheSeguro(detalhe))]);
}
function invalido() { const erro = new Error("Filtro de atividades inválido."); erro.codigo = "FILTRO_INVALIDO"; throw erro; }
async function listar(empresaId, { evento, atorId, desde, ate, cursor, limite = 30 } = {}) {
  if (cursor && (!/^[1-9]\d{0,18}$/.test(cursor) || BigInt(cursor) > 9223372036854775807n)) invalido();
  if (evento && !/^[a-z_]{1,80}$/.test(evento)) invalido();
  if (atorId && !/^[a-f0-9-]{36}$/i.test(atorId)) invalido();
  for (const data of [desde, ate]) if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data)) || new Date(data).toISOString().slice(0, 10) !== data)) invalido();
  if (desde && ate && desde > ate) invalido();
  const quantidade = Number(limite);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) invalido();
  const filtros = ["empresa_id=$1"], valores = [empresaId];
  function adicionar(sql, valor) { valores.push(valor); filtros.push(sql.replace("?", "$" + valores.length)); }
  if (evento) adicionar("evento=?", evento);
  if (atorId) adicionar("ator_id=?", atorId);
  if (desde) adicionar("criado_em >= ?::date", desde);
  if (ate) adicionar("criado_em < ?::date + interval '1 day'", ate);
  if (cursor) adicionar("id < ?::bigint", cursor);
  valores.push(quantidade + 1);
  const r = await db.query(`select id::text, ator_tipo as "atorTipo", ator_id as "atorId", evento, detalhe,
    criado_em as "criadoEm" from auditoria_operacional where ${filtros.join(" and ")}
    order by id desc limit $${valores.length}`, valores);
  const atores = await db.query(`select distinct a.ator_id as id,
    case when a.ator_tipo='dono' then 'Dono' when a.ator_tipo='sistema' then 'Sistema'
      else coalesce(f.nome, 'Funcionário arquivado') end as nome
    from auditoria_operacional a left join equipe_funcionarios f
      on f.id::text=a.ator_id and f.empresa_id=a.empresa_id
    where a.empresa_id=$1 and a.ator_id is not null order by nome, id`, [empresaId]);
  const nomes = new Map(atores.rows.map(a => [a.id, a.nome]));
  const eventos = r.rows.slice(0, quantidade).map(e => ({ ...e, atorNome: nomes.get(e.atorId) || "Sistema" }));
  return { eventos, atores: atores.rows, proximoCursor: r.rows.length > quantidade ? eventos[eventos.length - 1].id : null };
}
module.exports = { registrar, listar, detalheSeguro };

const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const db = require("./db");
const Permissoes = require("./permissoes");
const auditoria = require("./auditoria-operacional");

const RODADAS_PIN = 10;

function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenOpaco() {
  return crypto.randomBytes(32).toString("base64url");
}

function validarPin(pin) {
  if (!/^\d{4}$/.test(String(pin || ""))) throw erro("PIN_INVALIDO", "O PIN deve ter quatro dígitos.");
  return String(pin);
}

async function empresaPorSlug(executor, slug, trava = false) {
  const r = await executor.query(
    `select id, slug, ativo, plano, assinatura_status as "assinaturaStatus",
            equipe_habilitada as "equipeHabilitada"
       from empresas where slug = $1${trava ? " for update" : ""}`,
    [slug]
  );
  if (!r.rows[0]) throw erro("EMPRESA_NAO_ENCONTRADA", "Empresa não encontrada.");
  return r.rows[0];
}

async function garantirPerfis(executor, empresaId) {
  const nomes = {
    administrador: "Administrador",
    gerente: "Gerente",
    caixa: "Caixa",
    atendimento: "Atendimento",
    cozinha: "Cozinha",
    estoque_compras: "Estoque/Compras",
  };
  for (const codigo of Permissoes.PERFIS) {
    await executor.query(
      `insert into equipe_perfis (empresa_id, codigo, nome)
       values ($1, $2, $3)
       on conflict (empresa_id, codigo) do nothing`,
      [empresaId, codigo, nomes[codigo]]
    );
  }
}

async function criarFuncionario(slug, { nome, pin, perfil, ajustes = [], ativo = true, inatividadeMinutos = 15 }, ator = {}) {
  const nomeLimpo = String(nome || "").trim();
  const pinLimpo = validarPin(pin);
  if (!nomeLimpo) throw erro("NOME_INVALIDO", "Informe o nome do funcionário.");
  if (!Permissoes.PERFIS.includes(perfil)) throw erro("PERFIL_INVALIDO", "Perfil de equipe inválido.");
  if (![5, 15, 30, 60].includes(inatividadeMinutos)) throw erro("INATIVIDADE_INVALIDA", "Escolha 5, 15, 30 ou 60 minutos de inatividade.");

  const client = await db.pool.connect();
  try {
    await client.query("begin");
    const empresa = await empresaPorSlug(client, slug, true);
    await garantirPerfis(client, empresa.id);

    const existentes = await client.query(
      "select pin_hash from equipe_funcionarios where empresa_id = $1 and ativo = true",
      [empresa.id]
    );
    for (const existente of existentes.rows) {
      if (await bcrypt.compare(pinLimpo, existente.pin_hash)) {
        throw erro("PIN_EM_USO", "Este PIN já está em uso por outro funcionário.");
      }
    }

    const perfilDb = await client.query(
      "select id from equipe_perfis where empresa_id = $1 and codigo = $2 and ativo = true",
      [empresa.id, perfil]
    );
    const pinHash = await bcrypt.hash(pinLimpo, RODADAS_PIN);
    const criado = await client.query(
      `insert into equipe_funcionarios (empresa_id, perfil_id, nome, pin_hash, ativo, inatividade_minutos)
       values ($1, $2, $3, $4, $5, $6)
       returning id, nome, ativo, tentativas_pin as "tentativasPin",
                 bloqueado_ate as "bloqueadoAte", inatividade_minutos as "inatividadeMinutos"`,
      [empresa.id, perfilDb.rows[0].id, nomeLimpo, pinHash, ativo === true, inatividadeMinutos]
    );
    for (const ajuste of ajustes) {
      if (!ajuste || !ajuste.permissao || typeof ajuste.permitido !== "boolean") continue;
      if (Permissoes.EXCLUSIVAS_DONO.has(ajuste.permissao)) {
        throw erro("PERMISSAO_EXCLUSIVA", "Esta permissão é exclusiva do dono.");
      }
      await client.query(
        `insert into equipe_funcionario_permissoes (empresa_id, funcionario_id, permissao, permitido)
         values ($1, $2, $3, $4)`,
        [empresa.id, criado.rows[0].id, ajuste.permissao, ajuste.permitido]
      );
    }
    await auditoria.registrar(client, { empresaId: empresa.id, ator, evento: "funcionario_criado", detalhe: { funcionarioId: criado.rows[0].id, perfil, ativo } });
    await client.query("commit");
    return Object.assign(criado.rows[0], { perfil });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function listarFuncionarios(slug) {
  const empresa = await empresaPorSlug(db, slug);
  const r = await db.query(
    `select f.id, f.nome, f.ativo, f.tentativas_pin as "tentativasPin",
            f.bloqueado_ate as "bloqueadoAte", f.inatividade_minutos as "inatividadeMinutos",
            p.codigo as perfil, max(s.ultimo_acesso_em) as "ultimoAcessoEm"
       from equipe_funcionarios f
       join equipe_perfis p on p.empresa_id = f.empresa_id and p.id = f.perfil_id
       left join equipe_sessoes s on s.empresa_id = f.empresa_id and s.funcionario_id = f.id
      where f.empresa_id = $1
      group by f.id, p.codigo
      order by f.ativo desc, f.nome, f.id`,
    [empresa.id]
  );
  return Promise.all(r.rows.map(async (funcionario) => Object.assign(funcionario, {
    permissoes: await permissoesDoFuncionario(db, empresa.id, funcionario.id, funcionario.perfil),
  })));
}

async function atualizarFuncionario(slug, funcionarioId, dados = {}, ator = {}) {
  const client = await db.pool.connect();
  try {
    await client.query("begin");
    const empresa = await empresaPorSlug(client, slug, true);
    await garantirPerfis(client, empresa.id);
    const atual = await client.query(
      `select f.id, f.nome, f.ativo, f.pin_hash, f.inatividade_minutos, p.codigo as perfil
         from equipe_funcionarios f
         join equipe_perfis p on p.empresa_id = f.empresa_id and p.id = f.perfil_id
        where f.empresa_id = $1 and f.id = $2 for update of f`,
      [empresa.id, funcionarioId]
    );
    if (!atual.rows[0]) throw erro("FUNCIONARIO_INVALIDO", "Funcionário não encontrado.");

    const nome = dados.nome === undefined ? atual.rows[0].nome : String(dados.nome || "").trim();
    const perfil = dados.perfil === undefined ? atual.rows[0].perfil : dados.perfil;
    const ativo = dados.ativo === undefined ? atual.rows[0].ativo : dados.ativo === true;
    const inatividade = dados.inatividadeMinutos === undefined
      ? atual.rows[0].inatividade_minutos
      : Number(dados.inatividadeMinutos);
    if (!nome) throw erro("NOME_INVALIDO", "Informe o nome do funcionário.");
    if (!Permissoes.PERFIS.includes(perfil)) throw erro("PERFIL_INVALIDO", "Perfil de equipe inválido.");
    if (![5, 15, 30, 60].includes(inatividade)) {
      throw erro("INATIVIDADE_INVALIDA", "Escolha 5, 15, 30 ou 60 minutos de inatividade.");
    }

    const perfilDb = await client.query(
      "select id from equipe_perfis where empresa_id = $1 and codigo = $2 and ativo = true",
      [empresa.id, perfil]
    );
    let pinHash = atual.rows[0].pin_hash;
    if (dados.pin !== undefined && dados.pin !== "") {
      const pin = validarPin(dados.pin);
      const existentes = await client.query(
        "select pin_hash from equipe_funcionarios where empresa_id = $1 and id <> $2 and ativo = true",
        [empresa.id, funcionarioId]
      );
      for (const existente of existentes.rows) {
        if (await bcrypt.compare(pin, existente.pin_hash)) throw erro("PIN_EM_USO", "Este PIN já está em uso por outro funcionário.");
      }
      pinHash = await bcrypt.hash(pin, RODADAS_PIN);
    }

    await client.query(
      `update equipe_funcionarios
          set nome = $1, perfil_id = $2, ativo = $3, inatividade_minutos = $4,
              pin_hash = $5, atualizado_em = now()
        where empresa_id = $6 and id = $7`,
      [nome, perfilDb.rows[0].id, ativo, inatividade, pinHash, empresa.id, funcionarioId]
    );

    if (Array.isArray(dados.ajustes)) {
      await client.query(
        "delete from equipe_funcionario_permissoes where empresa_id = $1 and funcionario_id = $2",
        [empresa.id, funcionarioId]
      );
      for (const ajuste of dados.ajustes) {
        if (!ajuste || !ajuste.permissao || typeof ajuste.permitido !== "boolean") continue;
        if (Permissoes.EXCLUSIVAS_DONO.has(ajuste.permissao)) {
          throw erro("PERMISSAO_EXCLUSIVA", "Esta permissão é exclusiva do dono.");
        }
        await client.query(
          `insert into equipe_funcionario_permissoes (empresa_id, funcionario_id, permissao, permitido)
           values ($1, $2, $3, $4)`,
          [empresa.id, funcionarioId, ajuste.permissao, ajuste.permitido]
        );
      }
    }

    await auditoria.registrar(client, { empresaId: empresa.id, ator, evento: "funcionario_alterado", detalhe: { funcionarioId, perfil, ativo } });
    if (dados.ajustes || dados.perfil) await auditoria.registrar(client, { empresaId: empresa.id, ator, evento: "permissoes_alteradas", detalhe: { funcionarioId, perfil } });
    await client.query("commit");
    const lista = await listarFuncionarios(slug);
    return lista.find((item) => item.id === funcionarioId);
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function autorizarDispositivo(slug, { nome }, ator = {}) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) throw erro("NOME_INVALIDO", "Informe o nome do dispositivo.");
  const token = tokenOpaco();
  const client = await db.pool.connect();
  try {
    await client.query("begin");
    const empresa = await empresaPorSlug(client, slug, true);
    const r = await client.query(
      `insert into equipe_dispositivos (empresa_id, nome, chave_hash)
       values ($1, $2, $3)
       returning id, nome, autorizado_em as "autorizadoEm"`,
      [empresa.id, nomeLimpo, hashToken(token)]
    );
    await auditoria.registrar(client, { empresaId: empresa.id, ator, evento: "dispositivo_autorizado", detalhe: { dispositivoId: r.rows[0].id } });
    await client.query("commit");
    return Object.assign(r.rows[0], { token });
  } catch (e) { await client.query("rollback"); throw e; }
  finally { client.release(); }
}

async function listarDispositivos(slug) {
  const empresa = await empresaPorSlug(db, slug);
  const r = await db.query(
    `select id, nome, autorizado_em as "autorizadoEm", ultimo_acesso_em as "ultimoAcessoEm",
            revogado_em as "revogadoEm"
       from equipe_dispositivos where empresa_id = $1
      order by revogado_em nulls first, autorizado_em desc, id`,
    [empresa.id]
  );
  return r.rows;
}

async function listarFuncionariosDoDispositivo(slug, dispositivoToken) {
  const empresa = await empresaPorSlug(db, slug);
  const dispositivo = await db.query(
    `select id from equipe_dispositivos
      where empresa_id = $1 and chave_hash = $2 and revogado_em is null`,
    [empresa.id, hashToken(String(dispositivoToken || ""))]
  );
  if (!dispositivo.rows[0]) throw erro("DISPOSITIVO_NAO_AUTORIZADO", "Dispositivo não autorizado.");
  const funcionarios = await listarFuncionarios(slug);
  return funcionarios.filter((item) => item.ativo).map(({ id, nome, perfil, bloqueadoAte }) => ({
    id, nome, perfil, bloqueadoAte,
  }));
}

async function permissoesDoFuncionario(executor, empresaId, funcionarioId, perfil) {
  const perfilRegras = await executor.query(
    `select pp.permissao, pp.permitido
       from equipe_perfil_permissoes pp
       join equipe_funcionarios f
         on f.empresa_id = pp.empresa_id and f.perfil_id = pp.perfil_id
      where f.empresa_id = $1 and f.id = $2`,
    [empresaId, funcionarioId]
  );
  const ajustes = await executor.query(
    `select permissao, permitido from equipe_funcionario_permissoes
      where empresa_id = $1 and funcionario_id = $2`,
    [empresaId, funcionarioId]
  );
  return Array.from(
    Permissoes.resolverEfetivas({ perfil, permissoesPerfil: perfilRegras.rows, ajustes: ajustes.rows })
  );
}

async function iniciarSessao(slug, { funcionarioId, pin, dispositivoToken }) {
  const pinLimpo = validarPin(pin);
  const client = await db.pool.connect();
  let transacaoEncerrada = false;
  try {
    await client.query("begin");
    const empresa = await empresaPorSlug(client, slug, true);
    const dispositivo = await client.query(
      `select id from equipe_dispositivos
        where empresa_id = $1 and chave_hash = $2 and revogado_em is null
        for update`,
      [empresa.id, hashToken(String(dispositivoToken || ""))]
    );
    if (!dispositivo.rows[0]) throw erro("DISPOSITIVO_NAO_AUTORIZADO", "Dispositivo não autorizado.");

    const funcionario = await client.query(
      `select f.id, f.nome, f.pin_hash, f.ativo, f.tentativas_pin,
              f.bloqueado_ate, f.inatividade_minutos, p.codigo as perfil
         from equipe_funcionarios f
         join equipe_perfis p on p.empresa_id = f.empresa_id and p.id = f.perfil_id
        where f.empresa_id = $1 and f.id = $2
        for update of f`,
      [empresa.id, funcionarioId]
    );
    const ator = funcionario.rows[0];
    if (!ator || !ator.ativo) throw erro("FUNCIONARIO_INVALIDO", "Funcionário não encontrado ou inativo.");
    if (ator.bloqueado_ate && ator.bloqueado_ate > new Date()) {
      throw erro("PIN_BLOQUEADO", "Funcionário bloqueado por 15 minutos.");
    }

    const confere = await bcrypt.compare(pinLimpo, ator.pin_hash);
    if (!confere) {
      const tentativas = Math.min(5, ator.tentativas_pin + 1);
      await client.query(
        `update equipe_funcionarios
            set tentativas_pin = $1::smallint,
                bloqueado_ate = case when $1::smallint >= 5 then now() + interval '15 minutes' else null end,
                atualizado_em = now()
          where empresa_id = $2 and id = $3`,
        [tentativas, empresa.id, ator.id]
      );
      await auditoria.registrar(client, { empresaId: empresa.id, ator: { tipo: "funcionario", id: ator.id }, evento: tentativas >= 5 ? "pin_bloqueado" : "pin_incorreto", detalhe: { funcionarioId: ator.id, dispositivoId: dispositivo.rows[0].id, tentativas } });
      await client.query("commit");
      transacaoEncerrada = true;
      throw erro(
        tentativas >= 5 ? "PIN_BLOQUEADO" : "PIN_INCORRETO",
        tentativas >= 5 ? "Funcionário bloqueado por 15 minutos." : "PIN incorreto."
      );
    }

    const token = tokenOpaco();
    await client.query(
      "update equipe_funcionarios set tentativas_pin = 0, bloqueado_ate = null, atualizado_em = now() where empresa_id = $1 and id = $2",
      [empresa.id, ator.id]
    );
    const sessao = await client.query(
      `insert into equipe_sessoes (empresa_id, funcionario_id, dispositivo_id, token_hash)
       values ($1, $2, $3, $4)
       returning id, criada_em as "criadaEm"`,
      [empresa.id, ator.id, dispositivo.rows[0].id, hashToken(token)]
    );
    await client.query(
      "update equipe_dispositivos set ultimo_acesso_em = now() where empresa_id = $1 and id = $2",
      [empresa.id, dispositivo.rows[0].id]
    );
    const efetivas = await permissoesDoFuncionario(client, empresa.id, ator.id, ator.perfil);
    await auditoria.registrar(client, { empresaId: empresa.id, ator: { tipo: "funcionario", id: ator.id }, evento: "sessao_iniciada", detalhe: { funcionarioId: ator.id, dispositivoId: dispositivo.rows[0].id } });
    await client.query("commit");
    transacaoEncerrada = true;
    return {
      id: sessao.rows[0].id,
      token,
      criadaEm: sessao.rows[0].criadaEm,
      funcionario: { id: ator.id, nome: ator.nome, perfil: ator.perfil, permissoes: efetivas },
    };
  } catch (e) {
    if (!transacaoEncerrada) {
      await client.query("rollback").catch(() => {});
    }
    throw e;
  } finally {
    client.release();
  }
}

async function resolverSessao(token, agora = new Date()) {
  if (!token) return null;
  const r = await db.query(
    `select s.id, s.empresa_id, s.funcionario_id, s.ultimo_acesso_em,
            f.nome, f.inatividade_minutos, p.codigo as perfil, e.slug
       from equipe_sessoes s
       join equipe_funcionarios f
         on f.empresa_id = s.empresa_id and f.id = s.funcionario_id and f.ativo = true
       join equipe_dispositivos d
         on d.empresa_id = s.empresa_id and d.id = s.dispositivo_id and d.revogado_em is null
       join equipe_perfis p on p.empresa_id = f.empresa_id and p.id = f.perfil_id
       join empresas e on e.id = s.empresa_id and e.ativo = true
      where s.token_hash = $1 and s.revogada_em is null`,
    [hashToken(token)]
  );
  const sessao = r.rows[0];
  if (!sessao) return null;
  if (agora.getTime() - sessao.ultimo_acesso_em.getTime() >= sessao.inatividade_minutos * 60 * 1000) {
    await db.query("update equipe_sessoes set revogada_em = $1 where id = $2", [agora, sessao.id]);
    return null;
  }
  await db.query("update equipe_sessoes set ultimo_acesso_em = $1 where id = $2", [agora, sessao.id]);
  const efetivas = await permissoesDoFuncionario(db, sessao.empresa_id, sessao.funcionario_id, sessao.perfil);
  return {
    id: sessao.id,
    empresaId: sessao.empresa_id,
    slug: sessao.slug,
    funcionario: {
      id: sessao.funcionario_id,
      nome: sessao.nome,
      perfil: sessao.perfil,
      inatividadeMinutos: sessao.inatividade_minutos,
      permissoes: efetivas,
    },
  };
}

async function desbloquearFuncionario(slug, funcionarioId, ator = {}) {
  const client = await db.pool.connect();
  try {
  await client.query("begin");
  const empresa = await empresaPorSlug(client, slug, true);
  const r = await client.query(
    `update equipe_funcionarios
        set tentativas_pin = 0, bloqueado_ate = null, atualizado_em = now()
      where empresa_id = $1 and id = $2`,
    [empresa.id, funcionarioId]
  );
  if (r.rowCount) await auditoria.registrar(client, { empresaId: empresa.id, ator, evento: "pin_desbloqueado", detalhe: { funcionarioId } });
  await client.query("commit");
  return r.rowCount > 0;
  } catch (e) { await client.query("rollback"); throw e; }
  finally { client.release(); }
}

async function revogarDispositivo(slug, dispositivoId, ator = {}) {
  const client = await db.pool.connect();
  try {
    await client.query("begin");
    const empresa = await empresaPorSlug(client, slug, true);
    const r = await client.query(
      `update equipe_dispositivos set revogado_em = now()
        where empresa_id = $1 and id = $2 and revogado_em is null`,
      [empresa.id, dispositivoId]
    );
    if (r.rowCount) {
      await client.query(
        `update equipe_sessoes set revogada_em = now()
          where empresa_id = $1 and dispositivo_id = $2 and revogada_em is null`,
        [empresa.id, dispositivoId]
      );
    }
    if (r.rowCount) await auditoria.registrar(client, { empresaId: empresa.id, ator, evento: "dispositivo_revogado", detalhe: { dispositivoId } });
    await client.query("commit");
    return r.rowCount > 0;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  criarFuncionario,
  listarFuncionarios,
  atualizarFuncionario,
  autorizarDispositivo,
  listarDispositivos,
  listarFuncionariosDoDispositivo,
  iniciarSessao,
  resolverSessao,
  desbloquearFuncionario,
  revogarDispositivo,
  garantirPerfis,
  hashToken,
};

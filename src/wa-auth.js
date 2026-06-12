// ============================================================
// WA-AUTH — estado de autenticação do Baileys persistido no Postgres
// (tabela wa_auth), por slug. Substitui o useMultiFileAuthState (disco)
// → app stateless: a sessão do WhatsApp vive no banco, não em arquivo.
//
// As chaves do Baileys contêm Buffers; usamos BufferJSON.replacer/reviver
// para serializar/desserializar com segurança em jsonb.
// ============================================================

const db = require("./db");

// Baileys é ESM-only → import() dinâmico, cacheado.
let _baileys = null;
async function getBaileys() {
  if (!_baileys) _baileys = await import("@whiskeysockets/baileys");
  return _baileys;
}

async function usePostgresAuthState(slug) {
  const { BufferJSON, initAuthCreds, proto } = await getBaileys();

  async function readData(chave) {
    const r = await db.query("SELECT valor FROM wa_auth WHERE slug = $1 AND chave = $2", [slug, chave]);
    if (!r.rows[0]) return null;
    // valor volta como objeto (jsonb); reaplica o reviver para restaurar Buffers.
    return JSON.parse(JSON.stringify(r.rows[0].valor), BufferJSON.reviver);
  }

  async function writeData(chave, valor) {
    const encoded = JSON.parse(JSON.stringify(valor, BufferJSON.replacer));
    await db.query(
      `INSERT INTO wa_auth (slug, chave, valor) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (slug, chave) DO UPDATE SET valor = EXCLUDED.valor`,
      [slug, chave, JSON.stringify(encoded)]
    );
  }

  async function removeData(chave) {
    await db.query("DELETE FROM wa_auth WHERE slug = $1 AND chave = $2", [slug, chave]);
  }

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}:${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value || undefined;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id];
              const chave = `${type}:${id}`;
              tasks.push(value ? writeData(chave, value) : removeData(chave));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData("creds", creds),
  };
}

// Apaga toda a sessão de um tenant (reset / exclusão).
async function limparSessao(slug) {
  await db.query("DELETE FROM wa_auth WHERE slug = $1", [slug]);
}

module.exports = { usePostgresAuthState, limparSessao };

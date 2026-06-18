// ============================================================
// CEP — busca com cache no banco (tabela `ceps`).
//
// Cache-first: consulta a tabela; no miss, chama o ViaCEP no servidor, grava
// o resultado e devolve. Só grava lookups bem-sucedidos (não cacheia "não
// encontrado" nem erro de rede). Dado postal público, cache global.
// ============================================================

const db = require("./db");

// Devolve { logradouro, bairro, cidade, uf } ou null (CEP inválido/não achado/erro).
async function buscarCep(cepBruto) {
  const cep = String(cepBruto || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;

  // 1) Cache.
  const cache = await db.query(
    "SELECT logradouro, bairro, cidade, uf FROM ceps WHERE cep = $1",
    [cep]
  );
  if (cache.rows[0]) return cache.rows[0];

  // 2) Miss → ViaCEP (servidor).
  let d;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    d = await r.json();
  } catch (e) {
    return null; // ViaCEP fora do ar → o front cai no preenchimento manual
  }
  if (!d || d.erro) return null;

  const end = {
    logradouro: d.logradouro || "",
    bairro: d.bairro || "",
    cidade: d.localidade || "",
    uf: d.uf || "",
  };

  // 3) Grava no cache (idempotente; corrida → ignora conflito).
  try {
    await db.query(
      `INSERT INTO ceps (cep, logradouro, bairro, cidade, uf)
         VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cep) DO NOTHING`,
      [cep, end.logradouro, end.bairro, end.cidade, end.uf]
    );
  } catch (e) {
    console.error("cache cep:", e.message); // não falha a resposta
  }
  return end;
}

module.exports = { buscarCep };

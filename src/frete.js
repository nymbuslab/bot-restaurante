// ============================================================
// FRETE — cálculo de frete por raio (distância) para o Plano Completo.
//
// Funções PURAS (Haversine, faixa, montar endereço, normalizar config) →
// testáveis isoladas (test/frete.test.js). A geocodificação usa a Geoapify
// com CACHE no banco (tabela geo_cache), no mesmo padrão cache-first do
// src/cep.js (só grava sucesso; dado público, cache global).
//
// Distância por Haversine = LINHA RETA (boa p/ regra de raio e barata).
// ============================================================

const db = require("./db");

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY || "";

// Distância em km entre duas coordenadas (Haversine). Pura.
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // raio da Terra em km
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Acha a 1ª faixa cujo intervalo [ini, fim] (km) contém a distância. Pura.
// `faixas`: [{ ini, fim, valor }]. Retorna a faixa ou null (fora da área).
function encontrarFaixa(distKm, faixas) {
  if (!Array.isArray(faixas)) return null;
  for (const f of faixas) {
    if (!f) continue;
    const ini = Number(f.ini) || 0;
    const fim = Number(f.fim);
    if (!Number.isFinite(fim)) continue;
    if (distKm >= ini && distKm <= fim) return f;
  }
  return null;
}

// Monta o endereço completo (string) p/ geocodificar. Pura.
function montarEnderecoCompleto(e) {
  e = e || {};
  return [e.logradouro, e.numero, e.bairro, e.cidade, e.uf, "Brasil"]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

// Normaliza string p/ chave de cache (lower + espaços colapsados). Pura.
function normalizar(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Normaliza o bloco de frete da config (compat: taxaEntrega legado em
// atendimento). Pura — usada por servidor e checkout (fonte única).
function freteDeConfig(config) {
  const c = config || {};
  const frete = c.frete || {};
  const modo = frete.modo === "raio" ? "raio" : "fixo";
  const taxaLegado = (c.atendimento && c.atendimento.taxaEntrega) || 0;
  const taxaFixa = Number(frete.taxaFixa != null ? frete.taxaFixa : taxaLegado) || 0;
  const raio = frete.raio || {};
  return {
    modo,
    taxaFixa,
    raio: {
      coordEmpresa: raio.coordEmpresa || null,
      enderecoBase: raio.enderecoBase || "",
      faixas: Array.isArray(raio.faixas) ? raio.faixas : [],
      foraDaArea: raio.foraDaArea === "bloqueia" ? "bloqueia" : "retirada",
    },
  };
}

// Resolve frete por raio a partir de coords já obtidas + faixas. Pura.
// Retorna { entrega_disponivel, distancia_km, valor_frete }.
function calcularFreteRaio(coordEmpresa, coordCliente, faixas) {
  if (!coordEmpresa || !coordCliente) {
    return { entrega_disponivel: false, distancia_km: null, valor_frete: null };
  }
  const dist = calcularDistanciaKm(coordEmpresa.lat, coordEmpresa.lon, coordCliente.lat, coordCliente.lon);
  const distR = Math.round(dist * 100) / 100;
  const faixa = encontrarFaixa(dist, faixas);
  if (!faixa) return { entrega_disponivel: false, distancia_km: distR, valor_frete: null };
  return { entrega_disponivel: true, distancia_km: distR, valor_frete: Number(faixa.valor) || 0 };
}

// Geocodifica um endereço completo → { lat, lon } | null. Cache-first no banco
// (não cacheia falha). Sem GEOAPIFY_API_KEY → null (o chamador trata).
async function geocodificar(enderecoCompleto) {
  const norm = normalizar(enderecoCompleto);
  if (!norm || !GEOAPIFY_KEY) return null;

  // 1) Cache.
  try {
    const c = await db.query("SELECT lat, lon FROM geo_cache WHERE endereco_norm = $1", [norm]);
    if (c.rows[0]) return { lat: Number(c.rows[0].lat), lon: Number(c.rows[0].lon) };
  } catch (e) { /* miss → segue p/ API */ }

  // 2) Geoapify (servidor; UTF-8 nativo do fetch).
  let lat, lon;
  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", enderecoCompleto);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", GEOAPIFY_KEY);
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    const d = await r.json();
    const res = d && d.results && d.results[0];
    if (!res || typeof res.lat !== "number" || typeof res.lon !== "number") return null;
    lat = res.lat; lon = res.lon;
  } catch (e) {
    return null; // Geoapify fora do ar / endereço não localizado
  }

  // 3) Grava no cache (idempotente; corrida → ignora conflito).
  try {
    await db.query(
      `INSERT INTO geo_cache (endereco_norm, lat, lon) VALUES ($1, $2, $3)
       ON CONFLICT (endereco_norm) DO NOTHING`,
      [norm, lat, lon]
    );
  } catch (e) {
    console.error("cache geo:", e.message); // não falha a resposta
  }
  return { lat, lon };
}

module.exports = {
  calcularDistanciaKm, encontrarFaixa, montarEnderecoCompleto, normalizar,
  freteDeConfig, calcularFreteRaio, geocodificar,
};

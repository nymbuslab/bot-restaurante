// Wrapper de fetch com Bearer + retry unico em 401 (renova a sessao e repete).
let base = "";
let token = "";
let aoRenovar = null; // injetado por auth.js p/ evitar dependencia circular

function setBase(url) { base = String(url || "").replace(/\/+$/, ""); }
function setToken(t) { token = t || ""; }
function setRenovador(fn) { aoRenovar = fn; }

async function req(metodo, caminho, body) {
  const fazer = () => fetch(base + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let r = await fazer();
  if (r.status === 401 && aoRenovar) {
    const ok = await aoRenovar();
    if (ok) r = await fazer();
  }
  return r;
}

module.exports = {
  setBase, setToken, setRenovador,
  get: (p) => req("GET", p),
  post: (p, b) => req("POST", p, b),
};

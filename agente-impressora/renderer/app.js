const $ = (id) => document.getElementById(id);
function log(m) { const c = $("registros"); c.textContent += (c.textContent ? "\n" : "") + m; c.scrollTop = c.scrollHeight; }

function aplicarConexao(v) {
  $("campoRede").hidden = v !== "rede";
  $("campoSerialUsb").hidden = v === "rede";
  $("campoBaud").hidden = v !== "serial";
}

async function carregar() {
  const st = await window.api.authStatus();
  if (st.logado) { mostrarApp(st); } else { $("telaLogin").hidden = false; $("telaApp").hidden = true; }
}

function mostrarApp(st) {
  $("telaLogin").hidden = true; $("telaApp").hidden = false;
  $("nomeRest").textContent = st.nome || "Restaurante";
  $("emailRest").textContent = st.email || "";
  window.api.carregarConfig().then((cfg) => {
    $("conexao").value = cfg.conexao; aplicarConexao(cfg.conexao);
    $("alvoRede").value = cfg.conexao === "rede" ? cfg.alvo : "";
    // Repõe a impressora salva no seletor (Serial/USB) já selecionada — senão, ao reabrir, o
    // seletor fica vazio e teria que "Detectar" de novo (e Salvar gravaria alvo vazio, quebrando).
    if (cfg.conexao !== "rede" && cfg.alvo) {
      const sel = $("alvoLista"); sel.innerHTML = "";
      const o = document.createElement("option"); o.value = cfg.alvo; o.textContent = cfg.alvo; o.selected = true;
      sel.appendChild(o);
    }
    $("baud").value = cfg.baud; $("corte").value = cfg.corte; $("semAcento").checked = cfg.semAcento;
    $("viaCozinha").checked = cfg.vias.cozinha; $("viaCupom").checked = cfg.vias.cupom; $("copias").value = cfg.copias;
  });
}

function montarCfgDaUI() {
  const conexao = $("conexao").value;
  const alvo = conexao === "rede" ? $("alvoRede").value : ($("alvoLista").value || "");
  return { conexao, alvo, baud: parseInt($("baud").value, 10) || 9600, corte: $("corte").value, semAcento: $("semAcento").checked,
    vias: { cozinha: $("viaCozinha").checked, cupom: $("viaCupom").checked }, copias: parseInt($("copias").value, 10) || 1 };
}

// Servidor fixo (produção) — sem campo na UI. Se um dia mudar, é aqui.
const API_BASE = "https://bot-restaurante.fly.dev";
async function fazerLogin() {
  $("erroLogin").textContent = "";
  try { const s = await window.api.login(API_BASE, $("email").value, $("senha").value); s.email = $("email").value; mostrarApp(s); }
  catch (e) { $("erroLogin").textContent = e.message || "Falha no login."; }
}
$("btnLogin").addEventListener("click", fazerLogin);
// Enter em qualquer campo do login envia.
["email", "senha"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") fazerLogin(); }));
$("btnSair").addEventListener("click", async () => { await window.api.sair(); location.reload(); });
$("conexao").addEventListener("change", (e) => { aplicarConexao(e.target.value); });
$("btnDetectar").addEventListener("click", async () => {
  const lista = await window.api.listarImpressoras($("conexao").value);
  const sel = $("alvoLista"); sel.innerHTML = "";
  lista.forEach((p) => { const o = document.createElement("option"); o.value = p.path; o.textContent = p.path + (p.fabricante ? " (" + p.fabricante + ")" : ""); sel.appendChild(o); });
  log(lista.length ? ("Encontradas " + lista.length + " impressora(s).") : "Nenhuma impressora encontrada.");
});
$("btnSalvar").addEventListener("click", async () => { await window.api.salvarConfig(montarCfgDaUI()); log("Configuração salva."); });
$("btnTeste").addEventListener("click", async () => {
  await window.api.salvarConfig(montarCfgDaUI());
  try { await window.api.testeImpressao(); log("Teste enviado à impressora."); } catch (e) { log("Falha no teste: " + e.message); }
});

window.api.onLog(log);
window.api.onStatus((s) => {
  const f = $("faixaStatus");
  // Sessão expirada (refresh morto) → volta à tela de login em vez de ficar em "Erro 401".
  if (s.tipo === "deslogado") { $("telaLogin").hidden = false; $("telaApp").hidden = true; return; }
  if (s.tipo === "ok") { f.textContent = "IMPRESSORA ATIVA — aguardando pedidos"; f.className = "faixa ok"; }
  else if (s.tipo === "sem-conexao") { f.textContent = "Sem conexão com o servidor"; f.className = "faixa aviso"; }
  else { f.textContent = "Erro " + (s.http || ""); f.className = "faixa erro"; }
});

carregar();

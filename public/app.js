// ============================================================
// LÓGICA DO PAINEL (front-end)
// ============================================================

const token = sessionStorage.getItem("token");
if (!token) location.href = "login.html";

const cabecalhos = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + token,
};

// Exibe o nome da empresa no header assim que a página carrega
const _nomeEmpresa = sessionStorage.getItem("empresaNome");
document.addEventListener("DOMContentLoaded", () => {
  const h = document.getElementById("headerNome");
  if (h && _nomeEmpresa) h.textContent = "🍴 " + _nomeEmpresa;
});

async function api(metodo, url, corpo) {
  const opc = { method: metodo, headers: cabecalhos };
  if (corpo) opc.body = JSON.stringify(corpo);
  const r = await fetch(url, opc);
  if (r.status === 401) {
    sessionStorage.removeItem("token");
    location.href = "login.html";
    return;
  }
  return r;
}

const $ = (id) => document.getElementById(id);
let cardapioAtual = { categorias: [] };
let configAtual = {};

// ============================================================
// TOAST (substitui flash)
// ============================================================
function toast(msg, tipo = "sucesso") {
  const container = $("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("saindo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3800);
}

// Mantém compatibilidade com o código que usava flash()
function flash(id, msg) {
  const el = $(id);
  if (el) {
    el.textContent = msg;
    setTimeout(() => { el.textContent = ""; }, 4000);
  }
  toast(msg, "sucesso");
}

// ============================================================
// MODAL DE CONFIRMAÇÃO (substitui window.confirm)
// ============================================================
function confirmar(titulo, mensagem, txtConfirmar = "Confirmar") {
  return new Promise((resolve) => {
    const overlay = $("modal-overlay");
    $("modal-titulo").textContent = titulo;
    $("modal-mensagem").textContent = mensagem;
    $("modal-confirmar").textContent = txtConfirmar;
    overlay.style.display = "flex";
    overlay.classList.remove("saindo");

    function fechar(resultado) {
      overlay.classList.add("saindo");
      overlay.addEventListener("animationend", () => {
        overlay.style.display = "none";
        overlay.classList.remove("saindo");
      }, { once: true });
      $("modal-cancelar").removeEventListener("click", onCancelar);
      $("modal-confirmar").removeEventListener("click", onConfirmar);
      resolve(resultado);
    }

    function onCancelar() { fechar(false); }
    function onConfirmar() { fechar(true); }

    $("modal-cancelar").addEventListener("click", onCancelar);
    $("modal-confirmar").addEventListener("click", onConfirmar);
  });
}

// ============================================================
// BADGE DE ATENDIMENTO (header)
// ============================================================
function atualizarBadgeAtendimento(aberto) {
  const badge = $("badgeAtendimento");
  const texto = $("badgeAtendimentoTexto");
  badge.style.display = "inline-flex";
  badge.className = "badge-atendimento " + (aberto ? "aberto" : "fechado");
  texto.textContent = aberto ? "Aberto" : "Fechado";
}

// ============================================================
// NAVEGAÇÃO POR ABAS
// ============================================================
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("ativo"));
    document.querySelectorAll(".aba").forEach((a) => a.classList.remove("ativa"));
    btn.classList.add("ativo");
    $("aba-" + btn.dataset.aba).classList.add("ativa");
    if (btn.dataset.aba === "pedidos") carregarPedidos();
    if (btn.dataset.aba === "conexao") atualizarStatus();
  });
});

$("btnSair").addEventListener("click", async () => {
  try { await api("POST", "/api/logout"); } catch (e) { /* ignora */ }
  sessionStorage.clear();
  location.href = "login.html";
});

// ============================================================
// CONEXÃO (status do bot + QR)
// ============================================================
async function atualizarStatus() {
  try {
    const r = await fetch("/api/status");
    const s = await r.json();
    const box = $("statusBox");
    if (s.status === "conectado") {
      box.innerHTML = `<h2><span class="bolinha on"></span>Bot conectado</h2>
        <p class="sub">O atendimento automático está funcionando. Respondendo apenas a mensagens novas.</p>
        <button class="secundario" id="btnDesconectar">Desconectar</button>`;
      $("btnDesconectar").addEventListener("click", desconectarBot);
    } else if (s.status === "aguardando_qr" && s.qr) {
      box.innerHTML = `<h2><span class="bolinha wait"></span>Aguardando leitura do QR</h2>
        <img src="${s.qr}" alt="QR Code" width="280" />
        <p class="sub">No WhatsApp: <b>Aparelhos conectados → Conectar um aparelho</b></p>
        <button class="secundario" id="btnCancelarQR">Cancelar</button>`;
      $("btnCancelarQR").addEventListener("click", desconectarBot);
    } else if (s.status === "iniciando") {
      box.innerHTML = `<h2><span class="bolinha wait"></span>Iniciando conexão...</h2>
        <div class="load"></div>
        <p class="sub">Aguarde o QR Code aparecer (pode levar até ~30s na 1ª vez).</p>
        <p class="sub">Travou aqui? A sessão antiga pode estar inválida.</p>
        <button class="secundario mini" id="btnResetarQR">🧹 Gerar novo QR (limpar sessão)</button>`;
      $("btnResetarQR").addEventListener("click", resetarBot);
    } else {
      box.innerHTML = `<h2><span class="bolinha off"></span>Bot desligado</h2>
        <p class="sub">Configure tudo nas outras abas. Quando estiver pronto, conecte ao WhatsApp.</p>
        <button id="btnConectar">📱 Conectar ao WhatsApp</button>
        <p class="sub" style="margin-top:14px">Problemas para conectar?</p>
        <button class="secundario mini" id="btnResetarDesligado">🧹 Gerar novo QR (limpar sessão)</button>`;
      $("btnConectar").addEventListener("click", conectarBot);
      $("btnResetarDesligado").addEventListener("click", resetarBot);
    }
  } catch (e) {
    $("statusBox").textContent = "Erro ao obter status.";
  }
}

async function conectarBot() {
  $("statusBox").innerHTML = `<div class="load"></div><p class="sub">Iniciando...</p>`;
  await api("POST", "/api/bot/conectar");
  setTimeout(atualizarStatus, 1500);
}

async function desconectarBot() {
  const ok = await confirmar(
    "Desconectar o bot?",
    "O atendimento automático será pausado. Você precisará reconectar manualmente.",
    "Desconectar"
  );
  if (!ok) return;
  await api("POST", "/api/bot/desconectar");
  setTimeout(atualizarStatus, 800);
}

async function resetarBot() {
  const ok = await confirmar(
    "Limpar sessão e gerar novo QR?",
    "Você precisará escanear o QR novamente com o celular.",
    "Limpar sessão"
  );
  if (!ok) return;
  $("statusBox").innerHTML = `<div class="load"></div><p class="sub">Limpando sessão...</p>`;
  const r = await api("POST", "/api/bot/resetar");
  if (r && !r.ok) {
    const d = await r.json().catch(() => ({}));
    toast(d.erro || "Não foi possível limpar a sessão. Apague a pasta .wwebjs_auth manualmente.", "erro");
  }
  setTimeout(atualizarStatus, 1200);
}

setInterval(() => {
  if ($("aba-conexao").classList.contains("ativa")) atualizarStatus();
}, 4000);

// ============================================================
// CARDÁPIO
// ============================================================
function moeda(v) { return Number(v || 0).toFixed(2); }

function renderCardapio() {
  const c = $("cardapioContainer");
  c.innerHTML = "";
  cardapioAtual.categorias.forEach((cat, ci) => {
    const div = document.createElement("div");
    div.className = "categoria";
    div.innerHTML = `
      <div class="categoria-cabeca">
        <input value="${escapar(cat.nome)}" data-cat="${ci}" class="catNome" />
        <button class="perigo mini" data-del-cat="${ci}">Excluir</button>
      </div>
      <div class="itens" data-itens="${ci}"></div>
      <button class="secundario mini add-item" data-add-item="${ci}">+ Adicionar item</button>
    `;
    c.appendChild(div);
    const itensDiv = div.querySelector(`[data-itens="${ci}"]`);
    cat.itens.forEach((item, ii) => {
      const linha = document.createElement("div");
      linha.className = "item-linha" + (item.disponivel ? "" : " item-indisp");
      linha.innerHTML = `
        <input value="${escapar(item.nome)}" class="itNome" data-c="${ci}" data-i="${ii}" placeholder="Nome do item" />
        <input type="number" step="0.01" value="${moeda(item.preco)}" class="itPreco" data-c="${ci}" data-i="${ii}" />
        <label class="toggle"><input type="checkbox" ${item.disponivel ? "checked" : ""} class="itDisp" data-c="${ci}" data-i="${ii}" />on</label>
        <button class="perigo mini" data-del-item="${ci}-${ii}" aria-label="Excluir item">×</button>
        <input value="${escapar(item.desc || "")}" class="itDesc desc" data-c="${ci}" data-i="${ii}" placeholder="Descrição curta (opcional)" />
        <div class="item-extras">
          <div class="extra-col">
            <label>Composição</label>
            <textarea class="itComp" data-c="${ci}" data-i="${ii}" placeholder="Ex:&#10;Principal:&#10;* Arroz&#10;* Feijão&#10;Guarnição:&#10;* Batata frita">${escapar(item.composicao || "")}</textarea>
            <span class="comp-dica">Subcategoria com ":" no fim. <b>Alt+Enter</b> para nova linha.</span>
          </div>
          <div class="extra-col">
            <label>Opcionais</label>
            <textarea class="itOpc" data-c="${ci}" data-i="${ii}" placeholder="Ex:&#10;Ovo frito | 2.00&#10;Bacon | 3.50">${escapar(item.opcionais || "")}</textarea>
            <span class="comp-dica">Formato <b>Nome | preço</b> por linha. <b>Alt+Enter</b> para nova linha.</span>
          </div>
        </div>
      `;
      itensDiv.appendChild(linha);
    });
  });
  ligarEventosCardapio();
}

function ligarEventosCardapio() {
  document.querySelectorAll(".catNome").forEach((el) =>
    el.addEventListener("input", (e) => { cardapioAtual.categorias[e.target.dataset.cat].nome = e.target.value; })
  );
  document.querySelectorAll(".itNome").forEach((el) =>
    el.addEventListener("input", (e) => { item(e).nome = e.target.value; })
  );
  document.querySelectorAll(".itPreco").forEach((el) =>
    el.addEventListener("input", (e) => { item(e).preco = parseFloat(e.target.value) || 0; })
  );
  document.querySelectorAll(".itDesc").forEach((el) =>
    el.addEventListener("input", (e) => { item(e).desc = e.target.value; })
  );
  document.querySelectorAll(".itComp").forEach((el) => {
    el.addEventListener("input", (e) => { item(e).composicao = e.target.value; });
    el.addEventListener("keydown", (e) => altEnterInsere(e, "\n* "));
  });
  document.querySelectorAll(".itOpc").forEach((el) => {
    el.addEventListener("input", (e) => { item(e).opcionais = e.target.value; });
    el.addEventListener("keydown", (e) => altEnterInsere(e, "\n"));
  });
  document.querySelectorAll(".itDisp").forEach((el) =>
    el.addEventListener("change", (e) => { item(e).disponivel = e.target.checked; renderCardapio(); })
  );
  document.querySelectorAll("[data-del-cat]").forEach((el) =>
    el.addEventListener("click", async (e) => {
      const ok = await confirmar("Excluir categoria?", "Todos os itens desta categoria serão removidos.", "Excluir");
      if (ok) {
        cardapioAtual.categorias.splice(+e.target.dataset.delCat, 1);
        renderCardapio();
      }
    })
  );
  document.querySelectorAll("[data-del-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.target.dataset.delItem.split("-").map(Number);
      cardapioAtual.categorias[ci].itens.splice(ii, 1);
      renderCardapio();
    })
  );
  document.querySelectorAll("[data-add-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const ci = +e.target.dataset.addItem;
      cardapioAtual.categorias[ci].itens.push({
        id: novoId(), nome: "", preco: 0, desc: "", composicao: "", opcionais: "", disponivel: true,
      });
      renderCardapio();
    })
  );
}

function item(e) {
  return cardapioAtual.categorias[+e.target.dataset.c].itens[+e.target.dataset.i];
}

function novoId() {
  let max = 0;
  cardapioAtual.categorias.forEach((c) => c.itens.forEach((i) => { if (i.id > max) max = i.id; }));
  return max + 1;
}

$("btnAddCategoria").addEventListener("click", () => {
  cardapioAtual.categorias.push({ id: "cat_" + Date.now(), nome: "Nova categoria", itens: [] });
  renderCardapio();
});

$("btnSalvarCardapio").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "Salvando...";
  const r = await api("PUT", "/api/cardapio", cardapioAtual);
  btn.disabled = false;
  btn.textContent = "Salvar cardápio";
  if (r && r.ok) toast("✓ Cardápio salvo! Já está valendo para os clientes.");
});

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const DIAS_SEMANA = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

function renderHorarios() {
  const tbody = $("horariosBody");
  if (!tbody) return;
  const horarios = configAtual.horarios || {};
  tbody.innerHTML = "";
  for (const { key, label } of DIAS_SEMANA) {
    const h = horarios[key] || { abre: "11:00", fecha: "22:00", fechado: false };
    const fechado = !!h.fechado;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:6px 8px;font-size:14px">${label}</td>
      <td style="padding:4px 8px">
        <input type="time" id="h_abre_${key}" value="${h.abre || "11:00"}" ${fechado ? "disabled" : ""} style="width:110px" />
      </td>
      <td style="padding:4px 8px">
        <input type="time" id="h_fecha_${key}" value="${h.fecha || "22:00"}" ${fechado ? "disabled" : ""} style="width:110px" />
      </td>
      <td style="padding:4px 8px">
        <input type="checkbox" id="h_fechado_${key}" ${fechado ? "checked" : ""} style="width:auto" />
      </td>`;
    tbody.appendChild(tr);
    tr.querySelector(`#h_fechado_${key}`).addEventListener("change", (e) => {
      const isFechado = e.target.checked;
      tr.querySelector(`#h_abre_${key}`).disabled = isFechado;
      tr.querySelector(`#h_fecha_${key}`).disabled = isFechado;
    });
  }
}

function lerHorariosDoDOM() {
  const horarios = {};
  for (const { key } of DIAS_SEMANA) {
    horarios[key] = {
      abre:    ($(`h_abre_${key}`)  || {}).value || "11:00",
      fecha:   ($(`h_fecha_${key}`) || {}).value || "22:00",
      fechado: !!($(`h_fechado_${key}`) || {}).checked,
    };
  }
  return horarios;
}

function preencherConfig() {
  const c = configAtual;
  $("cfgNome").value = c.restaurante.nome || "";
  $("cfgTelefone").value = c.restaurante.telefone || "";
  $("cfgHorario").value = c.restaurante.horario || "";
  $("cfgEndereco").value = c.restaurante.endereco || "";
  $("cfgAberto").checked = !!c.atendimento.aberto;
  $("cfgTempo").value = c.atendimento.tempoEstimado || "";
  $("cfgTaxaEntrega").value = moeda(c.atendimento.taxaEntrega || 0);
  $("cfgBoasVindas").value = c.mensagens.boasVindas || "";
  $("cfgFechado").value = c.mensagens.fechado || "";
  $("cfgAtendente").value = c.mensagens.atendente || "";
  $("cfgConfirmado").value = c.mensagens.pedidoConfirmado || "";
  atualizarBadgeAtendimento(!!c.atendimento.aberto);
  renderHorarios();
  renderPagamentos();
}

function renderPagamentos() {
  const cont = $("pagamentosContainer");
  cont.innerHTML = "";
  configAtual.pagamentos.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "linha";
    div.style.marginBottom = "8px";
    div.innerHTML = `<input value="${escapar(p)}" data-pg="${i}" />
      <button class="perigo mini" data-del-pg="${i}">×</button>`;
    cont.appendChild(div);
  });
  cont.querySelectorAll("[data-pg]").forEach((el) =>
    el.addEventListener("input", (e) => { configAtual.pagamentos[+e.target.dataset.pg] = e.target.value; })
  );
  cont.querySelectorAll("[data-del-pg]").forEach((el) =>
    el.addEventListener("click", (e) => { configAtual.pagamentos.splice(+e.target.dataset.delPg, 1); renderPagamentos(); })
  );
}

$("cfgAberto").addEventListener("change", (e) => {
  atualizarBadgeAtendimento(e.target.checked);
});

$("btnAddPagamento").addEventListener("click", () => {
  configAtual.pagamentos.push("Nova forma");
  renderPagamentos();
});

$("btnSalvarConfig").addEventListener("click", async (e) => {
  configAtual.restaurante.nome = $("cfgNome").value;
  configAtual.restaurante.telefone = $("cfgTelefone").value;
  configAtual.restaurante.horario = $("cfgHorario").value;
  configAtual.restaurante.endereco = $("cfgEndereco").value;
  configAtual.atendimento.aberto = $("cfgAberto").checked;
  configAtual.atendimento.tempoEstimado = $("cfgTempo").value;
  configAtual.atendimento.taxaEntrega = parseFloat($("cfgTaxaEntrega").value) || 0;
  configAtual.horarios = lerHorariosDoDOM();
  configAtual.mensagens.boasVindas = $("cfgBoasVindas").value;
  configAtual.mensagens.fechado = $("cfgFechado").value;
  configAtual.mensagens.atendente = $("cfgAtendente").value;
  configAtual.mensagens.pedidoConfirmado = $("cfgConfirmado").value;
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "Salvando...";
  const r = await api("PUT", "/api/config", configAtual);
  btn.disabled = false;
  btn.textContent = "Salvar configurações";
  if (r && r.ok) toast("✓ Configurações salvas!");
});

// ============================================================
// PEDIDOS
// ============================================================
let pedidosCache = [];

async function carregarPedidos() {
  const r = await api("GET", "/api/pedidos");
  if (!r) return;
  pedidosCache = await r.json();
  const cont = $("pedidosContainer");
  if (pedidosCache.length === 0) {
    cont.innerHTML = `
      <div class="estado-vazio">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <p>Nenhum pedido recebido ainda</p>
        <span class="sub">Os pedidos aparecem aqui assim que o bot receber o primeiro pedido pelo WhatsApp.</span>
      </div>`;
    return;
  }
  let html = `<table><thead><tr>
    <th>#</th><th>Cliente</th><th>Total</th><th>Tipo</th><th>Pagamento</th><th>Quando</th><th></th>
    </tr></thead><tbody>`;
  pedidosCache.forEach((p, idx) => {
    const data = new Date(p.criadoEm).toLocaleString("pt-BR");
    const tipoTag = p.tipoEntrega === "Entrega"
      ? `<span class="tag tag-entrega">🛵 Entrega</span>`
      : `<span class="tag tag-retirada">🏃 Retirada</span>`;
    html += `<tr>
      <td>${p.numero}</td>
      <td>${escapar(p.cliente)}<br><span class="sub">${escapar(p.telefone || "")}</span></td>
      <td>R$ ${moeda(p.total)}</td>
      <td>${tipoTag}</td>
      <td>${escapar(p.pagamento)}</td>
      <td>${data}</td>
      <td><button class="btn-ver-pedido" data-idx="${idx}">Ver pedido</button></td>
    </tr>`;
  });
  html += "</tbody></table>";
  cont.innerHTML = html;

  cont.querySelectorAll(".btn-ver-pedido").forEach((btn) =>
    btn.addEventListener("click", (e) => abrirModalPedido(pedidosCache[+e.target.dataset.idx]))
  );
}

function abrirModalPedido(p) {
  $("pedido-numero").textContent = `Pedido #${p.numero}`;
  $("pedido-quando").textContent = new Date(p.criadoEm).toLocaleString("pt-BR");

  const taxa = p.taxaEntrega || 0;
  const totalItens = p.itens.reduce((acc, i) => {
    const extras = (i.opcionais || []).reduce((s, o) => s + (o.preco || 0), 0);
    return acc + (i.preco + extras) * i.qtd;
  }, 0);

  let itensHtml = p.itens.map((i) => {
    const extras = (i.opcionais || []).reduce((s, o) => s + (o.preco || 0), 0);
    const subtotal = (i.preco + extras) * i.qtd;
    const opcionaisHtml = i.opcionais && i.opcionais.length
      ? `<div class="pedido-item-opc">+ ${i.opcionais.map((o) => escapar(o.nome)).join(", ")}</div>`
      : "";
    const obsHtml = i.observacao
      ? `<div class="pedido-item-obs">📝 ${escapar(i.observacao)}</div>`
      : "";
    return `<div class="pedido-item">
      <div>
        <div class="pedido-item-nome">${i.qtd}× ${escapar(i.nome)}</div>
        ${opcionaisHtml}${obsHtml}
      </div>
      <div class="pedido-item-preco">R$ ${moeda(subtotal)}</div>
    </div>`;
  }).join("");

  const taxaHtml = taxa > 0
    ? `<div class="pedido-total-linha taxa"><span>Taxa de entrega</span><span>R$ ${moeda(taxa)}</span></div>`
    : "";

  const tipoTag = p.tipoEntrega === "Entrega"
    ? `<span class="tag tag-entrega">🛵 Entrega</span>`
    : `<span class="tag tag-retirada">🏃 Retirada</span>`;

  const enderecoHtml = p.endereco && p.endereco !== "—"
    ? `<div class="pedido-info-item pedido-endereco">
        <span class="pedido-info-label">Endereço</span>
        <span class="pedido-info-valor">${escapar(p.endereco)}</span>
       </div>`
    : "";

  $("pedido-detalhe-corpo").innerHTML = `
    <div class="pedido-secao">
      <div class="pedido-secao-titulo">Itens</div>
      ${itensHtml}
      ${taxaHtml}
      <div class="pedido-total-linha final">
        <span>Total</span>
        <span>R$ ${moeda(p.total)}</span>
      </div>
    </div>
    <div class="pedido-secao">
      <div class="pedido-secao-titulo">Informações</div>
      <div class="pedido-info-grid">
        <div class="pedido-info-item">
          <span class="pedido-info-label">Cliente</span>
          <span class="pedido-info-valor">${escapar(p.cliente)}</span>
        </div>
        <div class="pedido-info-item">
          <span class="pedido-info-label">Telefone</span>
          <span class="pedido-info-valor">${escapar(p.telefone || "—")}</span>
        </div>
        <div class="pedido-info-item">
          <span class="pedido-info-label">Tipo</span>
          <span class="pedido-info-valor">${tipoTag}</span>
        </div>
        <div class="pedido-info-item">
          <span class="pedido-info-label">Pagamento</span>
          <span class="pedido-info-valor">${escapar(p.pagamento)}</span>
        </div>
        ${enderecoHtml}
      </div>
    </div>`;

  const overlay = $("pedido-overlay");
  overlay.style.display = "flex";
  overlay.classList.remove("saindo");
}

function fecharModalPedido() {
  const overlay = $("pedido-overlay");
  overlay.classList.add("saindo");
  overlay.addEventListener("animationend", () => {
    overlay.style.display = "none";
    overlay.classList.remove("saindo");
  }, { once: true });
}

$("pedido-fechar").addEventListener("click", fecharModalPedido);
$("pedido-overlay").addEventListener("click", (e) => {
  if (e.target === $("pedido-overlay")) fecharModalPedido();
});

$("btnAtualizarPedidos").addEventListener("click", carregarPedidos);

// Auto-refresh de pedidos enquanto a aba estiver ativa
setInterval(() => {
  if ($("aba-pedidos").classList.contains("ativa")) carregarPedidos();
}, 15000);

// ============================================================
// Utilidades + carga inicial
// ============================================================
function escapar(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function altEnterInsere(e, insercao) {
  if (e.key === "Enter" && e.altKey) {
    e.preventDefault();
    const ta = e.target;
    const ini = ta.selectionStart, fim = ta.selectionEnd;
    ta.value = ta.value.slice(0, ini) + insercao + ta.value.slice(fim);
    ta.selectionStart = ta.selectionEnd = ini + insercao.length;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// ============================================================
// SIMULADOR DE CONVERSA
// ============================================================
const simChat  = $("simChat");
const simInput = $("simInput");
const simEstado = $("simEstado");

function simFormatarTexto(txt) {
  return escapar(txt)
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>");
}

function simAdicionarMensagemUser(texto) {
  const div = document.createElement("div");
  div.className = "sim-balao-user";
  div.innerHTML = `<div class="sim-bubble-user">${escapar(texto)}</div>`;
  simChat.appendChild(div);
  simRolarParaBaixo();
}

function simAdicionarMensagensBot(respostas) {
  for (const r of respostas) {
    if (!r || !r.trim()) continue;
    const div = document.createElement("div");
    div.className = "sim-balao-bot";
    div.innerHTML = `
      <div class="sim-avatar">🤖</div>
      <div class="sim-bubble-bot">${simFormatarTexto(r)}</div>`;
    simChat.appendChild(div);
  }
  simRolarParaBaixo();
}

function simMostrarTyping() {
  const div = document.createElement("div");
  div.className = "sim-typing";
  div.id = "simTyping";
  div.innerHTML = `
    <div class="sim-avatar">🤖</div>
    <div class="sim-typing-dots"><span></span><span></span><span></span></div>`;
  simChat.appendChild(div);
  simRolarParaBaixo();
  return div;
}

function simAtualizarEstado(estado, carrinho) {
  simEstado.textContent = estado || "—";
  const count = carrinho ? carrinho.length : 0;
  simEstado.title = count > 0 ? `${count} item(s) no carrinho` : "";
}

function simRolarParaBaixo() {
  simChat.scrollTop = simChat.scrollHeight;
}

function simAdicionarSeparador(texto) {
  const div = document.createElement("div");
  div.className = "sim-separador";
  div.textContent = texto;
  simChat.appendChild(div);
}

$("simForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = simInput.value.trim();
  if (!msg) return;
  simInput.value = "";
  simInput.disabled = true;

  simAdicionarMensagemUser(msg);

  const typing = simMostrarTyping();

  try {
    const r = await fetch("/api/simulador/mensagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: msg }),
    });
    const data = await r.json();
    typing.remove();
    simAdicionarMensagensBot(data.respostas || []);
    simAtualizarEstado(data.estado, data.carrinho);
  } catch {
    typing.remove();
    simAdicionarMensagensBot(["⚠️ Erro ao conectar com o servidor."]);
  }

  simInput.disabled = false;
  simInput.focus();
});

$("btnSimReset").addEventListener("click", async () => {
  await fetch("/api/simulador/reset", { method: "POST" });
  simChat.innerHTML = `<div class="sim-hint">Digite <strong>oi</strong> para começar o atendimento.</div>`;
  simAdicionarSeparador("Sessão reiniciada");
  simAtualizarEstado("INICIO", []);
  simInput.focus();
});

// Foca no input ao entrar na aba simulador
document.querySelector("[data-aba='simulador']").addEventListener("click", () => {
  setTimeout(() => simInput.focus(), 80);
});

// Envia com Enter (já é o padrão do form), permite Shift+Enter para nova linha no futuro
simInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("simForm").dispatchEvent(new Event("submit"));
  }
});

async function inicial() {
  atualizarStatus();
  const rc = await api("GET", "/api/cardapio");
  if (rc) { cardapioAtual = await rc.json(); renderCardapio(); }
  const rcfg = await api("GET", "/api/config");
  if (rcfg) { configAtual = await rcfg.json(); preencherConfig(); }
}
inicial();

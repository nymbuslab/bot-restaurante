const token = sessionStorage.getItem("token");
if (!token) { location.href = "login.html"; }

const form = document.getElementById("co-form");
const btn  = document.getElementById("co-btn");
const erro = document.getElementById("co-erro");
const LABEL_BTN = "Iniciar teste grátis de 7 dias";
let stripe, elements;
let planoEscolhido = "bot";

// Carrega os planos vendáveis e monta o seletor (radio). Plano inicial: ?plano=
// (vindo do cadastro/painel) se válido, senão o primeiro da lista.
async function carregarPlanos() {
  const wrap = document.getElementById("co-planos");
  if (!wrap) return;
  let lista = [];
  try {
    const r = await fetch("/api/planos");
    lista = await r.json();
  } catch (_) { /* segue com lista vazia */ }
  if (!Array.isArray(lista) || !lista.length) { wrap.style.display = "none"; return; }

  const qs = new URLSearchParams(location.search).get("plano");
  if (qs && lista.some((p) => p.chave === qs)) planoEscolhido = qs;
  else planoEscolhido = lista[0].chave;

  wrap.innerHTML = "";
  lista.forEach((p) => {
    const card = document.createElement("label");
    card.className = "co-plano-opt" + (p.chave === planoEscolhido ? " selecionado" : "");
    card.dataset.plano = p.chave;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "plano";
    radio.value = p.chave;
    radio.checked = p.chave === planoEscolhido;

    const info = document.createElement("div");
    info.className = "co-plano-opt-info";
    const nome = document.createElement("span");
    nome.className = "co-plano-opt-nome";
    nome.textContent = p.nome;
    const desc = document.createElement("span");
    desc.className = "co-plano-opt-desc";
    desc.textContent = p.features && p.features.cardapioDigital ? "Bot no WhatsApp + Cardápio Digital" : "Bot no WhatsApp";
    info.appendChild(nome);
    info.appendChild(desc);

    const preco = document.createElement("span");
    preco.className = "co-plano-opt-preco";
    preco.textContent = p.precoLabel;

    card.appendChild(radio);
    card.appendChild(info);
    card.appendChild(preco);
    radio.addEventListener("change", () => {
      planoEscolhido = p.chave;
      wrap.querySelectorAll(".co-plano-opt").forEach((el) =>
        el.classList.toggle("selecionado", el.dataset.plano === planoEscolhido));
    });
    wrap.appendChild(card);
  });
}

function falhar(msg) {
  erro.textContent = msg || "Algo deu errado. Tente novamente.";
  btn.disabled = false;
  btn.textContent = LABEL_BTN;
}

async function init() {
  try {
    const r = await fetch("/api/assinatura/setup-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    });
    if (r.status === 401) { location.href = "login.html"; return; }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      erro.textContent = d.erro || "Não foi possível iniciar o checkout.";
      return;
    }
    const { clientSecret, publishableKey } = await r.json();
    stripe = Stripe(publishableKey);

    // Appearance API — tema escuro com a identidade Nymbus.
    const appearance = {
      theme: "night",
      variables: {
        colorPrimary: "#6344BC",
        colorBackground: "#222533",
        colorText: "#F0F2FA",
        colorTextSecondary: "#8B92B3",
        colorDanger: "#EF4444",
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        borderRadius: "10px",
        spacingUnit: "4px",
      },
    };
    elements = stripe.elements({ clientSecret, appearance });
    const paymentElement = elements.create("payment", { layout: "tabs" });
    paymentElement.mount("#payment-element");
    paymentElement.on("ready", () => {
      btn.disabled = false;
      btn.textContent = LABEL_BTN;
    });
  } catch (e) {
    erro.textContent = "Erro ao conectar ao servidor.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!stripe || !elements) return;
  erro.textContent = "";
  btn.disabled = true;
  btn.textContent = "Processando…";

  const { error, setupIntent } = await stripe.confirmSetup({
    elements,
    confirmParams: { return_url: window.location.origin + "/admin.html?assinatura=ok" },
    redirect: "if_required",
  });

  if (error) { falhar(error.message); return; }
  if (!setupIntent || setupIntent.status !== "succeeded") {
    falhar("Não foi possível confirmar o cartão. Tente novamente.");
    return;
  }

  // Cartão salvo → cria a assinatura (trial 7d) no backend.
  try {
    const r = await fetch("/api/assinatura/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ setupIntentId: setupIntent.id, plano: planoEscolhido }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      falhar(d.erro || "Falha ao ativar a assinatura.");
      return;
    }
    location.href = "admin.html?assinatura=ok";
  } catch (e2) {
    falhar("Erro ao ativar a assinatura.");
  }
});

carregarPlanos();
init();

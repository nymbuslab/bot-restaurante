// Sessão segura (v0.26.0+): o access token vive só em memória, obtido do cookie
// httpOnly via /api/refresh — NÃO mais do sessionStorage (que ficava sempre vazio
// numa página nova como esta, causando loop checkout→login→painel).
let token = null;

async function bootSessao() {
  try {
    const r = await fetch("/api/refresh", { method: "POST" }); // cookie httpOnly vai junto
    if (!r.ok) { location.href = "login.html"; return false; }
    const d = await r.json();
    token = d.token;
    return true;
  } catch (e) {
    location.href = "login.html";
    return false;
  }
}

const form = document.getElementById("co-form");
const btn  = document.getElementById("co-btn");
const erro = document.getElementById("co-erro");
const LABEL_BTN = "Iniciar teste grátis de 7 dias";
let stripe, elements;

// Plano escolhido (Essencial padrão). Pode vir pré-selecionado por ?plano=completo.
function planoSelecionado() {
  const r = document.querySelector('input[name="coPlano"]:checked');
  return r && r.value === "completo" ? "completo" : "essencial";
}
function syncPlanoAtivo() {
  document.querySelectorAll(".co-plano-opt").forEach((l) => {
    const input = l.querySelector('input[name="coPlano"]');
    l.classList.toggle("ativo", !!(input && input.checked));
  });
}
document.querySelectorAll('input[name="coPlano"]').forEach((r) => r.addEventListener("change", syncPlanoAtivo));
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get("plano") === "completo") {
    const rc = document.querySelector('input[name="coPlano"][value="completo"]');
    if (rc) rc.checked = true;
  }
  syncPlanoAtivo();
})();

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
      body: JSON.stringify({ setupIntentId: setupIntent.id, plano: planoSelecionado() }),
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

// Boot: garante o token via /api/refresh antes de montar o checkout.
bootSessao().then(function (ok) { if (ok) init(); });

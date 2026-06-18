const btn  = document.getElementById("btnEntrar");
const erro = document.getElementById("erro");

// Já logado? O cookie de presença "sess" (legível pelo JS) sinaliza uma sessão
// ativa. Se houver, tenta retomar via /api/refresh e cai direto no painel — sem
// piscar o formulário. Em 401 o servidor limpa os cookies e o form aparece.
(function retomarSessao() {
  var temSessao = document.cookie.split(";").some(function (c) { return c.trim() === "sess=1"; });
  if (!temSessao) return;
  document.body.style.visibility = "hidden";
  fetch("/api/refresh", { method: "POST" })
    .then(function (r) {
      if (!r.ok) { document.body.style.visibility = ""; return; }
      // Onboarding incompleto → retoma o cadastro (igual ao login manual); senão, painel.
      return r.json().then(function (d) {
        location.replace(d && d.onboardingConcluido === false ? "cadastro.html" : "admin.html");
      });
    })
    .catch(function () { document.body.style.visibility = ""; });
})();

function toggleSenha(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const isHidden = inp.type === "password";
  inp.type = isHidden ? "text" : "password";
  document.getElementById(btnId + "-icon").innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

async function entrar() {
  erro.textContent = "";
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;
  if (!email || !senha) { erro.textContent = "Preencha e-mail e senha."; return; }

  btn.disabled = true;
  btn.textContent = "Entrando...";

  function falhar(msg) {
    erro.textContent = msg || "E-mail ou senha incorretos.";
    btn.disabled = false;
    btn.textContent = "Entrar";
  }

  const lembrar = !!document.getElementById("lembrar")?.checked;

  try {
    // 1) Tenta login de restaurante (Supabase Auth). A sessão (refresh token)
    //    fica num cookie httpOnly setado pelo servidor — nada vai pro storage.
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha, lembrar }),
    });
    if (r.ok) {
      const { onboardingConcluido } = await r.json();
      // Onboarding incompleto → retoma o cadastro de onde parou. Senão, painel.
      location.href = onboardingConcluido === false ? "cadastro.html" : "admin.html";
      return;
    }

    // 2) Não é restaurante → tenta a conta master (mesma tela, auth isolada).
    //    O token master vai para sessionStorage["tokenAdmin"] (chave própria,
    //    diferente do "token" do restaurante) e cai direto no painel master.
    const ra = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    if (ra.ok) {
      const { token } = await ra.json();
      sessionStorage.setItem("tokenAdmin", token);
      location.href = "admin-master.html";
      return;
    }

    // 3) Ambos falharam.
    falhar();
  } catch (e) {
    falhar("Erro ao conectar ao servidor.");
  }
}

btn.addEventListener("click", entrar);
// Form sem onsubmit inline (CSP): previne o reload aqui no JS.
document.getElementById("formLogin").addEventListener("submit", (e) => { e.preventDefault(); entrar(); });
// Botão de mostrar/ocultar senha (sem onclick inline, por CSP).
document.getElementById("olhoSenha").addEventListener("click", () => toggleSenha("senha", "olhoSenha"));

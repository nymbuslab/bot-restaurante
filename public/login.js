const btn  = document.getElementById("btnEntrar");
const erro = document.getElementById("erro");

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

  try {
    // 1) Tenta login de restaurante (Supabase Auth).
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    if (r.ok) {
      const { token, slug, nome, onboardingConcluido } = await r.json();
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("slug", slug);
      sessionStorage.setItem("empresaNome", nome);
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

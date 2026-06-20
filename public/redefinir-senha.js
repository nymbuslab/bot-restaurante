// Redefinição de senha: lê o token da URL e troca a senha via /api/redefinir-senha.
const params = new URLSearchParams(location.search);
const token = params.get("token") || "";
const btn = document.getElementById("btnReset");
const erro = document.getElementById("erro");
const ok = document.getElementById("ok");

if (!token) {
  erro.textContent = "Link inválido. Solicite uma nova redefinição na tela de login.";
  btn.disabled = true;
}

async function redefinir() {
  erro.textContent = "";
  ok.hidden = true;
  const senha = document.getElementById("senha").value;
  const senha2 = document.getElementById("senha2").value;
  if (senha.length < 6) { erro.textContent = "A senha deve ter ao menos 6 caracteres."; return; }
  if (senha !== senha2) { erro.textContent = "As senhas não conferem."; return; }

  btn.disabled = true;
  btn.textContent = "Salvando...";
  try {
    const r = await fetch("/api/redefinir-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, novaSenha: senha }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      ok.textContent = "Senha redefinida com sucesso! Redirecionando para o login...";
      ok.hidden = false;
      setTimeout(() => location.href = "login.html", 1800);
      return;
    }
    erro.textContent = d.erro || "Não foi possível redefinir. Solicite um novo link.";
  } catch (_) {
    erro.textContent = "Erro ao conectar ao servidor. Tente de novo.";
  }
  btn.disabled = false;
  btn.textContent = "Redefinir senha";
}

document.getElementById("formReset").addEventListener("submit", (e) => { e.preventDefault(); redefinir(); });

// ============================================================
// EMAIL — envio transacional via Resend (API HTTP, sem dependência).
//
// Remetente configurável (EMAIL_FROM); precisa ser do domínio verificado no
// Resend. Sem RESEND_API_KEY, os envios viram no-op (não quebram o fluxo).
// Os disparos por evento são FIRE-AND-FORGET: o chamador faz .catch() e segue.
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "Nymbus Pedidos <nao-responda@nymbuslab.com.br>";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const CONFIGURADO = Boolean(RESEND_API_KEY);

if (!CONFIGURADO) {
  console.warn("⚠️  Resend não configurado (defina RESEND_API_KEY). E-mails desativados (no-op).");
}

// Envia um e-mail. Resolve { ok } sem lançar — seguro para fire-and-forget.
async function enviar({ to, subject, html }) {
  if (!CONFIGURADO || !to) return { ok: false, motivo: "nao_configurado" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    if (!r.ok) {
      const d = await r.text().catch(() => "");
      console.error("email Resend:", r.status, d.slice(0, 200));
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("email Resend erro:", e.message);
    return { ok: false };
  }
}

// Escape mínimo de HTML para interpolar dados do usuário em templates.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Layout base com a marca (cabeçalho gradiente + rodapé).
function layout(titulo, corpoHtml) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1A1D27;">
    <div style="background:linear-gradient(135deg,#6344BC,#73D2E6);padding:20px 24px;border-radius:12px 12px 0 0;">
      <span style="color:#fff;font-size:18px;font-weight:700;">Nymbus Pedidos</span>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;font-size:14px;line-height:1.6;">
      <h1 style="font-size:18px;margin:0 0 14px;">${titulo}</h1>
      ${corpoHtml}
    </div>
    <p style="color:#8B92B3;font-size:11px;text-align:center;margin-top:16px;">Nymbus Pedidos · este é um e-mail automático, não responda.</p>
  </div>`;
}

function botao(href, texto) {
  return `<a href="${esc(href)}" style="display:inline-block;background:#6344BC;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;margin:6px 0;">${esc(texto)}</a>`;
}

// ---- Templates / disparos (cada um devolve a promise do enviar) ----

function boasVindas(to, nome) {
  return enviar({ to, subject: "Bem-vindo ao Nymbus Pedidos 🎉", html: layout(
    `Bem-vindo, ${esc(nome || "")}!`,
    `<p>Sua conta foi criada. Configure seu cardápio, conecte o WhatsApp e comece a receber pedidos.</p>
     ${PUBLIC_URL ? botao(PUBLIC_URL + "/admin.html", "Abrir meu painel") : ""}
     <p>Qualquer dúvida, estamos por aqui. 🍴</p>`) });
}

function resetSenha(to, link) {
  return enviar({ to, subject: "Redefinir sua senha — Nymbus Pedidos", html: layout(
    "Redefinição de senha",
    `<p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo (o link expira em <strong>1 hora</strong>):</p>
     ${botao(link, "Definir nova senha")}
     <p style="color:#8B92B3;font-size:12px;">Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.</p>`) });
}

function assinaturaConfirmada(to, nome, plano) {
  return enviar({ to, subject: "Sua assinatura está ativa — Nymbus Pedidos", html: layout(
    "Assinatura confirmada ✅",
    `<p>Olá, ${esc(nome || "")}! Sua assinatura do <strong>${esc(plano || "Nymbus Pedidos")}</strong> está ativa.</p>
     <p>Você pode gerenciar o plano, cartões e faturas na aba <strong>Assinatura</strong> do painel.</p>
     ${PUBLIC_URL ? botao(PUBLIC_URL + "/admin.html", "Abrir o painel") : ""}`) });
}

function avisoSeguranca(to, oQue) {
  return enviar({ to, subject: "Alteração na sua conta — Nymbus Pedidos", html: layout(
    "Aviso de segurança",
    `<p>${esc(oQue)} foi alterado(a) na sua conta Nymbus Pedidos.</p>
     <p style="color:#8B92B3;font-size:12px;">Se não foi você, redefina sua senha imediatamente e fale com o suporte.</p>`) });
}

function cancelamento(to, nome) {
  return enviar({ to, subject: "Assinatura cancelada — Nymbus Pedidos", html: layout(
    "Assinatura cancelada",
    `<p>Olá, ${esc(nome || "")}. Sua assinatura foi cancelada e o acesso ao painel/bot foi encerrado.</p>
     <p>Quando quiser voltar, é só assinar de novo pelo painel. Sentiremos sua falta! 👋</p>`) });
}

function contaExcluida(to, nome) {
  return enviar({ to, subject: "Conta excluída — Nymbus Pedidos", html: layout(
    "Conta excluída",
    `<p>Olá, ${esc(nome || "")}. Confirmamos a exclusão da sua conta e dos dados associados, conforme solicitado.</p>
     <p>Obrigado por ter usado o Nymbus Pedidos.</p>`) });
}

module.exports = {
  enviar, CONFIGURADO,
  boasVindas, resetSenha, assinaturaConfirmada, avisoSeguranca, cancelamento, contaExcluida,
};

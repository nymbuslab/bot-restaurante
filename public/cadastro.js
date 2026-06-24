    // ====== Estado do wizard ======
    let token = null;   // token de sessão após o login da Etapa 1
    let cfg = null;     // config do tenant (GET após login; mutada e salva por etapa)
    let stepAtual = 1;

    const DIAS = [
      ["seg", "Segunda"], ["ter", "Terça"], ["qua", "Quarta"], ["qui", "Quinta"],
      ["sex", "Sexta"], ["sab", "Sábado"], ["dom", "Domingo"],
    ];
    const NOMES = ["Conta", "Dados", "Horário", "Entrega"];
    const $ = (id) => document.getElementById(id);
    const authHeaders = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + token });
    // Moeda: máscara/leitura via util compartilhado (window.Dinheiro — dinheiro.js).

    function toggleSenha(inputId, btnId) {
      const inp = $(inputId);
      const isHidden = inp.type === "password";
      inp.type = isHidden ? "text" : "password";
      $(btnId + "-icon").innerHTML = isHidden
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }

    // ====== Navegação entre etapas ======
    function irPara(n) {
      stepAtual = n;
      for (let i = 1; i <= 4; i++) $("step" + i).style.display = i === n ? "" : "none";
      $("wizEtapaLabel").textContent = `Etapa ${n} de 4`;
      $("wizEtapaNome").textContent = NOMES[n - 1];
      document.querySelectorAll(".wiz-bar").forEach((b, i) => b.classList.toggle("ativa", i < n));
      if (n === 3) renderHorariosWiz();
      if (n === 4) renderEntregaWiz();
    }

    // ====== Persistência (reusa PUT /api/config do painel) ======
    async function salvarConfig() {
      try {
        const r = await fetch("/api/config", { method: "PUT", headers: authHeaders(), body: JSON.stringify(cfg) });
        return r.ok;
      } catch (e) { return false; }
    }

    // Fim do onboarding: vai para o checkout próprio (cartão + trial de 7 dias).
    // Se o cliente abandonar, o gate de assinatura no painel pede a ativação.
    function irParaPlano() {
      location.href = "checkout.html";
    }

    // ====== ETAPA 1 — cadastro + login (lógica atual, só envolvida no wizard) ======
    const btn  = $("btnCadastrar");
    const erro = $("erro");

    async function cadastrar() {
      erro.textContent = "";
      const nome   = $("nome").value.trim();
      const email  = $("email").value.trim();
      const senha  = $("senha").value;
      const senha2 = $("senha2").value;

      if (!nome || !email || !senha || !senha2) { erro.textContent = "Preencha todos os campos."; return; }
      if (senha !== senha2) { erro.textContent = "As senhas não coincidem."; return; }
      if (senha.length < 6) { erro.textContent = "A senha deve ter pelo menos 6 caracteres."; return; }
      if (!$("aceiteTermos").checked) { erro.textContent = "Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar."; return; }

      btn.disabled = true;
      btn.textContent = "Criando conta...";

      try {
        const r = await fetch("/api/cadastro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, email, senha, aceite: true }),
        });
        const data = await r.json();
        if (!r.ok) {
          // Conta completa já existe → tenta logar com a senha e retomar de onde parou.
          if (/j[áa] cadastrado/i.test(data.erro || "")) {
            const reab = await tentarRetomarComLogin(email, senha);
            if (reab) return; // retomou o wizard ou foi pro painel
            erro.textContent = "E-mail já cadastrado. Entre com sua senha para continuar.";
            btn.disabled = false; btn.textContent = "Criar conta e começar →";
            return;
          }
          erro.textContent = data.erro || "Erro ao criar conta.";
          btn.disabled = false; btn.textContent = "Criar conta e começar →";
          return;
        }

        // Login automático (idêntico ao fluxo atual)
        const lr = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, senha }),
        });
        const ld = await lr.json();
        if (!lr.ok) { erro.textContent = "Conta criada, mas falha ao entrar. Faça login."; btn.disabled = false; btn.textContent = "Criar conta e começar →"; return; }

        token = ld.token; // access token em memória; a sessão (refresh) veio no cookie do /api/login

        // Carrega a config limpa do tenant recém-criado (mutada e salva nas próximas etapas)
        const cr = await fetch("/api/config", { headers: authHeaders() });
        cfg = await cr.json();

        irPara(2);
      } catch (e) {
        erro.textContent = "Erro ao conectar ao servidor.";
        btn.disabled = false;
        btn.textContent = "Criar conta e começar →";
      }
    }

    // Conta já existe: loga com a senha digitada e retoma o wizard (ou vai ao
    // painel se o onboarding já terminou). Retorna true se conseguiu seguir.
    async function tentarRetomarComLogin(email, senha) {
      try {
        const lr = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, senha }),
        });
        if (!lr.ok) return false; // senha não confere → deixa o chamador avisar
        const ld = await lr.json();
        token = ld.token; // sessão (refresh) no cookie httpOnly; access token em memória
        if (ld.onboardingConcluido === false) {
          const cr = await fetch("/api/config", { headers: authHeaders() });
          cfg = await cr.json();
          cfg.onboarding = cfg.onboarding || { concluido: false, etapa: 2 };
          preencherDados();
          irPara(cfg.onboarding.etapa || 2);
        } else {
          location.href = "admin.html";
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    btn.addEventListener("click", cadastrar);
    $("formCadastro").addEventListener("submit", cadastrar);

    // ====== ETAPA 2 — Dados (obrigatória) ======

    // Máscara/busca de CEP (ViaCEP) + composição vêm do util compartilhado.
    EnderecoCep.ligarBuscaCep({
      cep: "wizCep", hint: "wizCepHint",
      logradouro: "wizLogradouro", numero: "wizNumero",
      bairro: "wizBairro", cidade: "wizCidade", uf: "wizUf",
    });

    $("btnDados").addEventListener("click", async (e) => {
      const tel         = $("wizTel").value.trim();
      const cep         = $("wizCep").value.trim();
      const logradouro  = $("wizLogradouro").value.trim();
      const numero      = $("wizNumero").value.trim();
      const bairro      = $("wizBairro").value.trim();
      const complemento = $("wizComplemento").value.trim();
      const cidade      = $("wizCidade").value.trim();
      const uf          = $("wizUf").value.trim().toUpperCase();
      const e2 = $("erro2");
      e2.textContent = "";
      if (!tel) { e2.textContent = "Informe o telefone de contato."; return; }
      if (!logradouro || !numero || !cidade) {
        e2.textContent = "Preencha ao menos logradouro, número e cidade.";
        return;
      }

      // Campos estruturados + string composta (a que o resto do sistema usa).
      Object.assign(cfg.restaurante, { telefone: tel, cep, logradouro, numero, bairro, complemento, cidade, uf });
      cfg.restaurante.endereco = EnderecoCep.comporEndereco({ logradouro, numero, bairro, complemento, cidade, uf, cep });
      marcarEtapa(3);

      const b = e.currentTarget;
      b.disabled = true; b.textContent = "Salvando...";
      const ok = await salvarConfig();
      b.disabled = false; b.textContent = "Continuar →";
      if (ok) irPara(3);
      else e2.textContent = "Não foi possível salvar. Tente de novo.";
    });

    // ====== ETAPA 3 — Horário (pulável) ======
    function renderHorariosWiz() {
      const tb = $("wizHorariosBody");
      if (tb.dataset.pronto) return; // monta uma vez (preserva edições ao voltar)
      tb.dataset.pronto = "1";
      const h = cfg.horarios || {};
      tb.innerHTML = "";
      for (const [key, label] of DIAS) {
        const d = h[key] || { abre: "11:00", fecha: "22:00", fechado: false };
        const fechado = !!d.fechado;
        const tr = document.createElement("tr");
        tr.className = "hor-linha" + (fechado ? " hor-fechado" : "");
        tr.innerHTML = `
          <td class="hor-dia" data-label="Dia">${label}</td>
          <td data-label="Abre"><input type="time" id="wh_abre_${key}" class="hor-time" value="${d.abre || "11:00"}" ${fechado ? "disabled" : ""} /></td>
          <td data-label="Fecha"><input type="time" id="wh_fecha_${key}" class="hor-time" value="${d.fecha || "22:00"}" ${fechado ? "disabled" : ""} /></td>
          <td data-label="Fechado" class="hor-fechado-cel"><label class="switch"><input type="checkbox" id="wh_fechado_${key}" ${fechado ? "checked" : ""} /></label></td>`;
        tb.appendChild(tr);
        tr.querySelector(`#wh_fechado_${key}`).addEventListener("change", (ev) => {
          const f = ev.target.checked;
          tr.querySelector(`#wh_abre_${key}`).disabled = f;
          tr.querySelector(`#wh_fecha_${key}`).disabled = f;
          tr.classList.toggle("hor-fechado", f);
        });
      }
    }
    function lerHorariosWiz() {
      const h = {};
      for (const [key] of DIAS) {
        h[key] = {
          abre:    ($("wh_abre_" + key)  || {}).value || "11:00",
          fecha:   ($("wh_fecha_" + key) || {}).value || "22:00",
          fechado: !!($("wh_fechado_" + key) || {}).checked,
        };
      }
      return h;
    }

    $("btnVoltar3").addEventListener("click", () => irPara(2));
    $("btnPularHorario").addEventListener("click", async () => {
      marcarEtapa(4); await salvarConfig(); irPara(4);
    });
    $("btnHorario").addEventListener("click", async (e) => {
      cfg.horarios = lerHorariosWiz();
      marcarEtapa(4);
      const b = e.currentTarget;
      b.disabled = true; b.textContent = "Salvando...";
      const ok = await salvarConfig();
      b.disabled = false; b.textContent = "Salvar e continuar →";
      if (ok) irPara(4);
      else $("erro3").textContent = "Não foi possível salvar. Tente de novo.";
    });

    // ====== ETAPA 4 — Entrega (pulável) ======
    function renderEntregaWiz() {
      Dinheiro.setValor("wizTaxa", cfg.atendimento.taxaEntrega || 0);
      Dinheiro.mascarar("wizTaxa");
      renderPagsWiz();
    }
    function renderPagsWiz() {
      const cont = $("wizPagamentos");
      cont.innerHTML = "";
      cfg.pagamentos.forEach((p, i) => {
        const pill = document.createElement("span");
        pill.className = "pag-pill";
        pill.innerHTML = `<span class="pag-pill-txt"></span><button type="button" class="pag-pill-del" aria-label="Remover">×</button>`;
        pill.querySelector(".pag-pill-txt").textContent = p;
        pill.querySelector(".pag-pill-del").addEventListener("click", () => { cfg.pagamentos.splice(i, 1); renderPagsWiz(); });
        cont.appendChild(pill);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "pag-add";
      add.id = "wizAddPag";
      add.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar`;
      add.addEventListener("click", addPagInline);
      cont.appendChild(add);
    }
    function addPagInline() {
      const cont = $("wizPagamentos");
      if (cont.querySelector(".pag-input")) { cont.querySelector(".pag-input").focus(); return; }
      const add = $("wizAddPag");
      const input = document.createElement("input");
      input.className = "pag-input";
      input.placeholder = "Nome do método";
      cont.insertBefore(input, add);
      input.focus();
      let confirmado = false;
      const commit = () => {
        if (confirmado) return;
        confirmado = true;
        const v = input.value.trim();
        if (v) cfg.pagamentos.push(v);
        renderPagsWiz();
      };
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); commit(); }
        else if (ev.key === "Escape") { confirmado = true; renderPagsWiz(); }
      });
      input.addEventListener("blur", commit);
    }

    $("btnVoltar4").addEventListener("click", () => irPara(3));
    $("btnPularEntrega").addEventListener("click", async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      await concluirOnboarding();
      irParaPlano();
    });
    $("btnEntrega").addEventListener("click", async (e) => {
      cfg.atendimento.taxaEntrega = Dinheiro.valor("wizTaxa");
      const b = e.currentTarget;
      b.disabled = true; b.textContent = "Salvando...";
      concluirMarca();
      const ok = await salvarConfig();
      if (ok) { irParaPlano(); return; }
      b.disabled = false; b.textContent = "Concluir →";
      $("erro4").textContent = "Não foi possível salvar. Tente de novo.";
    });

    // ====== Onboarding: progresso e retomada ======
    function marcarEtapa(n) {
      cfg.onboarding = cfg.onboarding || { concluido: false, etapa: 2 };
      cfg.onboarding.etapa = n;
    }
    function concluirMarca() {
      cfg.onboarding = cfg.onboarding || { concluido: false, etapa: 4 };
      cfg.onboarding.concluido = true;
    }
    async function concluirOnboarding() {
      concluirMarca();
      await salvarConfig();
    }

    // Preenche a Etapa 2 a partir do config salvo (usado ao retomar o cadastro).
    function preencherDados() {
      const r = (cfg && cfg.restaurante) || {};
      $("wizTel").value = r.telefone || "";
      $("wizCep").value = r.cep || "";
      $("wizLogradouro").value = r.logradouro || "";
      $("wizNumero").value = r.numero || "";
      $("wizBairro").value = r.bairro || "";
      $("wizComplemento").value = r.complemento || "";
      $("wizCidade").value = r.cidade || "";
      $("wizUf").value = r.uf || "";
    }

    // Boot: se já há sessão (veio do login ou recarregou), retoma o wizard de onde
    // parou; se o onboarding já terminou, vai pro painel. Sem sessão → Etapa 1.
    async function boot() {
      // Recarregou a página: tenta a sessão pelo cookie httpOnly (refresh token).
      try {
        const rr = await fetch("/api/refresh", { method: "POST" });
        if (!rr.ok) { irPara(1); return; }
        token = (await rr.json()).token;
      } catch (e) { irPara(1); return; }
      try {
        const cr = await fetch("/api/config", { headers: authHeaders() });
        if (!cr.ok) { irPara(1); return; }
        cfg = await cr.json();
        cfg.onboarding = cfg.onboarding || { concluido: false, etapa: 2 };
        if (cfg.onboarding.concluido) { location.href = "admin.html"; return; }
        preencherDados();
        irPara(cfg.onboarding.etapa || 2);
      } catch (e) {
        irPara(1);
      }
    }
    boot();

    // Abre Termos/Privacidade em modal (iframe) sem tirar o usuário do cadastro.
    // Fonte única de verdade: carrega a própria página em modo ?embed (sem nav/footer).
    (function () {
      const modal = document.getElementById("docModal");
      const frame = document.getElementById("docModalFrame");
      const loading = document.getElementById("docModalLoading");
      const titulo = document.getElementById("docModalTitulo");
      let ultimoFoco = null;
      let carregado = "";

      function abrir(doc) {
        const src = (doc === "privacidade" ? "privacidade.html" : "termos.html") + "?embed=1";
        titulo.textContent = doc === "privacidade" ? "Política de Privacidade" : "Termos de Uso";
        if (carregado !== src) {
          loading.style.display = "flex";
          frame.style.visibility = "hidden";
          frame.src = src;
          carregado = src;
        }
        ultimoFoco = document.activeElement;
        modal.classList.add("aberto");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        document.getElementById("docModalX").focus();
      }
      function fechar() {
        modal.classList.remove("aberto");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
      }

      frame.addEventListener("load", function () {
        if (!frame.src || frame.src === "about:blank") return;
        loading.style.display = "none";
        frame.style.visibility = "visible";
      });

      document.querySelectorAll("[data-doc]").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          abrir(a.getAttribute("data-doc"));
        });
      });
      document.getElementById("docModalX").addEventListener("click", fechar);
      document.getElementById("docModalFechar").addEventListener("click", fechar);
      document.getElementById("docModalAceitar").addEventListener("click", function () {
        const cb = document.getElementById("aceiteTermos");
        if (cb) cb.checked = true;
        fechar();
      });
      modal.addEventListener("click", function (e) { if (e.target === modal) fechar(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal.classList.contains("aberto")) fechar();
      });
    })();

// ============================================================
// Bindings sem handlers inline (CSP): form sem onsubmit, botoes de senha sem onclick.
// ============================================================
document.getElementById("formCadastro").addEventListener("submit", function (e) { e.preventDefault(); });
document.getElementById("olhoSenha").addEventListener("click", function () { toggleSenha("senha", "olhoSenha"); });
document.getElementById("olhoSenha2").addEventListener("click", function () { toggleSenha("senha2", "olhoSenha2"); });

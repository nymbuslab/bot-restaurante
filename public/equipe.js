(function () {
  "use strict";

  var PERFIS = {
    administrador: "Administrador",
    gerente: "Gerente",
    caixa: "Caixa",
    atendimento: "Atendimento",
    cozinha: "Cozinha",
    estoque_compras: "Estoque/Compras",
  };
  var PADROES = {};
  var ROTULOS = {
    "equipe.gerenciar": "Gerenciar equipe",
    "atividades.ver": "Ver atividades",
    "pedidos.ver": "Consultar pedidos",
    "pedidos.editar": "Editar pedidos",
    "pedidos.cancelar": "Cancelar vendas",
    "pdv.operar": "Operar o PDV",
    "mesas.operar": "Operar mesas",
    "caixa.abrir": "Abrir caixa",
    "caixa.movimentar": "Movimentar caixa",
    "caixa.fechar": "Fechar caixa",
    "cardapio.editar": "Editar produtos",
    "estoque.ver": "Consultar estoque",
    "estoque.movimentar": "Movimentar estoque",
    "clientes.ver": "Consultar clientes",
    "relatorios.ver": "Ver relatórios",
    "configuracoes.editar": "Editar configurações",
    "custos.ver": "Consultar custos",
    "compras.criar": "Criar compras",
    "compras.confirmar": "Confirmar compras",
  };
  var TODAS = Object.keys(ROTULOS);
  var estado = { funcionarios: [], dispositivos: [], filtro: "ativos", termo: "", editando: null };
  var gatilhoModal = null;
  function iniciarBloqueioInatividade(minutos) {
    var ultima = Number(sessionStorage.getItem("equipeUltimaAtividade")) || Date.now();
    function registrar(evento) {
      if (!evento.isTrusted) return;
      ultima = Date.now();
      sessionStorage.setItem("equipeUltimaAtividade", String(ultima));
    }
    ["pointerdown", "keydown", "touchstart"].forEach(function (nome) { document.addEventListener(nome, registrar, { passive: true }); });
    setInterval(function () {
      if (Date.now() - ultima >= minutos * 60000) {
        sessionStorage.removeItem("equipeSessao");
        sessionStorage.removeItem("equipeUltimaAtividade");
        location.replace("admin.html?operador=" + encodeURIComponent(painelSlug));
      }
    }, 1000);
  }

  function el(id) { return document.getElementById(id); }
  function escapar(valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function iniciais(nome) {
    return String(nome || "?").trim().split(/\s+/).slice(0, 2).map(function (parte) { return parte[0]; }).join("").toUpperCase();
  }
  function dataCurta(valor) {
    if (!valor) return "Nunca acessou";
    return "Último acesso " + new Date(valor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function mensagemResposta(status, padrao) {
    if (status === 401) return "A sessão terminou. Entre novamente.";
    if (status === 402) return "A assinatura precisa estar ativa para usar a equipe.";
    if (status === 403) return "Seu operador não tem permissão para esta ação.";
    if (status === 409) return "Este PIN já está em uso. Escolha outro.";
    if (status === 429) return "O PIN foi bloqueado por 15 minutos. O dono pode liberar antes.";
    return padrao;
  }

  function mostrarEstado(nome, texto) {
    ["equipeCarregando", "equipeVazio", "equipeErro", "equipeLista"].forEach(function (id) { if (el(id)) el(id).hidden = true; });
    if (el(nome)) el(nome).hidden = false;
    if (texto && el("equipeErroTexto")) el("equipeErroTexto").textContent = texto;
  }

  function corresponde(funcionario) {
    var bloqueado = funcionario.bloqueadoAte && new Date(funcionario.bloqueadoAte) > new Date();
    if (estado.filtro === "ativos" && (!funcionario.ativo || bloqueado)) return false;
    if (estado.filtro === "bloqueados" && !bloqueado) return false;
    if (estado.filtro === "arquivados" && funcionario.ativo) return false;
    var termo = estado.termo.toLowerCase();
    return !termo || funcionario.nome.toLowerCase().includes(termo) || (PERFIS[funcionario.perfil] || "").toLowerCase().includes(termo);
  }

  function renderEquipe() {
    var lista = el("equipeLista");
    if (!lista) return;
    var filtrados = estado.funcionarios.filter(corresponde);
    el("equipeTotalAtivos").textContent = String(estado.funcionarios.filter(function (f) { return f.ativo; }).length);
    el("equipeTotalBloqueados").textContent = String(estado.funcionarios.filter(function (f) { return f.bloqueadoAte && new Date(f.bloqueadoAte) > new Date(); }).length);
    el("equipeTotalDispositivos").textContent = String(estado.dispositivos.filter(function (d) { return !d.revogadoEm; }).length);
    if (!estado.funcionarios.length) { mostrarEstado("equipeVazio"); return; }

    lista.innerHTML = '<div class="equipe-linha equipe-linha-cabeca"><span>Funcionário</span><span>Perfil</span><span>Status</span><span></span></div>';
    if (!filtrados.length) {
      lista.innerHTML += '<div class="equipe-estado"><strong>Nenhum resultado</strong><p>Ajuste a busca ou o filtro.</p></div>';
    }
    filtrados.forEach(function (f) {
      var bloqueado = f.bloqueadoAte && new Date(f.bloqueadoAte) > new Date();
      var status = !f.ativo ? "Arquivado" : bloqueado ? "PIN bloqueado" : "Ativo";
      var classe = !f.ativo ? "arquivado" : bloqueado ? "bloqueado" : "";
      var linha = document.createElement("div");
      linha.className = "equipe-linha";
      linha.innerHTML = '<div class="equipe-pessoa"><span class="equipe-avatar">' + escapar(iniciais(f.nome)) + '</span><span><strong>' + escapar(f.nome) + '</strong><small>' + escapar(dataCurta(f.ultimoAcessoEm)) + '</small></span></div><span>' + escapar(PERFIS[f.perfil] || f.perfil) + '</span><span class="equipe-selo ' + classe + '">' + status + '</span><button type="button" class="secundario equipe-editar">Editar</button>';
      linha.querySelector("button").addEventListener("click", function () { abrirEditor(f); });
      lista.appendChild(linha);
    });
    mostrarEstado("equipeLista");
  }

  function renderDispositivos() {
    var lista = el("equipeDispositivosLista");
    if (!lista) return;
    lista.innerHTML = "";
    estado.dispositivos.filter(function (d) { return !d.revogadoEm; }).forEach(function (d) {
      var linha = document.createElement("div");
      linha.className = "equipe-dispositivo";
      linha.innerHTML = '<span><strong>' + escapar(d.nome) + '</strong><small class="sub">' + escapar(dataCurta(d.ultimoAcessoEm)) + '</small></span><button type="button" class="secundario">Revogar</button>';
      linha.querySelector("button").addEventListener("click", function () { revogarDispositivo(d); });
      lista.appendChild(linha);
    });
  }

  async function carregarEquipe() {
    if (!el("aba-equipe")) return;
    mostrarEstado("equipeCarregando");
    try {
      var resposta = await api("GET", "/api/equipe");
      if (!resposta || !resposta.ok) {
        mostrarEstado("equipeErro", mensagemResposta(resposta && resposta.status, "Confira a conexão e tente novamente."));
        return;
      }
      var dados = await resposta.json();
      estado.funcionarios = dados.funcionarios || [];
      PADROES = dados.padroes || {};
      var dispositivos = await api("GET", "/api/equipe/dispositivos");
      if (dispositivos && dispositivos.ok) estado.dispositivos = (await dispositivos.json()).dispositivos || [];
      else document.querySelector(".equipe-dispositivos").hidden = true;
      renderDispositivos();
      renderEquipe();
    } catch (_) {
      mostrarEstado("equipeErro", "Confira a conexão e tente novamente.");
    }
  }

  function preencherPerfis() {
    var select = el("equipePerfil");
    select.innerHTML = "";
    Object.keys(PERFIS).forEach(function (codigo) {
      var opcao = document.createElement("option");
      opcao.value = codigo;
      opcao.textContent = PERFIS[codigo];
      select.appendChild(opcao);
    });
  }

  function renderPermissoes(marcadas) {
    var caixa = el("equipePermissoes");
    caixa.innerHTML = "";
    TODAS.forEach(function (permissao) {
      var linha = document.createElement("div");
      linha.className = "equipe-permissao";
      linha.innerHTML = '<label for="equipePerm-' + escapar(permissao) + '">' + escapar(ROTULOS[permissao]) + '</label><input id="equipePerm-' + escapar(permissao) + '" type="checkbox" data-permissao="' + escapar(permissao) + '">';
      linha.querySelector("input").checked = marcadas.includes(permissao);
      caixa.appendChild(linha);
    });
  }

  function abrirEditor(funcionario) {
    gatilhoModal = document.activeElement;
    estado.editando = funcionario || null;
    el("equipeGavetaTitulo").textContent = funcionario ? "Editar funcionário" : "Adicionar funcionário";
    el("equipeGavetaSub").textContent = funcionario ? funcionario.nome : "Defina o perfil inicial e ajuste o acesso.";
    el("equipeNome").value = funcionario ? funcionario.nome : "";
    el("equipePerfil").value = funcionario ? funcionario.perfil : "caixa";
    el("equipeInatividade").value = String(funcionario ? funcionario.inatividadeMinutos : 15);
    el("equipeFuncionarioPin").value = "";
    el("equipeFuncionarioPin").required = !funcionario;
    el("equipeAtivo").checked = funcionario ? funcionario.ativo : true;
    el("equipeDesbloquear").hidden = !(funcionario && funcionario.bloqueadoAte && new Date(funcionario.bloqueadoAte) > new Date());
    el("equipeFormErro").textContent = "";
    renderPermissoes(funcionario ? funcionario.permissoes : PADROES.caixa || []);
    el("equipeGaveta").hidden = false;
    el("equipeNome").focus();
  }

  function fecharEditor() {
    el("equipeGaveta").hidden = true;
    if (gatilhoModal && gatilhoModal.focus) gatilhoModal.focus();
  }

  async function salvarFuncionario(evento) {
    evento.preventDefault();
    var nome = el("equipeNome").value.trim();
    var pin = el("equipeFuncionarioPin").value.trim();
    if (!nome) { el("equipeFormErro").textContent = "Informe o nome do funcionário."; el("equipeNome").focus(); return; }
    if ((!estado.editando || pin) && !/^\d{4}$/.test(pin)) { el("equipeFormErro").textContent = "O PIN deve ter quatro dígitos."; el("equipeFuncionarioPin").focus(); return; }
    var perfil = el("equipePerfil").value;
    var padrao = new Set(PADROES[perfil] || []);
    var ajustes = Array.from(document.querySelectorAll("#equipePermissoes [data-permissao]")).map(function (input) {
      return { permissao: input.dataset.permissao, permitido: input.checked };
    }).filter(function (ajuste) { return padrao.has(ajuste.permissao) !== ajuste.permitido; });
    var corpo = { nome: nome, perfil: perfil, inatividadeMinutos: Number(el("equipeInatividade").value), ativo: el("equipeAtivo").checked, ajustes: ajustes };
    if (pin) corpo.pin = pin;
    var botao = el("equipeSalvar");
    botao.disabled = true;
    botao.textContent = "Salvando...";
    try {
      var url = estado.editando ? "/api/equipe/" + estado.editando.id : "/api/equipe";
      var resposta = await api(estado.editando ? "PUT" : "POST", url, corpo);
      if (!resposta || !resposta.ok) {
        var erro = resposta ? await resposta.json().catch(function () { return {}; }) : {};
        el("equipeFormErro").textContent = erro.erro || mensagemResposta(resposta && resposta.status, "Não foi possível salvar o funcionário.");
        return;
      }
      fecharEditor();
      toast("Funcionário salvo.");
      await carregarEquipe();
    } catch (_) {
      el("equipeFormErro").textContent = "Confira a conexão e tente novamente.";
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar funcionário";
    }
  }

  async function autorizarDispositivo() {
    var nome = el("equipeDispositivoNome").value.trim();
    if (!nome) { toast("Informe um nome para o dispositivo.", "erro"); el("equipeDispositivoNome").focus(); return; }
    var resposta = await api("POST", "/api/equipe/dispositivos/autorizar", { nome: nome });
    if (!resposta || !resposta.ok) { toast(mensagemResposta(resposta && resposta.status, "Não foi possível autorizar o dispositivo."), "erro"); return; }
    var dispositivo = (await resposta.json()).dispositivo;
    localStorage.setItem("equipeDispositivo:" + painelSlug, dispositivo.token);
    localStorage.setItem("equipeDispositivoId:" + painelSlug, dispositivo.id);
    el("equipeDispositivoNome").value = "";
    toast("Dispositivo autorizado.");
    await carregarEquipe();
  }

  async function revogarDispositivo(dispositivo) {
    if (!await confirmar("Revogar dispositivo", "Os operadores deste dispositivo perderão o acesso.", "Revogar")) return;
    var resposta = await api("DELETE", "/api/equipe/dispositivos/" + dispositivo.id);
    if (!resposta || !resposta.ok) { toast("Não foi possível revogar o dispositivo.", "erro"); return; }
    if (localStorage.getItem("equipeDispositivoId:" + painelSlug) === dispositivo.id) {
      localStorage.removeItem("equipeDispositivo:" + painelSlug);
      localStorage.removeItem("equipeDispositivoId:" + painelSlug);
    }
    toast("Dispositivo revogado.");
    await carregarEquipe();
  }

  async function abrirOperador() {
    gatilhoModal = document.activeElement;
    var dispositivoToken = localStorage.getItem("equipeDispositivo:" + painelSlug);
    var bloqueado = new URLSearchParams(location.search).has("operador");
    el("equipeOperadorForm").querySelector('button[type="submit"]').disabled = false;
    if (bloqueado) { el("equipeOperadorModal").hidden = false; el("equipeOperadorFechar").hidden = true; }
    if (!dispositivoToken) {
      if (bloqueado) { el("equipeOperadorErro").textContent = "Peça ao dono que autorize este dispositivo novamente."; el("equipeOperadorForm").querySelector('button[type="submit"]').disabled = true; el("equipeEntrarDono").focus(); }
      else toast("Autorize este dispositivo na tela Equipe primeiro.", "erro");
      return;
    }
    var resposta = await fetch("/api/equipe/dispositivos/funcionarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: painelSlug, dispositivoToken: dispositivoToken }) });
    if (!resposta.ok) {
      if (bloqueado) { el("equipeOperadorErro").textContent = "Peça ao dono que autorize este dispositivo novamente."; el("equipeOperadorForm").querySelector('button[type="submit"]').disabled = true; el("equipeEntrarDono").focus(); }
      else toast("Este dispositivo não está autorizado.", "erro");
      return;
    }
    var funcionarios = (await resposta.json()).funcionarios || [];
    var select = el("equipeOperadorSelect");
    select.innerHTML = "";
    funcionarios.forEach(function (f) { var o = document.createElement("option"); o.value = f.id; o.textContent = f.nome + " · " + (PERFIS[f.perfil] || f.perfil); select.appendChild(o); });
    el("equipeOperadorErro").textContent = funcionarios.length ? "" : "Nenhum funcionário ativo neste restaurante.";
    el("equipePin").value = "";
    el("equipeOperadorModal").hidden = false;
    if (funcionarios.length) select.focus();
  }

  function fecharOperador() { if (new URLSearchParams(location.search).has("operador")) return; el("equipeOperadorModal").hidden = true; if (gatilhoModal && gatilhoModal.focus) gatilhoModal.focus(); }

  async function entrarOperador(evento) {
    evento.preventDefault();
    var pin = el("equipePin").value.trim();
    if (!/^\d{4}$/.test(pin)) { el("equipeOperadorErro").textContent = "Digite os quatro dígitos do PIN."; el("equipePin").focus(); return; }
    var dispositivoToken = localStorage.getItem("equipeDispositivo:" + painelSlug);
    var resposta = await fetch("/api/equipe/sessoes/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: painelSlug, funcionarioId: el("equipeOperadorSelect").value, pin: pin, dispositivoToken: dispositivoToken }) });
    if (!resposta.ok) {
      var erro = await resposta.json().catch(function () { return {}; });
      el("equipeOperadorErro").textContent = erro.erro || mensagemResposta(resposta.status, "Não foi possível entrar com este PIN.");
      return;
    }
    var sessao = (await resposta.json()).sessao;
    var encerrada = await fetch("/api/logout", { method: "POST" }).catch(function () { return null; });
    if (!encerrada || !encerrada.ok) {
      el("equipeOperadorErro").textContent = "Não foi possível encerrar a conta anterior. Tente novamente.";
      return;
    }
    sessionStorage.setItem("equipeSessao", JSON.stringify({ token: sessao.token, slug: painelSlug, nome: sessao.funcionario.nome }));
    sessionStorage.setItem("equipeUltimaAtividade", String(Date.now()));
    location.href = "admin.html";
  }

  function aplicarPermissoesNavegacao(ator) {
    if (!ator || ator.tipo === "dono") return;
    var permissoes = new Set(ator.permissoes || []);
    document.querySelectorAll("[data-abrir-atividades]").forEach(function (botao) { botao.hidden = !permissoes.has("atividades.ver"); });
    var regras = {
      dashboard: ["relatorios.ver"], pedidos: ["pedidos.ver"], pdv: ["pdv.operar"], mesas: ["mesas.operar"],
      caixa: ["caixa.abrir", "caixa.movimentar", "caixa.fechar"], cardapio: ["cardapio.editar", "pdv.operar", "mesas.operar"],
      categorias: ["cardapio.editar"], complementos: ["cardapio.editar"], estoque: ["estoque.ver"],
      config: ["configuracoes.editar"], simulador: ["configuracoes.editar"], assinatura: [], equipe: ["equipe.gerenciar"], atividades: ["atividades.ver"],
    };
    Object.keys(regras).forEach(function (aba) {
      var permitido = regras[aba].some(function (p) { return permissoes.has(p); });
      document.querySelectorAll('nav button[data-aba="' + aba + '"]').forEach(function (botao) { botao.hidden = !permitido; });
    });
    document.querySelectorAll(".btn-sair").forEach(function (botao) { botao.textContent = "Encerrar turno"; });
  }

  function iniciarEventos() {
    function comErro(funcao) {
      return function (evento) {
        Promise.resolve(funcao(evento)).catch(function () {
          if (!el("equipeOperadorModal").hidden) el("equipeOperadorErro").textContent = "Confira a conexão e tente novamente.";
          else toast("Confira a conexão e tente novamente.", "erro");
        });
      };
    }
    preencherPerfis();
    if (el("equipeAdicionar")) el("equipeAdicionar").addEventListener("click", function () { abrirEditor(null); });
    document.querySelectorAll("[data-equipe-adicionar]").forEach(function (b) { b.addEventListener("click", function () { abrirEditor(null); }); });
    if (el("equipeTentarNovamente")) el("equipeTentarNovamente").addEventListener("click", carregarEquipe);
    if (el("equipeBusca")) el("equipeBusca").addEventListener("input", function (e) { estado.termo = e.target.value || ""; renderEquipe(); });
    document.querySelectorAll("[data-equipe-filtro]").forEach(function (b) { b.addEventListener("click", function () { estado.filtro = b.dataset.equipeFiltro; document.querySelectorAll("[data-equipe-filtro]").forEach(function (x) { x.classList.toggle("ativo", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); renderEquipe(); }); });
    el("equipePerfil").addEventListener("change", function (e) { renderPermissoes(PADROES[e.target.value] || []); });
    el("equipeForm").addEventListener("submit", salvarFuncionario);
    el("equipeGavetaFechar").addEventListener("click", fecharEditor);
    el("equipeDescartar").addEventListener("click", fecharEditor);
    el("equipeDesbloquear").addEventListener("click", async function () {
      try {
        var resposta = await api("POST", "/api/equipe/" + estado.editando.id + "/desbloquear", {});
        if (!resposta || !resposta.ok) { el("equipeFormErro").textContent = "Não foi possível desbloquear o PIN."; return; }
        el("equipeDesbloquear").hidden = true;
        toast("PIN desbloqueado.");
        await carregarEquipe();
      } catch (_) { el("equipeFormErro").textContent = "Confira a conexão e tente novamente."; }
    });
    el("equipeGaveta").addEventListener("mousedown", function (e) { if (e.target === el("equipeGaveta")) fecharEditor(); });
    el("equipeAutorizarDispositivo").addEventListener("click", comErro(autorizarDispositivo));
    el("btnTrocarOperador").addEventListener("click", comErro(abrirOperador));
    el("btnTrocarOperadorMobile").addEventListener("click", comErro(abrirOperador));
    el("equipeOperadorFechar").addEventListener("click", fecharOperador);
    el("equipeOperadorForm").addEventListener("submit", comErro(entrarOperador));
    document.addEventListener("keydown", function (e) {
      var modal = !el("equipeOperadorModal").hidden ? el("equipeOperadorModal") : !el("equipeGaveta").hidden ? el("equipeGaveta") : null;
      if (!modal) return;
      if (e.key === "Escape") { e.preventDefault(); if (modal.id === "equipeOperadorModal") fecharOperador(); else fecharEditor(); }
      if (e.key === "Tab") {
        var alvos = Array.from(modal.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(function (n) { return n.getClientRects().length; });
        var primeiro = alvos[0], ultimo = alvos[alvos.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    });
  }

  window.carregarEquipe = carregarEquipe;
  var atividadesCursor = null, atividadesRequisicao = 0;
  var EVENTOS = { funcionario_criado: "Funcionário cadastrado", funcionario_alterado: "Funcionário alterado", permissoes_alteradas: "Permissões alteradas", dispositivo_autorizado: "Dispositivo autorizado", dispositivo_revogado: "Dispositivo revogado", sessao_iniciada: "Entrada por PIN", pin_incorreto: "PIN incorreto", pin_bloqueado: "PIN bloqueado", pin_desbloqueado: "PIN desbloqueado", permissao_negada: "Acesso negado" };
  async function carregarAtividades(mais) {
    var requisicao = ++atividadesRequisicao;
    if (!mais) { atividadesCursor = null; el("atividadesLista").innerHTML = ""; el("atividadesMais").hidden = true; el("atividadesLista").hidden = true; }
    ["atividadesVazio", "atividadesErro"].forEach(function (id) { el(id).hidden = true; });
    el("atividadesCarregando").hidden = false;
    el("atividadesMais").disabled = true;
    try {
      var parametros = new URLSearchParams({ limite: "30" });
      [["evento", "atividadesEvento"], ["atorId", "atividadesAtor"], ["desde", "atividadesDesde"], ["ate", "atividadesAte"]].forEach(function (par) { if (el(par[1]).value.trim()) parametros.set(par[0], el(par[1]).value.trim()); });
      if (mais && atividadesCursor) parametros.set("cursor", atividadesCursor);
      var resposta = await api("GET", "/api/equipe/atividades?" + parametros.toString());
      if (requisicao !== atividadesRequisicao) return;
      if (!resposta || !resposta.ok) {
        var erro = resposta ? await resposta.json().catch(function () { return {}; }) : {};
        throw new Error(erro.erro || mensagemResposta(resposta && resposta.status, "Não foi possível carregar atividades. Tente novamente."));
      }
      var dados = await resposta.json();
      if (requisicao !== atividadesRequisicao) return;
      var selecionado = el("atividadesAtor").value;
      el("atividadesAtor").innerHTML = '<option value="">Todos os operadores</option>';
      (dados.atores || []).forEach(function (ator) { var opcao = document.createElement("option"); opcao.value = ator.id; opcao.textContent = ator.nome; el("atividadesAtor").appendChild(opcao); });
      el("atividadesAtor").value = selecionado;
      dados.eventos.forEach(function (evento) {
        var linha = document.createElement("div"); linha.className = "atividades-linha";
        var operador = evento.atorNome || (evento.atorTipo === "dono" ? "Dono" : evento.atorTipo === "funcionario" ? "Operador" : "Sistema");
        linha.innerHTML = '<span>' + escapar(new Date(evento.criadoEm).toLocaleString("pt-BR")) + '</span><strong>' + escapar(EVENTOS[evento.evento] || evento.evento) + '</strong><span>' + escapar(operador) + '<small>' + escapar(evento.atorId ? evento.atorId.slice(0, 8) : "") + '</small></span><button type="button" class="secundario">Detalhes</button>';
        linha.querySelector("button").addEventListener("click", function () {
          el("atividadesDetalheTitulo").textContent = EVENTOS[evento.evento] || evento.evento;
          el("atividadesDetalheResumo").textContent = operador + (evento.atorId ? " · " + evento.atorId : "") + " · " + new Date(evento.criadoEm).toLocaleString("pt-BR");
          el("atividadesDetalheDados").textContent = JSON.stringify(evento.detalhe, null, 2);
          el("atividadesDetalhe").showModal();
        });
        el("atividadesLista").appendChild(linha);
      });
      atividadesCursor = dados.proximoCursor;
      el("atividadesLista").hidden = !el("atividadesLista").children.length;
      el("atividadesVazio").hidden = !!el("atividadesLista").children.length;
      el("atividadesMais").hidden = !atividadesCursor;
    } catch (erro) {
      if (requisicao !== atividadesRequisicao) return;
      el("atividadesErroTexto").textContent = erro.message;
      el("atividadesErro").hidden = false;
    } finally {
      if (requisicao === atividadesRequisicao) { el("atividadesCarregando").hidden = true; el("atividadesMais").disabled = false; }
    }
  }
  function iniciarAtividades() {
    Object.keys(EVENTOS).forEach(function (codigo) { var opcao = document.createElement("option"); opcao.value = codigo; opcao.textContent = EVENTOS[codigo]; el("atividadesEvento").appendChild(opcao); });
    el("atividadesFiltros").addEventListener("submit", function (evento) { evento.preventDefault(); carregarAtividades(); });
    el("atividadesLimpar").addEventListener("click", function () { el("atividadesFiltros").reset(); carregarAtividades(); });
    el("atividadesMais").addEventListener("click", function () { carregarAtividades(true); });
    el("atividadesTentar").addEventListener("click", function () { carregarAtividades(); });
    el("atividadesDetalheFechar").addEventListener("click", function () { el("atividadesDetalhe").close(); });
    document.querySelectorAll("[data-abrir-atividades]").forEach(function (botao) { botao.addEventListener("click", function () { document.querySelector('nav button[data-aba="atividades"]').click(); }); });
  }
  window.carregarAtividades = carregarAtividades;
  window.aplicarPermissoesNavegacao = aplicarPermissoesNavegacao;
  window.abrirOperador = abrirOperador;
  window.iniciarBloqueioInatividade = iniciarBloqueioInatividade;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { iniciarEventos(); iniciarAtividades(); });
  else { iniciarEventos(); iniciarAtividades(); }
})();

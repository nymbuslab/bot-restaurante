from pathlib import Path
from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:4174"
ARQUIVOS = Path(__file__).resolve().parent / "resultados"


def responder_api(route):
    path = route.request.url.split(BASE, 1)[-1]
    method = route.request.method
    if path == "/api/refresh":
        body = {"token": "dono.jwt.teste", "slug": "restaurante-teste", "nome": "Restaurante teste"}
    elif path == "/api/equipe" and method == "GET":
        body = {"funcionarios": [
            {"id": "1", "nome": "Gerência", "perfil": "gerente", "ativo": True, "tentativasPin": 0, "bloqueadoAte": None, "inatividadeMinutos": 15, "ultimoAcessoEm": "2026-09-14T12:00:00Z", "permissoes": ["equipe.gerenciar", "pedidos.ver"]},
            {"id": "2", "nome": "Operador do caixa", "perfil": "caixa", "ativo": True, "tentativasPin": 5, "bloqueadoAte": "2099-09-14T12:15:00Z", "inatividadeMinutos": 15, "ultimoAcessoEm": "2026-09-14T11:00:00Z", "permissoes": ["pedidos.ver", "pdv.operar", "mesas.operar", "caixa.abrir", "caixa.movimentar", "caixa.fechar"]},
        ]}
    elif path == "/api/equipe/dispositivos" and method == "GET":
        body = {"dispositivos": [{"id": "d1", "nome": "PDV do balcão", "autorizadoEm": "2026-09-14T10:00:00Z", "ultimoAcessoEm": None, "revogadoEm": None}]}
    elif path == "/api/status":
        body = {"status": "desconectado"}
    elif path == "/api/cardapio":
        body = {"categorias": []}
    elif path == "/api/config":
        body = {"restaurante": {"nome": "Restaurante teste"}, "atendimento": {"aberto": True}, "pagamentos": ["Dinheiro"]}
    elif path == "/api/conta":
        body = {"email": "teste@example.invalid"}
    elif path == "/api/assinatura":
        body = {"status": "cortesia", "plano": "completo", "acessoLiberado": True}
    elif path.startswith("/api/dashboard"):
        body = {}
    elif path.startswith("/api/pedidos"):
        body = [] if path == "/api/pedidos" else {"numero": 0}
    elif path == "/api/cardapio/link":
        body = {"url": "", "qr": ""}
    else:
        body = {}
    route.fulfill(status=200, json=body)


def validar_viewport(browser, largura, altura, nome):
    page = browser.new_page(viewport={"width": largura, "height": altura})
    erros = []
    page.on("pageerror", lambda erro: erros.append(str(erro)))
    page.route("**/api/**", responder_api)
    page.route("https://js.stripe.com/**", lambda route: route.fulfill(status=200, body=""))
    page.goto(BASE + "/admin.html")
    page.wait_for_selector('nav button[data-aba="equipe"]')
    page.wait_for_load_state("networkidle")
    if largura < 700:
        page.locator("#btnMenuMobile").click()
    page.locator('nav button[data-aba="equipe"]').click()
    page.wait_for_selector("#equipeLista:not([hidden])")

    assert page.locator("#equipeLista .equipe-linha").count() == 2
    page.locator('[data-equipe-filtro="bloqueados"]').click()
    assert page.locator("#equipeLista .equipe-linha").count() == 2
    assert page.locator("#equipeLista").inner_text().find("PIN bloqueado") >= 0
    page.locator('[data-equipe-filtro="ativos"]').click()
    page.locator("#equipeAdicionar").evaluate("n => Promise.all(n.getAnimations().map(a => a.finished))")
    assert page.locator("#equipeTotalAtivos").inner_text() == "2"
    assert page.locator("#equipeTotalBloqueados").inner_text() == "1"
    ARQUIVOS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARQUIVOS / f"{nome}.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), page.evaluate("Array.from(document.querySelectorAll('body *')).filter(n => n.getBoundingClientRect().right > innerWidth && n.getClientRects().length).map(n => n.id || n.className).slice(0, 20)")

    for seletor in ["#equipeAdicionar", "#equipeBusca", ".equipe-editar"]:
        caixa = page.locator(seletor).first.bounding_box()
        assert caixa and caixa["height"] >= 44, f"alvo menor que 44px: {seletor} {caixa}, minHeight={page.locator(seletor).first.evaluate('(n) => getComputedStyle(n).minHeight')}"

    page.locator("#equipeAdicionar").click()
    assert page.locator("#equipeGaveta").is_visible()
    assert page.locator("#equipeNome").evaluate("(n) => document.activeElement === n")
    page.locator("#equipeGavetaFechar").focus()
    page.keyboard.press("Shift+Tab")
    assert page.locator("#equipeSalvar").evaluate("(n) => document.activeElement === n")
    page.keyboard.press("Escape")
    assert not page.locator("#equipeGaveta").is_visible()

    ARQUIVOS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARQUIVOS / f"{nome}.png"), full_page=True)
    assert not erros, "erros no navegador: " + " | ".join(erros)
    page.close()


with sync_playwright() as playwright:
    navegador = playwright.chromium.launch(headless=True)
    validar_viewport(navegador, 1280, 900, "equipe-desktop")
    validar_viewport(navegador, 375, 812, "equipe-mobile")
    navegador.close()

print("OK: equipe desktop e mobile validados")

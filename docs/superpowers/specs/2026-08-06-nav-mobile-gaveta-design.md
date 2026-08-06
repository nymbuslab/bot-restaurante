---
doc: spec
titulo: Navegação mobile — barra inferior + gaveta (hambúrguer)
data: 2026-08-06
status: aprovado
escopo: Camada de navegação mobile (só @media ≤640px); desktop intacto
---

# Navegação mobile — barra inferior + gaveta

## Problema

No mobile o `.sidebar` vira uma fileira horizontal fixa (`bottom:0`) com todos os itens
(9 hoje, e a lista cresce com a evolução p/ ERP). Fica lotada e difícil de tocar.

## Decisão (confirmada)

Padrão híbrido, **decisão de layout delegada ao agente**: **barra inferior com 4 atalhos**
(as telas do dia a dia) **+ um 5º botão "Menu" (hambúrguer)** que abre uma **gaveta**
(drawer) com a navegação completa. Tudo na zona do polegar (base da tela). Motivo de
preferir isto ao hambúrguer no topo: alcance do polegar em telas grandes.

- **Atalhos da barra (escolha do dono):** Dashboard, Pedidos (com badge), PDV, Caixa.
- **Gaveta:** reaproveita o `.sidebar` completo (marca + acordeão Cadastros/Financeiro/
  Relatórios + Mesas, Config, Prévia, Assinatura + "Em breve" + Ajuda/Sair). Desliza da
  esquerda sobre backdrop.

## Comportamento

- **Menu (≡):** abre a gaveta. Fecha ao: tocar num item de nav, tocar no backdrop, Esc, ou
  no X da gaveta.
- **Atalho da barra:** troca a tela (fluxo atual).
- **Estado ativo sincronizado:** o handler passa a marcar `.ativo`/`aria-current` em TODOS
  os botões da mesma `data-aba` (barra + gaveta acendem juntas).
- **Badge de Pedidos:** também na barra (`#badge-pedidos-mob`); `atualizarBadgePedidos`
  atualiza os dois ids.
- **Acessibilidade:** gaveta contém o foco (via `inert` no `.conteudo` e `.mobile-bar`
  enquanto aberta), Esc fecha, foco volta pro botão Menu; backdrop com scrim; `aria-expanded`
  no Menu, `aria-controls` apontando o sidebar.

## Técnico (arquivos)

- `public/admin.html` — id no `<aside class="sidebar">`; botão X (`.drawer-fechar`) na
  marca (só mobile); **barra inferior** `<nav class="mobile-bar">` (4 atalhos `data-aba` +
  botão Menu) e **backdrop** `<div class="drawer-backdrop" hidden>` antes dos scripts.
- `public/app.js` — bloco da gaveta (`abrirDrawer`/`fecharDrawer` com `inert` + Esc +
  backdrop + X); sincronizar ativo por `data-aba` (handler + boot antecipado); badge dual;
  fechar gaveta ao navegar.
- `public/style.css` — reescreve o bloco `@media (max-width:640px)`: `.sidebar` deixa de
  virar bottom-nav e vira **gaveta off-canvas** (`transform:translateX(-100%)` → `.aberta`);
  reexibe `.sidebar-marca`/`.sidebar-rodape`; **remove o flatten do acordeão** (a gaveta
  mostra os grupos normalmente); estilos de `.mobile-bar`, `.drawer-backdrop`, `.drawer-fechar`
  (todos `display:none` no desktop).

## Fora de escopo

Desktop (inalterado) e a lógica das telas. Só a navegação mobile.

## Critério de pronto

- Mobile: barra inferior com os 4 atalhos + Menu; Menu abre/fecha a gaveta; gaveta mostra o
  acordeão completo e navega; ativo sincronizado; Esc/backdrop/X fecham; badge nos dois lugares.
- Desktop sem regressão. `npm run check` + testes passam; validação visual no harness mobile.

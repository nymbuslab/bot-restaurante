---
expx_schema: 1
expx_tool: sprintx
kind: base_indice
trabalho_id: correcoes-auditoria-design-system
atualizado_em: 2026-09-05
areas:
  - arquivo: 00-toasts-e-botoes-fechar.md
    titulo: Toasts e botoes de fechar (acessibilidade)
    lacunas: 0
  - arquivo: 01-contraste-cor.md
    titulo: Contraste de cor text-secondary sobre bg-overlay
    lacunas: 0
  - arquivo: 02-estados-carregamento-e-erro.md
    titulo: Estados de carregamento e erro vs caixa fechado
    lacunas: 1
  - arquivo: 03-cardapio-estados-vazios.md
    titulo: Cardapio - estados vazios de tenant novo e busca
    lacunas: 0
  - arquivo: 04-campo-vs-auth-campo.md
    titulo: Campo vs auth-campo - duplicacao de primitivo de formulario
    lacunas: 0
  - arquivo: 05-heading-painel-master.md
    titulo: Hierarquia de heading duplicada no painel master
    lacunas: 0
  - arquivo: 06-button-mini-touch.md
    titulo: button.mini abaixo da altura minima de toque
    lacunas: 1
  - arquivo: 07-pdv-breakpoint.md
    titulo: Breakpoint do PDV descasado do da sidebar
    lacunas: 0
  - arquivo: 08-abas-configuracoes-editor.md
    titulo: Abas dentro de Configuracoes e do editor de item
    lacunas: 1
  - arquivo: 09-padroes-de-teste-frontend.md
    titulo: Padroes de teste do projeto e lacuna de teste para front-end estatico
    lacunas: 1
---

# Índice da base — correcoes-auditoria-design-system

Feature: corrigir os 12 achados Alto (6) / Médio (5) / Baixo (1) da auditoria de design system
registrada em `docs/design-system/AUDIT.md` (veredito geral REPROVADO). Os 2 Bloqueios da mesma
auditoria (paginação de Pedidos e confirmação de exclusão sem nome) ficam FORA deste trabalho.

| Arquivo | Área | Resumo |
|---|---|---|
| `00-toasts-e-botoes-fechar.md` | Acessibilidade — toast e botão fechar | Alto #1 (`aria-live` no toast) e Alto #2 (`aria-label` em 3 botões `✕`) |
| `01-contraste-cor.md` | Contraste de cor | Alto #3 — `--text-secondary` sobre `--bg-overlay` abaixo de AA |
| `02-estados-carregamento-e-erro.md` | Estados de tela | Alto #4 (sem "carregando") e Alto #5 (erro de rede confundido com caixa fechado) |
| `03-cardapio-estados-vazios.md` | Cardápio | Alto #6 (tenant novo sem estado vazio) e Médio #3 (busca vazia fora do padrão) |
| `04-campo-vs-auth-campo.md` | Formulário | Médio #1 — `.campo` e `.auth-campo` duplicados |
| `05-heading-painel-master.md` | Semântica/heading | Médio #2 — dois `<h1>` simultâneos no painel master |
| `06-button-mini-touch.md` | Botão/toque | Médio #4 — `button.mini` abaixo da altura mínima de toque |
| `07-pdv-breakpoint.md` | Responsividade | Médio #5 — breakpoint do PDV descasado do da sidebar |
| `08-abas-configuracoes-editor.md` | Navegação | Baixo #1 — abas dentro de Configurações/editor (observação, sem correção prescrita) |
| `09-padroes-de-teste-frontend.md` | Testes (transversal) | Framework de teste do projeto e a lacuna de teste automatizado para front-end estático |

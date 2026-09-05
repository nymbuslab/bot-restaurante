---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: correcoes-auditoria-design-system
sprint_id: sprint-02
atualizado_em: 2026-09-05
fases:
  - id: F-02.1
    titulo: Acessibilidade de componentes
    status: concluida
    criterio_saida: Testes estaticos de T-02.01, T-02.02 e T-02.12 verdes
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.01, T-02.02, T-02.12]
  - id: F-02.2
    titulo: Contraste de cor
    status: concluida
    criterio_saida: Teste estatico de T-02.03 verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.03]
  - id: F-02.3
    titulo: Estados de carregamento e erro
    status: concluida
    criterio_saida: Testes estaticos de T-02.04 e T-02.05 verdes
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.04, T-02.05]
  - id: F-02.4
    titulo: Cardapio - estados vazios
    status: concluida
    criterio_saida: Testes estaticos de T-02.06 e T-02.07 verdes
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.06, T-02.07]
  - id: F-02.5
    titulo: Consistencia de padroes
    status: concluida
    criterio_saida: Testes estaticos de T-02.08, T-02.09 e T-02.10 verdes
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.08, T-02.09, T-02.10]
  - id: F-02.6
    titulo: Responsividade do PDV
    status: concluida
    criterio_saida: Teste estatico de T-02.11 verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.11]
---

# Fases — Sprint 02

<!-- Nenhuma das 12 tasks desta sprint declara depende_de: todas têm depende_de: []. A
     dependência do helper de teste (T-01.01, sprint-01) é estrutural, garantida pela ordem das
     sprints, não uma dependência funcional entre tasks — por isso o grafo abaixo não tem
     nenhuma aresta. O paralelismo real entre as tasks é limitado pelos arquivos que cada uma
     altera (a maioria toca public/app.js, public/admin.html ou public/style.css, que se
     repetem entre fases); por isso quase todas as fases foram declaradas sequenciais por
     decisão de plano. Exceção: T-02.09 (fase F-02.5) é paralelizavel: true, por não conflitar
     com nenhum arquivo de outra task (achado MÉDIA da F5, 00-AUDITORIA.md). -->

```mermaid
%% Grafo de tasks — sprint-02 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 — Acessibilidade de componentes"]
    T_02_01["T-02.01<br/>Toast aria-live e role"]
    T_02_02["T-02.02<br/>Aria-label em botoes fechar"]
    T_02_12["T-02.12<br/>Abas editor tablist/tab"]
  end
  subgraph fase_02_2["F-02.2 — Contraste de cor"]
    T_02_03["T-02.03<br/>Token --text-secondary-fg"]
  end
  subgraph fase_02_3["F-02.3 — Estados de carregamento e erro"]
    T_02_04["T-02.04<br/>Estado carregando 4 telas"]
    T_02_05["T-02.05<br/>Erro de rede com retry"]
  end
  subgraph fase_02_4["F-02.4 — Cardapio: estados vazios"]
    T_02_06["T-02.06<br/>Estado vazio tenant novo"]
    T_02_07["T-02.07<br/>Estado vazio busca cardapio"]
  end
  subgraph fase_02_5["F-02.5 — Consistencia de padroes"]
    T_02_08["T-02.08<br/>Unificar campo e auth-campo"]
    T_02_09["T-02.09<br/>Heading painel master"]
    T_02_10["T-02.10<br/>Modificador mini-lista"]
  end
  subgraph fase_02_6["F-02.6 — Responsividade do PDV"]
    T_02_11["T-02.11<br/>Breakpoint PDV 1100px"]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_02_01 concluida
  class T_02_02 concluida
  class T_02_03 concluida
  class T_02_04 concluida
  class T_02_05 concluida
  class T_02_06 concluida
  class T_02_07 concluida
  class T_02_08 concluida
  class T_02_09 concluida
  class T_02_10 concluida
  class T_02_11 concluida
  class T_02_12 concluida
  class T_02_01 critico
```

> Um bloco por fase. O paralelismo declarado aqui é definitivo: a execução nunca decide
> paralelismo sozinha. Todas as fases desta sprint foram declaradas sequenciais por decisão de
> plano — a maioria das tasks toca os mesmos três arquivos (`public/app.js`,
> `public/admin.html`, `public/style.css`), então rodar fases em paralelo arriscaria duas tasks
> escrevendo no mesmo arquivo ao mesmo tempo.

---

## F-02.1 — Acessibilidade de componentes

**Objetivo:** Corrigir os achados Alto #1 (toast sem `aria-live`), Alto #2 (botões `✕` sem
`aria-label`, incluindo o 4º botão de D-09) e Baixo #1 (abas do editor sem `role` ARIA).

**Tasks que a compõem:** T-02.01, T-02.02, T-02.12

**Critério de saída:** Os 3 testes estáticos correspondentes passam.

**Roda em paralelo com:** nenhuma

---

## F-02.2 — Contraste de cor

**Objetivo:** Corrigir o achado Alto #3 (`--text-secondary` sobre `--bg-overlay` abaixo do
mínimo AA), criando o token `--text-secondary-fg`.

**Tasks que a compõem:** T-02.03

**Critério de saída:** O teste estático passa.

**Roda em paralelo com:** nenhuma

---

## F-02.3 — Estados de carregamento e erro

**Objetivo:** Corrigir os achados Alto #4 (sem indicador de carregando em 4 telas) e Alto #5
(erro de rede confundido com "caixa fechado" no PDV e em Mesas).

**Tasks que a compõem:** T-02.04, T-02.05

**Critério de saída:** Os 2 testes estáticos passam.

**Roda em paralelo com:** nenhuma

---

## F-02.4 — Cardápio: estados vazios

**Objetivo:** Corrigir os achados Alto #6 (tenant novo sem estado vazio) e Médio #3 (busca sem
resultado fora do padrão `.estado-vazio`).

**Tasks que a compõem:** T-02.06, T-02.07

**Critério de saída:** Os 2 testes estáticos passam.

**Roda em paralelo com:** nenhuma

---

## F-02.5 — Consistência de padrões

**Objetivo:** Corrigir os achados Médio #1 (`.campo`/`.auth-campo` duplicados), Médio #2
(heading duplicado no painel master) e Médio #4 (`button.mini` abaixo da altura de toque).

**Tasks que a compõem:** T-02.08, T-02.09, T-02.10

**Critério de saída:** Os 3 testes estáticos passam.

**Roda em paralelo com:** nenhuma

---

## F-02.6 — Responsividade do PDV

**Objetivo:** Corrigir o achado Médio #5 (breakpoint do PDV descasado do da sidebar).

**Tasks que a compõem:** T-02.11

**Critério de saída:** O teste estático passa.

**Roda em paralelo com:** nenhuma

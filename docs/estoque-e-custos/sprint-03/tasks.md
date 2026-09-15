# Tasks — Sprint 03

```yaml
id: T-03.01
titulo: Protótipo de Gestão de equipe
objetivo: Desenhar lista, editor, permissões, PIN, bloqueio, dispositivos e Atividades em desktop e mobile.
arquivos:
  cria: [design/canvas/equipe-desktop.dc.html, design/canvas/equipe-mobile.dc.html]
  altera: []
teste_integracao: O protótipo representa todos os contratos da API de equipe.
teste_funcional: Teclado, Escape, foco e alvos de 44 px estão especificados em cada fluxo.
criterio_aceite: A aprovação do usuário está registrada antes de T-03.02.
depende_de: [T-02.04]
paralelizavel: false
status: concluido
evidencia: docs/estoque-e-custos/prototipos/gestao-equipe.md
aprovado_em: 2026-09-14
```

```yaml
id: T-03.02
titulo: Interface de equipe e operador
objetivo: Implementar gestão de funcionários, perfis, troca por PIN e bloqueio por inatividade.
arquivos:
  cria: [public/equipe.js]
  altera: [public/admin.html, public/app.js, public/style.css]
teste_integracao: A interface consome as rotas reais e reflete 401, 402, 403, 409 e 429.
teste_funcional: Dono cria funcionário e o funcionário troca de operador e acessa somente áreas permitidas.
criterio_aceite: Fluxos desktop e mobile correspondem ao protótipo aprovado.
depende_de: [T-03.01]
paralelizavel: false
status: concluido
concluido_em: 2026-09-15
suite: CI 753/753; integracao 86/86; sintaxe 180 arquivos; Playwright desktop/mobile e fluxo real de equipe/PIN/inatividade.
evidencia: docs/equipe.md; test/integracao/equipe-compatibilidade.test.js; test/visual/equipe-real.py; test/visual/equipe-ui.py.
confirmacao_dev: Usuario confirmou que o painel abriu apos reiniciar npm start; nenhuma migration ou ativacao em producao.
divergencias: Rotas e servicos de listagem/edicao foram necessarios alem dos arquivos previstos; consultas legadas receberam compatibilidade com schema anterior.
```

```yaml
id: T-03.03
titulo: Atividades e rollout de equipe
objetivo: Expor auditoria filtrável e homologar o gate separado de equipe.
arquivos:
  cria: [src/auditoria-operacional.js, test/integracao/equipe.test.js]
  altera: [src/servidor.js, public/equipe.js]
teste_integracao: Eventos de PIN, permissão e mutação ficam ligados ao ator e ao tenant.
teste_funcional: Revogar dispositivo interrompe o operador e o dono encontra o evento na tela.
criterio_aceite: O tenant de teste conclui o ciclo de equipe com a flag ligada e outro tenant permanece sem alteração.
depende_de: [T-03.02]
paralelizavel: false
status: concluido
concluido_em: 2026-09-15
suite: CI 754/754; integracao 92/92; sintaxe 183 arquivos; Playwright ciclo real desktop/mobile, revogacao, cursor, detalhes, vazio e erro/retry.
evidencia: docs/equipe.md; test/integracao/equipe.test.js; test/visual/equipe-real.py; test/visual/resultados/atividades-desktop.png; test/visual/resultados/atividades-mobile.png.
divergencias: Migration aditiva de auditoria, alteracoes transacionais em equipe-db, HTML/CSS e fixtures/testes adicionais; prefixo 20260915100000 exige renumerar a migration planejada de T-04.01 antes de cria-la.
```

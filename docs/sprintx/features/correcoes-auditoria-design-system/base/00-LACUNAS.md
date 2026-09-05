# Lacunas

- **`02-estados-carregamento-e-erro.md`** — NÃO DOCUMENTADO qual texto/comportamento exato o dono
  quer para o estado de erro de rede em PDV/Mesas (mensagem "tente de novo"? botão de retry?).
  Procurado em `public/app.js` (funções `carregarPdv`/`carregarMesas`) e não há precedente de
  helper de "estado de erro genérico" reutilizável no projeto. Vira pergunta obrigatória da F2.
- **`06-button-mini-touch.md`** — NÃO DOCUMENTADO se o dono prefere aumentar `.mini` globalmente
  (risco de regressão visual ampla) ou criar um modificador novo só para contexto de
  lista/mobile. Procurado em `docs/design-system.md`/`DESIGN-SYSTEM.md` e não há diretriz de
  tamanho mínimo de toque adotada pelo projeto. Vira pergunta obrigatória da F2.
- **`08-abas-configuracoes-editor.md`** — NÃO DOCUMENTADO se o dono quer (a) só registrar que o
  achado Baixo #1 foi revisado e não precisa de mudança, ou (b) adicionar `role="tablist"`/
  `role="tab"` ao `.editor-tabs` por consistência ARIA. A própria auditoria não prescreve
  correção para este item. Vira pergunta obrigatória da F2.
- **`09-padroes-de-teste-frontend.md`** — NÃO DOCUMENTADO qual formato de teste o dono aceita
  como "teste de integração"/"teste funcional" (regra 4 do sprintx) para mudanças de HTML/CSS
  estático sem lógica pura isolável: teste estático de arquivo (novo padrão, via `node:test` +
  `fs.readFileSync`) e/ou validação visual manual via Playwright (já usada em trabalhos
  anteriores, nunca commitada como teste). Procurado em `test/*.test.js` (48 arquivos, todos
  sobre módulos puros) e não há precedente de teste de DOM/CSS no projeto. Esta é a lacuna de
  maior impacto no plano: decide o formato de TODAS as 12 tasks. Vira pergunta obrigatória da F2.

---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: correcoes-auditoria-design-system
atualizado_em: 2026-09-05
decisoes:
  - id: D-01
    decisao: Teste estatico de arquivo (node:test + fs.readFileSync) para as tasks
    alternativa_descartada: Validacao visual manual via Playwright como unico teste
    motivo: Projeto nao tem DOM virtual (jsdom); teste estatico roda no npm test e prova presenca do atributo/valor esperado
    status: fechada
    bloqueante: false
  - id: D-02
    decisao: Erro de rede no PDV e em Mesas mostra mensagem de erro com botao Tentar de novo
    alternativa_descartada: So mensagem, sem botao de retry
    motivo: Dono escolheu a opcao recomendada, que evita reload de pagina para o operador
    status: fechada
    bloqueante: false
  - id: D-03
    decisao: Criar modificador novo (mini-lista) para botoes de acao em linha de tabela, sem tocar o mini global
    alternativa_descartada: Aumentar o padding vertical de button.mini globalmente
    motivo: Evita regressao visual em toolbars/headers que ja usam mini fora de listas
    status: fechada
    bloqueante: false
  - id: D-04
    decisao: Adicionar role=tablist e role=tab ao editor-tabs do editor de item, por consistencia ARIA com o cfg-subnav
    alternativa_descartada: So registrar o achado Baixo 1 como revisado, sem mudar codigo
    motivo: Dono preferiu o pequeno ajuste de acessibilidade em vez de so documentar
    status: fechada
    bloqueante: false
  - id: D-05
    decisao: Criar token dedicado --text-secondary-fg para uso sobre --bg-overlay, seguindo o padrao ja usado em --error-fg/--accent-fg
    alternativa_descartada: Clarear --text-secondary globalmente
    motivo: Escopo contido, sem precisar reconferir contraste de --text-secondary em todos os outros usos do token
    status: fechada
    bloqueante: false
  - id: D-06
    decisao: CTA do cardapio vazio de tenant novo navega para a tela Categorias
    alternativa_descartada: Abrir modal de criar categoria direto por cima da tela de Cardapio
    motivo: Mesmo destino que o comentario do codigo ja indicava (categoria e gerida na tela Categorias)
    status: fechada
    bloqueante: false
  - id: D-07
    decisao: Estados de carregando em Pedidos, PDV, Mesas e Caixa usam texto simples Carregando, sem spinner
    alternativa_descartada: Replicar o spinner (qr-spinner) da aba Conexao nas 4 telas
    motivo: Consistente com o padrao ja usado no painel master e no extrato de estoque, menor esforco de implementacao
    status: fechada
    bloqueante: false
  - id: D-08
    decisao: Breakpoint do .pdv muda de max-width 980px para 1100px, alinhando com o breakpoint da sidebar
    alternativa_descartada: Manter 980px e reduzir a largura fixa do carrinho na faixa intermediaria
    motivo: Mudanca de um unico valor, efeito previsivel, sem redesenhar a coluna do carrinho
    status: fechada
    bloqueante: false
  - id: D-09
    decisao: Incluir o botao pedido-fechar (admin.html:1685) na task de aria-label, junto com os 3 do achado Alto 2
    alternativa_descartada: Corrigir so os 3 botoes citados no AUDIT.md, deixando pedido-fechar como achado novo fora de escopo
    motivo: Mesma causa raiz e mesma correcao dos outros 3; achado durante a ingestao da F1, nao previsto no AUDIT.md original
    status: fechada
    bloqueante: false
---

# Decisões — correcoes-auditoria-design-system

## Decisões

```
D-01 | Teste estático de arquivo (node:test + fs.readFileSync) para as 12 tasks | Validação visual manual via Playwright como único teste | Projeto não tem DOM virtual (jsdom); teste estático roda no npm test e prova presença do atributo/valor esperado
D-02 | Erro de rede no PDV e em Mesas mostra mensagem de erro com botão "Tentar de novo" | Só mensagem, sem botão de retry | Evita reload de página para o operador
D-03 | Criar modificador novo (.mini-lista) para botões de ação em linha de tabela, sem tocar o .mini global | Aumentar o padding vertical de button.mini globalmente | Evita regressão visual em toolbars/headers que já usam .mini fora de listas
D-04 | Adicionar role="tablist"/role="tab" ao .editor-tabs do editor de item, por consistência ARIA com o .cfg-subnav | Só registrar o achado Baixo #1 como revisado, sem mudar código | Dono preferiu o pequeno ajuste de acessibilidade em vez de só documentar
D-05 | Criar token dedicado --text-secondary-fg para uso sobre --bg-overlay, seguindo o padrão já usado em --error-fg/--accent-fg | Clarear --text-secondary globalmente | Escopo contido, sem precisar reconferir contraste de --text-secondary em todos os outros usos do token
D-06 | CTA do cardápio vazio de tenant novo navega para a tela Categorias | Abrir modal de criar categoria direto por cima da tela de Cardápio | Mesmo destino que o comentário do código já indicava ("gerida na tela Categorias")
D-07 | Estados de carregando em Pedidos, PDV, Mesas e Caixa usam texto simples "Carregando…", sem spinner | Replicar o spinner (.qr-spinner) da aba Conexão nas 4 telas | Consistente com o padrão já usado no painel master e no extrato de estoque, menor esforço de implementação
D-08 | Breakpoint do .pdv muda de max-width:980px para 1100px, alinhando com o breakpoint da sidebar | Manter 980px e reduzir a largura fixa do carrinho na faixa intermediária | Mudança de um único valor, efeito previsível, sem redesenhar a coluna do carrinho
D-09 | Incluir o botão #pedido-fechar (admin.html:1685) na task de aria-label, junto com os 3 do achado Alto #2 | Corrigir só os 3 botões citados no AUDIT.md, deixando #pedido-fechar como achado novo fora de escopo | Mesma causa raiz e mesma correção dos outros 3; achado durante a ingestão da F1, não previsto no AUDIT.md original
```

Confirmações adicionais dos eixos de arquitetura, dados/observabilidade/ambiente e definição de
pronto (sem gerar D-NN próprio, por serem confirmação de suposição já documentada na base, não
escolha entre alternativas):

- **Arquitetura**: nenhuma task cria módulo/arquivo novo — só edições em `public/app.js`,
  `public/admin.html`, `public/admin-master.html` e `public/style.css`, nos pontos já mapeados em
  `base/`. Confirmado.
- **Dados/observabilidade/ambiente**: nenhuma task mexe em schema, log, métrica, variável de
  ambiente ou segredo. Confirmado.
- **Definição de pronto**: cada task fecha com `npm test` + `npm run check` verdes, o teste
  estático (D-01) passando, e conferência visual manual (Playwright/navegador) para as mudanças
  puramente visuais (contraste D-05, breakpoint D-08, altura de botão D-03). Confirmado.

## Pendências

Nenhuma pendência.

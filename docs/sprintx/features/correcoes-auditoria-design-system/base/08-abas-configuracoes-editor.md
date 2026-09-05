# Abas dentro de Configurações e do editor de item (Baixo #1 do AUDIT.md)

## Contrato de entrada

- `public/admin.html:307-317` — sub-navegação da aba Configurações:
  ```html
  <div class="cfg-subnav" role="tablist">
    <button type="button" class="ativo" data-sub="empresa" role="tab" aria-selected="true">...</button>
    <button type="button" data-sub="cardapio" role="tab">...</button>
    ...
  </div>
  ```
  (marcação ARIA de tabs já correta: `role="tablist"`/`role="tab"`/`aria-selected`).
- `public/admin.html:1749-1754` — sub-navegação do editor de item do cardápio:
  ```html
  <div class="editor-tabs" id="editor-tabs-nav">
    <button type="button" class="editor-tab ativo" data-tab="principal">Principal</button>
    <button type="button" class="editor-tab" data-tab="opcionais">Complementos</button>
    <button type="button" class="editor-tab" data-tab="variacoes">Variações</button>
  </div>
  ```
  (sem `role="tablist"`/`role="tab"` aqui, diferente do `.cfg-subnav` acima).
- Regra genérica de design (B3, citada pela auditoria) recomenda "sub-navegação em rail, nunca
  tabs" para navegação ENTRE TELAS do app — o `.sidebar` do painel já segue esse padrão
  corretamente para a navegação principal (Dashboard/Pedidos/Cardápio/PDV/Mesas/Caixa/etc).

## Contrato de saída

- A auditoria classificou este achado como severidade BAIXA e explicitamente NÃO recomendou
  correção: "Ressalva: o DS já documenta essa família (`.editor-tab`/`.filtro-chip`/`.pdv-cat`)
  como padrão estabelecido e reaproveitado 31 vezes (...), e aqui o uso é para alternar seções
  DENTRO DE UM MODAL/FORMULÁRIO (não navegação entre telas do app, que já usa `.sidebar` como
  rail corretamente). Não reclassifiquei como bloqueio por isso, mas fica registrado para o caso
  de esse padrão crescer para navegação de tela inteira."
- Ou seja: o comportamento atual (abas dentro de Configurações e do editor de item) é
  CONSIDERADO ACEITÁVEL pela própria auditoria. Não há, nos 12 achados, uma ação corretiva
  concreta pedida para este item — é uma observação registrada para vigilância futura, não um
  defeito a corrigir agora.

## Limites e cotas

NÃO DOCUMENTADO / não se aplica.

## Erros conhecidos e tratamento

Nenhum.

## Riscos para a nossa implementação

- **Risco principal aqui é de ESCOPO, não de código**: como a própria auditoria não prescreve
  correção, incluir este item nas 12 tasks pode significar (a) registrar formalmente que foi
  revisado e nenhuma mudança é necessária (uma "task" de decisão/registro, sem código), ou (b)
  o dono pode querer aproveitar para adicionar `role="tablist"`/`role="tab"` no
  `.editor-tabs`/`.editor-tab` só para consistência ARIA com `.cfg-subnav` (mudança pequena,
  puramente de acessibilidade, sem alterar o padrão visual de abas em si).
  **NÃO DOCUMENTADO** qual das duas leituras o dono quer — pergunta obrigatória da F2, já que o
  pedido original foi "corrigir os 12 achados" e este item, tecnicamente, não pede correção
  visual/estrutural nenhuma segundo o próprio relatório.

## Fonte

- `public/admin.html:300-317` (`.cfg-subnav`), `1749-1754` (`.editor-tabs`) — lido em
  2026-09-05.
- `docs/design-system/DESIGN-SYSTEM.md` (seção 4, família `.editor-tab`/`.filtro-chip`/
  `.pdv-cat` documentada como padrão de 31 ocorrências) — lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achado Baixo #1, com a ressalva explícita de não-bloqueio) —
  lido em 2026-09-05.

# Contraste de cor — `--text-secondary` sobre `--bg-overlay` (Alto #3 do AUDIT.md)

## Contrato de entrada

- Tokens envolvidos, ambos em `public/style.css:3-63` (`:root`):
  - `--text-secondary: #8B92B3` (`style.css:13`)
  - `--bg-overlay: #2A2E3F` (`style.css:7`)
- Uso concreto citado pela auditoria: `public/style.css:5988` —
  `.mesa-status-badge.s-livre { background: var(--bg-overlay); color: var(--text-secondary); }`
  (texto 10px, `font-weight: 700`, `text-transform: uppercase`, ver `style.css:5975-5987` para
  as demais propriedades do seletor `.mesa-status-badge`).
- Mesmo par de tokens também é a base de `.modal-caixa` (`style.css:2452-2461`) e `.np-modal`
  (`style.css:2466-2472`): `background: var(--bg-overlay)`, que hospedam texto `.sub`/
  `.campo-ajuda` (cor `--text-secondary`) por cima.

## Contrato de saída

- Contraste calculado `--text-secondary` (`#8B92B3`) sobre `--bg-overlay` (`#2A2E3F`) ≈ **4,39:1**.
- Mínimo WCAG AA para texto normal (não "large text", que exigiria só 3:1): **4,5:1**. O texto do
  `.mesa-status-badge` é 10px/700 — não se qualifica como "texto grande" (que exigiria ≥18pt
  regular ou ≥14pt bold, ou seja, ≥18.66px bold), então o padrão aplicável é 4,5:1.
- `--error-fg: #F87171` (`style.css:34`) já documenta em comentário (`style.css:31-33`) o mesmo
  tipo de ajuste feito antes para o par vermelho: "`--error` cheio dá 4,0:1 em texto pequeno sobre
  o fundo vermelho suave, abaixo do mínimo AA (4,5:1). Este dá 5,4:1." — ou seja, o projeto já tem
  o padrão de criar uma variante `-fg` mais clara quando o token de texto padrão não fecha
  contraste sobre uma superfície específica. Não existe hoje um `--text-secondary-fg` (ou
  equivalente) para o par citado no achado.

## Limites e cotas

NÃO DOCUMENTADO (não se aplica — token CSS estático, não é limite de API).

## Erros conhecidos e tratamento

- Nenhum bug funcional; é um problema de legibilidade/acessibilidade para usuários com baixa
  visão ou em ambientes de luz forte (ex.: cozinha, balcão).

## Riscos para a nossa implementação

- `--text-secondary` é usado em **muitos** lugares do CSS (rótulos de campo, `.sub`, badges,
  textos auxiliares) — mudar o valor do token global afeta todas as superfícies de uma vez, não
  só o caso citado. Duas abordagens possíveis, a decidir na F2:
  1. **Global:** clarear `--text-secondary` (ex.: para algo como `#9AA1BF`, sugestão da
     auditoria, ~4,6:1 sobre `--bg-overlay`) — mas precisa reconferir contraste desse novo valor
     contra TODAS as superfícies onde `--text-secondary` já aparece (`--bg-surface`,
     `--bg-elevated`, `--bg-primary`), para não piorar um par que hoje já está OK.
  2. **Escopado:** seguir o padrão já usado pelo projeto para `--error-fg`/`--accent-fg` — criar
     um token específico (ex. `--text-secondary-fg`) só para uso sobre `--bg-overlay`, e trocar
     apenas os seletores que hoje combinam os dois (`.mesa-status-badge.s-livre` e qualquer outro
     achado por grep de `color: var(--text-secondary)` dentro de regras que também tenham
     `background: var(--bg-overlay)` ou estejam aninhadas em `.modal-caixa`/`.np-modal`).
  - A opção 2 é mais alinhada ao padrão já estabelecido no arquivo (tokens `-fg` dedicados) e tem
    raio de impacto menor — decisão a confirmar na F2.
- `--mesa-status-badge` e as demais 3 variantes de status (`s-ocupada`, `s-pediu_conta`,
  `s-fechando`, `style.css:5989-5991`) usam pares `--success`/`--success-subtle`,
  `--warning`/`--warning-subtle`, `--accent-fg`/`--accent-subtle` — só `s-livre` usa o par
  problemático; as outras três já resolvem com sombra "subtle" + cor "cheia", que teoricamente já
  teria contraste maior (não auditado neste achado, fora de escopo).

## Fonte

- `public/style.css:3-63` (tokens), `5975-5991` (`.mesa-status-badge`), `2452-2472`
  (`.modal-caixa`/`.np-modal`), `31-34` (comentário do padrão `-fg` já usado para `--error`) —
  lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achado Alto #3, com o cálculo de contraste 4,39:1) — lido em
  2026-09-05.

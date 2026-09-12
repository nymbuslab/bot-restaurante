# Jobs agendados — `index.js`

## Contrato de entrada

Não há lib de cron (sem `node-cron`/`node-schedule` no projeto). Mecanismo é `setTimeout` (delay após boot) + `setInterval` (repetição) — todo intervalo é relativo ao instante em que o processo subiu, não a um horário fixo do relógio.

| Job | Boot delay | Intervalo | Linhas |
|---|---|---|---|
| `limparSessoes` (higiene sessão WhatsApp, +90d) | 30s | 24h | `index.js:32-41` |
| `anonimizarPedidos` (retenção LGPD, 12 meses) | 45s | 24h | `index.js:46-55` |
| `removerClientesInativos` (retenção, 12 meses) | 60s | 24h | `index.js:61-70` |
| `limparAuditoria` (retenção, 24 meses) | 75s | 24h | `index.js:75-84` |
| `limparFilaImpressao` (7 dias) | 90s | 24h | `index.js:90-99` |
| `limparIncidentes` (90 dias) | 105s | 24h | `index.js:104-113` |
| `limparEstoque` (12 meses) | 105s | 24h | `index.js:119-128` |
| `limparSessoesMemoria` (RAM) | — | 10min | `index.js:134-142` |
| `restaurarBots` (reconecta WhatsApp no boot) | 10s | única vez | `index.js:153-170` |

Padrão de cada job: função `async` com `try/catch` que loga e nunca lança (`index.js:32-39` é o exemplo canônico), disparada uma vez via `setTimeout` (offset para não competir no boot) e reagendada via `setInterval`.

## Contrato de saída

Nenhum job expõe retorno via API — todos são fire-and-forget internos, só logam no console.

## Limites e cotas

NÃO DOCUMENTADO (sem limite de concorrência entre jobs observado).

## Erros conhecidos e tratamento

Todo job captura exceção internamente (`try/catch`) e loga — nenhum propaga erro para o processo.

## Riscos para a nossa implementação

- **Sem cron de horário fixo**: um relatório diário pensado para "chegar às 8h" ou "resumo do fechamento às 23h" NÃO é suportado pelo padrão atual — o intervalo é "a cada 24h desde o boot", que se desloca a cada deploy/restart (Fly.io). Decisão de descoberta: aceitar o horário deslizante, ou introduzir alguma noção de horário-alvo (ex.: comparar `new Date().getHours()` dentro de um `setInterval` mais curto, tipo a cada 30min, e disparar só quando bater a hora configurada).
- **Nota de instância única já registrada no código** (`index.js:150-151`, sobre `restaurarBots`): "assume instância única... com 2+ instâncias, ambas tentariam restaurar o mesmo tenant". O mesmo risco se aplica a um job de relatório — com 2+ instâncias rodando, o relatório sairia em duplicidade para o mesmo tenant. Hoje o projeto roda instância única (confirmado no CLAUDE.md do projeto), então é risco latente, não bloqueante agora.
- O mecanismo aceita plugar mais um bloco `setTimeout`+`setInterval` sem alterar nada existente — baixo risco de regressão nos jobs atuais.

## Fonte

`index.js:1-189` (lido por completo) — acessado em 2026-09-06

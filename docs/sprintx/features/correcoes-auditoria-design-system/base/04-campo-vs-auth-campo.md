# `.campo` vs `.auth-campo` — duplicação de primitivo de formulário (Médio #1 do AUDIT.md)

## Contrato de entrada

- **`.campo`** — `public/style.css:1013-1028`:
  ```css
  .campo { margin-bottom: 14px; }
  .campo:last-child { margin-bottom: 0; }
  .campo label {
    display: block; font-size: 11px; font-weight: 700; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;
  }
  .linha { display: flex; gap: 12px; flex-wrap: wrap; }
  .linha > .campo { flex: 1; min-width: 140px; }
  ```
- **`.auth-campo`** — `public/style.css:224-236`:
  ```css
  .auth-campo { display: flex; flex-direction: column; gap: 6px; }
  .auth-campo label {
    font-size: 11px; font-weight: 700; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  ```
- O `label` das duas classes é visualmente idêntico (mesmo `font-size`, `font-weight`, `color`,
  `text-transform`, `letter-spacing`); a diferença é só o container: `.campo` usa
  `margin-bottom`, `.auth-campo` usa `display:flex; flex-direction:column; gap:6px`.
- `.auth-campo` não está restrito ao shell de autenticação: reaparece em
  `public/style.css:3796` (dentro de um contexto de modal de caixa do painel master — bloco a
  confirmar o seletor pai exato na F3) e `public/style.css:4042` (bloco de wizard) — a auditoria
  cita esses dois pontos como prova de que `.auth-campo` já "vazou" para fora do login/cadastro.

## Contrato de saída

- Hoje: dois primitivos de label/campo com o mesmo visual de rótulo, cada um com seu próprio
  bloco de CSS — qualquer mudança de estilo de rótulo (cor, tamanho, espaçamento) precisa ser
  replicada nos dois lugares manualmente.
- Esperado: uma única fonte de verdade para o estilo do rótulo (seletor combinado, ex.
  `.campo label, .auth-campo label { ... }`, ou fazer `.auth-campo` herdar via classe adicional)
  — decisão exata de qual union/estratégia de CSS usar é tarefa de implementação (F3), não desta
  base.

## Limites e cotas

NÃO DOCUMENTADO (não se aplica).

## Erros conhecidos e tratamento

- Nenhum bug funcional. É debt de manutenção (regra de design "DRY" do `CLAUDE.md`: "Manter DRY
  / fonte única de verdade — não duplicar conteúdo ou lógica que já existe").

## Riscos para a nossa implementação

- `.auth-campo` também define `display:flex; flex-direction:column; gap:6px` no CONTAINER (não
  só no label), enquanto `.campo` usa `margin-bottom` no container — os dois containers têm
  comportamento de layout DIFERENTE (flex vs. margin), então a unificação segura é migrar só a
  regra do `label` para um seletor compartilhado, sem mexer no container de `.auth-campo` (que
  pode ter motivo de ser flex — não documentado, mas gap:6px sugere espaçamento vertical
  controlado que `margin-bottom` não daria da mesma forma).
- Qualquer unificação precisa varrer TODOS os usos de `.auth-campo` no projeto (login, cadastro,
  redefinir-senha, modal de caixa do master, wizard) antes de mudar a regra, para não quebrar
  layout em telas que a auditoria não visitou linha a linha.
- `public/style.css:3796` e `4042` não foram lidos com contexto completo do seletor ao redor
  nesta base (só a linha do achado, vinda do AUDIT.md) — ler o bloco completo é tarefa da F3
  antes de decidir a forma exata da unificação.

## Fonte

- `public/style.css:224-236` (`.auth-campo`), `1013-1028` (`.campo`/`.linha`) — lido em
  2026-09-05.
- `docs/design-system/AUDIT.md` (achado Médio #1, citando `style.css:3796` e `4042` como outros
  usos de `.auth-campo`) — lido em 2026-09-05.
- `CLAUDE.md` (raiz do projeto), seção "Mentalidade de engenharia e UX" (regra de DRY) — lido em
  2026-09-05.

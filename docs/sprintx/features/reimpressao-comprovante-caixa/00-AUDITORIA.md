# Auditoria — reimpressao-comprovante-caixa

Data: 2026-08-30 (2ª auditoria, depois da regeneração do plano na F3)

## Achados da 1ª auditoria e o que foi feito

| severidade | achado | situação |
|---|---|---|
| ALTA | T-01.01 mandava aplicar migração "no projeto de teste" sem dizer como apontar o CLI, e o `.env` local aponta para produção | **FECHADO.** `sprint-01/tasks.md` ganhou um portão obrigatório de 5 passos logo abaixo da task: ler `refTeste` do helper que já existe, conferir a ref linkada, relinkar se diferente, só então `db push`, e PARAR registrando bloqueio se a ref bater com a de produção. Registrado como D-12. |
| MÉDIA | T-02.02 não verificava `pedidoNumero`, que a base aponta como risco 4 | **FECHADO.** `pedidoNumero` entrou no `teste_funcional` e no `criterio_aceite`. |
| MÉDIA | T-03.02 provava D-07 só por presença de tokens no texto do `app.js` | **FECHADO.** O critério passou a exigir ORDEM por `indexOf`: `disabled = true` antes da chamada da rota, reabilitação dentro do `finally`. |
| MÉDIA | T-03.03 não declarava como obter a tela para a validação visual | **FECHADO.** A task ganhou o campo `meio:` declarando harness local com APIs mockadas, sem depender de tenant Completo com caixa aberto. |
| MÉDIA | Nenhuma proteção de servidor contra rajada de reimpressões | **FECHADO.** Nova task T-02.05 (janela mínima por movimento) e decisão D-11. |
| BAIXA ×3 | T-02.01 e T-03.01 sequenciais sem necessidade; testes da T-01.03 validam a própria fixture | **MANTIDOS.** Nenhum está no caminho crítico e nenhum invalida a execução. Ficam registrados. |

## Achados desta 2ª auditoria

| severidade | arquivo | problema | correção sugerida |
|---|---|---|---|
| BAIXA | `sprint-03/tasks.md` (T-03.03) | O campo `meio:` não faz parte dos 10 campos do contrato da task. Resolve o achado anterior, mas cria um campo fora do padrão que outras tasks não têm. | Aceitável como está; se o padrão incomodar, mover o conteúdo para o `sprint.md` da sprint 03. |
| BAIXA | `sprint-02/tasks.md` (T-02.04) | O `criterio_aceite` cita a recusa de `recebimento` (400) mas não a de `estorno`, que D-03 também põe fora. A cobertura existe pela função pura da T-02.01, que a rota consome. | Acrescentar `estorno` à lista do critério, ou deixar como está confiando na T-02.01. |
| BAIXA | `sprint-01/tasks.md` (T-01.01) | O portão do `db push` é texto em prosa, não campo estruturado. Um executor que leia só o bloco `yaml` da task pode não vê-lo. | Está imediatamente abaixo da task e o `ORQUESTRADOR.md` aponta para ele na seção 3; se quiser reforçar, repetir o portão na seção 4 do orquestrador. |

## Verificação estrutural

- 12 tasks, todas com os 10 campos do contrato preenchidos.
- Nenhum `depende_de` aponta para id inexistente; sem ciclo direto ou transitivo.
- Única dupla `paralelizavel: true` é T-01.01 ∥ T-01.02, e elas não escrevem em nenhum arquivo em comum.
- Pares que compartilham arquivo (T-02.02/T-02.03 em `src/caixa.js`; T-02.04/T-02.05 em `src/servidor.js`; T-03.01/T-03.02 em `public/app.js`) são todos sequenciais por dependência declarada.
- Sprint 01 entrega capacidade de testar, não negócio.
- Nenhuma task exige decisão humana em execução: o portão da T-01.01 tem condição de parada definida (registrar bloqueio), que é a regra 8 do método, não uma pergunta.

VEREDITO: SIM — o plano está pronto para execução autônoma.

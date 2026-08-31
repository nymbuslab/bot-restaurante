# Tasks — Sprint 01

> Um bloco por task, com TODOS os campos do contrato. Na F6 a linha `status` é atualizada em cada transição; ao concluir, acrescente data e resultado da suíte.

---

```yaml
id: T-01.01
titulo: Indice em caixa_movimentos(pedido_id)
objetivo: Dar suporte ao filtro por pedido_id que o reagrupamento do cancelamento vai usar (D-02, D-10).
arquivos:
  cria: [supabase/migrations/20260830150000_indice_caixa_movimentos_pedido.sql]
  altera: []
teste_integracao: Depois de aplicar a migracao no projeto de teste, `npm run test:integracao` termina com fail 0.
teste_funcional: Consulta `SELECT indexname FROM pg_indexes WHERE tablename='caixa_movimentos'` no projeto de teste inclui `caixa_movimentos_pedido_id_idx`.
criterio_aceite: A consulta a pg_indexes devolve exatamente 1 linha com indexname = 'caixa_movimentos_pedido_id_idx', executada contra o projeto cuja ref bate com a do .env.test.
depende_de: []
paralelizavel: true
status: concluida - 2026-08-30 - suite: npm run test:integracao => pass 47, fail 0; pg_indexes => 1 linha
```

> **PORTAO OBRIGATORIO ANTES DO `db push` (D-12, achado ALTA da 1a auditoria).**
> O `.env` local aponta para **PRODUCAO**. O `npx supabase db push` NAO le o `.env.test`:
> ele usa o projeto que estiver linkado pelo CLI. Rodar o comando com o link errado
> aplica a migracao no banco do cliente.
>
> Sequencia obrigatoria, nesta ordem, antes de qualquer `db push`:
>
> 1. Ler a ref do projeto de TESTE com o helper que ja existe: `refTeste` de
>    `test/integracao/ajuda/ambiente.js`.
> 2. Rodar `npx supabase projects list` (ou `npx supabase status`) e conferir para qual
>    ref o CLI esta linkado AGORA.
> 3. Se a ref linkada for diferente da `refTeste`, rodar
>    `npx supabase link --project-ref <refTeste>` e conferir de novo.
> 4. So entao rodar `npx supabase db push`.
> 5. Se em qualquer passo a ref linkada bater com a de PRODUCAO (`refDoProjeto` do mesmo
>    helper), PARAR, registrar em `00-BLOQUEIOS.md` e nao rodar o push.
>
> O passo 5 nao e formalidade: e o unico ponto do plano inteiro em que um comando pode
> escrever no banco do cliente.

---

```yaml
id: T-01.02
titulo: Helper de leitura da fila de impressao sem consumir
objetivo: Permitir ler a fila duas vezes na mesma prova, porque a rota do agente reserva os trabalhos ao ler.
arquivos:
  cria: [test/integracao/ajuda/fila.js]
  altera: [test/integracao/caixa-comprovantes.test.js]
teste_integracao: O teste `caixa-comprovantes` existente passa usando o helper novo no lugar da funcao local `fila()`.
teste_funcional: Apos um unico suprimento com comprovante ligado, duas leituras seguidas do helper devolvem a mesma lista de 1 trabalho.
criterio_aceite: `node --test test/integracao/caixa-comprovantes.test.js` termina com fail 0 e a segunda leitura devolve length 1.
depende_de: []
paralelizavel: true
status: concluida - 2026-08-30 - suite: node --test test/integracao/caixa-comprovantes.test.js => pass 1, fail 0
```

---

```yaml
id: T-01.03
titulo: Fixture dos tres tipos de movimento com comprovante
objetivo: Criar sangria, suprimento e cancelamento pago numa chamada, devolvendo os ids de movimento para as provas de reimpressao.
arquivos:
  cria: [test/integracao/ajuda/movimentos-caixa.js]
  altera: []
teste_integracao: A fixture roda contra o app real e os ids que devolve existem em `movimentos[].id` de `GET /api/caixa`.
teste_funcional: Uma chamada da fixture devolve `{ sangria, suprimento, cancelamento }` com tres ids numericos distintos.
criterio_aceite: Os tres ids devolvidos aparecem em movimentos[].id de GET /api/caixa e sao distintos entre si.
depende_de: [T-01.02]
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/integracao/caixa-comprovantes.test.js => pass 2, fail 0
```

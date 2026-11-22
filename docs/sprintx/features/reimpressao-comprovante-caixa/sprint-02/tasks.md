# Tasks — Sprint 02

> Um bloco por task, com TODOS os campos do contrato. Na F6 a linha `status` é atualizada em cada transição; ao concluir, acrescente data e resultado da suíte.

---

```yaml
id: T-02.01
titulo: podeReimprimirComprovante como fonte unica dos tipos
objetivo: Front e backend passam a decidir pelo MESMO criterio quais movimentos tem comprovante, para o icone nunca aparecer numa linha que a rota recusa.
arquivos:
  cria: []
  altera: [public/comprovante-caixa.js, test/comprovante-caixa.test.js]
teste_integracao: A suite pura `node --test test/comprovante-caixa.test.js` termina com fail 0 e o modulo segue carregavel em CommonJS e no browser.
teste_funcional: `podeReimprimirComprovante` devolve true para 'sangria', 'suprimento' e 'cancelamento', e false para 'recebimento', 'estorno', '' e undefined.
criterio_aceite: As sete entradas acima devolvem exatamente os valores listados.
depende_de: []
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/comprovante-caixa.test.js => pass 3, fail 0
```

---

```yaml
id: T-02.02
titulo: Leitura do movimento guardado com operador, numero do pedido e hora original
objetivo: Devolver, por id de movimento, os campos que o comprovante precisa e que nao estao em caixa_movimentos.
arquivos:
  cria: []
  altera: [src/caixa.js]
teste_integracao: Para uma sangria e um cancelamento criados pela fixture, a leitura devolve o operador da abertura do caixa, o `criado_em` guardado e, no cancelamento, o `pedidoNumero` vindo do JOIN.
teste_funcional: Id de uma sangria de R$ 5,00 devolve `{ tipo:'sangria', valor:5, operador:'Operador Teste' }` com `criadoEm` igual ao `quando` do extrato; id do cancelamento devolve `pedidoNumero` igual ao `numero` do pedido.
criterio_aceite: Os campos tipo, valor, operador, criadoEm e pedidoNumero batem com os do extrato para o mesmo id; movimento de outra empresa devolve null.
depende_de: [T-01.03]
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/integracao/caixa-comprovantes.test.js => pass 3, fail 0
```

---

```yaml
id: T-02.03
titulo: Reagrupamento dos movimentos irmaos do cancelamento
objetivo: Reimprimir cancelamento como UM comprovante somado com todas as formas, igual ao papel original (D-02).
arquivos:
  cria: []
  altera: [src/caixa.js]
teste_integracao: Para um pedido pago em duas formas e cancelado, a leitura por QUALQUER um dos dois ids de cancelamento devolve o mesmo registro somado.
teste_funcional: Cancelamento de pedido pago R$ 8,00 em Dinheiro e R$ 4,00 em PIX devolve `valor: 12` e `formas` com as duas entradas.
criterio_aceite: valor devolvido = 12 e formas tem length 2, para os dois ids de entrada.
depende_de: [T-02.02]
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/integracao/caixa-comprovantes.test.js => pass 4, fail 0
```

---

```yaml
id: T-02.04
titulo: Rota POST /api/caixa/movimento/:id/reimprimir
objetivo: Expor a reimpressao por HTTP, ignorando o toggle (D-01), com os dois gates de plano (D-05) e isolamento por empresa.
arquivos:
  cria: []
  altera: [src/servidor.js, test/integracao/caixa-comprovantes.test.js]
teste_integracao: Com o toggle DESLIGADO, a rota devolve 200 e o texto enfileirado e string-identico ao enfileirado no registro original com o toggle ligado.
teste_funcional: POST no id de uma sangria devolve `{ ok: true }` e faz a fila crescer em exatamente 1 trabalho de tipo 'caixa-comprovante'.
criterio_aceite: Sangria/suprimento/cancelamento devolvem 200; id de outra empresa devolve 404; id de recebimento devolve 400; empresa sem Plano Completo devolve 403.
depende_de: [T-02.01, T-02.03]
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/integracao/caixa-comprovantes.test.js => pass 6, fail 0
```

---

```yaml
id: T-02.05
titulo: Janela minima entre reimpressoes do mesmo movimento
objetivo: Proteger a fila de impressao da rajada sem barrar a segunda via legitima de outro movimento (D-11).
arquivos:
  cria: []
  altera: [src/servidor.js, test/integracao/caixa-comprovantes.test.js]
teste_integracao: Dois POST seguidos no MESMO id de movimento fazem a fila crescer em 1, nao em 2, e o segundo devolve status de recusa com mensagem propria.
teste_funcional: POST no movimento A seguido de POST no movimento B, ambos dentro da janela, devolvem 200 os dois e a fila cresce em 2, provando que a janela e por movimento e nao por rota.
criterio_aceite: 2 POST no mesmo id dentro da janela = fila +1 e o segundo nao devolve 200; 1 POST em cada um de 2 ids dentro da janela = fila +2 e ambos 200.
depende_de: [T-02.04]
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/integracao/caixa-comprovantes.test.js => pass 7, fail 0
```

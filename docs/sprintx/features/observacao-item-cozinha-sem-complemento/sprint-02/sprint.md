# Sprint 02 — Item de cozinha sem complemento abre modal de observação no PDV/Mesas

## Objetivo

Fazer o PDV (e Mesas, que reaproveita a mesma grade) abrirem o modal de item já existente — em vez de empilhar direto no carrinho — sempre que o item tiver `cozinha === true`, mesmo sem grupo de complemento/composição configurado, para que o operador possa registrar uma observação que sai na via da cozinha. Cardápio web não muda (já funciona — D-01).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Mudança de condição (pdvTileClick + pdvVariacaoClick) e protótipo | nenhuma |
| F-02.2 | Validação end-to-end real (PDV avulso + Mesa) | nenhuma (depende de F-02.1) |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm test`, `npm run check` e `npm run test:integracao` terminam 100% verdes; os dois testes de caracterização da sprint 1 continuam passando para os casos que NÃO mudam (D-10); os dois casos alterados (D-02) passam a chamar `abrirPdvItemModal`; protótipo aprovado pelo dono (D-06); observação confirmada saindo na via da cozinha em PDV avulso e em Mesa (D-07).

## Riscos conhecidos

- D-04: item de cozinha sem complemento deixa de agrupar quantidade automaticamente em clique repetido — efeito colateral aceito pelo dono, mas vale confirmar visualmente no protótipo/validação que não confunde o operador.
- base/05-impressao-comanda-cozinha.md registra que a linha "Obs: ..." não quebra automaticamente se ultrapassar a largura da bobina — fora do escopo desta sprint (D-11), mas relevante observar na validação manual (D-07) se aparece de forma legível com uma observação real digitada.

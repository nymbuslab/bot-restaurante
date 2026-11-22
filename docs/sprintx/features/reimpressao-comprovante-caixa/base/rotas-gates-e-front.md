# Rotas, gates de plano e a grade do caixa no front

## Contrato de entrada

**Padrão de rota de reimpressão que já existe** (`src/servidor.js:2305-2321`):

```
app.post("/api/pedidos/:id/reimprimir", exigeAuth, async (req, res) => {
  if (!(await exigeImpressao(req, res))) return;
  ...
  await impressaoFila.enfileirar(req.tenantDir, "reimpressao", vias);
  res.json({ ok: true });
});
```

Ou seja: `exigeAuth` como middleware, gate de plano chamado DENTRO do handler e FORA do `try`, enfileira, devolve `{ ok: true }`.

**Gates disponíveis** (todos `async (req, res) => boolean`, respondem sozinhos quando barram):

- `exigeCaixa` (`src/servidor.js:2331-2341`) — `empresas.temCaixa(emp)`; 403 `"Recurso do Plano Completo."`.
- `exigeImpressao` (`src/servidor.js:2489-2499`) — `empresas.temImpressao(emp)`; mesmo 403.
- Ambos devolvem 500 `"Falha ao verificar o seu plano. Tente de novo."` em exceção.

Comentário do próprio código (`src/servidor.js:2324-2330`) explica por que o gate fica fora do `try`: Express 4 não captura rejeição de handler async, e o gate estourando deixava a requisição sem resposta nenhuma.

**Grade do extrato** (`public/app.js:3939-3971`, dentro de `renderCaixaAberto`):

- Cada linha é montada de `movimentosCaixaVisiveis(data.movimentos || [])` (`public/app.js:3939`).
- A última célula é `<td class="caixa-tab-acao">${acao}</td>` (`public/app.js:3969`).
- Hoje `acao` só recebe conteúdo em recebimento estornável: `m.estornavel && !m.tipoVisual` → botão `.caixa-estornar` com `data-id="${m.pedidoId}"` (`public/app.js:3959-3960`). Em todo o resto a célula fica **vazia**.
- A coluna existe também no `<thead>` como `<th></th>` (`public/app.js:3985`) e na linha de abertura (`public/app.js:3982`).
- CSS: `.caixa-tab-acao { text-align: right; width: 1%; white-space: nowrap; }` (`public/style.css:4954`).
- Os listeners são ligados por `querySelectorAll` depois do `innerHTML` (padrão em `public/app.js:4046-4047`).

## Contrato de saída

- Rota de reimpressão existente: `{ ok: true }` em sucesso; `400 { erro }` em falha; `404 { erro: "Pedido não encontrado." }`.
- Front: o painel usa `api(metodo, url, corpo)` (`public/app.js:~75`), que já trata 401 renovando a sessão.

## Limites e cotas

- `NÃO DOCUMENTADO`: não há rate limit específico nas rotas de caixa. O `limitador()` citado no `CLAUDE.md` cobre autenticação/cadastro, não estas.
- CSP estrita: nenhum `<script>` inline nem handler inline (`onclick=`) é permitido; listener tem que ser `addEventListener` em arquivo `.js` (`CLAUDE.md`, seção Convenções).

## Erros conhecidos e tratamento

- Gate de plano barrando devolve 403 e o front mostra a mensagem do campo `erro`.
- Falha ao enfileirar na rota de pedido vira `400 { erro }` (`src/servidor.js:2319-2320`). Diferente do caminho de comprovante de caixa, que NÃO derruba a operação porque lá o movimento financeiro já aconteceu. Na reimpressão não existe operação financeira junto, então 400 é aceitável.

## Riscos para a nossa implementação

1. **Qual gate?** A rota de pedidos usa `exigeImpressao`; as rotas de caixa usam `exigeCaixa`. A reimpressão de comprovante de caixa é as duas coisas. Aplicar os dois é o mais conservador e não custa nada, mas precisa ser decidido (candidato a decisão na F2).
2. **Ícone só em algumas linhas.** O desenho aprovado põe o ícone em sangria, suprimento e cancelamento, e deixa recebimento comum sem. A condição no front tem que casar com o que o backend aceita, senão o ícone aparece e a rota recusa.
3. **Mistura de controles na mesma coluna:** botão de texto "Estornar" nas linhas de recebimento e ícone nas outras. Os dois nunca caem na mesma linha (tipos de movimento diferentes), então não competem visualmente. Registrado como observação, não como problema.
4. **`data-id` da ação hoje é `pedidoId`**, não o id do movimento. O ícone novo precisa de `data-id` com o **id do movimento**, que já vem na API desde o commit `b100c43`. Cuidado para não confundir os dois no mesmo `querySelectorAll`.

## Fonte

`src/servidor.js:2305-2341`, `src/servidor.js:2489-2499`, `public/app.js:3939-3990`, `public/app.js:4046-4047`, `public/style.css:4954`, `CLAUDE.md` (Convenções) — acessado em 2026-08-30

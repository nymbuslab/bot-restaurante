# Gating por plano/assinatura — o padrão `tem*`

## Contrato de entrada

Fonte única em `src/empresas.js`:

```js
const STATUS_LIBERADOS = ["trialing", "active", "cortesia"];
function acessoLiberado(emp) { return !!emp && !!emp.ativo && STATUS_LIBERADOS.includes(emp.assinaturaStatus); }  // linha 326-328
function planoDe(emp) { return (emp && emp.plano) || "essencial"; }                                              // linha 332-334

function temFreteRaio(emp)  { return acessoLiberado(emp) && planoDe(emp) === "completo"; }  // linha 338-340
function temCaixa(emp)      { return acessoLiberado(emp) && planoDe(emp) === "completo"; }  // linha 343-345
function temPdv(emp)        { return acessoLiberado(emp) && planoDe(emp) === "completo"; }  // linha 348-350
function temImpressao(emp)  { return acessoLiberado(emp) && planoDe(emp) === "completo"; }  // linha 356-358
```

Comentário do próprio código (`src/empresas.js:352-355`) explica por que `temImpressao` existe separado de `temPdv` mesmo com regra idêntica: são features distintas do ponto de vista de produto/planos, cada uma com seu próprio "porteiro" — precedente direto para `temRelatoriosTelegram(emp)` como função própria.

Confirmado em `docs/assinatura-stripe.md:12-13`: "Gating de feature por plano: `empresas.temFreteRaio(emp)` = `acessoLiberado` e plano completo (fonte única)."

## Contrato de saída

`GET /api/conta` devolve `plano: empresas.planoDe(emp)` (`src/servidor.js:1817`).

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Gate no servidor retorna `403 { erro: "Recurso do Plano Completo." }` quando a checagem falha (padrão em `exigeCaixa`, ver abaixo).

## Riscos para a nossa implementação

- **Gate real é sempre no backend**, nunca só no front — comentário explícito no código: "caixa é recurso de servidor → barra no backend (não só no front)" (`src/servidor.js:2328`). Padrão de função de gate:

```js
async function exigeCaixa(req, res) {
  const emp = await empresas.buscarPorSlug(req.slug);
  if (!empresas.temCaixa(emp)) { res.status(403).json({ erro: "Recurso do Plano Completo." }); return false; }
  return true;
}
```
(`src/servidor.js:2334-2344`; usos análogos: `temImpressao` em `:2527`, `temPdv` em `:2539`, `temFreteRaio` em `:1781`). Chamada nas rotas: `if (!(await exigeCaixa(req, res))) return;`.

- Front usa `planoAtual` (guardado a partir de `GET /api/conta`, `public/app.js:1655,4594`) só para exibir cadeado/upsell (`public/app.js:3605-3652`) — é cosmético, não segurança.
- Para esta feature, o usuário já decidiu explicitamente que a COBRANÇA fica para depois ("por hora quero fazer funcionar"). Isso significa: nesta rodada, NÃO criar `temRelatoriosTelegram`/gate 403 ainda — mas vale registrar em `00-DECISOES.md` (F2) que o ponto de extensão existe e é este, para quando a monetização entrar (evita ter que redesenhar o acesso depois).

## Fonte

`src/empresas.js:326-358`, `src/servidor.js:1655,1781,1817,2328,2334-2344,2527,2539`, `public/app.js:1655,3605-3652,4594`, `docs/assinatura-stripe.md:12-13` — acessado em 2026-09-06

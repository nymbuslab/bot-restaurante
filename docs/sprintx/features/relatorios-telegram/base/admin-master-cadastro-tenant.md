# Admin-master — edição de dados de um tenant específico

## Contrato de entrada

O admin-master (`public/admin-master.html` + `public/app-admin.js`) é uma página separada do painel do restaurante, confirmada em `docs/super-admin.md:55-56` ("página separada do painel de restaurante — não usar `admin.html`/`app.js`").

**Navegação de topo:** 4 abas fixas definidas em `admin-master.html:97-114` (`data-aba="visao|restaurantes|monitor|config"`), cada uma virando uma `<section class="aba" id="aba-...">` (`admin-master.html:134,160,186,213`). O JS que alterna a `.ativa` por `data-aba` não foi lido linha a linha nesta ingestão.

**Edição de UM tenant** não é feita por aba, é por um **modal overlay** (`#tenant-overlay`, `admin-master.html:286-299`), aberto pelo botão "Gerenciar" na lista de clientes. Corpo (`#am-tenant-corpo`, linha 295) é montado dinamicamente por `renderTenantModal(d)` (`app-admin.js:694-793`), com 3 blocos fixos: Resumo (694-754), Ações (756-780), Histórico de pagamentos (782-786). Abertura: `abrirGerenciar(slug)` (`app-admin.js:624-632`) → `recarregarGerenciar()` (`app-admin.js:634-650`) → `GET /api/admin/tenants/${slug}/assinatura` (`app-admin.js:638`).

**NÃO existe hoje** uma aba "Cadastro" com sub-abas (dados básicos/plano/frete) dentro do admin-master — essa estrutura de sub-abas (`aba-config`) existe apenas no painel do PRÓPRIO dono (`public/admin.html:307-340`), acessível só via `exigeAuth`/`req.slug` (self-service), não pelo operador da plataforma.

**Padrão de formulário+salvar no admin-master** (o único exemplo real hoje): aba "Configurações Master" (`admin-master.html:213-273`) — cards `.am-config-card` com `.auth-campo` (label+input), botão `#btnSalvarPlataforma` (linha 250) e aviso `#cfg-plat-aviso` (linha 251), alimentada por `GET/PUT /api/admin/plataforma` (citado em `docs/super-admin.md:83`). Diferença importante: essa tela grava uma tabela singleton (`plataforma_config`), não uma linha por tenant.

## Contrato de saída

Rotas de admin já existentes, todas sob `exigeSuperAdmin` (`src/servidor.js:302-319`, valida JWT + allowlist, **não** popula `req.slug`/`req.tenantDir`):

| Rota | Linha |
|---|---|
| `GET /api/admin/tenants` | `src/servidor.js:1218` |
| `POST /api/admin/tenants` | `src/servidor.js:1435` |
| `PATCH /api/admin/tenants/:slug/suspender` | `src/servidor.js:1447` |
| `PATCH /api/admin/tenants/:slug/reativar` | `src/servidor.js:1474` |
| `DELETE /api/admin/tenants/:slug` | `src/servidor.js:1497` |
| `GET /api/admin/tenants/:slug/assinatura` | `src/servidor.js:1551` |
| `PATCH /api/admin/tenants/:slug/plano` | `src/servidor.js:1581` |
| `PATCH /api/admin/tenants/:slug/assinatura/cortesia` | `src/servidor.js:1611` |
| `PATCH /api/admin/tenants/:slug/assinatura/revogar` | `src/servidor.js:1637` |
| `PATCH /api/admin/tenants/:slug/assinatura/cancelar` | `src/servidor.js:1656` |

NÃO existe `GET/PUT /api/admin/tenants/:slug/config` (leitura/gravação do `config` jsonb de outro tenant pelo operador) — seria rota nova.

**Padrão exato para o operador ler/gravar dados de outra empresa** (extraído de `PATCH /api/admin/tenants/:slug/plano`, `src/servidor.js:1581-1605`):

```js
app.patch("/api/admin/tenants/:slug/plano", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  const emp = await empresas.buscarPorSlug(slug);
  if (!emp) return res.status(404).json({ erro: "Tenant não encontrado." });
  // lê/grava dados desse `emp` — nunca req.slug, que não existe sob exigeSuperAdmin
});
```

Para uma futura rota de config por tenant, o padrão a compor é: `:slug` na URL → `empresas.buscarPorSlug(slug)` (`src/empresas.js:41` tem `tenantDir(slug)`) → `store.ensure(tenantDir)` / `store.getConfig` / `store.setConfig` (as mesmas funções que a rota self-service do dono usa, ver `config-empresa-jsonb.md`).

## Limites e cotas

NÃO DOCUMENTADO (não há paginação/rate limit específico nas rotas de admin consultadas).

## Erros conhecidos e tratamento

`GET /api/admin/tenants/:slug/assinatura` e afins devolvem `404 { erro: "Tenant não encontrado." }` quando o slug não existe (`src/servidor.js:1584` padrão repetido). Demais erros NÃO DOCUMENTADOS nesta ingestão.

## Riscos para a nossa implementação

- Não há um padrão irmão direto de "aba com sub-navegação dentro do modal de tenant" — a nova aba "Relatórios Telegram" precisa decidir entre (a) virar um bloco a mais dentro de `renderTenantModal` (junto de Resumo/Ações/Histórico) ou (b) um modal/tela própria. Fica para a F2.
- Como `exigeSuperAdmin` não popula `req.tenantDir`, qualquer rota nova de config-por-tenant no admin-master precisa resolver isso explicitamente a cada chamada (repetir o padrão de `buscarPorSlug` + `tenantDir`), não reusar o middleware do dono.
- Precisa decidir se o CAMPO fica editável só pelo admin-master (operador cadastra o chat_id do dono) ou também pelo próprio dono no painel normal (`admin.html`/`app.js`) — o pedido do usuário foi explicitamente "configurar pelo cadastro do admin-master", mas vale confirmar na F2 se é EXCLUSIVO de lá.

## Fonte

`public/admin-master.html:97-299`, `public/app-admin.js:624-793`, `public/admin.html:307-340`, `src/servidor.js:302-319,1218,1435,1447,1474,1497,1551,1581-1605,1611,1637,1656`, `src/empresas.js:41`, `docs/super-admin.md:24-27,55-56,83` — acessado em 2026-09-06

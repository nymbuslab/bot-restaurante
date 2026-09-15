# Base técnica atual — índice

Levantamento interno para a arquitetura de Compras, Insumos, Estoque, ficha técnica e custos. Esta
base preserva o levantamento de entrada do programa, anterior às Sprints 01 a 03.
Não confundir limites daquele baseline (como ausência de papéis operacionais)
com o código já homologado. Estado atual em `../README.md`, `../sprint-03/tasks.md`
e `../../equipe.md`; decisões permanecem em `../02-DECISOES-PENDENTES.md`.

| Área | Documento | Estado resumido |
|---|---|---|
| Catálogo e identidade | `01-CATALOGO-E-IDENTIDADE.md` | Produtos em JSONB; IDs estáveis apenas dentro do catálogo |
| Estoque atual | `02-ESTOQUE-ATUAL.md` | Saldo no JSONB; trilha relacional; transação com trava por empresa |
| Vendas e cancelamentos | `03-VENDAS-E-CANCELAMENTOS.md` | Baixa e devolução atômicas; cancelamento ainda aceita devolução implícita |
| Insumos e ficha | `04-INSUMOS-E-FICHA-INERTES.md` | Migration, motor puro e testes existem; persistência operacional não existe |
| Autenticação e planos | `05-AUTH-PLANOS-E-PERMISSOES.md` | JWT + tenant; gate Plano Completo; sem papéis operacionais por usuário |
| Banco e multi-tenant | `06-BANCO-TENANCY-E-TRANSACOES.md` | Postgres parametrizado; `empresa_id`; RLS deny-all para tabelas operacionais |
| Retenção e auditoria | `07-RETENCAO-E-AUDITORIA.md` | estoque apaga trilha após doze meses; incompatível com decisão de cinco anos |
| Testes e interface | `08-TESTES-E-INTERFACE.md` | cobertura madura do legado; nenhuma tela operacional de Compras/Insumos |

## Fontes centrais

- `../00-AUDITORIA-BASELINE.md`
- `../02-DECISOES-PENDENTES.md`
- `../../../src/store.js`
- `../../../src/estoque-db.js`
- `../../../public/estoque.js`
- `../../../src/servidor.js`
- `../../../src/pedidos.js`
- `../../../src/caixa.js`
- `../../../src/mesas-db.js`
- `../../../public/insumos.js`
- `../../../supabase/migrations/20260816210000_insumos.sql`

# Backend e isolamento por tenant

## Contrato de entrada

O padrão de estoque resolve `empresa_id` a partir de `tenantDir` e mantém cache por slug (`src/estoque-db.js:13-27`). As rotas privadas usam `exigeAuth`; recursos do Plano Completo chamam `exigePdv` antes de operar (`src/servidor.js:2126-2262,2714-2723`).

O desenho aprovado exige um novo `src/insumos-db.js` e rotas `/api/insumos` atrás de `exigePdv`, mas o contrato detalhado de cada operação é NÃO DOCUMENTADO.

## Contrato de saída

O módulo `estoque-db` existente mapeia linhas SQL para camelCase e devolve listas de movimentos, resumos por tipo e ids inseridos (`src/estoque-db.js:31-118`). Para o CRUD de insumos, formato de resposta e códigos de sucesso são NÃO DOCUMENTADO.

## Limites e cotas

Como padrão reaproveitável, `estoqueDb.listar` usa limite padrão de 30 e restringe o máximo a 100 (`src/estoque-db.js:75-99`). `estoqueDb.resumo` usa 30 dias por padrão e restringe a janela a 365 dias (`src/estoque-db.js:101-118`). Esses números pertencem ao extrato existente; a aplicação deles ao CRUD da Fase 3 é NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

`exigePdv` responde 403 quando o plano não libera o recurso e 500 quando falha a verificação do plano (`src/servidor.js:2714-2723`). As rotas de estoque respondem 400 para entrada inválida, 404 quando o saldo não existe em operações específicas e 500 para falha de leitura (`src/servidor.js:2126-2293`).

O novo módulo e as rotas de insumos ainda não existem; mensagens e mapeamento de conflito de nome são NÃO DOCUMENTADO.

## Riscos para a nossa implementação

Consultar ou alterar por id sem `empresa_id` quebraria o isolamento multi-tenant. Criar rotas só com `exigeAuth` liberaria Insumos no Plano Essencial, contrariando o desenho aprovado. Traduzir toda falha SQL para 400 esconderia indisponibilidade de infraestrutura como erro do usuário.

## Fonte

`src/estoque-db.js`, `src/servidor.js` e `docs/superpowers/specs/2026-08-16-insumos-design.md` — acessados em 2026-09-13

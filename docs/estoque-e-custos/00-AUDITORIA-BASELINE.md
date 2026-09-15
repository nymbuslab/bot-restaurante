# Auditoria de baseline antes de Compras e Insumos

Data: 2026-09-13
Escopo: código, testes, dados, implantação, segurança de dependências e documentação.
Postura: somente leitura; nenhum dado de cliente ou banco de produção foi consultado ou alterado.

## Veredito

O sistema atual está operacional e tem boas proteções para venda, caixa e estoque. A nova linha
de Compras e custos, porém, não deve começar antes de uma estabilização P0/P1. A principal razão é
que ela atravessará dois modelos de saldo e passará a afetar valores financeiros usados na ficha
técnica e na margem.

## Baseline comprovado

| Verificação | Resultado |
|---|---|
| Sintaxe (`npm run check`) | 158 arquivos aprovados |
| Suíte rápida (`npm run test:ci`) | 721 de 721 testes aprovados, 75 arquivos |
| Integração (`npm run test:integracao`) | 67 de 67 testes aprovados, 10 arquivos |
| Produção pública | `/health` respondeu HTTP 200 |
| CI remoto do último commit publicado | aprovado |
| Segredos | `.env` e `.env.test` ignorados; exemplos sem valores reais versionados |

A integração cobre bot, caixa, venda, cancelamento, PDV, mesas, isolamento entre empresas,
recálculo de preços no servidor, comanda e Stripe em modo de teste. Ela não cobre Compras ou
Insumos operacionais, porque essas áreas ainda não existem.

## Proteções que devem ser preservadas

- Toda consulta e mutação de negócio inclui `empresa_id` ou resolve o tenant autenticado.
- Baixa, devolução e ajuste do estoque atual usam transação e trava `FOR UPDATE` na empresa.
- O movimento de estoque é gravado na mesma transação da mudança de saldo.
- Cancelamentos possuem caminhos de devolução testados.
- O servidor recalcula os itens e não aceita preço enviado pelo navegador como verdade.
- Testes com banco usam um projeto descartável e possuem travas contra produção.
- As rotas do Plano Completo possuem gate no servidor, não apenas no menu.

## Estado técnico relevante

- Produtos e variações guardam saldo em `empresas.cardapio` (JSONB).
- Insumos guardam saldo na tabela relacional `insumos`.
- `estoque_movimentos` é trilha, não fonte do saldo, e não guarda custo nem compra de origem.
- `public/insumos.js` contém cálculo puro e 21 testes, mas está inerte.
- Não existem `src/insumos-db.js`, rotas operacionais de Insumos ou tela ativa.
- `item.precoCusto` pode ser editado, mas não é consumido por cálculo operacional.
- Não existem tabelas de compras, itens de compra, fornecedores ou histórico de custo.
- Migrations não são aplicadas no boot do container; o deploy é manual.
- O backend e o frontend principais são monolíticos (`src/servidor.js`, `public/app.js` e
  `public/style.css`), aumentando a área de regressão de mudanças grandes.

## Achados P0

### P0-01 — Dependências com alertas de segurança

O `npm audit --omit=dev` reportou 8 vulnerabilidades: 4 altas e 4 moderadas. Há alertas no
`multer` usado diretamente no upload autenticado, no pacote de endereço IP usado pelo rate limit
e em dependências transitivas do Baileys (`axios`, `sharp` e `protobufjs`). Isso não comprova que
o sistema foi explorado, mas exige atualização isolada, revisão do diff do lockfile e regressão
completa antes da feature gigante.

**Resolvido em 2026-09-13.** `multer` passou a 2.3.0 e `express-rate-limit` a 8.7.0. As correções
transitivas levaram `axios` a 1.20.0, `sharp` a 0.35.4, `protobufjs` a 7.6.6, `ip-address` a
10.7.0 e `body-parser` a 1.20.8. O Express permaneceu na série 4 e o Baileys na série 6; um
`override` restrito colocou `qs` 6.16.0 no Express 4 sem antecipar migração de framework.
Resultado: `npm audit --omit=dev` com **0 vulnerabilidades**.

Evidência de regressão: instalação limpa; Node 22.23.2; 159 arquivos sem erro de sintaxe;
723/723 testes rápidos; 67/67 integrações; testes HTTP focados no limite de upload e separação do
rate limit pelo `Fly-Client-IP`; carregamento de Baileys e Sharp confirmado no Node 22. Nenhum bot
ou dado de produção foi manipulado.

### P0-02 — Escopo antigo de Insumos superado

O plano anterior tratava saldo como somente leitura e custo como campo manual. A direção aprovada
agora é `Compras → Insumos → Estoque`, com entrada e custo de aquisição. Implementar o protótipo
antigo criaria retrabalho e um fluxo incompleto.

### P0-03 — Implantação sem migration automática

Uma versão de aplicação que espera tabelas novas falhará se chegar antes do schema. O rollout deve
ser migration compatível primeiro, depois código ainda desligado, smoke test e ativação separada.

### P0-04 — Produção sem backup restaurável disponível

Na consulta de 2026-09-13, teste e produção retornaram `backups: []` e `pitr_enabled: false` pela
API de backups do Supabase. Logo, não existe hoje ponto de restauração disponível por esse caminho.
A afirmação antiga de que o backup estava “resolvido pelo Supabase” foi corrigida nos documentos
vivos. Nenhuma migration nova deve alcançar produção antes de existir backup com restauração
ensaiada. Objetos do Storage exigem cópia própria: backup do banco guarda metadados, não recompõe
um arquivo apagado.

### Resultado da auditoria de schema

- Teste e produção: Postgres 17.6, 46 migrations em ambos e nenhuma divergência com o repositório.
- Ambos possuem 18 tabelas públicas e RLS habilitado em todas.
- A conexão da aplicação não é superuser, mas ignora RLS; o isolamento por `empresa_id` continua
  obrigatório em toda query de backend.
- Produção medida somente por agregados: banco pequeno e 42 objetos no Storage. Nenhum conteúdo,
  nome de cliente ou dado pessoal foi lido.

## Achados P1

1. Uma compra precisa atualizar produtos em JSONB e insumos relacionais na mesma transação.
2. A confirmação deve ser idempotente e travar o documento para impedir entrada duplicada.
3. É necessário definir custo médio, saldo negativo, estoque inicial e arredondamento.
4. Cancelar compra não pode apagar história nem recalcular ingenuamente consumo posterior.
5. Desconto, frete, impostos e outras despesas precisam de regra de rateio explícita.
6. Venda precisa guardar fotografia do custo; custo futuro não pode mudar a margem histórica.
7. A migração para baixa por ficha deve impedir baixa dupla de produto e ingredientes.
8. Entrada manual atual deve continuar distinguível de entrada originada por compra.
9. Compras exigem histórico próprio; a retenção de 12 meses do extrato de estoque não basta como
   única trilha documental.
10. Custos incompletos devem aparecer como incompletos, nunca como zero silencioso.
11. Fornecedor precisa de identidade ou snapshot suficiente para preservar o documento histórico.
12. A ativação deve poder ocorrer por etapa/tenant, sem liberar tudo ao Plano Completo de uma vez.

## Limites desta auditoria

Não foram verificados dados reais, colisões de nomes, restauração de backup, plano contratado no
Supabase, drift entre migrations locais e produção, logs privados do Fly ou comportamento visual
de telas. Esses itens entram como gates operacionais antes de qualquer migration ou rollout.

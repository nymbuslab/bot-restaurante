# Plano de estabilização P0/P1

Este plano acontece antes da arquitetura detalhada e antes de qualquer implementação de Compras.
Cada pacote deve ser pequeno, revisável e reversível.

## Etapa A — P0 de segurança de dependências ✅ concluída em 2026-09-13

### Trabalho

- Levantar versões corrigidas de `multer`, `express-rate-limit`, Express/`qs` e Baileys.
- Atualizar somente o conjunto necessário, sem `npm audit fix` cego.
- Revisar mudanças transitivas de `axios`, `sharp`, `protobufjs` e `ip-address`.
- Revalidar upload válido, upload inválido, limite de 2 MB, rate limit e conexão do bot.

### Critério de saída

- `npm audit --omit=dev` sem vulnerabilidade corrigível alta, ou exceção documentada com exposição
  analisada e prazo.
- Sintaxe, suíte rápida e integração verdes.
- Smoke de upload e carregamento técnico do bot. A sessão real não deve ser reiniciada só para
  validar dependência; simulador e integração cobrem o comportamento sem risco de banimento.
- Commit próprio, sem código de Compras misturado.

### Resultado

- `npm audit --omit=dev`: 0 vulnerabilidades.
- Express 4 e Baileys 6 preservados; nenhuma migração major ou RC introduzida.
- Testes focados de Multer/rate limit, 723 testes rápidos e 67 integrações aprovados.
- Instalação limpa e smoke de Baileys/Sharp aprovados no Node 22.23.2.
- Alterações ainda locais, sem commit ou deploy.

## Etapa B — P0 de rollout e recuperação ✅ concluída em 2026-09-16

### Trabalho

- Confirmar o backup disponível e executar teste de restauração em ambiente não produtivo.
- Conferir o drift das 46 migrations entre repositório, teste e produção, somente leitura.
- Escrever checklist de migration-first, código desligado, smoke, ativação e rollback.
- Definir observabilidade mínima: logs de confirmação, reversão e falha, sem dados pessoais.

### Critério de saída

- Evidência de backup/restauração e schema registrada.
- Rollback técnico e operacional descrito antes da primeira migration nova.
- Nenhuma ativação depende de editar código às pressas em produção.

### Auditoria realizada em 2026-09-13

- 46 migrations locais, 46 no teste e 46 na produção; nenhuma divergência.
- Postgres 17.6 nos dois projetos; 18 tabelas públicas, todas com RLS.
- Backups disponíveis: zero; PITR: desligado nos dois projetos.
- Checklist de implantação e rollback criado em
  [`03-CHECKLIST-ROLLOUT-E-ROLLBACK.md`](03-CHECKLIST-ROLLOUT-E-ROLLBACK.md).
- Falta escolher e implantar uma estratégia de backup, ensaiar restauração fora de produção e
  registrar RPO/RTO. Até isso acontecer, o gate para migrations novas permanece fechado.

### Decisão de 2026-09-13

O Supabase Pro não será contratado neste momento. O P0-B permanece aberto, mas não bloqueia a
descoberta e a arquitetura P1. Ele bloqueia somente migration e ativação em produção.

Alternativa aceita para uma implantação futura: gerar imediatamente antes da migration um dump
lógico, criptografá-lo e armazená-lo fora do repositório; copiar separadamente os objetos do
Storage; restaurar ambos no projeto descartável e conferir os totais. O procedimento só pode ser
automatizado depois que o dono definir o destino seguro e a forma de guardar a chave.

### Resultado (2026-09-16)

- Estratégia implantada: `pg_dump --schema=public --no-privileges` (schemas internos do Supabase
  não são nossos e já vêm prontos em qualquer projeto) + cópia separada dos objetos do bucket
  `cardapio` do Storage, empacotados e criptografados com `age` (chave assimétrica), enviados ao
  Cloudflare R2 via GitHub Actions diário (`.github/workflows/backup.yml`, 04:00 BRT).
- Restauração ensaiada de ponta a ponta contra o projeto Supabase de testes
  (`scripts/restaurar-backup.js`): schema `public` recriado do zero, 18 tabelas restauradas,
  `empresas` e `pedidos` com contagem batendo, Storage reenviado.
- RPO ~24h (intervalo do cron diário). RTO ~1h — majoritariamente coordenação humana (localizar o
  arquivo mais recente no R2 e recuperar a chave privada, guardada pelo dono fora do repositório);
  a restauração técnica em si, no volume atual de dados, levou poucos minutos no ensaio.
- P0-B encerrado — ver evidência em [00-BLOQUEIOS.md](00-BLOQUEIOS.md) e detalhe operacional em
  [../gotchas.md](../gotchas.md).

## Etapa C — P1 de invariantes financeiras e de estoque ✅ concluída em 2026-09-14

### Trabalho

- Fechar as decisões de [02-DECISOES-PENDENTES.md](02-DECISOES-PENDENTES.md).
- Especificar uma transação única de confirmação de compra.
- Definir idempotência, estados do documento e correções por movimento compensatório.
- Definir custo médio, fotografia do custo na venda e tratamento de custo incompleto.
- Definir a convivência entre estoque próprio do produto e baixa por ficha.

### Critério de saída

- Exemplos numéricos aprovados, incluindo arroz em pacotes, desconto/frete, saldo negativo,
  confirmação repetida, cancelamento e venda posterior.
- Invariantes traduzidas em constraints e testes antes de código de interface.

### Resultado

- Dezoito decisões aprovadas em
  [`02-DECISOES-PENDENTES.md`](02-DECISOES-PENDENTES.md), cada uma com casos de aceite.
- Fechados custo médio, precisão, implantação, rateio, idempotência, estorno, tipos de entrada,
  conciliação, baixa exclusiva, saldo negativo, cancelamento, CMV, rendimento, fornecedores,
  datas, gates, retenção e variações.
- A tradução concreta para tabelas, constraints e testes executáveis é a primeira obrigação da
  arquitetura. Nenhuma interface ou migration pode antecedê-la.

## Etapa D — Arquitetura e modularização mínima ⏭️ próxima

Não é uma refatoração geral. A nova feature deve nascer em módulos próprios para não ampliar os
monólitos atuais:

- persistência de compras;
- cálculo de custo puro;
- serviço transacional de estoque;
- rotas finas;
- interface carregada por módulo próprio.

### Critério de saída

- Fronteiras e contratos aprovados na arquitetura.
- Nenhuma lógica financeira nova espalhada diretamente por `src/servidor.js` ou `public/app.js`.

## Etapa E — Arquitetura e experiência novas

Começa após A e C. O P0-B (resolvido em 2026-09-16) não bloqueia mais a etapa 6 nem ativação em
produção. A sequência interna será:

1. descoberta de Compras;
2. arquitetura de dados e transações;
3. contrato de API;
4. protótipo desktop/mobile;
5. plano executável e auditoria SprintX;
6. migrations aditivas;
7. backend desligado por gate;
8. interface e validação;
9. ativação gradual;
10. ficha técnica e baixa de insumos em etapa posterior.

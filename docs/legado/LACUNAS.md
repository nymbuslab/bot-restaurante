# Lacunas do perfil

> Substitua TODOS os marcadores `{{assim}}` ao acrescentar uma linha.
> Todo `NÃO DETERMINADO` do PERFIL.md tem uma linha correspondente aqui.
>
> Uma lacuna não é uma falha do mapeamento: é o mapeamento sendo honesto.
> Um PERFIL com dez afirmações verificadas e cinco lacunas é um bom PERFIL.
> Um PERFIL com quinze afirmações plausíveis e nenhuma lacuna é perigoso, porque o
> raio de impacto vai ser calculado em cima dele.

Atualizado em: 2026-09-05

---

## Lacunas abertas

| # | Seção do PERFIL | O que falta | Por que não foi possível determinar | O que resolveria | Prioridade |
|---|---|---|---|---|---|
| L-01 | 7 Zonas de risco | Quem valida uma mudança em cada uma das seis zonas de risco (financeiro, assinatura, autenticação, LGPD, cálculo contratual, dado histórico) | Não há arquivo `CODEOWNERS`, e o histórico de commits mostra um único autor (Pabllo Martins) sem papel de revisor distinto documentado em `docs/` | Resposta do dono do projeto: quem (pessoa ou papel) revisa/aprova mudança em cada zona antes de ir para produção | alta |
| L-02 | 5 Cobertura de teste verdadeira | Cobertura real de `src/servidor.js`, `src/caixa.js`, `src/empresas.js`, `src/stripe.js`, `src/multi-bot.js` e demais arquivos não exercitados por `npm test` | A cobertura desses arquivos vem de `test/integracao/*.test.js`, que toca um banco Postgres real (`.env.test`) e não pôde ser executado nesta varredura (o roteiro da Camada 1 proíbe rodar scripts que escrevam em banco) | Rodar `npm run test:integracao` num ambiente autorizado com `.env.test` configurado, e registrar a cobertura combinada | alta |
| L-03 | 1 Stack e versões reais | Versão exata do motor PostgreSQL usado em produção | É infraestrutura gerenciada pelo Supabase, sem arquivo no repositório que declare a versão do motor | Consultar o painel do Supabase (Settings → Database) e registrar a versão | média |
| L-04 | 2 Pontos de entrada / Filas e workers | Conteúdo detalhado de `agente-impressora/` (como o app Electron consome as rotas de impressão, se há outro entry point além do polling HTTP) | Fora do escopo desta Camada 1, que priorizou o repositório principal (`src/`, `public/`); o app tem `package.json`/build próprio não varrido linha a linha | Rodar a Camada 1 (ou uma extensão dela) apontada especificamente para `agente-impressora/` | média |
| L-05 | 2 Comandos de CLI | Se `scripts/migrar-convenios.js` foi removido intencionalmente após uso único (o schema tem uma migração `20260713120000_drop_fiado.sql` que sugere a feature de convênio/fiado foi descontinuada) ou se é uma referência quebrada por engano | O arquivo não existe no working tree atual; não foi investigado o histórico completo de quando/por que foi removido | Perguntar ao dono do projeto, ou rodar `git log --diff-filter=D -- scripts/migrar-convenios.js` para confirmar remoção deliberada | média |
| L-06 | 8 Áreas suspeitas de código morto | Se os módulos de referência única (`src/cep.js`, `src/incidentes.js`, `src/plataforma.js`, `src/stripe.js`, `src/wa-auth.js`) têm alguma função interna não usada mesmo dentro do único arquivo que os importa | Esta varredura verificou apenas a contagem de módulos importadores, não o uso de cada função exportada individualmente | Grep função por função exportada desses 5 arquivos contra todo o repositório (Camada 10) | baixa |

### Prioridade alta

Reserve para as lacunas que **travam trabalho**:

- **Quem valida uma zona de risco (L-01).** Sem ela, a Camada 11 não tem a quem endereçar, e o
  primeiro trabalho que tocar qualquer uma das seis zonas descritas na seção 7 do PERFIL vai
  precisar da resposta antes de planejar.
- **Cobertura real da camada de rotas e dos módulos financeiros (L-02).** O comando de teste de
  arquivo único existe e funciona (não é lacuna), mas o número de cobertura desta Camada 1 é
  parcial por não ter rodado a suíte de integração — subestimar ou superestimar essa cobertura
  distorce o raio calculado para qualquer trabalho em `src/servidor.js` ou `src/caixa.js`.

---

## Consequência de cada lacuna no cálculo do raio

> Sinal não coletável conta como PIOR CASO (regra 3). Esta tabela deixa isso explícito,
> para que ninguém interprete lacuna como neutralidade.

| Lacuna | Sinal afetado | Como o raio a trata |
|---|---|---|
| L-01 | zona de risco tocada / validador disponível | pior caso assumido: qualquer trabalho nas seis zonas da seção 7 é ALTO até que exista resposta registrada de quem valida |
| L-02 | cobertura de teste | pior caso assumido: cobertura ausente em `src/servidor.js`, `src/caixa.js`, `src/empresas.js`, `src/stripe.js`, `src/multi-bot.js` e todo `public/*.js` não listado no relatório unitário, mesmo sabendo que a suíte de integração provavelmente cobre parte disso |
| L-03 | nenhum sinal do raio diretamente | não afeta o cálculo do raio; é relevante só para decisão de compatibilidade de SQL |
| L-04 | chamadores / zona tocada | pior caso assumido: qualquer trabalho que toque `agente-impressora/` é tratado como área não mapeada (região fora do escopo desta Camada 1) até ser mapeada |
| L-05 | migração / dado histórico | não afeta o raio diretamente; é uma limpeza de manifesto, não uma mudança de comportamento |
| L-06 | código morto confirmado | não afeta o raio; relevante só para a Camada 10 |

---

## Lacunas fechadas

> Append-only, como o DIVIDA.md. Fechar uma lacuna é acrescentar uma linha aqui,
> não apagar a linha acima.

| # | Fechada em | Como foi resolvida | Quem respondeu |
|---|---|---|---|
| (nenhuma até o momento) | | | |

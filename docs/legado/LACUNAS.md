# Lacunas do perfil

> Substitua TODOS os marcadores `{{assim}}` ao acrescentar uma linha.
> Todo `NÃO DETERMINADO` do PERFIL.md tem uma linha correspondente aqui.
>
> Uma lacuna não é uma falha do mapeamento: é o mapeamento sendo honesto.
> Um PERFIL com dez afirmações verificadas e cinco lacunas é um bom PERFIL.
> Um PERFIL com quinze afirmações plausíveis e nenhuma lacuna é perigoso, porque o
> raio de impacto vai ser calculado em cima dele.

Atualizado em: 2026-09-05 (L-01 a L-06: todas fechadas exceto os restos anotados dentro de L-02 e L-04)

---

## Lacunas abertas

| # | Seção do PERFIL | O que falta | Por que não foi possível determinar | O que resolveria | Prioridade |
|---|---|---|---|---|---|
| L-01 | 7 Zonas de risco | ~~Quem valida uma mudança em cada uma das seis zonas de risco~~ **FECHADA em 2026-09-05 — ver Lacunas fechadas** | Não há arquivo `CODEOWNERS`, e o histórico de commits mostra um único autor (Pabllo Martins) sem papel de revisor distinto documentado em `docs/` | Resposta do dono do projeto: quem (pessoa ou papel) revisa/aprova mudança em cada zona antes de ir para produção | alta |
| L-02 | 5 Cobertura de teste verdadeira | ~~Cobertura real de `src/servidor.js`, `src/caixa.js`, `src/empresas.js`, `src/stripe.js`~~ **FECHADA em 2026-09-05 — ver Lacunas fechadas** (`src/multi-bot.js` e os demais módulos de integração externa seguem sem cobertura real medida — ver seção 5 do PERFIL) | A cobertura desses arquivos vem de `test/integracao/*.test.js`, que toca um banco Postgres real (`.env.test`) e não pôde ser executado na Camada 1 original (o roteiro proíbe rodar scripts que escrevam em banco) | Rodar `npm run test:integracao` num ambiente autorizado com `.env.test` configurado, e registrar a cobertura combinada | alta |
| L-03 | 1 Stack e versões reais | ~~Versão exata do motor PostgreSQL usado em produção~~ **FECHADA em 2026-09-05 — ver Lacunas fechadas** | É infraestrutura gerenciada pelo Supabase, sem arquivo no repositório que declare a versão do motor | Consultar o painel do Supabase (Settings → Database) e registrar a versão | média |
| L-04 | 2 Pontos de entrada / Filas e workers | ~~Conteúdo detalhado de `agente-impressora/`~~ **FECHADA em 2026-09-05 — ver Lacunas fechadas** | Fora do escopo desta Camada 1, que priorizou o repositório principal (`src/`, `public/`); o app tem `package.json`/build próprio não varrido linha a linha | Rodar a Camada 1 (ou uma extensão dela) apontada especificamente para `agente-impressora/` | média |
| L-05 | 2 Comandos de CLI | ~~Se `scripts/migrar-convenios.js` foi removido intencionalmente~~ **FECHADA em 2026-09-05 — ver Lacunas fechadas** | O arquivo não existe no working tree atual; não foi investigado o histórico completo de quando/por que foi removido | Perguntar ao dono do projeto, ou rodar `git log --diff-filter=D -- scripts/migrar-convenios.js` para confirmar remoção deliberada | média |
| L-06 | 8 Áreas suspeitas de código morto | Se os módulos de referência única (`src/cep.js`, `src/incidentes.js`, `src/plataforma.js`, `src/stripe.js`, `src/wa-auth.js`) têm alguma função interna não usada mesmo dentro do único arquivo que os importa | Esta varredura verificou apenas a contagem de módulos importadores, não o uso de cada função exportada individualmente | Grep função por função exportada desses 5 arquivos contra todo o repositório (Camada 10) | baixa |

### Prioridade alta

Nenhuma pendente no momento — **L-01 e L-02 foram fechadas em 2026-09-05** (ver Lacunas fechadas).
Registro do que elas travavam, para contexto histórico:

- **Quem valida uma zona de risco (L-01, fechada).** Sem ela, a Camada 11 não tinha a quem
  endereçar, e o primeiro trabalho que tocasse qualquer uma das seis zonas da seção 7 do PERFIL
  precisaria da resposta antes de planejar. Resolvida com a designação padrão do dono.
- **Cobertura real da camada de rotas e dos módulos financeiros (L-02, fechada).** O número de
  cobertura da Camada 1 original era parcial por não ter rodado a suíte de integração — hoje
  `src/servidor.js`, `src/caixa.js`, `src/empresas.js` e `src/stripe.js` têm número real medido.

---

## Consequência de cada lacuna no cálculo do raio

> Sinal não coletável conta como PIOR CASO (regra 3). Esta tabela deixa isso explícito,
> para que ninguém interprete lacuna como neutralidade.

| Lacuna | Sinal afetado | Como o raio a trata |
|---|---|---|
| L-01 | zona de risco tocada / validador disponível | **FECHADA em 2026-09-05.** Zona tocada continua ALTO por regra própria (Sinal 5), independente de validador — isso nunca foi o que a lacuna afetava. O que a lacuna travava era a Camada 11: sem "quem valida" registrado, o plano não podia ser gerado. Agora resolvido — a resposta já vem do PERFIL, sem precisar perguntar de novo a cada trabalho |
| L-02 | cobertura de teste | **FECHADA.** `src/servidor.js` (51%), `src/caixa.js` (90%), `src/empresas.js` (69%) e `src/stripe.js` (58%) têm cobertura real medida via integração — deixam de contar como "ausente" para efeito de raio. `src/multi-bot.js` e todo `public/*.js` continuam pior caso (cobertura ausente) |
| L-03 | nenhum sinal do raio diretamente | **FECHADA.** Nunca afetou o cálculo do raio; era relevante só para decisão de compatibilidade de SQL |
| L-04 | chamadores / zona tocada | **FECHADA.** `agente-impressora/` agora está mapeado em `PERFIL.md`; trabalho que o tocar não precisa mais assumir "área não mapeada" |
| L-05 | migração / dado histórico | **FECHADA.** Nunca afetou o raio diretamente; era limpeza de manifesto |
| L-06 | código morto confirmado | **FECHADA.** Achado (exports não usados de `stripe.js`) registrado em `DIVIDA.md`, não afeta o raio; relevante só para a Camada 10 |

---

## Lacunas fechadas

> Append-only, como o DIVIDA.md. Fechar uma lacuna é acrescentar uma linha aqui,
> não apagar a linha acima.

| # | Fechada em | Como foi resolvida | Quem respondeu |
|---|---|---|---|
| L-01 | 2026-09-05 | Pabllo Martins designado validador padrão das seis zonas de risco (`PERFIL.md` seção 7, nota no início da seção + linha "Quem valida" de cada zona) | Pabllo Martins (dono do projeto) |
| L-02 | 2026-09-05 | `npm run test:integracao` rodado com `--experimental-test-coverage` isolado (54/54, banco de teste descartável): `servidor.js` 51,13%, `caixa.js` 90,08%, `empresas.js` 69,31%, `stripe.js` 57,93%. Registrado em `PERFIL.md` seção 5. Combinação numérica exata com o unitário não foi obtida (tentativa travou, processo encerrado por prudência) — os dois números separados já bastam pro que a lacuna pedia | Pabllo Martins (dono do projeto) |
| L-03 | 2026-09-05 | Consultado direto no Postgres de produção: `SELECT version()` → PostgreSQL 17.6 (aarch64). Registrado em `PERFIL.md` seção 1 | Pabllo Martins (dono do projeto) |
| L-04 | 2026-09-05 | `agente-impressora/` mapeado arquivo a arquivo: ponto de entrada, os dois loops de poll, a cópia vendorizada de `comanda.js` (com a implicação de que ela não sincroniza sozinha), transporte ESC/POS, testes e distribuição. Registrado em `PERFIL.md` seção 2 (Filas e workers) | Pabllo Martins (dono do projeto) |
| L-05 | 2026-09-05 | Confirmado como remoção deliberada (feature de convênio/fiado descontinuada, coerente com a migração `20260713120000_drop_fiado.sql`); a entrada `"migrar-convenios"` foi removida de `package.json` | Pabllo Martins (dono do projeto) |
| L-06 | 2026-09-05 | Grep função por função dos 5 módulos: `cep.js`, `incidentes.js`, `plataforma.js`, `wa-auth.js` têm todos os exports com pelo menos 1 chamador externo real. Achado em `stripe.js`: os exports `stripe`, `PRICE_ID`, `PRICE_ID_COMPLETO` e `PUBLISHABLE_KEY` não têm nenhum chamador fora do próprio arquivo (`src/servidor.js`, único importador, só usa `.CONFIGURADO`, `.PLANO_INFO` e as funções). Registrado em `docs/legado/DIVIDA.md`, não removido (regra 10) | Pabllo Martins (dono do projeto) |

-- Histórico de incidentes de infraestrutura (Monitoramento — Fase 2). Global,
-- não por tenant. Hoje o único gatilho são os 500 de auth (falha do exigeAuth ao
-- resolver o token → soluço de conexão ao Postgres/Supabase): a Fase 1 já logava a
-- causa no console; aqui ela vira registro consultável no painel master.
-- RÁFAGA: repetições do MESMO tipo numa janela curta (5min) são AGRUPADAS num único
-- episódio (contador `ocorrencias` + primeira/última vez) em vez de N linhas — menos
-- escrita no banco justo quando ele está frágil. O registro é best-effort (usa o
-- próprio banco): em queda total ele simplesmente não grava; em soluço transitório
-- um request seguinte costuma conseguir.
CREATE TABLE IF NOT EXISTS incidentes (
  id           bigserial PRIMARY KEY,
  tipo         text NOT NULL,                       -- 'auth_500' (por ora o único)
  mensagem     text,                                -- e.message do erro que originou
  ocorrencias  int  NOT NULL DEFAULT 1,             -- quantas vezes o episódio repetiu na janela
  primeira_vez timestamptz NOT NULL DEFAULT now(),
  ultima_vez   timestamptz NOT NULL DEFAULT now()
);

-- O painel lista os episódios mais recentes primeiro.
CREATE INDEX IF NOT EXISTS incidentes_ultima_vez_idx ON incidentes (ultima_vez DESC);

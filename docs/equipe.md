# Equipe e operadores

Implementação em homologação. A liberação em produção depende dos portões de
backup/rollout em `docs/estoque-e-custos/`, não apenas da conclusão da Sprint 03.

As consultas do dono (`resolverPorToken` e `buscarPorSlug`) leem a flag de equipe
de forma compatível com o schema anterior: coluna ausente significa flag falsa.
Isso mantém login e operações legadas disponíveis sem aplicar a migration.
As rotas novas de Equipe ainda precisam da migration no ambiente de homologação.
`npm start` usa `.env`; os testes de integração usam `.env.test`. Não confundir
o servidor em localhost com um banco local ou descartável.

## Acesso

O dono mantém seu JWT Supabase. Funcionários usam sessão opaca em
`sessionStorage`, limitada ao tenant, funcionário e dispositivo autorizado.
Somente hashes dos tokens e do PIN são persistidos no banco. Nenhuma resposta
de listagem devolve esses hashes. O dono autoriza e revoga dispositivos; o token
do dispositivo é entregue uma vez e fica no navegador autorizado.

Os seis perfis e seus acessos padrão têm fonte única em `src/permissoes.js`.
`GET /api/equipe` entrega os padrões ao editor. Ajustes individuais adicionam ou
removem permissões. A autorização efetiva é verificada no servidor, não somente
na navegação. Funcionários não alteram o próprio acesso nem concedem acesso que
não possuem. Assinatura, credenciais, exclusão de conta e dispositivos são
exclusivos do dono.

## Fluxo no painel

Equipe possui busca, filtros de ativos, PIN bloqueado e arquivados, cadastro e
edição em gaveta. O editor permite escolher 5, 15, 30 ou 60 minutos de
inatividade e desbloquear o PIN. Cinco tentativas incorretas bloqueiam por
15 minutos. O PIN tem quatro dígitos e não é exibido após o cadastro.

Trocar operador aparece no cabeçalho desktop e no rodapé do menu móvel. Antes
da troca, a conta anterior é encerrada. A sessão expirada nunca usa o refresh
do dono como alternativa. O painel monitora interação real por ponteiro,
toque ou teclado: os polls não renovam o relógio de atividade da interface.
Ao bloquear, a página volta à seleção de operador e exige PIN novamente.
O servidor também expira sessões sem requisições e recusa dispositivos revogados.

## Rotas

- `GET /api/equipe/principal`: principal autenticado, sem segredos.
- `GET/POST /api/equipe`, `PUT /api/equipe/:id`: gestão e ajustes de acesso.
- `POST /api/equipe/:id/desbloquear`: libera PIN bloqueado.
- `GET /api/equipe/dispositivos`, `POST /api/equipe/dispositivos/autorizar`,
  `DELETE /api/equipe/dispositivos/:id`: autorização exclusiva do dono.
- `POST /api/equipe/dispositivos/funcionarios`: seleção de funcionários mediante
  token de dispositivo válido.
- `POST /api/equipe/sessoes/pin`: entrada por PIN no dispositivo autorizado.
- `GET /api/equipe/atividades`: consulta somente leitura, exige `atividades.ver`.

## Atividades e gate

Todas as entradas de Equipe, inclusive seleção por dispositivo e PIN, exigem
empresa ativa, assinatura liberada, Plano Completo e `equipe_habilitada=true`.
A flag desligada barra Equipe, mas não interrompe o login e as operações legadas
do dono. Pagamento de Mesas exige também `caixa.movimentar`; cancelamento de mesa
ou item exige também `pedidos.cancelar`. Esconder a navegação não substitui esses gates.

`auditoria_operacional` registra cadastro/edição, permissões, autorização/revogação
de dispositivo, entrada por PIN, tentativas incorretas, bloqueio/desbloqueio e
negações de acesso. Mutações de equipe e seus eventos usam a mesma transação;
falha no registro reverte a mutação. Negações são registradas best-effort e sempre
continuam negadas, mesmo se o banco da auditoria falhar.

A consulta limita cada página a 100 eventos (30 no painel), ordena por ID
decrescente e usa cursor exclusivo. Filtros: evento, operador e intervalo de datas
UTC inclusivo. O tenant vem da sessão, nunca de um parâmetro da consulta.
Nomes atuais dos operadores são resolvidos dentro da mesma empresa. Detalhes são
uma lista explícita de campos operacionais; PIN, hash, token e payload bruto não entram.

A migration `20260915100000_auditoria_operacional.sql` habilita RLS deny-all e
índices por tenant/cursor, evento e ator. A tabela é separada da auditoria LGPD,
portanto o job legado de 24 meses não a apaga. Retenção mínima aprovada: cinco
anos, enquanto a empresa existir; exclusão da empresa apaga em cascata. Ainda
não há expurgo automático após cinco anos; revisar no portão de produção.
Esta etapa não adiciona auditoria transacional às mutações financeiras legadas.

## Validação

`npm run test:ci`, `npm run test:integracao` e `npm run check` são os portões
globais. `node test/visual/equipe-real.js` cria tenants descartáveis usando o
harness protegido de `.env.test`, abre o servidor real, cadastra funcionário,
autoriza dispositivo, troca por PIN e verifica 403. Também revoga o dispositivo,
confere bloqueio do operador e encontra o evento em desktop/mobile; valida cursor,
detalhes/Escape, vazio e erro/retry. O refresh
do dono é uma fixture de autenticação; as rotas de equipe e o banco são reais.

`python test/visual/equipe-ui.py` verifica layout em 1280 e 375 px, filtros,
overflow, tamanho dos controles, foco e Escape com respostas simuladas. Requer
servidor estático em `127.0.0.1:4174` servindo `public/` e Python Playwright.
As capturas são gravadas em `test/visual/resultados/`.

## Próxima etapa

Sprint 04: identidade operacional do catálogo e fornecedores. P0-B resolvido em
2026-09-16 (não bloqueia mais produção); retenção/expurgo, base legal dos dados de
operadores e rollout gradual ainda precisam de revisão antes da liberação.

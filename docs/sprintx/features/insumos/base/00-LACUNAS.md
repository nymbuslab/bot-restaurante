# Lacunas

- O desenho aprovado nomeia `/api/insumos`, mas não define os verbos HTTP, payloads, respostas ou códigos de status de cada operação. Procurado em `docs/superpowers/specs/2026-08-16-insumos-design.md`, `src/servidor.js` e `public/app.js`.
- Não está documentado se um insumo arquivado pode ser restaurado pela interface. Procurado no desenho aprovado e na migration `supabase/migrations/20260816210000_insumos.sql`.
- Não está documentado o comportamento esperado ao tentar cadastrar novamente um nome que já está ativo, além da restrição do banco. Procurado no desenho aprovado e na migration da tabela.
- O conteúdo e a interação exatos do mapa “saem na cozinha e ainda não têm ficha” não estão definidos. Procurado no desenho aprovado e em `design/`.
- Não existe protótipo de Insumos em `design/`; só foi encontrado o desenho textual aprovado em `docs/superpowers/specs/2026-08-16-insumos-design.md`.
- Não foram encontrados `src/insumos-db.js`, rotas `/api/insumos`, seção `#aba-insumos`, carregamento de `public/insumos.js` no painel ou limite `MAX_FICHA_LINHAS`. Procurado em `src/`, `public/` e `test/`.
- Não está definido se a Fase 3 terá lançamentos de saldo e extrato operacionais ou apenas cadastro e ficha; o texto da fase diz “cadastro, sem baixa”, enquanto a descrição da gaveta espelha saldo, lançamentos e extrato e a Fase 5 volta a atribuir as rotas de movimentos. Procurado no desenho aprovado.

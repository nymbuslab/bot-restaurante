# Lacunas

- **Teto de linhas para o filtro de intervalo customizado (`desde`/`ate`) em `GET /api/pedidos`.** Procurado em `src/servidor.js:2226-2237` e `src/pedidos.js:101-117` — a validação confere só o formato da data (`AAAA-MM-DD`), não o tamanho do intervalo nem um `LIMIT` na query SQL. Não documentado se isso é intencional ou um risco pré-existente fora do escopo desta correção.
- **Limite formal para decidir quando extrair uma função de `app.js` para um arquivo dual-mode testável** (como `busca.js`) vs. deixar inline. Não há um critério escrito no projeto — só o padrão observado em arquivos já extraídos.

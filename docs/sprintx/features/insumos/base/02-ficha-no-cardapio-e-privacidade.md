# Ficha no cardápio e privacidade

## Contrato de entrada

O desenho aprovado define `item.ficha` e `grupo.opcoes[].ficha` como listas de `{ insumoId, qtd }` (`docs/superpowers/specs/2026-08-16-insumos-design.md`, seção “Ficha técnica no jsonb”).

Hoje `normalizarBiblioteca` recebe grupos e reconstrói cada opção apenas com `id`, `nome` e `preco` (`public/grupos.js:59-86`). A gaveta de grupo faz outra cópia restrita ao abrir e reconstrói as opções ao salvar (`public/app.js:570-641`). O editor de produto reconstrói o item em `novoItem` ao salvar (`public/app.js:2629-2690`).

## Contrato de saída

`resolverGrupos` devolve grupos concretos com as opções normalizadas da biblioteca (`public/grupos.js:93-110`). `projetarCardapio` inclui esses grupos resolvidos na projeção pública (`src/cardapio-web.js:23-44`).

No estado atual, a ficha ainda não sobrevive aos pontos de reconstrução citados. Quando passar a sobreviver internamente, a projeção pública precisará removê-la explicitamente.

## Limites e cotas

O cardápio inteiro tem limite de 512 KiB (`src/validacao.js:11,28`). Variações têm limite de 100 por item (`src/validacao.js:14,41`). Não existe limite específico para linhas de ficha; `MAX_FICHA_LINHAS` não foi encontrado.

## Erros conhecidos e tratamento

Grupo, opção ou vínculo sem id válido é descartado pela normalização existente (`public/grupos.js:59-110`). A validação do cardápio rejeita objeto inválido, categorias ou itens fora do formato e payload acima do limite total (`src/validacao.js:26-47`), mas ainda não valida fichas.

## Riscos para a nossa implementação

Alterar apenas um dos pontos de reconstrução faz a ficha sumir após editar e salvar. Preservar a ficha em `resolverGrupos` sem criar uma whitelist pública específica expõe receita e gramatura em `GET /api/c/:slug`. Sem limite por ficha, a interface pode produzir um cardápio que só falha no teto global.

## Fonte

`public/grupos.js`, `public/app.js`, `src/cardapio-web.js`, `src/validacao.js` e `docs/superpowers/specs/2026-08-16-insumos-design.md` — acessados em 2026-09-13

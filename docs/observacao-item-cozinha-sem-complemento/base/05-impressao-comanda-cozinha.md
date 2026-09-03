# Impressão — comanda da cozinha já imprime observação por item (cupom do cliente não)

## Contrato de entrada

`Comanda.montarCozinha(pedido, config)` — `public/comanda.js:74-102` (dual-mode Node/browser, também usado puro no servidor via `require("../public/comanda")`). Recebe `pedido.itens`, cada item podendo ter `observacao`.

## Contrato de saída

Por item, se `i.observacao && i.observacao.trim()`, imprime a linha `"   Obs: " + i.observacao.trim()` logo abaixo do nome/composição/variações/opcionais do item (`public/comanda.js:92`). Também existe uma observação **geral do pedido** (`pedido.observacao`, campo separado, nível pedido — não item), impressa como "Obs. geral: ..." no rodapé da comanda (`public/comanda.js:97-98`).

Já `Comanda.montarCupom` (cupom do cliente, `public/comanda.js:104-...`) **não imprime `i.observacao`** — só nome, quantidade, variações e opcionais por item (`public/comanda.js:139-146`). Confirmado por leitura: não há referência a `observacao` no corpo dessa função.

## Limites e cotas

Largura fixa de 48 colunas (`LARGURA = 48`, `public/comanda.js:8`), texto quebrado por `quebrar()` onde aplicável — mas a linha de observação do item (`"   Obs: " + texto`) **não passa por `quebrar()`**, então uma observação de até 200 caracteres pode ultrapassar a largura da bobina 80mm sem quebra de linha automática nesse ponto específico. Isso é comportamento pré-existente (não introduzido por esta feature), mas relevante porque a feature vai aumentar a frequência de itens com observação impressa.

## Erros conhecidos e tratamento

NÃO DOCUMENTADO.

## Riscos para a nossa implementação

- **Nenhuma mudança em `comanda.js` é necessária** para o pedido em si sair certo: assim que `observacao` chegar preenchida no item (dos três canais), a via da cozinha já imprime. O gap é só fazer o PDV/Mesas oferecerem a UI para preencher (ver `03-`).
- Risco de UX pré-existente identificado (não é bug novo desta feature, mas fica registrado): observação sem quebra de linha pode estourar a largura da bobina se o cliente/operador digitar um texto longo sem espaços úteis para quebrar. Fora do escopo corrigir aqui, salvo decisão em contrário na F2.

## Fonte

`public/comanda.js:74-153` — acessado em 2026-09-03

# Lacunas da base

- A fonte atual não define se Mesas e Comandas abertas devem ficar em seções simultâneas, abas internas ou uma grade única. Procurado em `public/admin.html`, `public/app.js`, `design/UI.md` e na feature anterior `pdv-balcao-em-aberto`.
- A fonte atual não define quais capacidades exclusivas de Mesa devem ser oferecidas à Comanda avulsa: taxa de serviço, número de pessoas, recebimento parcial, transferência ou solicitação de conta. Procurado em `src/mesas-db.js`, `src/servidor.js` e `docs/planos-e-frete.md`.
- As permissões `pdv.operar`, `mesas.operar`, `pedidos.ver`, `pedidos.editar`, `pedidos.cancelar` e `caixa.movimentar` podem divergir para um funcionário. A fonte atual não define qual combinação governa o card e suas ações dentro de Mesas / Comandas. Procurado nas rotas de `src/servidor.js` e nos gates atuais do painel.

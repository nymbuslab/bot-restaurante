# Lacunas

- Não documentado: se o dono quer o mesmo comportamento no card de sabor vindo da busca do PDV (`pdvVariacaoClick`, `public/app.js:6007`) quando o item tem `cozinha === true`, variações mas nenhum grupo de composição/complemento. Fica para a F2 confirmar se entra no escopo.
- Não documentado: se o modal deve continuar obrigatório (usuário PODE cancelar sem observação) ou se o campo observação deve virar obrigatório para itens de cozinha. O padrão atual (cardápio web e modal do PDV) sempre trata observação como opcional.

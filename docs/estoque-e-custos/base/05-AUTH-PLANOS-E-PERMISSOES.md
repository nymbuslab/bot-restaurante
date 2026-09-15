# Autenticação, planos e permissões

## Contrato de entrada

- Rotas autenticadas recebem access token do Supabase no cabeçalho Bearer. O middleware valida o
  JWT, resolve o tenant pelo `user_id`, verifica `ativo` e aquece o cache. Fontes:
  `../../../src/servidor.js:223-258` e `../../../src/empresas.js:187-211`.
- Gates de estoque e PDV consultam novamente a empresa pelo slug e exigem acesso liberado e plano
  completo. Fontes: `../../../src/servidor.js:2714-2723` e
  `../../../src/empresas.js:338-361`.

## Contrato de saída

- Token ausente, inválido ou tenant inativo recebe `401`; falha de infraestrutura na autenticação
  recebe `500`. Fonte: `../../../src/servidor.js:226-257`.
- Recurso fora do Plano Completo recebe `403`; falha ao verificar plano recebe `500`. Fonte:
  `../../../src/servidor.js:2714-2723`.
- Assinatura inativa para ações cobertas pelo gate geral recebe `402`. Fonte:
  `../../../src/servidor.js:261-273`.

## Limites e cotas

- O modelo atual associa um `user_id` principal à empresa; papéis operacionais múltiplos por tenant:
  **NÃO DOCUMENTADO**.
- Gates separados existem por recurso, embora hoje usem a mesma regra comercial. Fonte:
  `../../../src/empresas.js:348-377`.

## Erros conhecidos e tratamento

- A primeira requisição após deploy falhava com cache frio; o aquecimento foi centralizado no
  middleware. Fonte: `../../../src/servidor.js:242-257`.
- O frontend pode antecipar bloqueios, mas a resposta da API é a autoridade do gate de estoque.
  Fonte: `../../../public/app.js:718-747`.

## Riscos

- Cadastro, consulta de custo, confirmação, estorno e conciliação ainda não possuem permissões
  separadas.
- Rebaixar plano não pode interromper baixa por ficha já ativa; o gate de escrita e o motor de venda
  precisarão ser independentes.
- Feature flag por tenant para o rollout novo: **NÃO DOCUMENTADO**.

## Fonte

- `../../../src/servidor.js:223-273`
- `../../../src/servidor.js:2714-2723`
- `../../../src/empresas.js:175-211`
- `../../../src/empresas.js:335-377`
- `../02-DECISOES-PENDENTES.md:582-621`

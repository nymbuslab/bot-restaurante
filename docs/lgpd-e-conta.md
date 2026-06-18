# Conta de acesso e Privacidade (LGPD)

Funcionalidades do **painel do dono do restaurante**, sub-aba **Empresa** das Configurações.

## Conta de acesso (trocar e-mail/senha)

E-mail e senha vivem no Supabase Auth, não no `config`. Rotas próprias (sob `exigeAuth`):
`GET /api/conta` → `{ email, nome }` (exibe o e-mail de login); `PATCH /api/conta/senha
{ senhaAtual, novaSenha }`; `PATCH /api/conta/email { senhaAtual, novoEmail }`. **Toda troca
exige a senha atual** — `empresas.trocarSenha`/`trocarEmail` validam via `signInWithPassword`
e só então aplicam com `admin.updateUserById` (service_role). Ao trocar o e-mail, a coluna
`empresas.email` é sincronizada com o Auth (`email_confirm: true`, sem etapa de confirmação).
No painel ficam na seção "Conta de acesso".

## Privacidade e dados (LGPD) — autoatendimento do dono

Na mesma sub-aba **Empresa**, seção "Privacidade e dados" (sob `exigeAuth`):

- **Exportar meus dados:** `GET /api/conta/exportar` → JSON com `empresa`, `assinatura`, `config`,
  `cardapio`, **todos os `pedidos`** (`pedidos.lerTodos`) e os **`clientes`** (cada um com seus
  `enderecos`, via `clientes.exportar`). O front baixa como `nymbus-dados-{slug}.json` (blob client-side).
  Atende acesso + portabilidade.
- **Excluir minha conta:** `DELETE /api/conta { senhaAtual, confirmacao }`. **Duas travas:** exige a
  **senha atual** (`empresas.conferirSenha` → `_validarSenhaAtual` via `signInWithPassword`) e
  `confirmacao === "EXCLUIR"`. **Cancela a assinatura no Stripe ANTES** (se houver `stripeSubscriptionId`;
  falha → aborta 502), desconecta o bot e chama `empresas.excluir` (empresa → **pedidos + clientes +
  enderecos** em cascata → `wa_auth` → usuário do Auth → imagens; `clientes.esquecer` limpa o cache).
  No sucesso o painel descarta o token e volta pra landing. UI numa **zona de perigo** (card vermelho);
  alerta de "assinatura ativa será cancelada" quando o status é `trialing/active/past_due`.
- **Retenção de pedidos:** `pedidos.anonimizarAntigos(meses=12)` — job **global** agendado no `index.js`
  (boot + 24h, junto da higiene de sessões). Anonimiza PII de pedidos com +12 meses (`cliente='anonimizado'`,
  `telefone/endereco/chat_id=''`) **mantendo** número, itens, total e datas. Idempotente (WHERE ignora
  já anonimizados).
- **Retenção de clientes:** `clientes.removerInativos(meses=12)` — job **global** no `index.js` (boot + 24h).
  **Apaga** (não anonimiza) clientes sem pedido há +12 meses (por `atualizado_em`); a cascata limpa os
  `enderecos`. Diferente de pedidos: `clientes`/`enderecos` são PII pura **sem valor estatístico**, então
  removem-se de vez. A tabela `ceps` (cache de CEP) **não** é PII e fica fora de export/excluir/retenção.
- **Páginas públicas:** `/termos.html` e `/privacidade.html` (Política de Privacidade LGPD), com a
  identidade da empresa injetada de `GET /api/plataforma/publico` (mesma fonte do footer, via `footer.js`
  com o gancho `window.onPlataformaData`). No cadastro, o **aceite** dos dois é obrigatório (checkbox que
  trava a criação) e os documentos abrem em **modal (iframe `?embed`)** sem tirar o usuário do cadastro
  (classe `.embed` esconde nav/footer/voltar; "Li e aceito" marca o checkbox; links entre docs mantêm o embed).

> Os textos de Termos e Privacidade são base sólida adaptada, mas **merecem revisão jurídica** antes de
> oficializar (limite de responsabilidade, prazo de retenção, figura do DPO).

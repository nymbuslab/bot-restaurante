# Subprocessadores / Sub-operadores (LGPD)

Registro interno dos serviços externos que tratam dados pessoais em nome da Nymbus Lab
(operadora) e dos restaurantes (controladores). Base para o ROPA e para a seção
"Com quem compartilhamos" da Política de Privacidade (`public/privacidade.html`, seção 4).

> Mantido manualmente. Ao adicionar/remover uma integração que receba dado pessoal,
> atualizar esta tabela **e** a Política.

| Serviço | Papel | Dados pessoais que recebe | País/Região | Transferência internacional | Onde no código |
|---|---|---|---|---|---|
| **Supabase** (Auth + Postgres + Storage) | Banco de dados, autenticação e imagens | E-mail e senha (hash) do dono; nome do restaurante; pedidos (nome/telefone/endereço/chat_id do cliente); cadastro de clientes e endereços; sessões do WhatsApp; imagens do cardápio | **EUA (`us-east-1`)** | **Sim** | `src/supabase.js`, `src/db.js` |
| **Stripe** | Pagamento da assinatura | E-mail e nome do dono; `customer_id`/`subscription_id`; cartão **tokenizado** (nunca trafega/armazena no app) | EUA | Sim | `src/stripe.js` |
| **Resend** | E-mail transacional | E-mail e nome do destinatário (boas-vindas, recuperação de senha, avisos de assinatura) | **EUA** (dados da conta; envio configurável: `us-east-1`, `eu-west-1`, `sa-east-1`, `ap-northeast-1`) | Sim (SCCs) | `src/email.js` |
| **Geoapify** | Geocodificação p/ frete por raio | Endereço de entrega informado no cardápio (logradouro/bairro/cidade/UF) | **UE** (Alemanha, servidores Hetzner) | Não | `src/frete.js` |
| **ViaCEP** | Consulta de CEP | Apenas o CEP (dado postal público) — **não é dado pessoal** | Brasil | Não | `src/cep.js` |
| **Meta / WhatsApp** (via Baileys, não-oficial) | Canal de mensagens | Telefone e mensagens (nome/telefone/itens do pedido) | Global (Meta) | Sim | `src/multi-bot.js`, `src/wa-auth.js` |
| **Fly.io** | Hospedagem/execução da aplicação | Dados em trânsito e em memória (sem persistência em disco — app stateless) | São Paulo (`gru`) | Não | `fly.toml` |

## DPAs (status)

| Serviço | DPA | Status |
|---|---|---|
| **Supabase** | `supabase.com/legal/dpa` — assinável via PandaDoc no dashboard (latest v2026-06) | ✅ Disponível |
| **Stripe** | `stripe.com/legal/dpa` — SCCs incluídos; subprocessadores em `stripe.com/legal/service-providers` | ✅ Disponível |
| **Resend** | `resend.com/static/documents/resend-dpa-signed.pdf` — SCCs incluídos | ✅ Disponível |
| **Geoapify** | Sob demanda via `contact@geoapify.com` | ⚠️ Solicitar |

## Pendências / ações

- **(decisão) Região do Supabase = EUA (`us-east-1`).** Permitido pela LGPD como transferência
  internacional com salvaguardas (já divulgado na Política). Se a preferência for manter os dados
  **no Brasil**, avaliar criar/migrar o projeto para a região **São Paulo (`sa-east-1`)** do
  Supabase — operação à parte (envolve novo projeto + migração de dados).
- **Solicitar DPA da Geoapify** via `contact@geoapify.com` e arquivar na documentação.

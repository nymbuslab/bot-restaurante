# ROPA — Registro de Operações de Tratamento (LGPD Art. 37)

**Última revisão:** 2026-06-24

> Documento interno que mapeia **o que o sistema faz com dados pessoais**. Serve para
> prestar contas à ANPD ou aos titulares. **Manter atualizado** sempre que mudar a coleta,
> a finalidade, a retenção ou os parceiros — a skill `concluir-tarefa` revisa este arquivo
> ao fechar tarefas que tocam dados pessoais. Lista de parceiros em
> [subprocessadores.md](subprocessadores.md).

## Papéis

- **Controlador:** cada **restaurante** é controlador dos dados dos seus clientes finais.
- **Operadora:** a **Nymbus Lab** opera a plataforma em nome dos restaurantes; e é
  **controladora** dos dados de cadastro dos próprios donos (conta/assinatura).

## Atividades de tratamento

| # | Atividade | Dados pessoais | Titulares | Finalidade | Base legal | Retenção | Onde (código) |
|---|---|---|---|---|---|---|---|
| 1 | Cadastro e gestão de conta | e-mail, nome, senha (hash) | Dono do restaurante | Criar/gerir a conta e o acesso | Execução de contrato (Art. 7, V) | Enquanto a conta existir; apagada na exclusão | `src/empresas.js`, Supabase Auth |
| 2 | Assinatura / pagamento | e-mail, nome, `customer_id` (cartão tokenizado no Stripe) | Dono do restaurante | Cobrança da assinatura | Execução de contrato / obrigação legal | Enquanto a assinatura existir; registros fiscais conforme lei | `src/stripe.js` |
| 3 | Pedidos pelo cardápio web | nome, telefone, endereço de entrega, `chat_id`, observação | Cliente final | Preparar e entregar o pedido | Execução de contrato (Art. 7, V) | **Anonimizado após 12 meses** | `src/pedidos.js` |
| 4 | Cadastro de clientes e endereços | nome, telefone, `chat_id`, endereços reaproveitáveis | Cliente final | Reconhecer o cliente e agilizar novos pedidos | Legítimo interesse (Art. 7, IX) | **Excluído após 12 meses sem pedidos** | `src/clientes.js` |
| 5 | Atendimento via WhatsApp | telefone, conteúdo das mensagens | Cliente final | Canal de atendimento/pedido | Execução de contrato / legítimo interesse | Sessão removida após 90 dias de inatividade | `src/multi-bot.js`, `src/wa-auth.js` (Meta) |
| 6 | Frete por raio | endereço / CEP | Cliente final | Calcular a taxa de entrega | Execução de contrato | Resultado em cache técnico não-pessoal (`geo_cache`/`ceps`) | `src/frete.js`, `src/cep.js` (Geoapify, ViaCEP) |
| 7 | E-mails transacionais | e-mail, nome | Dono do restaurante | Boas-vindas, recuperação de senha, avisos de assinatura | Execução de contrato | Pelo tempo do envio (no provedor) | `src/email.js` (Resend) |
| 8 | Recuperação de senha | e-mail, token (hash) | Dono do restaurante | Redefinir o acesso com segurança | Execução de contrato / legítimo interesse | Token expira em 1 hora | `password_resets` |
| 9 | Trilha de auditoria | evento, slug, data/hora (sem PII no detalhe) | — (metadado) | Prestação de contas (Art. 37) | Obrigação legal / legítimo interesse | A definir (sugerido: 24 meses) | `src/auditoria.js` |
| — | Imagens do cardápio | fotos de **produtos** (não pessoais) | — | Exibir o cardápio | — | Enquanto a conta existir | Supabase Storage |

## Direitos dos titulares (como são atendidos)

- **Dono:** autoatendimento no painel — exportar dados (`GET /api/conta/exportar`) e excluir a
  conta (`DELETE /api/conta`). Ver [lgpd-e-conta.md](lgpd-e-conta.md).
- **Cliente final:** exerce os direitos **junto ao restaurante** (controlador); o aviso no
  checkout e o rodapé do cardápio orientam isso. A retenção automática (12 meses) também limita o acúmulo.
- **Canal/Encarregado (DPO):** `atendimento@nymbuslab.com.br` — resposta em até **15 dias**.

## Segurança (resumo)

Senhas com hash (Supabase Auth), JWT assinado, isolamento por tenant + RLS deny-all, HTTPS,
rate limiting, segredos em variáveis de ambiente, sem PII em logs. Detalhe técnico no relatório
do `lgpd-checker` e em [../auditoria-seguranca.md](../auditoria-seguranca.md).

## Identificadores (privacy by design)

- **`slug`** (identificador do restaurante) é **público por design** (vai na URL do cardápio
  `/c/:slug`); não é dado pessoal de consumidor.
- **`pedidos.numero`** é **sequencial por restaurante**, para servir de referência legível
  ("pedido #123"). **Não há risco de enumeração:** a única rota pública de pedido é a de
  **criação** (`POST /api/c/:slug/pedido`); toda leitura de pedido exige login (`exigeAuth`) e é
  isolada por `empresa_id`. A confirmação ao cliente vai pelo WhatsApp (vínculo por token), não por
  URL numerada. **Decisão (2026-06-24): mantido como está** — número sequencial é adequado e não
  expõe dados de terceiros.

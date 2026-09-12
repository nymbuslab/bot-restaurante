---
expx_schema: 1
expx_tool: sprintx
kind: base_indice
trabalho_id: personalizacao-relatorios-telegram
atualizado_em: 2026-09-07
areas:
  - arquivo: telegram-mensagem-atual.md
    titulo: Estado atual dos formatadores de mensagem
    lacunas: 0
  - arquivo: dados-fechamento-caixa.md
    titulo: Origem dos dados do fechamento de caixa
    lacunas: 1
  - arquivo: referencia-relatorio-caixa.md
    titulo: Referencia de formatacao completa (cupom termico)
    lacunas: 0
  - arquivo: estoque-zerado-minimo.md
    titulo: Separacao estoque zerado vs minimo
    lacunas: 0
  - arquivo: editor-mensagens-whatsapp.md
    titulo: Precedente de UI (editor de mensagens do bot WhatsApp)
    lacunas: 0
  - arquivo: ui-admin-master-telegram.md
    titulo: UI atual do bloco Telegram no admin-master
    lacunas: 0
  - arquivo: gate-e-testes-telegram.md
    titulo: Gate de plano e padrao de testes existentes
    lacunas: 0
  - arquivo: pontos-de-cancelamento.md
    titulo: Pontos onde um cancelamento/estorno de venda acontece
    lacunas: 0
---

# Índice da base — personalizacao-relatorios-telegram

| Arquivo | Área | Resumo |
|---|---|---|
| `telegram-mensagem-atual.md` | Formatadores de mensagem | O que os formatadores leem hoje e o que falta pra virarem detalhados |
| `dados-fechamento-caixa.md` | Dados do fechamento de caixa | Quase tudo já existe calculado; só "quantidade por forma" é novo |
| `referencia-relatorio-caixa.md` | Formatação completa (cupom) | Objeto e fórmulas de diferença/estado já prontos, candidatos a reuso |
| `estoque-zerado-minimo.md` | Separação de estoque | Trivial — os dois flags já são mutuamente exclusivos |
| `editor-mensagens-whatsapp.md` | Precedente de UI citado pelo dono | Layout de referência é texto livre, não checkbox — precisa desenhar |
| `ui-admin-master-telegram.md` | UI atual do bloco Telegram | Onde inserir os novos controles, contrato da rota GET |
| `gate-e-testes-telegram.md` | Gate de plano e testes | Nada mudou; padrão de teste a seguir por tipo de task |
| `pontos-de-cancelamento.md` | Pontos de cancelamento/estorno | 6 pontos distintos; só 2 (P2, P4) já têm valor pronto e vivem no arquivo certo |

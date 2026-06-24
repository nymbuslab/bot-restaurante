# Plano de Resposta a Incidentes de Segurança (LGPD Art. 48)

**Última revisão:** 2026-06-24

> O que fazer se houver um **incidente de segurança** com dados pessoais (vazamento, acesso
> indevido, perda). Objetivo: conter rápido, avaliar o risco e cumprir os deveres de
> notificação da LGPD. **Responsável:** Encarregado (DPO) — `atendimento@nymbuslab.com.br`.

## Passo a passo

1. **Detectar e conter (imediato).** Ao identificar (alerta, denúncia, comportamento anômalo),
   conter primeiro: revogar tokens/credenciais expostos, suspender acesso comprometido, isolar
   o que vazou. Anotar data/hora e o que se sabe.
2. **Avaliar o escopo e o risco.** Quais dados, de quantos/quais titulares, e qual o risco a eles
   (financeiro, exposição, fraude). Usar a [ROPA](ropa.md) para mapear o que foi afetado e a
   [trilha de auditoria](ropa.md#atividades-de-tratamento) (`auditoria`) para reconstruir o que
   ocorreu.
3. **Notificar a ANPD (quando houver risco relevante).** Comunicar a Autoridade Nacional de
   Proteção de Dados em **prazo razoável** (referência adotada: **até 72 horas** da ciência), pelo
   canal oficial da ANPD, informando: natureza do incidente, dados/titulares afetados, medidas
   tomadas e riscos. (Se o risco for irrelevante, registrar a avaliação e dispensar.)
4. **Notificar os titulares afetados.** Quando houver risco relevante, avisar os titulares de
   forma clara e direta (e-mail e/ou aviso no painel), explicando o ocorrido, os riscos e o que
   eles podem fazer. Para clientes finais, acionar o **restaurante** (controlador) quando aplicável.
5. **Registrar e corrigir.** Documentar o incidente, a resposta e a correção da causa raiz
   (post-mortem). Atualizar este plano e as medidas de segurança se necessário.

## Contatos e canais

- **Encarregado/DPO:** `atendimento@nymbuslab.com.br`.
- **ANPD:** canal oficial em [gov.br/anpd](https://www.gov.br/anpd).
- **Provedores** (em caso de incidente na infraestrutura deles): ver [subprocessadores.md](subprocessadores.md).

## Prevenção (já em vigor)

Isolamento por tenant + RLS deny-all, HTTPS, senhas com hash, JWT assinado, rate limiting em
autenticação, segredos fora do código, remoção automática de sessões inativas e anonimização de
pedidos antigos. Detalhe no relatório do `lgpd-checker`.

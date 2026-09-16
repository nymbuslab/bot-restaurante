# Decisões — estoque-e-custos

> Decisões desta descoberta complementam e, quando indicado, substituem as decisões P1 históricas de `02-DECISOES-PENDENTES.md`.

## Decisões

```text
D-01 | O primeiro go-live operacional entrega Compras antes de Insumos e ficha técnica | lançar o conjunto completo | reduz o lote de risco e valida a fundação primeiro
D-02 | O catálogo permanece em JSONB e ganha um registro-ponte relacional | migrar todo o catálogo ou referenciar JSONB sem integridade | preserva as vendas atuais e cria identidade estável para compras
D-03 | Gestão de equipe será entregue antes de Compras | lançar junto ou depois | compras e financeiro já nascem com autoria e autorização validadas
D-04 | Gestão de equipe atende o sistema inteiro | permissões apenas de estoque | o dono quer delegar também as áreas operacionais existentes
D-05 | Haverá seis perfis ajustáveis: Administrador, Gerente, Caixa, Atendimento, Cozinha e Estoque/Compras | perfis fixos ou matriz vazia | combina início rápido com exceções por funcionário
D-06 | Funcionários entram por PIN de quatro dígitos em dispositivo autorizado pelo dono | e-mail individual ou acesso em qualquer aparelho | reduz atrito em terminais compartilhados sem expor PIN curto na internet
D-07 | Cinco erros de PIN bloqueiam o funcionário por quinze minutos e o dono pode liberar | PIN sem bloqueio ou bloqueio indefinido | equilibra segurança e continuidade operacional
D-08 | Sessão de funcionário bloqueia por inatividade configurável em 5, 15, 30 ou 60 minutos, padrão 15 | sessão permanente ou PIN por ação | protege terminais compartilhados sem repetir PIN em toda operação
D-09 | Dispositivo autorizado permanece válido até revogação pelo dono | expiração automática ou acesso universal | mantém a operação previsível e permite corte imediato
D-10 | Gestão de equipe é do Plano Completo e não limita funcionários ativos | limite comercial ou todos os planos | simplifica a regra comercial aprovada
D-11 | Gestão de equipe é delegável sem editar dono, a si mesmo ou conceder acesso que o ator não possui | somente dono ou delegação irrestrita | evita autoelevação e permite operação delegada
D-12 | Assinatura, exclusão da conta, credenciais principais e autorização de dispositivos são exclusivas do dono | delegar segurança da conta | reduz risco de tomada ou exclusão da conta
D-13 | A auditoria operacional terá tela de Atividades com filtros e permissão própria | apenas contexto local ou suporte | dá transparência ao estabelecimento
D-14 | Alertas aparecem no painel e podem usar o Telegram já vinculado | somente painel ou novo provedor de e-mail | reutiliza infraestrutura sem nova credencial
D-15 | Compras pagas exigem condição financeira completa na confirmação | gerar pendência ou financeiro opcional | impede estoque confirmado sem obrigação financeira correspondente
D-16 | O financeiro usa contas próprias, separadas do caixa operacional do PDV | lançar pagamentos no caixa do turno | preserva o fechamento atual
D-17 | Contas financeiras aceitam implantação, pagamentos, estornos e transferências | fluxo de caixa geral ou somente pagamentos | cobre fornecedores sem incluir receitas e despesas avulsas
D-18 | A conciliação inicial é manual pelo extrato interno | OFX ou integração bancária | não cria dependência externa nesta etapa
D-19 | Devolução ao fornecedor pode gerar crédito, abater parcelas ou registrar reembolso | somente crédito ou ajuste separado | representa os desfechos reais sem perder vínculo
D-20 | Painéis incluem compras, vencimentos, contas, estoque valorizado e histórico de custo | apenas listas ou financeiro mínimo | define a saída operacional esperada
D-21 | O custo do produto fica automático e protegido após a primeira compra | sobrescrita livre no cadastro | preserva a rastreabilidade do custo
D-22 | Quem possui confirmar compras pode confirmar o próprio rascunho | dupla aprovação | evita workflow adicional na primeira versão
D-23 | O piloto exige ciclo completo homologado e restauração de backup ensaiada | piloto antecipado ou fluxo parcial | protege clientes reais
D-24 | Rebaixar o plano bloqueia PINs e novas mutações premium sem apagar histórico | apagar equipe ou interromper baixa ativa | mantém dados e consistência
D-25 | Auditoria financeira e operacional é transacional e retida por cinco anos | auditoria best-effort de 24 meses | ações de valor precisam sobreviver com o documento
D-26 | O registro-ponte representa produto, variação e futuramente insumo por alvo tipado | prefixar IDs em coluna textual | permite integridade e evolução sem colisão
D-27 | Contas a Receber, OFX, Open Finance, receitas, despesas avulsas e recorrências ficam fora | módulo financeiro geral | limita a entrega ao ciclo de fornecedores
D-28 | Nenhuma migration ou ativação de produção ocorre antes do P0-B (resolvido em 2026-09-16) | avançar sem recuperação ensaiada | produção possui clientes reais; backup restaurável agora comprovado (`00-BLOQUEIOS.md`)
D-29 | A primeira versão não exige segredo, credencial ou serviço externo novo | adicionar integração externa | PIN usa primitivas locais e alertas reutilizam Telegram
D-30 | O plano financeiro desta descoberta substitui o adiamento de Contas a Pagar em D-P1-15 | manter financeiro para depois | o dono ampliou explicitamente o primeiro lançamento
D-31 | A gestão multiusuário desta descoberta substitui a conta operacional única provisória de D-P1-16 | manter somente dono | o dono decidiu criar equipe antes de Compras
```

## Pendências

Nenhuma pendência.

# Checklist de rollout e rollback

Este checklist é obrigatório para migrations e ativações do conjunto Compras, Insumos, Estoque e
custos. Produção atende clientes reais; teste aprovado não substitui recuperação comprovada.

## Portão zero: recuperação

> Supabase Pro foi adiado em 2026-09-13. Enquanto não houver backup recorrente, cada implantação
> com migration exige dump lógico manual criptografado e cópia separada do Storage.

- [ ] Existe backup recente do Postgres, com data, retenção e local registrados.
- [ ] Existe cópia separada dos objetos do Supabase Storage quando a mudança puder afetá-los.
- [ ] A restauração foi ensaiada em projeto descartável e os totais esperados foram conferidos.
- [ ] RPO (quanto dado pode ser perdido) e RTO (tempo aceitável fora do ar) foram aceitos.

Sem os quatro itens, a implantação para antes da migration.

## Antes da migration

- [ ] `main` limpa, CI verde e commit/release identificados.
- [ ] Migration aplicada primeiro no banco descartável com cópia restaurada.
- [ ] Migration é aditiva: cria antes de exigir; não renomeia, remove ou reescreve massa no mesmo
  deploy.
- [ ] Queries possuem `statement_timeout`; alterações longas têm estratégia para evitar lock.
- [ ] Código antigo continua funcionando com o schema novo.
- [ ] Gate técnico nasce desligado e separado do Plano Completo.
- [ ] Janela, responsável e condição de abortar estão definidos.

## Sequência em produção

1. Confirmar saúde pública, banco, fila de impressão e bot antes da mudança.
2. Registrar a evidência do backup sem copiar dados pessoais para logs ou documentação.
3. Aplicar apenas a migration aditiva.
4. Conferir a versão em `supabase_migrations.schema_migrations`.
5. Confirmar que a versão antiga da aplicação continua saudável.
6. Publicar o código com a feature desligada.
7. Executar smoke com tenant próprio de teste, nunca com operação de cliente.
8. Ativar primeiro no tenant de teste.
9. Observar erros, latência, locks e divergências antes de ampliar.
10. Liberar por lotes e registrar horário e resultado.

## Condições de interrupção

- erro 5xx novo ou aumento sustentado;
- lock ou latência anormal no banco;
- saldo, custo ou total divergente;
- movimento duplicado;
- dado de outro tenant;
- venda, caixa, impressão ou bot degradados.

Qualquer condição desliga o gate e interrompe a ampliação.

## Rollback

- **Interface ou comportamento:** desligar o gate primeiro.
- **Aplicação:** voltar para a release anterior do Fly; o schema aditivo deve continuar compatível.
- **Schema com dados novos:** preferir migration corretiva para frente. Não executar `down` destrutivo
  nem apagar coluna/tabela que já recebeu dados.
- **Corrupção ou perda:** restaurar backup é último recurso, com janela de indisponibilidade e perda
  desde o ponto restaurado comunicadas antes da ação.

## Evidência pós-implantação

- health público e rota autenticada de teste;
- versão da aplicação e migrations;
- operação criada no tenant de teste e resultado no saldo/extrato;
- ausência de 5xx e erro transacional no período observado;
- decisão final: ampliar, manter restrito ou reverter.

# Tasks — Sprint 07

```yaml
id: T-07.01
titulo: Painéis e relatórios
objetivo: Implementar compras, vencimentos, contas, estoque valorizado e histórico de custo com paginação por cursor.
arquivos:
  cria: [src/relatorios-compras.js, public/relatorios-compras.js, test/integracao/relatorios-compras.test.js]
  altera: [src/servidor.js, public/admin.html]
teste_integracao: Totais dos relatórios reconciliam com compras, parcelas, contas e custos do mesmo tenant.
teste_funcional: Filtro explícito encontra documento com mais de doze meses sem carregar todo o histórico.
criterio_aceite: Cada total exibido possui consulta tenant-scoped e teste de reconciliação.
depende_de: [T-06.04]
paralelizavel: false
status: pendente
```

```yaml
id: T-07.02
titulo: Alertas e retenção
objetivo: Criar central de alertas e outbox Telegram e ajustar retenção para cinco anos.
arquivos:
  cria: [src/alertas-operacionais.js]
  altera: [index.js, src/telegram.js, public/app.js]
teste_integracao: Alerta persiste no commit e falha do Telegram não desfaz a operação nem duplica reenvio.
teste_funcional: Parcela vencida aparece no painel e o envio opcional registra sucesso ou falha.
criterio_aceite: Movimento ligado a compra não é removido pelo job de doze meses.
depende_de: [T-07.01]
paralelizavel: false
status: pendente
```

```yaml
id: T-07.03
titulo: Backup e restauração ensaiada
objetivo: Produzir dump criptografado, cópia de Storage e evidência de restauração fora de produção.
arquivos:
  cria: [docs/estoque-e-custos/evidencias/RECUPERACAO.md]
  altera: [docs/estoque-e-custos/00-BLOQUEIOS.md, docs/estoque-e-custos/03-CHECKLIST-ROLLOUT-E-ROLLBACK.md]
teste_integracao: O banco restaurado passa smoke de autenticação, catálogo, pedidos, equipe e compras.
teste_funcional: Um documento e seus movimentos são recuperados com os mesmos totais e vínculos.
criterio_aceite: RPO, RTO, hash, local e resultado da restauração estão registrados sem segredo ou PII.
depende_de: [T-07.02]
paralelizavel: false
status: pendente
```

```yaml
id: T-07.04
titulo: Piloto e liberação gradual
objetivo: Aplicar migrations aditivas, homologar tenant de teste, ativar piloto e validar desligamento emergencial.
arquivos:
  cria: [docs/estoque-e-custos/evidencias/PILOTO.md]
  altera: [PROGRESSO.md, ROADMAP.md, CHANGELOG.md]
teste_integracao: Tenant sem flag permanece no legado e tenant piloto executa o ciclo completo.
teste_funcional: Desligar a flag bloqueia novas mutações sem apagar histórico nem alterar saldo.
criterio_aceite: Equipe e Compras só chegam ao piloto após todas as suítes e restauração aprovadas.
depende_de: [T-07.03]
paralelizavel: false
status: pendente
```

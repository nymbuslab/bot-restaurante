---
expx_schema: 1
expx_tool: sprintx
kind: estimativa_historico
trabalho_id: null
atualizado_em: 2026-09-16
unidade: h
entradas:
  - trabalho_id: extrato-geral-estoque
    task_id: T-01.01
    tipo_task: ui
    area: admin.html — nav e portão de design
    sinais: [descoberta_durante_execucao]
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 0.5
    desvio: null
    registrado_em: 2026-09-16
  - trabalho_id: extrato-geral-estoque
    task_id: T-02.01
    tipo_task: persistencia
    area: src/estoque-db.js — consulta geral
    sinais: []
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 1.0
    desvio: null
    registrado_em: 2026-09-16
  - trabalho_id: extrato-geral-estoque
    task_id: T-02.02
    tipo_task: api
    area: src/servidor.js — rota GET /api/estoque/geral
    sinais: []
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 0.75
    desvio: null
    registrado_em: 2026-09-16
  - trabalho_id: extrato-geral-estoque
    task_id: T-03.01
    tipo_task: ui
    area: public/admin.html — nav e seção Relatórios
    sinais: []
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 0.4
    desvio: null
    registrado_em: 2026-09-16
  - trabalho_id: extrato-geral-estoque
    task_id: T-03.02
    tipo_task: dominio
    area: public/extrato-estoque.js — query string
    sinais: []
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 0.4
    desvio: null
    registrado_em: 2026-09-16
  - trabalho_id: extrato-geral-estoque
    task_id: T-03.03
    tipo_task: ui
    area: public/app.js — carregamento e render do extrato geral
    sinais: []
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 0.75
    desvio: null
    registrado_em: 2026-09-16
  - trabalho_id: extrato-geral-estoque
    task_id: T-03.04
    tipo_task: ui
    area: public/app.js — chips de filtro
    sinais: []
    estimado_min: null
    estimado_max: null
    estimado_media: null
    real: 0.6
    desvio: null
    registrado_em: 2026-09-16
calibracao:
  - tipo_task: ui
    entradas: 4
    desvio_medio: null
    fator_ativo: true
  - tipo_task: persistencia
    entradas: 1
    desvio_medio: null
    fator_ativo: false
  - tipo_task: api
    entradas: 1
    desvio_medio: null
    fator_ativo: false
  - tipo_task: dominio
    entradas: 1
    desvio_medio: null
    fator_ativo: false
---

> Este arquivo é do PROJETO, não de um trabalho: acumula entradas de todos os trabalhos.
> Apendado, nunca sobrescrito.

# Histórico de esforço — calibração das estimativas

Uma linha por task concluída, com o esforço real medido. É a única base de calibração real do
projeto: sem ele, toda estimativa fica com confiança no máximo MÉDIA.

Unidade: hora de trabalho focado. O real é o esforço efetivamente gasto na task — escrever os
dois testes, implementar, rodar a suíte e verificar o critério de aceite. Não inclui reunião,
revisão, deploy nem ida e volta com o cliente.

## Entradas

| Trabalho | Task | Tipo | Área | Sinais | Estimado (min–max) | Média est. | Real | Desvio |
|---|---|---|---|---|---|---|---|---|
| extrato-geral-estoque | T-01.01 | ui | admin.html — nav e portão de design | descoberta_durante_execucao | — | — | 0,5 h | — |
| extrato-geral-estoque | T-02.01 | persistencia | src/estoque-db.js — consulta geral | — | — | — | 1,0 h | — |
| extrato-geral-estoque | T-02.02 | api | src/servidor.js — rota GET /api/estoque/geral | — | — | — | 0,75 h | — |
| extrato-geral-estoque | T-03.01 | ui | public/admin.html — nav e seção Relatórios | — | — | — | 0,4 h | — |
| extrato-geral-estoque | T-03.02 | dominio | public/extrato-estoque.js — query string | — | — | — | 0,4 h | — |
| extrato-geral-estoque | T-03.03 | ui | public/app.js — carregamento e render | — | — | — | 0,75 h | — |
| extrato-geral-estoque | T-03.04 | ui | public/app.js — chips de filtro | — | — | — | 0,6 h | — |

Trabalho rodou sem a F3.5 (sem `00-ESTIMATIVA.md`): `estimado_min`, `estimado_max`,
`estimado_media` e `desvio` ficam `null` nas 7 entradas acima. O real ainda alimenta a
comparabilidade por tipo e área nas estimativas futuras.

## Calibração por tipo de task

| Tipo de task | Entradas | Desvio médio | Fator ativo? |
|---|---|---|---|
| ui | 4 | — (sem estimativa para comparar) | não — sem `00-ESTIMATIVA.md` nesta feature, desvio não calculável |
| persistencia | 1 | — | não — menos de 3 entradas |
| api | 1 | — | não — menos de 3 entradas |
| dominio | 1 | — | não — menos de 3 entradas |

**Regra do fator.** O desvio de um tipo só vira fator de correção nas estimativas seguintes a
partir de **3 entradas encerradas** daquele tipo — abaixo disso é ruído. Quando aplicado, o
fator é **sempre declarado na saída da estimativa**, nunca embutido em silêncio.

## Como se calcula o desvio

```
desvio_task = real / media_task_estimada          # media_task = (o + 4m + p) / 6
desvio_medio_do_tipo = media dos desvio_task daquele tipo
```

## Como esta tabela é alimentada

Ao concluir cada task na F6, o esforço real daquela task é anotado. Ao fim do trabalho, a F6
acrescenta as entradas aqui e recalcula a tabela de calibração por tipo.

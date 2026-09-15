# Decisões: insumos

> **Estado em 2026-09-14:** o desenho desta rodada foi parcialmente superado pela decisão de
> construir Compras antes do cadastro operacional de Insumos. D-01, D-12 e D-14 não autorizam mais
> implementação. As 18 decisões funcionais do novo P1 foram aprovadas; o histórico foi preservado e
> o programa vigente está indexado em
> [`docs/estoque-e-custos/`](../estoque-e-custos/README.md).

> Decisões tomadas na descoberta da fase 3. Uma decisão revertida ganha nova linha e cita a anterior.

## Decisões

```text
D-01 | A fase 3 entrega cadastro de insumos e fichas técnicas; o saldo é somente leitura e lançamentos, extrato e baixa ficam nas fases seguintes | Antecipar movimentos ou saldo inicial | Mantém a entrega inerte em relação às vendas e reduz o risco operacional
D-02 | Insumos podem ser arquivados, listados por filtro e restaurados; nunca são excluídos | Ocultar sem restauração ou excluir definitivamente | Preserva referências e histórico
D-03 | Nome é único por estabelecimento, sem diferenciar maiúsculas, inclusive entre arquivados; conflito orienta abrir ou restaurar o cadastro existente | Permitir duplicados ou mesclar registros | Evita duas matérias-primas visualmente iguais
D-04 | A tela mostra um bloco de produtos ativos enviados à cozinha que estão sem ficha e abre o produto diretamente na aba Ficha técnica | Usar apenas filtro ou não mostrar o mapa | Expõe o trabalho de adoção sem tirar o usuário do contexto
D-05 | Cada ficha aceita no máximo 30 linhas | Limites de 50 ou 100 linhas | Cobre receitas extensas sem permitir que um erro de interface infle o cardápio
D-06 | O protótipo cobre desktop e mobile, sucesso, carregamento, vazio, erro, conflitos, cadastro e os dois editores de ficha | Prototipar apenas telas principais ou wireframe | A implementação precisa nascer com os quatro estados e responsividade verificados
D-07 | Produto ativo, de cozinha, sem variações e com ficha vazia pode receber `fichaDispensada: true`; vazio sem o marcador continua pendente | Exigir ficha ou tratar todo vazio como dispensado | Distingue revenda consciente de configuração esquecida
D-08 | Arquivar insumo usado em ficha retorna conflito e informa os produtos ou opções que precisam ser ajustados | Arquivar com referência viva ou remover linhas automaticamente | Impede receita órfã e alteração silenciosa
D-09 | Falha ao salvar ficha não grava alteração parcial, mantém o editor aberto e preserva os dados digitados | Rascunho local ou salvamento parcial | Permite corrigir ou tentar novamente sem corromper a receita
D-10 | A fase 3 adiciona logs operacionais de mutação e erro, sem criar tabela ou tela de auditoria | Histórico persistente completo ou nenhum rastreio novo | Dá diagnóstico proporcional a uma fase sem movimentação de saldo
D-11 | A API usa rotas REST explícitas para listar, criar, editar, arquivar e restaurar | Endpoint único ou salvamento em lote | Segue os handlers existentes e deixa os conflitos claros
D-12 | Depois das validações, Insumos aparece no menu para estabelecimentos elegíveis ao Plano Completo, sem feature flag ou segredo novo | Manter escondido ou liberar gradualmente | A fase termina utilizável e reaproveita `exigePdv`
D-13 | Pronto exige `npm run check`, testes unitários e de integração e navegador em desktop e mobile, cobrindo sucesso e erros principais | Só automação ou só fluxo desktop | Fecha código, contrato e experiência na mesma entrega
D-14 | A fase 3 adiciona custo e estoque mínimo editáveis; saldo não é editável | Deixar custo sem tela | O cadastro já precisa concentrar os dados estáveis do insumo
D-15 | Produtos com ficha mantêm o estoque próprio até a fase 4, quando a troca para baixa por ingrediente será atômica | Desativar o estoque próprio já na fase 3 | Evita um intervalo em que nenhuma baixa ocorreria
D-16 | Opções de grupo podem ter ficha vazia sem marcador de dispensa; `fichaDispensada` existe somente no produto e governa o mapa de adoção | Criar marcador também em cada opção | A dispensa resolve uma pendência de produto, enquanto opção vazia significa que ela não acrescenta consumo
D-17 | Produtos com variações não recebem ficha nesta fase e ficam fora do mapa de adoção | Permitir ficha no produto com variações | Ficha por variação permanece uma evolução aditiva futura
```

## Revisões aprovadas

```text
D-18 | Compras vem antes do cadastro operacional de Insumos e será o caminho normal de entrada para produtos e insumos | Manter entrada apenas por ajuste manual | A compra alimenta saldo e custo a partir do mesmo fato, com rastreabilidade
D-19 | A ficha técnica calcula primeiro o custo atual dos insumos; não será chamada de custo total real sem incluir mão de obra, embalagem, perdas e demais despesas | Tratar somente ingredientes como custo total | Evita prometer precisão que o modelo ainda não possui
D-20 | O protótipo antigo de Insumos não segue para código; será refeito depois dos P0/P1 dentro do conjunto Compras, Insumos e Estoque | Implementar a tela já desenhada | Impede consolidar um fluxo sem entrada de compra e sem custo confiável
D-21 | A entrada preserva embalagem e converte para unidade-base; 4 pacotes de 5 kg entram como 20 kg, sem soma manual pelo usuário | Editar o saldo existente ou registrar apenas 20 kg sem a embalagem | Reduz erro operacional e mantém o documento compreensível
```

## Pendências

As decisões financeiras, transacionais e de ativação estão listadas em
[`docs/estoque-e-custos/02-DECISOES-PENDENTES.md`](../estoque-e-custos/02-DECISOES-PENDENTES.md).

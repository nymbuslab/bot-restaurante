# Aprovação do protótipo — Gestão de equipe

Data da aprovação: 2026-09-14

Status: **APROVADO PELO DONO**

## Referências no Stitch

- Projeto: `projects/7236747227852373120` — mcheff Restaurant Management Platform.
- Design system: `assets/6506830711685967852` — Nymbus Pedidos.
- Gestão de equipe desktop: `screens/53cb0b8f37234830aeecd14ee25a1fde`.
- Gestão de equipe e acesso por PIN mobile: `screens/f9f8cd383169473483043bc20a443ce6`.
- Dispositivos e Atividades, desktop e mobile: `screens/096aa98796bc41e78ad7308dce5a0594`.

O Stitch foi semeado com os tokens reais de `public/style.css`. Os arquivos `.dc.html` em
`design/canvas/` continuam como apoio local; as telas acima são a referência visual aprovada.

## Escopo aprovado

- lista, busca, filtros e estados de funcionários;
- cadastro e edição em gaveta ou folha mobile;
- seis perfis ajustáveis e exceções individuais de permissão;
- PIN de quatro dígitos sem exibição do valor atual;
- tentativas incorretas, bloqueio temporário e desbloqueio pelo dono;
- identificação do operador em dispositivo autorizado;
- gerenciamento e revogação de dispositivos pelo dono;
- Atividades somente leitura, com filtros, detalhe e carregamento por cursor;
- carregamento, vazio, erro e sucesso;
- desktop e mobile, foco visível, teclado, Escape e alvos mínimos de 44 px.

## Limites preservados

- sem folha de pagamento, escala ou ponto;
- sem recuperação ou exposição do PIN;
- sem edição ou exclusão de eventos de auditoria;
- sem migrations ou ativação em produção antes do backup restaurável do P0-B.

## Registro da decisão

O dono respondeu **“APROVADO”** após receber os três renders do Stitch em 2026-09-14. Este registro
fecha o critério de aceite de T-03.01 e libera T-03.02 quando suas dependências anteriores estiverem
concluídas.

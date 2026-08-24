# Features: Onboarding, Formulários e Horário

## Onboarding (wizard) e retomada

Cadastro público em `/cadastro.html` é um **wizard de 4 etapas**: Conta → Dados (telefone +
endereço) → Horário → Entrega → checkout. Só a **Etapa 1** (conta) e a **Etapa 2** (dados)
são obrigatórias; Horário/Entrega são puláveis.

- **Progresso rastreado** em `config.onboarding = { concluido, etapa }`. O wizard salva a
  `etapa` ao avançar e marca `concluido: true` ao finalizar/pular a Entrega.
- **Retomada:** `autenticar`/`POST /api/login` retornam `onboardingConcluido`/`onboardingEtapa`.
  `login.html` manda pro wizard se incompleto (retoma na etapa salva, com a Etapa 2 preenchida);
  senão, painel. O re-cadastro com e-mail existente **loga com a senha digitada e retoma** (ou vai
  ao painel). `cadastro.html` também retoma sozinho no boot se já houver sessão.
- **Auto-reparo de conta órfã:** se o usuário existe no Supabase Auth **sem** linha em `empresas`
  (cadastro interrompido), `empresas.cadastrar` loga com a senha para obter o `user_id` e **recria
  a linha** — corrige o caso "diz que já existe mas o login não valida". Senha errada → bloqueia.
- **Retrocompatível:** contas antigas (config sem `onboarding`) são tratadas como **concluídas**.

No cadastro, o **aceite** dos Termos + Política de Privacidade é obrigatório — ver
[lgpd-e-conta.md](lgpd-e-conta.md).

## Formulários — utils compartilhados (`public/`)

Para padronização entre onboarding e painel, dois utils carregados por `<script>` antes do
`app.js`/script inline (em `cadastro.html` e `admin.html`):

- **`endereco-cep.js`** (`window.EnderecoCep`): endereço **estruturado** (CEP, logradouro, número,
  bairro, complemento, cidade, UF) com **autofill via ViaCEP** (`viacep.com.br`, direto do
  navegador). `comporEndereco(...)` monta a string única `config.restaurante.endereco` que
  painel/pedido/bot já consomem; os campos estruturados também ficam em `config.restaurante`.
  No painel, endereço legado (só string) é preservado e mostrado como dica até preencher o CEP.
- **`dinheiro.js`** (`window.Dinheiro`): **padrão monetário único** da plataforma. Máscara
  **"centavos primeiro"** (`mascarar(campo)`): digita-se da direita pra esquerda — `1`→`0,01`,
  `1000`→`10,00`, `123456`→`1.234,56`. `valor(campo)` lê o número, `setValor(campo, reais)` grava,
  `formatar(reais)`/`comPrefixo(reais)` exibem em BR (vírgula + ponto de milhar). **Todo campo de
  dinheiro usa isto** (taxa de entrega, preço de item, opcionais) — `type=text inputmode=numeric`,
  nunca `type=number` nem `parseFloat` direto.

## Horário de funcionamento

Estrutura em `config.json` (por tenant):
```json
"horarios": {
  "seg": { "abre": "11:00", "fecha": "22:00", "fechado": false },
  "dom": { "abre": "08:00", "fecha": "14:00", "fechado": true }
}
```

A regra vive em **`public/horario.js`** (`abertoAgora`), módulo dual-mode: `estaAberto(tenantDir)`
em `fluxo.js` só delega, e o **painel usa o mesmo arquivo** para o selo de aberto/fechado. Antes o
painel tinha a própria versão, mais curta, que dizia "fechado" para loja aberta.

1. Se `config.atendimento.aberto` é `false` → sempre fechado (override manual). **Ausente não fecha**:
   só o `false` explícito.
2. Se `horarios` existe → compara dia/hora atual com a janela do dia.
3. Se não existe → considera aberto.

Quatro sutilezas que a versão curta do painel errava, todas cobertas por `test/horario.test.js`:

- **Hora sempre no fuso BR** (`America/Sao_Paulo`), nunca o relógio da máquina: o Fly roda em UTC e o
  navegador roda no fuso de quem está olhando.
- **Fechar às `00:00` é o FIM do dia** (1440 minutos), não o começo. Então `11:00–00:00` vale o dia
  inteiro, e **`00:00–00:00` significa 24 horas abertas**.
- **Janela que vira a noite** (`fecha <= abre`, ex.: `18:00–02:00`): aberto a partir da abertura.
- **Cauda da madrugada**: 01:00 de terça ainda conta pela janela da segunda que virou.

Fora do horário, saudações e o "1" (fazer pedido) recebem `config.mensagens.fechado`.

- **Simulador ignora o horário:** `processarMensagem(..., opts)` aceita `{ ignorarHorario: true }`
  (passado pela rota `/api/simulador/mensagem`). O console de testes sempre atende, para testar o
  fluxo a qualquer hora; o **bot real no WhatsApp** (multi-bot, sem `opts`) continua respeitando.
- **Texto `{horario}` automático:** a variável `{horario}` das mensagens é **gerada da tabela**
  por `textoHorario(config)` em `fluxo.js` (mesmo formato do painel), garantindo que o cliente
  receba o horário correto/atualizado. No painel, o campo "Horário (texto exibido ao cliente)" é
  **read-only** e atualiza ao vivo conforme a tabela (sem botão "gerar").
- **Badge do header segue o horário real:** `lojaAbertaAgora(config)` (em `app.js`, espelha o
  `estaAberto`) — fica "Fechado" mesmo com o toggle ligado se estiver fora do horário. O toggle
  "Status do Atendimento" continua sendo só o override manual.

O painel mostra a tabela de horários na aba **Configurações**.

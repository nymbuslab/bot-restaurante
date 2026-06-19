# Implementação de Frete por Raio usando CEP, ViaCEP e Geoapify

## Objetivo

Implementar na plataforma uma lógica de cálculo de frete para bares, restaurantes e estabelecimentos que trabalham com delivery.

A regra principal será:

1. A empresa/restaurante possui um endereço cadastrado na plataforma.
2. Esse endereço da empresa deve ser convertido uma vez em latitude e longitude.
3. No checkout, o cliente informa o CEP.
4. A plataforma consulta o ViaCEP para preencher rua, bairro, cidade e UF.
5. O cliente informa o número e complemento.
6. O endereço completo do cliente é convertido em latitude e longitude usando uma API de geolocalização.
7. O sistema calcula a distância entre o cliente e a empresa.
8. Com base na distância em km, o sistema define o valor do frete.
9. Caso a distância ultrapasse o limite configurado, o sistema informa que a empresa não entrega naquela região.

---

## APIs utilizadas

### 1. ViaCEP

Usar o ViaCEP para buscar endereço a partir do CEP informado pelo cliente.

Exemplo de chamada:

```txt
https://viacep.com.br/ws/14010000/json/
```

Exemplo de retorno:

```json
{
  "cep": "14010-000",
  "logradouro": "Rua Exemplo",
  "bairro": "Centro",
  "localidade": "Ribeirão Preto",
  "uf": "SP"
}
```

Observação importante:

O ViaCEP não retorna latitude e longitude. Ele serve apenas para preencher o endereço.

---

### 2. Geoapify

Usar a Geoapify para transformar um endereço completo em latitude e longitude.

O endereço deve ser montado com:

```txt
logradouro, número, bairro, cidade, UF, Brasil
```

Exemplo:

```txt
Rua Exemplo, 250, Centro, Ribeirão Preto, SP, Brasil
```

A chave da API deve ficar em variável de ambiente.

Exemplo:

```env
GEOAPIFY_API_KEY=sua_chave_aqui
```

Nunca deixar a chave fixa diretamente no código do frontend.

---

## Fluxo geral do sistema

```txt
Cliente digita o CEP
↓
Sistema consulta ViaCEP
↓
Sistema preenche rua, bairro, cidade e UF
↓
Cliente informa número e complemento
↓
Sistema monta endereço completo
↓
Sistema consulta Geoapify
↓
Geoapify retorna latitude e longitude do cliente
↓
Sistema compara com latitude e longitude da empresa
↓
Sistema calcula distância em km
↓
Sistema busca regra de frete correspondente
↓
Sistema retorna valor do frete ou informa que está fora da área de entrega
```

---

## Estrutura sugerida no banco de dados

### Tabela de empresas

A empresa/restaurante precisa ter endereço e coordenadas salvas.

```sql
CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,

    cep VARCHAR(20),
    logradouro VARCHAR(255),
    numero VARCHAR(50),
    complemento VARCHAR(255),
    bairro VARCHAR(255),
    cidade VARCHAR(255),
    uf VARCHAR(2),

    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### Tabela de regras de frete

Cada empresa poderá ter suas próprias faixas de frete por distância.

```sql
CREATE TABLE regras_frete (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

    raio_inicial_km DECIMAL(10, 2) NOT NULL,
    raio_final_km DECIMAL(10, 2) NOT NULL,
    valor_frete DECIMAL(10, 2) NOT NULL,

    ativo BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

Exemplo de dados:

```sql
INSERT INTO regras_frete (
    empresa_id,
    raio_inicial_km,
    raio_final_km,
    valor_frete
) VALUES
('ID_DA_EMPRESA', 0, 2, 5.00),
('ID_DA_EMPRESA', 2.01, 4, 8.00),
('ID_DA_EMPRESA', 4.01, 6, 12.00),
('ID_DA_EMPRESA', 6.01, 8, 15.00);
```

---

## Regra de frete esperada

Exemplo:

| Distância | Valor |
|---|---:|
| Até 2 km | R$ 5,00 |
| De 2,01 km até 4 km | R$ 8,00 |
| De 4,01 km até 6 km | R$ 12,00 |
| De 6,01 km até 8 km | R$ 15,00 |
| Acima de 8 km | Não entrega |

A regra deve ser configurável por empresa.

---

## Função para calcular distância em km

Criar uma função utilitária no backend para calcular a distância entre duas coordenadas usando a fórmula de Haversine.

```ts
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const raioTerraKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return raioTerraKm * c;
}
```

---

## Função para buscar regra de frete

A lógica deve buscar a regra ativa onde a distância calculada esteja entre o raio inicial e o raio final.

Exemplo em TypeScript:

```ts
type RegraFrete = {
  raio_inicial_km: number;
  raio_final_km: number;
  valor_frete: number;
};

export function encontrarRegraFrete(
  distanciaKm: number,
  regras: RegraFrete[]
): RegraFrete | null {
  return (
    regras.find((regra) => {
      return (
        distanciaKm >= regra.raio_inicial_km &&
        distanciaKm <= regra.raio_final_km
      );
    }) ?? null
  );
}
```

---

## Função para formatar endereço completo

Criar uma função para montar o endereço completo antes de enviar para a Geoapify.

```ts
type Endereco = {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export function montarEnderecoCompleto(endereco: Endereco): string {
  return [
    endereco.logradouro,
    endereco.numero,
    endereco.bairro,
    endereco.cidade,
    endereco.uf,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
}
```

---

## Integração com ViaCEP

Criar uma função para consultar CEP.

```ts
export async function buscarEnderecoPorCep(cep: string) {
  const cepLimpo = cep.replace(/\D/g, "");

  if (cepLimpo.length !== 8) {
    throw new Error("CEP inválido.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

  if (!response.ok) {
    throw new Error("Erro ao consultar CEP.");
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  return {
    cep: data.cep,
    logradouro: data.logradouro,
    bairro: data.bairro,
    cidade: data.localidade,
    uf: data.uf,
  };
}
```

---

## Integração com Geoapify

Criar uma função de geocoding para transformar endereço em coordenadas.

```ts
type Coordenadas = {
  latitude: number;
  longitude: number;
};

export async function buscarCoordenadasPorEndereco(
  enderecoCompleto: string
): Promise<Coordenadas> {
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    throw new Error("GEOAPIFY_API_KEY não configurada.");
  }

  const url = new URL("https://api.geoapify.com/v1/geocode/search");

  url.searchParams.set("text", enderecoCompleto);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Erro ao buscar coordenadas.");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("Não foi possível localizar o endereço.");
  }

  const resultado = data.results[0];

  return {
    latitude: resultado.lat,
    longitude: resultado.lon,
  };
}
```

---

## Endpoint para consultar CEP

Criar uma rota de API para buscar endereço pelo CEP.

Exemplo de endpoint:

```txt
GET /api/enderecos/cep/14010000
```

Resposta esperada:

```json
{
  "cep": "14010-000",
  "logradouro": "Rua Exemplo",
  "bairro": "Centro",
  "cidade": "Ribeirão Preto",
  "uf": "SP"
}
```

---

## Endpoint para calcular frete

Criar uma rota de API para calcular o frete.

Exemplo:

```txt
POST /api/frete/calcular
```

Body:

```json
{
  "empresa_id": "ID_DA_EMPRESA",
  "cep": "14010-000",
  "logradouro": "Rua Exemplo",
  "numero": "250",
  "bairro": "Centro",
  "cidade": "Ribeirão Preto",
  "uf": "SP"
}
```

Resposta quando entrega:

```json
{
  "entrega_disponivel": true,
  "distancia_km": 1.72,
  "valor_frete": 5.00,
  "mensagem": "Entrega disponível para sua região."
}
```

Resposta quando não entrega:

```json
{
  "entrega_disponivel": false,
  "distancia_km": 9.43,
  "valor_frete": null,
  "mensagem": "Endereço fora da área de entrega."
}
```

---

## Validações obrigatórias

Implementar as seguintes validações:

1. CEP deve conter 8 números.
2. Número do endereço deve ser obrigatório.
3. Empresa precisa ter latitude e longitude cadastradas.
4. Empresa precisa ter pelo menos uma regra de frete ativa.
5. Se a API de geolocalização não encontrar o endereço, retornar erro amigável.
6. Se a distância não se encaixar em nenhuma regra ativa, retornar que a entrega não está disponível.
7. Não expor a chave da Geoapify no frontend.
8. Evitar múltiplas chamadas desnecessárias para a Geoapify.

---

## Cache recomendado

Para economizar chamadas na Geoapify, criar cache de coordenadas de endereços consultados.

Sugestão de tabela:

```sql
CREATE TABLE enderecos_geocodificados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    endereco_completo TEXT NOT NULL UNIQUE,

    cep VARCHAR(20),
    logradouro VARCHAR(255),
    numero VARCHAR(50),
    bairro VARCHAR(255),
    cidade VARCHAR(255),
    uf VARCHAR(2),

    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

Antes de consultar a Geoapify:

1. Montar o endereço completo.
2. Procurar na tabela `enderecos_geocodificados`.
3. Se existir, usar latitude e longitude salvas.
4. Se não existir, consultar Geoapify e salvar no banco.

---

## Comportamento esperado no frontend

No checkout:

1. Cliente digita o CEP.
2. Sistema busca o endereço no ViaCEP.
3. Campos de rua, bairro, cidade e UF são preenchidos automaticamente.
4. Cliente informa número e complemento.
5. Sistema calcula o frete.
6. Mostrar o valor do frete no resumo do pedido.
7. Se estiver fora da área de entrega, bloquear finalização do pedido ou exibir retirada no local, se existir essa opção.

Exemplo de mensagem positiva:

```txt
Entrega disponível. Distância aproximada: 1,7 km. Frete: R$ 5,00.
```

Exemplo de mensagem negativa:

```txt
No momento, este restaurante não entrega no endereço informado.
```

---

## Painel administrativo

No painel da empresa/restaurante, criar uma área para configurar as faixas de frete.

Campos necessários:

- Raio inicial em km.
- Raio final em km.
- Valor do frete.
- Ativo/inativo.

Exemplo visual:

| Raio inicial | Raio final | Valor | Ativo |
|---:|---:|---:|---|
| 0 km | 2 km | R$ 5,00 | Sim |
| 2,01 km | 4 km | R$ 8,00 | Sim |
| 4,01 km | 6 km | R$ 12,00 | Sim |
| 6,01 km | 8 km | R$ 15,00 | Sim |

---

## Regras de negócio

1. Cada empresa pode ter sua própria tabela de frete.
2. A distância deve ser calculada da empresa até o endereço do cliente.
3. A distância pode ser inicialmente calculada em linha reta usando Haversine.
4. Futuramente, poderá ser implementado cálculo por rota real usando API de rotas.
5. Se não houver regra de frete compatível com a distância, considerar fora da área de entrega.
6. O valor do frete deve ser salvo no pedido no momento da finalização.
7. Mesmo que a regra de frete mude depois, o pedido antigo deve manter o valor calculado no momento da compra.

---

## Campos recomendados na tabela de pedidos

Adicionar ou validar se existem os seguintes campos:

```sql
ALTER TABLE pedidos
ADD COLUMN cep_entrega VARCHAR(20),
ADD COLUMN logradouro_entrega VARCHAR(255),
ADD COLUMN numero_entrega VARCHAR(50),
ADD COLUMN complemento_entrega VARCHAR(255),
ADD COLUMN bairro_entrega VARCHAR(255),
ADD COLUMN cidade_entrega VARCHAR(255),
ADD COLUMN uf_entrega VARCHAR(2),
ADD COLUMN latitude_entrega DECIMAL(10, 8),
ADD COLUMN longitude_entrega DECIMAL(11, 8),
ADD COLUMN distancia_entrega_km DECIMAL(10, 2),
ADD COLUMN valor_frete DECIMAL(10, 2);
```

---

## Observações importantes

### Sobre distância por raio

A distância calculada por Haversine é uma distância em linha reta. Ela é boa para regra de raio e barato para rodar.

Exemplo:

```txt
Empresa até cliente: 1,8 km em linha reta
Frete aplicado: R$ 5,00
```

### Sobre distância por rota real

A distância por rota real considera ruas, avenidas e sentido de trânsito. Ela é mais precisa, mas consome mais API.

Essa melhoria pode ser feita depois usando:

- Geoapify Routing API
- OpenRouteService
- OSRM self-hosted

Para a primeira versão, usar Haversine.

---

## Checklist de implementação

- [ ] Criar variável de ambiente `GEOAPIFY_API_KEY`.
- [ ] Criar ou ajustar tabela de empresas para salvar latitude e longitude.
- [ ] Criar tabela `regras_frete`.
- [ ] Criar tabela opcional `enderecos_geocodificados` para cache.
- [ ] Criar função `buscarEnderecoPorCep`.
- [ ] Criar função `buscarCoordenadasPorEndereco`.
- [ ] Criar função `calcularDistanciaKm`.
- [ ] Criar função `encontrarRegraFrete`.
- [ ] Criar endpoint para consulta de CEP.
- [ ] Criar endpoint para cálculo de frete.
- [ ] Criar interface no checkout para CEP, número e complemento.
- [ ] Criar interface no painel para configurar faixas de frete.
- [ ] Salvar valor do frete no pedido.
- [ ] Tratar erro de CEP inválido.
- [ ] Tratar erro de endereço não localizado.
- [ ] Tratar caso fora da área de entrega.
- [ ] Testar com endereço próximo.
- [ ] Testar com endereço longe.
- [ ] Testar com CEP inválido.
- [ ] Testar com empresa sem coordenadas.
- [ ] Testar com empresa sem regra de frete.

---

## Prompt para a IA implementar no projeto

Use este prompt para pedir a implementação:

```txt
Implemente no projeto a lógica de cálculo de frete por raio para delivery.

A empresa/restaurante deve ter endereço cadastrado com latitude e longitude. No checkout, o cliente deve digitar o CEP, o sistema deve consultar o ViaCEP para preencher rua, bairro, cidade e UF, e o cliente deve informar o número.

Depois disso, o backend deve montar o endereço completo do cliente, consultar a Geoapify para converter esse endereço em latitude e longitude, calcular a distância em km entre o cliente e a empresa usando Haversine, buscar a regra de frete ativa correspondente e retornar o valor do frete.

Crie também uma tabela de regras de frete por empresa, com raio inicial, raio final, valor e status ativo/inativo.

A chave da Geoapify deve ficar em variável de ambiente `GEOAPIFY_API_KEY` e nunca deve ser exposta no frontend.

Implemente cache de endereços geocodificados para evitar chamadas repetidas na Geoapify.

No checkout, exiba o valor do frete quando a entrega estiver disponível. Se a distância não se encaixar em nenhuma faixa ativa, exiba que o endereço está fora da área de entrega.

O valor do frete, a distância calculada e o endereço completo devem ser salvos no pedido no momento da finalização.

Antes de alterar qualquer arquivo, analise a estrutura atual do projeto e siga os padrões já existentes de rotas, componentes, services, banco de dados, validações e organização de pastas.

Ao finalizar, atualize o CHANGELOG.md e o PROGRESSO.md explicando o que foi implementado.
```

---

## Resultado esperado

Ao final da implementação, a plataforma deve permitir que cada bar/restaurante configure sua própria tabela de frete por km.

Exemplo:

```txt
0 até 2 km = R$ 5,00
2,01 até 4 km = R$ 8,00
4,01 até 6 km = R$ 12,00
Acima disso = fora da área de entrega
```

O cliente informa o CEP e número, o sistema calcula automaticamente a distância até a empresa e exibe o frete no checkout.

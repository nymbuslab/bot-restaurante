// ============================================================
// TENANT — empresa descartável, criada e apagada dentro do teste.
//
// Cada empresa nasce com slug único, então testes que rodem juntos (ou uma
// bateria interrompida no meio) nunca disputam a mesma linha.
//
// O login usa `empresas.autenticar` em vez da rota POST /api/login de propósito:
// aquela rota tem rate limit, e uma bateria que cria várias empresas bateria no
// teto e falharia por motivo que não é o do teste. A rota de login é exercitada
// por HTTP onde ela É o objeto do teste, não no preparo dos outros.
//
// A limpeza passa por `empresas.excluir`, que é o mesmo caminho do produto:
// apaga a linha (cascata leva pedidos, caixa, estoque), a sessão do WhatsApp, o
// usuário no Auth e as imagens no Storage.
// ============================================================

require("./ambiente");

const empresas = require("../../../src/empresas");
const store = require("../../../src/store");

const criados = [];

function sufixo() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function criarEmpresa(rotulo = "teste", opcoes = {}) {
  const marca = rotulo + "-" + sufixo();
  const email = marca + "@exemplo-teste.invalid"; // .invalid nunca resolve: e-mail não vaza
  const senha = "Teste" + sufixo() + "!1";

  const { slug, nome } = await empresas.cadastrar({ nome: "Restaurante " + marca, email, senha });
  criados.push(slug);

  // Empresa nova nasce SEM assinatura, e `acessoLiberado` (src/empresas.js) exige
  // status em trialing/active/cortesia. Sem isso o cardápio público responde 404 e
  // nenhum pedido entra — comportamento correto do produto, que o teste precisa
  // contornar de forma honesta. `cortesia` é o status que o super-admin usa para
  // liberar acesso sem Stripe, então é o que descreve a verdade aqui: liberado à
  // mão, sem cobrança nenhuma envolvida.
  // `plano` importa para Caixa, PDV e Mesas: os porteiros `temCaixa`/`temPdv`
  // exigem plano completo. Passar { plano: "completo" } configura o plano pelo
  // mesmo caminho do super-admin — não burla o porteiro.
  await empresas.atualizarAssinatura(slug, { status: "cortesia", plano: opcoes.plano || "essencial" });

  const sessao = await empresas.autenticar(email, senha);
  if (!sessao) throw new Error("empresa criada mas o login falhou (slug=" + slug + ")");

  return {
    slug,
    nome,
    email,
    senha,
    token: sessao.token,
    dir: empresas.tenantDir(slug),
    plano: opcoes.plano || "essencial",
    marca,
  };
}

// Cardápio mínimo com um item de preço conhecido. O preço é o que o teste do
// recálculo compara contra o que o cliente tenta mandar.
// O id PRECISA ser numérico: a projeção relacional de `itens_venda` converte o id
// do item para bigint, e um id de texto derruba a gravação do pedido com
// `invalid input syntax for type bigint`. Descoberto por esta bateria — nenhum
// teste de lógica pura alcança essa conversão, que só existe no banco.
function cardapioDeUmItem({ idItem = 101, nome = "Prato do Teste", preco = 10 } = {}) {
  return {
    categorias: [{ nome: "Categoria do Teste", ativo: true, itens: [{ id: idItem, nome, preco, disponivel: true }] }],
    grupos: [],
  };
}

async function prepararLoja(emp, { cardapio, config } = {}) {
  await store.setCardapio(emp.dir, cardapio || cardapioDeUmItem());
  const atual = (await store.getConfig(emp.dir)) || {};
  await store.setConfig(
    emp.dir,
    Object.assign({}, atual, {
      // `aberto: true` sem grade de horário = aberto sempre (public/horario.js:
      // atendimento ausente não fecha, e só `aberto === false` fecha).
      atendimento: { aberto: true },
      pagamentos: ["Dinheiro"],
      entrega: Object.assign({}, atual.entrega, { retirada: true }),
    }, config || {})
  );
}

async function limparTudo() {
  const erros = [];
  while (criados.length) {
    const slug = criados.pop();
    try {
      await empresas.excluir(slug);
    } catch (e) {
      erros.push(slug + ": " + e.message);
    }
  }
  // Falha de limpeza não reprova o teste, mas não pode passar em silêncio: o
  // resto vira lixo acumulado no projeto de teste.
  if (erros.length) console.error("AVISO: falha ao limpar empresa(s) de teste →", erros.join(" | "));
}

module.exports = { criarEmpresa, prepararLoja, cardapioDeUmItem, limparTudo };

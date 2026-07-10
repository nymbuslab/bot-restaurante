// ============================================================
// VALIDAÇÃO — helpers PUROS de validação de entrada (sem dependências
// externas, sem I/O). Extraídos do servidor.js para serem testáveis em
// isolamento (ver test/validacao.test.js).
// ============================================================

// Limites do payload jsonb (config/cardápio). O jsonb é flexível por design
// (sem schema rígido), mas barramos payload não-objeto ou exagerado, que
// inflaria a linha no banco ou quebraria o bot/painel.
const LIMITE_CONFIG_BYTES = 256 * 1024; // ~256 KB
const LIMITE_CARDAPIO_BYTES = 512 * 1024; // ~512 KB
const MAX_CATEGORIAS = 200;
const MAX_ITENS_POR_CATEGORIA = 500;
const MAX_VARIACOES_POR_ITEM = 100;

const ehObjetoSimples = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const tamanhoBytes = (v) => Buffer.byteLength(JSON.stringify(v), "utf8");

// Retorna string de erro (mensagem ao usuário), ou null se válido.
function validarConfig(body) {
  if (!ehObjetoSimples(body)) return "Configuração inválida.";
  if (tamanhoBytes(body) > LIMITE_CONFIG_BYTES) return "Configuração grande demais.";
  return null;
}

function validarCardapio(body) {
  if (!ehObjetoSimples(body)) return "Cardápio inválido.";
  if (tamanhoBytes(body) > LIMITE_CARDAPIO_BYTES) return "Cardápio grande demais.";
  const cats = body.categorias;
  if (cats !== undefined) {
    if (!Array.isArray(cats)) return "Cardápio inválido (categorias).";
    if (cats.length > MAX_CATEGORIAS) return "Categorias demais.";
    for (const cat of cats) {
      if (!ehObjetoSimples(cat)) return "Categoria inválida.";
      if (cat.itens !== undefined) {
        if (!Array.isArray(cat.itens)) return "Categoria inválida (itens).";
        if (cat.itens.length > MAX_ITENS_POR_CATEGORIA) return "Itens demais em uma categoria.";
        for (const it of cat.itens) {
          if (it && it.variacoes !== undefined) {
            if (!Array.isArray(it.variacoes)) return "Item inválido (variações).";
            if (it.variacoes.length > MAX_VARIACOES_POR_ITEM) return "Variações demais em um item.";
          }
        }
      }
    }
  }
  return null;
}

// ---- Documentos (CPF/CNPJ) — validação PURA por dígito verificador ----
// Aceita com ou sem máscara (só olha os dígitos). Rejeita tamanho errado e
// sequências repetidas (000..., 111...), que passam na conta mas são inválidas.
const soDigitos = (v) => String(v == null ? "" : v).replace(/\D/g, "");

function validarCpf(valor) {
  const c = soDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(c[i]) * (10 - i);
  let d1 = (soma * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(c[i]) * (11 - i);
  let d2 = (soma * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

function validarCnpj(valor) {
  const c = soDigitos(valor);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const digito = (base) => {
    const len = base.length;
    let pos = len - 7;
    let soma = 0;
    for (let i = 0; i < len; i++) {
      soma += Number(base[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (digito(c.slice(0, 12)) !== Number(c[12])) return false;
  return digito(c.slice(0, 13)) === Number(c[13]);
}

// Valida o documento conforme o tipo do cliente ('PF' → CPF, 'PJ' → CNPJ).
// Documento vazio é aceito (campo opcional no cadastro).
function validarDocumento(tipo, valor) {
  const c = soDigitos(valor);
  if (!c) return true;
  return tipo === "PJ" ? validarCnpj(c) : validarCpf(c);
}

// Detecta o tipo REAL da imagem pelos magic bytes (não confia no MIME do header,
// que é falsificável). Retorna { ext, mime } ou null se não for imagem suportada.
function tipoImagemPorAssinatura(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return { ext: "png", mime: "image/png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

module.exports = {
  validarConfig,
  validarCardapio,
  validarCpf,
  validarCnpj,
  validarDocumento,
  tipoImagemPorAssinatura,
  LIMITE_CONFIG_BYTES,
  LIMITE_CARDAPIO_BYTES,
  MAX_CATEGORIAS,
  MAX_ITENS_POR_CATEGORIA,
  MAX_VARIACOES_POR_ITEM,
};

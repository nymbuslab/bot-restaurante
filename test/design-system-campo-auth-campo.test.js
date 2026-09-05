const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const CSS = path.join(__dirname, "..", "public", "style.css");

test(".campo e .auth-campo compartilham um unico bloco de label", () => {
  const css = fs.readFileSync(CSS, "utf8");

  const combinado = css.match(/\.campo label,\s*\n\.auth-campo label \{([^}]*)\}/);
  assert.ok(combinado, "deve existir um seletor combinado '.campo label,\n.auth-campo label'");

  const corpoCombinado = combinado[1];
  const compartilhadas = [
    "font-size: 11px",
    "font-weight: 700",
    "color: var(--text-secondary)",
    "text-transform: uppercase",
    "letter-spacing: 0.5px",
  ];
  for (const prop of compartilhadas) {
    assert.ok(corpoCombinado.includes(prop), "seletor combinado deve declarar: " + prop);
  }

  const corpoCampoLabel = css.match(/\.campo label \{([^}]*)\}/);
  assert.ok(corpoCampoLabel, "deve existir bloco .campo label");
  for (const prop of compartilhadas) {
    assert.ok(!corpoCampoLabel[1].includes(prop.split(":")[0]), ".campo label nao deve repetir " + prop.split(":")[0]);
  }

  const soAuth = css.match(/^\s*\.auth-campo label \{([^}]*)\}/m);
  if (soAuth) {
    const antes = css.slice(0, soAuth.index);
    assert.ok(/(^|\n)\s*\.campo label,\s*$/.test(antes), ".auth-campo label deve ser parte do seletor combinado, nao um bloco isolado");
  }
});

test("containers de .campo e .auth-campo mantem layout proprio", () => {
  const css = fs.readFileSync(CSS, "utf8");

  const campo = css.match(/^\.campo \{([^}]*)\}/m);
  assert.ok(campo, "bloco .campo nao encontrado");
  assert.ok(/margin-bottom/.test(campo[1]), ".campo deve manter margin-bottom");

  const authCampo = css.match(/^\.auth-campo \{([^}]*)\}/m);
  assert.ok(authCampo, "bloco .auth-campo nao encontrado");
  assert.ok(/display:\s*flex/.test(authCampo[1]), ".auth-campo deve manter display:flex");
  assert.ok(/flex-direction:\s*column/.test(authCampo[1]), ".auth-campo deve manter flex-direction:column");
});
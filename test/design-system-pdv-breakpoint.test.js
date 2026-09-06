const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const CSS = path.join(__dirname, "..", "public", "style.css");

test("breakpoint intermediario do .pdv usa max-width 1100px, nao 980px", () => {
  const css = fs.readFileSync(CSS, "utf8");

  const bloco = css.match(/@media \(max-width: (\d+)px\) \{\s*\.pdv \{ grid-template-columns: 116px 1fr 320px; gap: 14px; \}/);
  assert.ok(bloco, "breakpoint intermediario do .pdv (116px 1fr 320px) nao encontrado");
  assert.equal(bloco[1], "1100", "breakpoint do .pdv deve ser 1100px, achou: " + bloco[1] + "px");
});

test("nao ha mais @media (max-width 980px) para o seletor .pdv", () => {
  const css = fs.readFileSync(CSS, "utf8");
  const mq = css.match(/@media \(max-width: 980px\) \{([\s\S]*?)\n\}/g) || [];
  for (const bloco of mq) {
    assert.ok(!/^\s*\.pdv /m.test(bloco), "ha um @media 980px que redefine .pdv: " + bloco.slice(0, 80));
  }
});
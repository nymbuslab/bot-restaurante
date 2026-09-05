const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { contemTrecho, trechoEntre } = require("./apoio/arquivo-estatico");

const CSS = path.join(__dirname, "..", "public", "style.css");

function relLum(hex) {
  const h = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contraste(a, b) {
  const la = relLum(a);
  const lb = relLum(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function valorToken(css, nome) {
  const m = css.match(new RegExp(`--${nome}:\\s*([^;]+);`));
  assert.ok(m, `token --${nome} nao encontrado em :root`);
  return m[1].trim();
}

test("style.css declara --text-secondary-fg em :root", () => {
  const css = require("fs").readFileSync(CSS, "utf8");
  const tok = valorToken(css, "text-secondary-fg");
  assert.ok(/^#[0-9A-Fa-f]{6}$/.test(tok), "token deve ser um hex de 6 digitos");
});

test("contraste de --text-secondary-fg sobre --bg-overlay >= 4.5:1", () => {
  const css = require("fs").readFileSync(CSS, "utf8");
  const fg = valorToken(css, "text-secondary-fg");
  const bg = valorToken(css, "bg-overlay");
  const r = contraste(fg, bg);
  assert.ok(r >= 4.5, `contraste ${r.toFixed(2)}:1 abaixo de 4.5:1`);
});

test(".mesa-status-badge.s-livre usa var(--text-secondary-fg)", () => {
  const ok = contemTrecho(CSS, ".mesa-status-badge.s-livre { background: var(--bg-overlay); color: var(--text-secondary-fg); }");
  assert.equal(ok, true);
});
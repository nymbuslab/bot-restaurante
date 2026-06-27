const test = require("node:test");
const assert = require("node:assert");
const { calcBackoff } = require("../main/poller");

test("calcBackoff: 1a falha = 5s; dobra; teto 60s", () => {
  assert.equal(calcBackoff(1), 5000);
  assert.equal(calcBackoff(2), 10000);
  assert.equal(calcBackoff(3), 20000);
  assert.equal(calcBackoff(10), 60000); // teto
  assert.equal(calcBackoff(0), 5000);   // defensivo
});

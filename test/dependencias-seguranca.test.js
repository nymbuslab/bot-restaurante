const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

async function comServidor(app, executar) {
  const servidor = await new Promise((resolve) => {
    const instancia = app.listen(0, "127.0.0.1", () => resolve(instancia));
  });
  try {
    const endereco = servidor.address();
    return await executar(`http://127.0.0.1:${endereco.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      servidor.close((erro) => erro ? reject(erro) : resolve());
    });
  }
}

test("multer mantém o upload em memória e recusa arquivo acima de 2 MB", async () => {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  app.post("/upload", (req, res) => {
    upload.single("imagem")(req, res, (erro) => {
      if (erro) return res.status(400).json({ codigo: erro.code });
      res.json({ tamanho: req.file && req.file.size });
    });
  });

  await comServidor(app, async (base) => {
    const valido = new FormData();
    valido.append("imagem", new Blob([Buffer.alloc(128)]), "imagem.png");
    const respostaValida = await fetch(`${base}/upload`, { method: "POST", body: valido });
    assert.equal(respostaValida.status, 200);
    assert.deepEqual(await respostaValida.json(), { tamanho: 128 });

    const grande = new FormData();
    grande.append("imagem", new Blob([Buffer.alloc(2 * 1024 * 1024 + 1)]), "grande.png");
    const respostaGrande = await fetch(`${base}/upload`, { method: "POST", body: grande });
    assert.equal(respostaGrande.status, 400);
    assert.deepEqual(await respostaGrande.json(), { codigo: "LIMIT_FILE_SIZE" });
  });
});

test("express-rate-limit separa os baldes pelo IP informado pelo Fly", async () => {
  const app = express();
  const limitador = rateLimit({
    windowMs: 60 * 1000,
    max: 2,
    keyGenerator(req) {
      const fly = String(req.headers["fly-client-ip"] || "").trim();
      return ipKeyGenerator(fly || req.ip || "");
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.get("/limitado", limitador, (_req, res) => res.json({ ok: true }));

  await comServidor(app, async (base) => {
    const chamar = (ip) => fetch(`${base}/limitado`, { headers: { "Fly-Client-IP": ip } });
    assert.equal((await chamar("203.0.113.10")).status, 200);
    assert.equal((await chamar("203.0.113.10")).status, 200);
    assert.equal((await chamar("203.0.113.10")).status, 429);
    assert.equal((await chamar("203.0.113.11")).status, 200);
  });
});

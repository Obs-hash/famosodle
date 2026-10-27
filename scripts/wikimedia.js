// Funções comuns aos scripts de build que consultam a Wikipedia, o Wikimedia Commons e o Wikidata.
// Nada disto roda no site. Segue a política de User-Agent da Wikimedia (nome, versão e contato),
// faz um pedido por vez com pausa entre eles e respeita 429, Retry-After e maxlag.
"use strict";
const fs = require("fs");
const path = require("path");

const SITE = "https://famosodle.vercel.app/";
const UA = `FamosodleBuild/1.0 (${SITE}) Node.js/${process.versions.node}`;
const WP = "https://en.wikipedia.org/w/api.php";
const WD = "https://www.wikidata.org/w/api.php";
const PAUSA = 300; // ms entre pedidos
const espera = ms => new Promise(r => setTimeout(r, ms));
let ultimo = 0;

async function pedir(url, tentativas = 5) {
  for (let i = 0; ; i++) {
    const falta = ultimo + PAUSA - Date.now();
    if (falta > 0) await espera(falta);
    ultimo = Date.now();
    let r;
    try { r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) }); }
    catch (e) { if (i >= tentativas) throw e; await espera(2000 * 2 ** i); continue; }
    if (r.status === 429 || r.status >= 500) {
      if (i >= tentativas) throw new Error(`HTTP ${r.status} em ${url}`);
      const ra = Number(r.headers.get("retry-after"));
      await espera(ra > 0 ? ra * 1000 : 2000 * 2 ** i);
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    return r;
  }
}

async function api(base, params) {
  const u = new URL(base);
  // no Wikidata o maxlag inclui o atraso do serviço de consultas e trava até leituras simples; lá ele fica de fora
  const extra = base === WD ? {} : { maxlag: "5" };
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...extra, ...params })) u.searchParams.set(k, v);
  for (let i = 0; ; i++) {
    const j = await (await pedir(u)).json();
    if (j.error && j.error.code === "maxlag" && i < 5) { await espera(5000); continue; }
    if (j.error) throw new Error(`${j.error.code}: ${j.error.info}`);
    return j;
  }
}

const lotes = (lista, n) => { const out = []; for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n)); return out; };
const titulo = w => w.replace(/_/g, " ");

// segue as normalizações e os redirecionamentos de uma resposta da API até o título final
function seguir(q) {
  const mapa = new Map();
  for (const n of (q && q.normalized) || []) mapa.set(n.from, n.to);
  for (const n of (q && q.redirects) || []) mapa.set(n.from, n.to);
  return t => { let x = t; for (let k = 0; mapa.has(x) && k < 5; k++) x = mapa.get(x); return x; };
}

// lista de figuras já validada pelo gerar-dados.js
function figuras() {
  const arq = path.join(__dirname, "..", "dados", "data.json");
  if (!fs.existsSync(arq)) throw new Error("Rode antes: npm run dados");
  return JSON.parse(fs.readFileSync(arq, "utf8")).people;
}

module.exports = { SITE, UA, WP, WD, espera, pedir, api, lotes, titulo, seguir, figuras };

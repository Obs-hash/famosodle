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
const COMMONS = "https://commons.wikimedia.org/w/api.php";
const WDQS = "https://query.wikidata.org/sparql";
// imagens só dos servidores da Wikimedia: miniaturas em thumb.wikimedia.org, arquivos inteiros em upload.wikimedia.org
const IMG = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;
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

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
// travessões viram hífen; caracteres de controle e invisíveis viram espaço
const TRAVESSAO = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]", "g");
const INVISIVEIS = new RegExp("[" + [[0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]", "g");
const MAX_BYTES = 5 * 1048576; // nenhuma miniatura chega perto disso
const MAX_LADO = 4000; // PNG maior que isso não é miniatura e poderia travar a decodificação
// texto puro a partir do HTML que o Commons devolve no campo de autor.
// As entidades são decodificadas depois de tirar as tags, então o resultado pode conter "<": é texto,
// e quem o puser em HTML precisa escapar (o jogo passa tudo por esc()).
function textoPuro(html, max) {
  let s = String(html || "").slice(0, 4000)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/gi, (m, e) => {
      if (e[0] !== "#") return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
      const n = /x/i.test(e[1]) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 31 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(TRAVESSAO, "-")
    .replace(INVISIVEIS, " ")
    .replace(/\s+/g, " ").trim()
    .replace(/^(File:)?[^:]{1,160}\.(jpe?g|png|tiff?|gif|svg|webp)\s*:\s*/i, "") // "Arquivo.jpg : Autor", comum em obras derivadas
    .replace(/\[\s*\d+\s*\]/g, "")
    .replace(/\s*\(\s*(talk|contribs?|archived link)\b[^)]*\)/gi, "")
    .replace(/\bUser:/g, "")
    // frases padrão do Commons que não são nomes
    .replace(/The SVG code is valid\s*\.?/gi, " ")
    .replace(/This (vector )?image was created with (Inkscape|a text editor)( by)?\s*\.?/gi, " ")
    .replace(/,?\s*see (the )?file history\W{0,3}(below\s*)?(for details\s*)?\.?/gi, " ")
    .replace(/^\s*see below\s*\.?\s*$/i, "")
    .replace(/\s+([,.;:)])/g, "$1").replace(/\(\s+/g, "(")
    .replace(/^unknown\s+unknown\b/i, "Unknown")
    .replace(/\s+/g, " ").trim()
    .replace(/[\s,;]+$/, "")
    .replace(/^various\.?$/i, "Vários autores")
    .slice(0, 400)
    .replace(/^(.+?)\s*\1$/, "$1");
  s = s.replace(/^unknown( author| photographer)?\b\.?/i, "Autor desconhecido");
  if (/^own work$/i.test(s)) s = "";
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return s;
}
const licenca = s => (/^public domain$/i.test(s) ? "Domínio público" : /^no restrictions$/i.test(s) ? "Sem restrições" : s);

// baixa uma imagem da Wikimedia com limite de tamanho; depois de um redirecionamento, o endereço final também precisa ser da Wikimedia
async function baixarImagem(url) {
  const r = await pedir(url);
  if (!IMG.test(r.url)) throw new Error("redirecionado para " + r.url);
  if (Number(r.headers.get("content-length")) > MAX_BYTES) throw new Error("arquivo grande demais");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("arquivo grande demais");
  return buf;
}
// largura e altura de um PNG, lidas do cabeçalho IHDR sem decodificar a imagem; null se não for PNG
function ladosPng(buf) {
  if (buf.length < 24 || buf.subarray(0, 4).toString("latin1") !== "\x89PNG") return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

// lista de figuras já validada pelo gerar-dados.js
function figuras() {
  const arq = path.join(__dirname, "..", "dados", "data.json");
  if (!fs.existsSync(arq)) throw new Error("Rode antes: npm run dados");
  return JSON.parse(fs.readFileSync(arq, "utf8")).people;
}

module.exports = { SITE, UA, WP, WD, COMMONS, WDQS, IMG, MAX_LADO, espera, pedir, api, lotes, titulo, seguir, textoPuro, licenca, baixarImagem, ladosPng, figuras };

// Servidor local que imita a Vercel: serve dist/famosodle com os mesmos cabeçalhos do vercel.json,
// compressão gzip, ETag e a página 404.html. Usado por npm run servir, pelos testes e pelo Lighthouse.
// Uso: node scripts/servir.js [pasta] [porta]
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const zlib = require("zlib");
const crypto = require("crypto");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2"
};
const COMPRIMIR = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

// converte o "source" da Vercel em expressão regular: os grupos entre parênteses já são regex, o resto é literal
function fonteParaRegex(src) {
  let re = "", i = 0;
  while (i < src.length) {
    if (src[i] === "(") {
      let nivel = 0, j = i;
      for (; j < src.length; j++) { if (src[j] === "(") nivel++; else if (src[j] === ")" && --nivel === 0) break; }
      re += src.slice(i, j + 1); i = j + 1;
    } else { re += src[i].replace(/[.*+?^${}|[\]\\/]/g, "\\$&"); i++; }
  }
  return new RegExp("^" + re + "$");
}

// caminho real do arquivo pedido, ou null. Recusa nomes alternativos do Windows (":", ponto ou espaço no fim),
// atalhos e diferenças de maiúsculas: cada arquivo só tem um endereço, e as regras de cabeçalho valem para ele
function arquivoReal(raiz, rota) {
  if (/[:\\]|[. ](\/|$)/.test(rota)) return null;
  const arq = path.join(raiz, rota.endsWith("/") ? rota + "index.html" : rota);
  if (!arq.startsWith(raiz + path.sep)) return null;
  try { return fs.realpathSync.native(arq) === arq && fs.statSync(arq).isFile() ? arq : null; } catch (e) { return null; }
}

function iniciar({ pasta, porta = 0, vercel } = {}) {
  const raiz = fs.realpathSync.native(path.resolve(pasta || path.join(__dirname, "..", "dist", "famosodle")));
  const cfgArq = vercel || path.join(raiz, "vercel.json");
  const regras = (fs.existsSync(cfgArq) ? JSON.parse(fs.readFileSync(cfgArq, "utf8")).headers || [] : [])
    .map(r => ({ re: fonteParaRegex(r.source), headers: r.headers }));
  const server = http.createServer((req, res) => {
    let rota;
    try { rota = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    let arq = arquivoReal(raiz, rota);
    let status = 200;
    // nada fora da pasta servida
    if (!arq) { status = 404; arq = path.join(raiz, "404.html"); }
    const cab = { "Cache-Control": "public, max-age=0, must-revalidate" };
    for (const r of regras) if (r.re.test(rota)) for (const h of r.headers) cab[h.key] = h.value;
    if (!fs.existsSync(arq)) { res.writeHead(404, { ...cab, "Content-Type": "text/plain; charset=utf-8" }); res.end("404"); return; }
    let corpo = fs.readFileSync(arq);
    const tipo = TIPOS[path.extname(arq).toLowerCase()] || "application/octet-stream";
    const etag = '"' + crypto.createHash("sha1").update(corpo).digest("base64url").slice(0, 16) + '"';
    Object.assign(cab, { "Content-Type": tipo, ETag: etag });
    if (status === 200 && req.headers["if-none-match"] === etag) { res.writeHead(304, cab); res.end(); return; }
    if (COMPRIMIR.test(tipo) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      corpo = zlib.gzipSync(corpo); cab["Content-Encoding"] = "gzip"; cab.Vary = "Accept-Encoding";
    }
    cab["Content-Length"] = corpo.length;
    res.writeHead(status, cab);
    res.end(req.method === "HEAD" ? undefined : corpo);
  });
  return new Promise(ok => server.listen(porta, "127.0.0.1", () => ok(server)));
}

module.exports = { iniciar, fonteParaRegex };

if (require.main === module) {
  const [pasta, porta] = process.argv.slice(2);
  iniciar({ pasta, porta: Number(porta) || 4173 }).then(s => console.log(`Servindo ${path.resolve(pasta || "dist/famosodle")} em http://127.0.0.1:${s.address().port}`));
}

// Monta as entregas do Famosodle:
// dist/famosodle/      o site: index.html, 404.html, assets/ (JS, CSS e fontes com hash no nome), fotos, ícones e vercel.json
// dist/famosodle.html  arquivo único sem minificar: abre direto no navegador e tem os botões de gerar fotos
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const esbuild = require("esbuild");

// endereço público do site: URL canônica, og:url, og:image, robots.txt, sitemap.xml e texto de compartilhar
const SITE = "https://famosodle.vercel.app/";
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const out = path.join(DIST, "famosodle");
const TRAVESSAO = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const ESC_LT = String.fromCharCode(92) + "u003c"; // "<" escrito como escape dentro do JSON embutido
const hash = buf => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
const comHash = (nome, buf) => nome.replace(/(\.[a-z0-9]+)$/, `.${hash(buf)}$1`);
const ler = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const gravar = (rel, conteudo) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, conteudo); };
const kb = n => (n / 1024).toFixed(1) + " KB";

// começa do zero, para não publicar arquivos de builds antigos
fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(path.join(DIST, "famosodle.html"), { force: true });
fs.mkdirSync(out, { recursive: true });

/* ---------- fontes ---------- */
const fontFile = (pkg, file) => fs.readFileSync(path.join(path.dirname(require.resolve(pkg + "/package.json")), "files", file));
// o .woff2 do peso 400 vem corrompido no pacote @fontsource/open-sauce-sans 5.3.0, por isso esse peso usa o .woff
// preload: fontes do primeiro desenho da página (texto, botões e título)
const faces = [
  { fam: "Open Sauce Emb", pkg: "@fontsource/open-sauce-sans", file: "open-sauce-sans-latin-400-normal.woff", w: 400, st: "normal", preload: true },
  { fam: "Open Sauce Emb", pkg: "@fontsource/open-sauce-sans", file: "open-sauce-sans-latin-600-normal.woff2", w: 600, st: "normal", preload: true },
  { fam: "Open Sauce Emb", pkg: "@fontsource/open-sauce-sans", file: "open-sauce-sans-latin-700-normal.woff2", w: 700, st: "normal" },
  { fam: "Instrument Serif Emb", pkg: "@fontsource/instrument-serif", file: "instrument-serif-latin-400-normal.woff2", w: 400, st: "normal", preload: true },
  { fam: "Instrument Serif Emb", pkg: "@fontsource/instrument-serif", file: "instrument-serif-latin-400-italic.woff2", w: 400, st: "italic" },
];
const fmt = file => (file.endsWith(".woff2") ? "woff2" : "woff");
faces.forEach(f => {
  f.buf = fontFile(f.pkg, f.file);
  // confere a assinatura de cada fonte, para não publicar arquivo quebrado
  if (f.buf.subarray(0, 4).toString("latin1") !== (fmt(f.file) === "woff2" ? "wOF2" : "wOFF")) throw new Error("fonte inválida: " + f.file);
  f.url = "fonts/" + comHash(f.file, f.buf); // relativo ao CSS, que fica em assets/
  gravar("assets/" + f.url, f.buf);
});
const local = `@font-face{font-family:"Perandory Local";src:local("Perandory"),local("Perandory Regular"),local("Perandory-Regular");font-display:swap}`;
const faceCss = inline => [local, ...faces.map(f => `@font-face{font-family:"${f.fam}";src:url(${inline ? `data:font/${fmt(f.file)};base64,${f.buf.toString("base64")}` : f.url}) format("${fmt(f.file)}");font-weight:${f.w};font-style:${f.st};font-display:swap}`)].join("\n");

/* ---------- CSS e JavaScript ---------- */
const css = ler("src/estilo.css");
const cssSite = esbuild.transformSync(faceCss(false) + "\n" + css, { loader: "css", minify: true }).code;
const cssNome = comHash("famosodle.css", Buffer.from(cssSite));
gravar("assets/" + cssNome, cssSite);

const data = ler("dados/data.json").replace(/</g, ESC_LT);
const app = ler("src/app.js").replace("/*__DATA__*/{}", () => data).replace('/*__SITE__*/""', () => JSON.stringify(SITE));
// os botões do arquivo único trocam exatamente este texto pelas fotos embutidas
if (!app.includes("const PHOTO_EMBED = null; /*__EMBED__*/")) throw new Error("o marcador do PHOTO_EMBED sumiu de src/app.js");
if (/<\/script|<!--/i.test(app)) throw new Error("app.js contém </script ou <!--");
const jsSite = esbuild.transformSync(app, { loader: "js", minify: true, format: "iife", target: "es2020", legalComments: "none" }).code;
const jsNome = comHash("app.js", Buffer.from(jsSite));
gravar("assets/" + jsNome, jsSite);

/* ---------- bandeiras: bandeiras/xx.png, com autor, licença e página do arquivo em bandeiras/creditos.json ---------- */
// entram os países que o gerar-dados marcou com fl (ele já conferiu o arquivo e o tamanho)
const escHtml = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const PAGINA_COMMONS = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:[^\s"'<>]+$/;
const bandeirasDir = path.join(ROOT, "bandeiras");
const credB = fs.existsSync(path.join(bandeirasDir, "creditos.json")) ? JSON.parse(fs.readFileSync(path.join(bandeirasDir, "creditos.json"), "utf8")).bandeiras || {} : {};
const bandeiras = Object.entries(JSON.parse(data).countries).filter(([, c]) => c.fl)
  .map(([cod, c]) => ({ cod, nome: c.n, e: credB[cod], arq: path.join(bandeirasDir, cod.toLowerCase() + ".png") }))
  .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
for (const b of bandeiras) if (!b.e || !PAGINA_COMMONS.test(b.e.u || "") || !b.e.l) throw new Error("crédito incompleto da bandeira " + b.cod);
const listaBandeiras = bandeiras.length
  ? "<ul>" + bandeiras.map(b => `<li><b>${escHtml(b.nome)}</b>: ${b.e.a ? escHtml(b.e.a) + " · " : ""}${escHtml(b.e.l)} · <a href="${escHtml(b.e.u)}" target="_blank" rel="noopener noreferrer">Commons</a></li>`).join("") + "</ul>"
  : "<p>Nenhuma bandeira em imagem; o jogo mostra o emoji.</p>";
// no arquivo único as bandeiras vão embutidas no script, porque ele abre sozinho, sem a pasta bandeiras/
if (!app.includes("/*__FLAGS__*/null")) throw new Error("o marcador do FLAG_EMBED sumiu de src/app.js");
const appSingle = app.replace("/*__FLAGS__*/null", () => JSON.stringify(Object.fromEntries(bandeiras.map(b => [b.cod, "data:image/png;base64," + fs.readFileSync(b.arq).toString("base64")]))));

/* ---------- páginas ---------- */
const favicon = fs.readFileSync(path.join(ROOT, "src", "estaticos", "favicon.svg"), "utf8").trim();
// minificação leve e segura: tira comentários e junta espaços entre tags (o modelo não tem <pre> nem <textarea>)
const minHtml = s => s.replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "> <").replace(/\s{2,}/g, " ").trim();
// a 404 pode aparecer em qualquer caminho, então usa endereços absolutos
function pagina(tpl, abs) {
  const b = abs ? "/" : "";
  return tpl
    .replace("<!--__ICONS__-->", () => `<link rel="icon" href="${b}favicon.ico" sizes="32x32"><link rel="icon" href="${b}favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="${b}apple-touch-icon.png"><link rel="manifest" href="${b}site.webmanifest">`)
    .replace("<!--__PRELOAD__-->", () => faces.filter(f => f.preload).map(f => `<link rel="preload" href="${b}assets/${f.url}" as="font" type="font/${fmt(f.file)}" crossorigin>`).join(""))
    .replace("<!--__CSS__-->", () => `<link rel="stylesheet" href="${b}assets/${cssNome}">`)
    .replace("<!--__JS__-->", () => `<script src="${b}assets/${jsNome}" defer></script>`)
    .replace("<!--__BANDEIRAS__-->", () => listaBandeiras)
    .replace(/__SITE__/g, SITE);
}
const index = minHtml(pagina(ler("src/index.html"), false));
const nf = minHtml(pagina(ler("src/404.html"), true));
gravar("index.html", index);
gravar("404.html", nf);
// arquivo único: CSS, fontes e script dentro do HTML, sem minificar (o PRISTINE depende do texto original)
// aberto por file:// ele não recebe cabeçalhos, então leva o CSP numa meta, que vai junto para a cópia offline.
// O script e o estilo precisam ser inline; a meta bloqueia scripts externos e limita para onde os dados podem ir.
const cspSingle = [
  "default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", "font-src data:",
  "img-src data: https://upload.wikimedia.org https://thumb.wikimedia.org",
  "connect-src https://en.wikipedia.org https://upload.wikimedia.org https://thumb.wikimedia.org",
  "base-uri 'none'", "form-action 'none'"
].join("; ");
const single = ler("src/index.html")
  .replace("<!--__ICONS__-->", () => `<meta http-equiv="Content-Security-Policy" content="${cspSingle}">\n<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}">`)
  .replace("<!--__PRELOAD__-->", "")
  .replace("<!--__CSS__-->", () => `<style>\n${faceCss(true)}\n${css}</style>`)
  .replace("<!--__JS__-->", () => `<script>\n${appSingle}\n</script>`)
  .replace("<!--__BANDEIRAS__-->", () => listaBandeiras)
  .replace(/__SITE__/g, SITE);
fs.writeFileSync(path.join(DIST, "famosodle.html"), single);

/* ---------- arquivos fixos: ícones, imagem de compartilhar, robots, sitemap e manifesto ---------- */
const estaticos = path.join(ROOT, "src", "estaticos");
for (const f of fs.readdirSync(estaticos)) {
  const buf = fs.readFileSync(path.join(estaticos, f));
  gravar(f, /\.(txt|xml|webmanifest)$/.test(f) ? buf.toString("utf8").replace(/__SITE__/g, SITE) : buf);
}

for (const [nome, txt] of [["index.html", index], ["404.html", nf], ["app.js", app], ["estilo.css", css]]) {
  if (TRAVESSAO.test(txt)) throw new Error("travessão encontrado em " + nome);
}

/* ---------- cabeçalhos de segurança e cache ---------- */
const csp = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "font-src 'self'",
  "img-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org", "connect-src 'self' https://en.wikipedia.org",
  "manifest-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"
].join("; ");
// os cabeçalhos são escritos em dois lugares, sempre iguais:
// vercel.json na raiz (a Vercel lê esse arquivo antes do build, por isso ele precisa estar no git atualizado)
// dist/famosodle/vercel.json (para quem publicar só essa pasta)
const headers = [
  { source: "/(.*)", headers: [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
  ] },
  // JS, CSS, fontes, fotos e bandeiras só servem para o próprio site; og.png e os ícones ficam de fora, porque outros sites mostram essas imagens
  { source: "/(assets|fotos-\\d+|bandeiras)/(.*)", headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }] },
  // nomes com hash do conteúdo: podem ficar em cache para sempre. A regra só casa com nomes nesse formato,
  // para um 404 em /assets/ não ficar um ano em cache
  { source: "/assets/(.*\\.[0-9a-f]{10}\\.(?:js|css|woff2?))", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
  // fotos: um dia de cache; quando uma foto muda, o creditos.json leva um hash novo na URL dela
  { source: "/fotos-(\\d+)/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
  // bandeiras: quase nunca mudam; um dia de cache e uma semana servindo a cópia antiga enquanto revalida
  { source: "/bandeiras/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] }
];
gravar("vercel.json", JSON.stringify({ headers }, null, 2) + "\n");
const raiz = path.join(ROOT, "vercel.json");
const novo = JSON.stringify({ framework: null, installCommand: "npm ci", buildCommand: "npm run build", outputDirectory: "dist/famosodle", headers }, null, 2) + "\n";
const antigo = fs.existsSync(raiz) ? fs.readFileSync(raiz, "utf8") : "";
if (antigo !== novo) { fs.writeFileSync(raiz, novo); console.log("vercel.json da raiz atualizado: inclua esse arquivo no próximo commit."); }

/* ---------- fotos do site: as pastas fotos-1, fotos-2... ficam em /fotos e são copiadas para o site ---------- */
const fotosDir = path.join(ROOT, "fotos");
let nFotos = 0;
if (fs.existsSync(fotosDir)) {
  for (const d of fs.readdirSync(fotosDir)) {
    if (!/^fotos-\d$/.test(d)) continue;
    // só as fotos pXXX.jpg e o creditos.json da fotos-1, e nunca atalhos: qualquer outro arquivo iria para a mesma origem do jogo
    fs.mkdirSync(path.join(out, d), { recursive: true });
    for (const f of fs.readdirSync(path.join(fotosDir, d))) {
      const orig = path.join(fotosDir, d, f);
      const ok = /^p\d{3}\.jpg$/.test(f) || (d === "fotos-1" && f === "creditos.json");
      if (!ok || !fs.lstatSync(orig).isFile()) { console.log(`ignorado: fotos/${d}/${f}`); continue; }
      fs.copyFileSync(orig, path.join(out, d, f));
      if (f.endsWith(".jpg")) nFotos++;
    }
  }
}
for (const b of bandeiras) {
  fs.mkdirSync(path.join(out, "bandeiras"), { recursive: true });
  fs.copyFileSync(b.arq, path.join(out, "bandeiras", path.basename(b.arq)));
}
const gz = s => zlib.gzipSync(s).length;
console.log(`ok | index.html ${kb(index.length)} (${kb(gz(index))} gzip) | ${cssNome} ${kb(cssSite.length)} (${kb(gz(cssSite))}) | ${jsNome} ${kb(jsSite.length)} (${kb(gz(jsSite))}) | famosodle.html ${kb(Buffer.byteLength(single))} | ${nFotos ? nFotos + " fotos copiadas de /fotos" : "sem pasta /fotos, o site usa a Wikipedia"} | ${bandeiras.length} bandeiras`);

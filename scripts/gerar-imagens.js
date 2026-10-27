// Gera as imagens fixas do site em src/estaticos/: og.png (1200x630, para compartilhar em redes e mensageiros),
// apple-touch-icon.png, icon-192.png, icon-512.png e favicon.ico. Desenha HTML no Chrome pelo Playwright,
// com as fontes do próprio projeto. Só precisa rodar de novo se o visual mudar; o resultado vai para o git.
// Uso: npm run imagens
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const OUT = path.join(__dirname, "..", "src", "estaticos");
const fonte = (pkg, file) => "data:font/" + (file.endsWith("woff2") ? "woff2" : "woff") + ";base64," + fs.readFileSync(path.join(path.dirname(require.resolve(pkg + "/package.json")), "files", file)).toString("base64");
const FONTES = `
@font-face{font-family:"OS";src:url(${fonte("@fontsource/open-sauce-sans", "open-sauce-sans-latin-400-normal.woff")});font-weight:400}
@font-face{font-family:"OS";src:url(${fonte("@fontsource/open-sauce-sans", "open-sauce-sans-latin-600-normal.woff2")});font-weight:600}
@font-face{font-family:"IS";src:url(${fonte("@fontsource/instrument-serif", "instrument-serif-latin-400-normal.woff2")})}`;
const ESTRELA = `<svg viewBox="0 0 24 24"><path d="M12 1.5c.7 5.6 3.9 8.8 10.5 10.5-6.6 1.7-9.8 4.9-10.5 10.5C11.3 16.9 8.1 13.7 1.5 12 8.1 10.3 11.3 7.1 12 1.5z" fill="currentColor"/></svg>`;
const MARCAS = {
  ok: `<path d="M2.5 6.3l2.2 2.2 4.8-5"/>`,
  near: `<path d="M1.5 4c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0M1.5 8.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0"/>`,
  bad: `<path d="M3 3l6 6M9 3l-6 6"/>`
};
const quadro = (s, txt) => `<div class="t ${s}"><svg viewBox="0 0 12 12">${MARCAS[s]}</svg><span>${txt}</span></div>`;

const OG = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTES}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#efe3c8;padding:28px;font-family:OS,sans-serif}
.c{height:100%;border-radius:36px;background:#1f1b1d;color:#efe3c8;padding:44px 56px 48px;display:flex;flex-direction:column}
.r1{display:flex;justify-content:space-between;align-items:center}
.eb{font-size:22px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#bcae93}
.st{width:72px;height:72px;border-radius:50%;border:2px solid #efe3c8;display:grid;place-items:center}
.st svg{width:32px;height:32px}
h1{font-family:IS,serif;font-weight:400;font-size:212px;line-height:.9;letter-spacing:.015em;text-transform:uppercase;margin-top:18px}
.r3{margin-top:auto;border-top:2px solid #4a4144;padding-top:28px;display:flex;justify-content:space-between;align-items:flex-end;gap:32px}
.sub{font-size:30px;line-height:1.3;color:#bcae93;max-width:520px}
.tiles{display:flex;gap:10px}
.t{width:96px;height:96px;border-radius:18px;display:grid;place-items:center;position:relative;font-weight:600;font-size:19px;color:#f7efdd}
.t svg{position:absolute;top:10px;right:10px;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ok{background:#56744a}.near{background:#c39a3e;color:#231a06}.bad{background:#8b3a31}
</style></head><body><div class="c">
<div class="r1"><span class="eb">Jogo diário · figuras históricas</span><span class="st">${ESTRELA}</span></div>
<h1>Famosodle</h1>
<div class="r3"><p class="sub">Uma figura histórica nova por dia. Adivinhe pelas pistas, pelo retrato borrado ou pela frase famosa.</p>
<div class="tiles">${quadro("ok", "Brasil")}${quadro("near", "1889")}${quadro("bad", "Ciência")}${quadro("ok", "Política")}</div></div>
</div></body></html>`;

// ícone: estrela creme no fundo preto, dentro da área segura dos ícones adaptáveis (80% do centro)
const ICONE = n => `<!doctype html><html><head><style>*{margin:0}body{width:${n}px;height:${n}px;background:#1f1b1d;display:grid;place-items:center;color:#efe3c8}svg{width:${Math.round(n * 0.56)}px;height:${Math.round(n * 0.56)}px}</style></head><body>${ESTRELA}</body></html>`;
const FAVICON = n => `<!doctype html><html><head><style>*{margin:0}html,body{background:transparent}</style></head><body>${fs.readFileSync(path.join(OUT, "favicon.svg"), "utf8").replace("<svg ", `<svg width="${n}" height="${n}" `)}</body></html>`;

// .ico com imagens PNG dentro (formato aceito por todos os navegadores atuais)
function ico(pngs) {
  const cab = Buffer.alloc(6 + 16 * pngs.length);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(pngs.length, 4);
  let off = cab.length;
  pngs.forEach(([n, buf], i) => {
    const e = 6 + 16 * i;
    cab.writeUInt8(n >= 256 ? 0 : n, e); cab.writeUInt8(n >= 256 ? 0 : n, e + 1); cab.writeUInt8(0, e + 2); cab.writeUInt8(0, e + 3);
    cab.writeUInt16LE(1, e + 4); cab.writeUInt16LE(32, e + 6); cab.writeUInt32LE(buf.length, e + 8); cab.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([cab, ...pngs.map(p => p[1])]);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  const foto = async (html, w, h, transparente) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.screenshot({ type: "png", omitBackground: !!transparente });
    await page.close();
    return buf;
  };
  fs.writeFileSync(path.join(OUT, "og.png"), await foto(OG, 1200, 630));
  fs.writeFileSync(path.join(OUT, "apple-touch-icon.png"), await foto(ICONE(180), 180, 180));
  fs.writeFileSync(path.join(OUT, "icon-192.png"), await foto(ICONE(192), 192, 192));
  fs.writeFileSync(path.join(OUT, "icon-512.png"), await foto(ICONE(512), 512, 512));
  fs.writeFileSync(path.join(OUT, "favicon.ico"), ico([[16, await foto(FAVICON(16), 16, 16, true)], [32, await foto(FAVICON(32), 32, 32, true)], [48, await foto(FAVICON(48), 48, 48, true)]]));
  await browser.close();
  for (const f of ["og.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "favicon.ico"]) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + " KB");
})().catch(e => { console.error("Erro:", e.message); process.exit(1); });

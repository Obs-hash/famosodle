// Baixa a imagem principal livre do artigo de cada figura (miniatura de 500 px da Wikimedia) para
// fotos/fotos-N/pXXX.jpg e grava fotos/fotos-1/creditos.json com autor, licença e página do arquivo,
// no mesmo formato que o jogo lê (o botão "Gerar pacote de fotos para o site" gera o mesmo formato).
// PNG vira JPEG com pngjs e jpeg-js (só JavaScript). GIF, WebP e outros formatos ficam de fora:
// nesses casos o jogo busca a imagem direto na Wikipedia. Depois, todas as fotos são recomprimidas com o
// codificador JPEG do Chrome (o mesmo do botão do navegador), pelo Playwright; sem Chrome, ficam como vieram.
// Uso: npm run baixar-fotos   (depois rode npm run build e faça commit da pasta fotos/)
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PNG } = require("pngjs");
const jpeg = require("jpeg-js");
const { api, pedir, WP, lotes, titulo, seguir, figuras } = require("./wikimedia");

const LARGURA = 500; // um dos tamanhos padrão de miniatura da Wikimedia
const FUNDO = [43, 38, 41]; // --ink-2, a cor do quadro, para fotos com transparência
const QUALIDADE = 0.8; // mesma qualidade do botão "Gerar pacote de fotos para o site"
// quando a imagem principal do artigo não é livre, mas o Commons tem um retrato livre da pessoa
const ALTERNATIVAS = { p167: "Darcy Ribeiro.jpg" };
const RAIZ = path.join(__dirname, "..", "fotos");
const TEMP = path.join(RAIZ, ".baixando");
// as miniaturas vêm de thumb.wikimedia.org; arquivos menores que 500 px vêm inteiros de upload.wikimedia.org
const IMG = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;
const PAGINA = /^https:\/\/(commons\.wikimedia|en\.wikipedia)\.org\/wiki\//;
// 99 fotos por pasta; a fotos-1 leva também o creditos.json (no máximo 100 arquivos por pasta)
const pasta = pid => `fotos-${Math.floor((Number(pid.slice(1)) - 1) / 99) + 1}`;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
// travessões viram hífen; caracteres de controle e invisíveis viram espaço
const TRAVESSAO = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]", "g");
const INVISIVEIS = new RegExp("[" + [[0, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff]].map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]", "g");
const MAX_BYTES = 5 * 1048576; // nenhuma miniatura de 500 px chega perto disso
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
    .replace(/^unknown\s+unknown\b/i, "Unknown")
    .replace(/\s+/g, " ").trim()
    .slice(0, 400)
    .replace(/^(.+?)\s*\1$/, "$1");
  s = s.replace(/^unknown( author| photographer)?\b\.?/i, "Autor desconhecido");
  if (/^own work$/i.test(s)) s = "";
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return s;
}
const licenca = s => (/^public domain$/i.test(s) ? "Domínio público" : /^no restrictions$/i.test(s) ? "Sem restrições" : s);

function formato(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 4).toString("latin1") === "\x89PNG") return "png";
  if (b.subarray(0, 3).toString("latin1") === "GIF") return "gif";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return "desconhecido";
}
// PNG para JPEG, pintando a transparência com a cor do quadro
function pngParaJpeg(buf) {
  // largura e altura ficam no cabeçalho IHDR; confere antes de decodificar
  if (buf.length < 24 || buf.readUInt32BE(16) > MAX_LADO || buf.readUInt32BE(20) > MAX_LADO) throw new Error("PNG grande demais");
  const png = PNG.sync.read(buf), d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a < 1) { for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] * a + FUNDO[c] * (1 - a)); d[i + 3] = 255; }
  }
  return jpeg.encode({ data: d, width: png.width, height: png.height }, 82).data;
}
// as miniaturas do Commons vêm com qualidade alta; o codificador do Chrome (subamostragem 4:2:0) reduz o pacote quase pela metade
async function abrirCodificador() {
  let browser;
  try {
    const { chromium } = require("@playwright/test");
    browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
    const page = await browser.newPage();
    return {
      async jpeg(buf) {
        const b64 = await page.evaluate(async ([src, q]) => {
          const bmp = await createImageBitmap(await (await fetch("data:image/jpeg;base64," + src)).blob());
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          c.getContext("2d").drawImage(bmp, 0, 0);
          const u8 = new Uint8Array(await (await c.convertToBlob({ type: "image/jpeg", quality: q })).arrayBuffer());
          let s = "";
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
          return btoa(s);
        }, [buf.toString("base64"), QUALIDADE]);
        const novo = Buffer.from(b64, "base64");
        return novo.length < buf.length ? novo : buf;
      },
      fechar: () => browser.close()
    };
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    console.log("Aviso: Chrome indisponível pelo Playwright; as fotos ficam sem recompressão.");
    return null;
  }
}

(async () => {
  const pessoas = figuras();
  console.log(`Buscando a imagem principal de ${pessoas.length} artigos...`);
  const arquivo = new Map();
  for (const lote of lotes(pessoas, 50)) {
    const j = await api(WP, { action: "query", redirects: "1", prop: "pageimages", piprop: "name", pilicense: "free", titles: lote.map(p => titulo(p.w)).join("|") });
    const q = j.query || {}, fim = seguir(q), pags = new Map((q.pages || []).map(p => [p.title, p]));
    for (const p of lote) { const pg = pags.get(fim(titulo(p.w))); if (pg && pg.pageimage) arquivo.set(p.id, titulo(pg.pageimage)); }
  }
  for (const [pid, f] of Object.entries(ALTERNATIVAS)) if (!arquivo.has(pid)) arquivo.set(pid, f);

  console.log(`Buscando autor e licença de ${new Set(arquivo.values()).size} arquivos...`);
  const info = new Map();
  for (const lote of lotes([...new Set(arquivo.values())], 25)) {
    const j = await api(WP, { action: "query", prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: String(LARGURA), iiextmetadatafilter: "Artist|Credit|LicenseShortName|UsageTerms", titles: lote.map(f => "File:" + f).join("|") });
    const q = j.query || {}, fim = seguir(q), pags = new Map((q.pages || []).map(p => [p.title, p]));
    for (const f of lote) {
      const pg = pags.get(fim("File:" + f)), ii = pg && pg.imageinfo && pg.imageinfo[0];
      if (!ii) continue;
      const em = ii.extmetadata || {};
      info.set(f, {
        // os parâmetros utm_* de rastreio que a API acrescenta não são necessários
        thumb: String(ii.thumburl || ii.url || "").replace(/\?.*$/, ""), pagina: ii.descriptionurl, repo: pg.imagerepository,
        // sem autor, usa o campo de crédito quando ele é curto; sem nome curto de licença, usa os termos de uso
        autor: textoPuro(em.Artist && em.Artist.value, 100) || [textoPuro(em.Credit && em.Credit.value, 1000)].filter(c => c.length <= 60)[0] || "",
        licenca: licenca(textoPuro(em.LicenseShortName && em.LicenseShortName.value, 40) || textoPuro(em.UsageTerms && em.UsageTerms.value, 40))
      });
    }
  }

  fs.rmSync(TEMP, { recursive: true, force: true });
  const fotos = {}, falhas = [], semFoto = [];
  let bytes = 0, original = 0, convertidas = 0;
  const cod = await abrirCodificador();
  for (const p of pessoas) {
    const f = arquivo.get(p.id), i = f && info.get(f);
    if (!i) { semFoto.push(`${p.id} ${p.n}`); continue; }
    if (!IMG.test(i.thumb || "") || !PAGINA.test(i.pagina || "")) { falhas.push(`${p.id} ${p.n}: endereço inesperado (${i.thumb})`); continue; }
    if (ALTERNATIVAS[p.id] && i.repo !== "shared") { falhas.push(`${p.id} ${p.n}: a alternativa precisa estar no Commons`); continue; }
    let buf;
    try {
      const r = await pedir(i.thumb);
      // depois de um redirecionamento, o endereço final também precisa ser da Wikimedia
      if (!IMG.test(r.url)) throw new Error("redirecionado para " + r.url);
      if (Number(r.headers.get("content-length")) > MAX_BYTES) throw new Error("arquivo grande demais");
      buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error("arquivo grande demais");
    } catch (e) { falhas.push(`${p.id} ${p.n}: ${e.message}`); continue; }
    const tipo = formato(buf);
    if (tipo === "png") {
      try { buf = pngParaJpeg(buf); convertidas++; } catch (e) { falhas.push(`${p.id} ${p.n}: ${e.message}`); continue; }
    } else if (tipo !== "jpeg") { falhas.push(`${p.id} ${p.n}: formato ${tipo} não suportado`); continue; }
    original += buf.length;
    if (cod) buf = await cod.jpeg(buf);
    const rel = `${pasta(p.id)}/${p.id}.jpg`;
    fs.mkdirSync(path.join(TEMP, pasta(p.id)), { recursive: true });
    fs.writeFileSync(path.join(TEMP, rel), buf);
    bytes += buf.length;
    fotos[p.id] = {
      f: rel, file: f.replace(/ /g, "_"), a: i.autor, l: i.licenca, u: i.pagina, r: i.repo === "shared" ? "c" : "w",
      v: crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8), n: p.n
    };
    process.stdout.write(`\r${Object.keys(fotos).length} fotos baixadas`);
  }
  console.log("");
  if (cod) await cod.fechar();
  if (Object.keys(fotos).length < 100) {
    if (falhas.length) console.log(`Não baixadas (${falhas.length}):\n  ` + falhas.slice(0, 30).join("\n  "));
    fs.rmSync(TEMP, { recursive: true, force: true });
    throw new Error("Poucas fotos baixadas; nada foi alterado na pasta fotos/.");
  }
  fs.mkdirSync(path.join(TEMP, "fotos-1"), { recursive: true });
  fs.writeFileSync(path.join(TEMP, "fotos-1", "creditos.json"), JSON.stringify({ gerado: new Date().toISOString(), fonte: "Wikipedia e Wikimedia Commons", fotos }, null, 1) + "\n");
  // troca as pastas antigas pelas novas só no fim, para não deixar o pacote pela metade
  for (const d of fs.readdirSync(RAIZ)) if (/^fotos-\d$/.test(d)) fs.rmSync(path.join(RAIZ, d), { recursive: true, force: true });
  for (const d of fs.readdirSync(TEMP)) fs.renameSync(path.join(TEMP, d), path.join(RAIZ, d));
  fs.rmSync(TEMP, { recursive: true, force: true });

  const porPasta = {};
  for (const e of Object.values(fotos)) { const d = e.f.split("/")[0]; porPasta[d] = (porPasta[d] || 0) + 1; }
  console.log(`Pronto: ${Object.keys(fotos).length} fotos, ${(bytes / 1048576).toFixed(1)} MB (${(original / 1048576).toFixed(1)} MB antes da recompressão) | por pasta ${JSON.stringify(porPasta)} | PNG convertidos ${convertidas}`);
  if (semFoto.length) console.log(`Sem imagem principal livre (${semFoto.length}):\n  ` + semFoto.join("\n  "));
  if (falhas.length) console.log(`Não baixadas (${falhas.length}):\n  ` + falhas.join("\n  "));
})().catch(e => { console.error("\nErro:", e.message); process.exit(1); });

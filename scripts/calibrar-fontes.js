// Mede no Chrome a largura do texto nas fontes do site e nas fontes de reserva (Arial e Times New Roman)
// e mostra o size-adjust que faz a reserva ocupar o mesmo espaço. Os valores vão para o topo de src/estilo.css.
// Só precisa rodar de novo se as fontes mudarem. Uso: node scripts/calibrar-fontes.js
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const fonte = (pkg, file) => "data:font/" + (file.endsWith("woff2") ? "woff2" : "woff") + ";base64," + fs.readFileSync(path.join(path.dirname(require.resolve(pkg + "/package.json")), "files", file)).toString("base64");
const TEXTO = "Digite o nome de qualquer figura. Cada palpite mostra o que ela tem em comum com a figura secreta. Quem marcou a história, uma pista por vez.";
const TITULO = "FAMOSODLE QUEM É A FIGURA DE HOJE? DE QUEM É ESTE RETRATO? QUEM DISSE ESTA FRASE? ATÉ AMANHÃ";

(async () => {
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  const page = await browser.newPage();
  await page.setContent(`<style>
@font-face{font-family:OS;src:url(${fonte("@fontsource/open-sauce-sans", "open-sauce-sans-latin-400-normal.woff")})}
@font-face{font-family:OS6;src:url(${fonte("@fontsource/open-sauce-sans", "open-sauce-sans-latin-600-normal.woff2")})}
@font-face{font-family:IS;src:url(${fonte("@fontsource/instrument-serif", "instrument-serif-latin-400-normal.woff2")})}
span{font-size:100px;white-space:nowrap;position:absolute}</style>
<span id="a" style="font-family:OS">${TEXTO}</span><span id="b" style="font-family:Arial">${TEXTO}</span>
<span id="c" style="font-family:OS6;font-weight:600">${TEXTO}</span><span id="d" style="font-family:Arial;font-weight:600">${TEXTO}</span>
<span id="e" style="font-family:IS">${TITULO}</span><span id="f" style="font-family:'Times New Roman'">${TITULO}</span>`);
  await page.evaluate(() => document.fonts.ready);
  const w = await page.evaluate(() => Object.fromEntries([..."abcdef"].map(id => [id, document.getElementById(id).getBoundingClientRect().width])));
  const pct = (x, y) => (100 * x / y).toFixed(1) + "%";
  console.log(`Open Sauce 400 / Arial: size-adjust ${pct(w.a, w.b)} | Open Sauce 600 / Arial 600: ${pct(w.c, w.d)} | Instrument Serif / Times New Roman: ${pct(w.e, w.f)}`);
  await browser.close();
})().catch(e => { console.error("Erro:", e.message); process.exit(1); });

// Funções comuns aos testes
const fs = require("fs");
const path = require("path");
const { expect } = require("@playwright/test");

const RAIZ = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(RAIZ, "dados", "data.json"), "utf8"));
const cont = p => DATA.countries[p.c].ct;
const nomes = filtro => DATA.people.filter(filtro).map(p => p.n);
const JSON_WIKI = body => ({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

// prepara a página: junta erros do console e violações de CSP, pula a ajuda da primeira visita
// e simula a Wikipedia ("vazia" responde sem imagens, "fora" derruba a conexão)
async function preparar(page, { ajuda = false, wikipedia = "vazia" } = {}) {
  const erros = [];
  page.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
  page.on("pageerror", e => erros.push("erro de script: " + e.message));
  await page.addInitScript(semAjuda => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    if (semAjuda) { try { localStorage.setItem("famosodle:v1:help", "1"); } catch (e) { } }
  }, !ajuda);
  if (wikipedia === "vazia") await page.route("https://en.wikipedia.org/**", r => r.fulfill(JSON_WIKI({ batchcomplete: true, query: { pages: [] } })));
  else if (wikipedia === "fora") await page.route(/^https:\/\/(en\.wikipedia|upload\.wikimedia|thumb\.wikimedia)\.org\//, r => r.abort("internetdisconnected"));
  return erros;
}
async function semErros(page, erros, ignorar = []) {
  expect(await page.evaluate(() => window.__csp), "violações de CSP").toEqual([]);
  expect(erros.filter(e => !ignorar.some(re => re.test(e))), "erros no console").toEqual([]);
}
async function palpite(page, painel, nome) {
  const inp = page.locator(`#${painel}-input`);
  await inp.fill(nome);
  await inp.press("Enter");
}
// tenta os nomes em ordem até acertar (o campo é desativado no acerto)
async function resolver(page, painel, lista) {
  for (const n of lista) {
    if (await page.locator(`#${painel}-input`).isDisabled()) break;
    await palpite(page, painel, n);
  }
  await expect(page.locator(`#${painel}-result`)).toBeVisible();
}
async function semRolagemLateral(page) {
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
  expect(r.doc, `largura da página (${r.doc}) maior que a tela (${r.vw})`).toBeLessThanOrEqual(r.vw);
}

// cópia do sorteio de src/app.js, para os testes saberem a resposta de cada modo e nível. Se a lógica do jogo
// mudar sem querer, a resposta calculada aqui deixa de bater com a do jogo e os testes acusam.
const LAUNCH = "2026-10-26";
const SEEDS = { g: 1966, af: 1957, am: 1888, as: 1947, eu: 1789, oc: 1893, foto: 1839, frase: 1963 };
const CONTINENTES = ["af", "am", "as", "eu", "oc"];
const NIVEL = { 1: "Iniciante", 2: "Fácil", 3: "Médio", 4: "Difícil" };
const BY = Object.fromEntries(DATA.people.map(p => [p.id, p]));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffled(list, seed) { const r = mulberry32(seed); const a = list.slice().sort(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const ORDENS = {};
const ordem = (m, lv) => (ORDENS[m + lv] = ORDENS[m + lv] || shuffled(DATA.levels[m][lv - 1], SEEDS[m] * 7919 + lv * 104729));
const mod = (k, n) => ((k % n) + n) % n;
const dia = chave => Math.round((Date.parse(chave) - Date.parse(LAUNCH)) / 86400e3);
const chaveHoje = (deslocamento = 0) => new Date(Date.now() - 3 * 3600e3 + deslocamento * 86400e3).toISOString().slice(0, 10);
function primeiraFora(o, i, evitar) { for (let k = 0; k < o.length; k++) { const c = o[mod(i + k, o.length)]; if (!evitar.has(c)) return c; } return o[mod(i, o.length)]; }
function resposta(m, lv, chave) {
  const i = dia(chave), o = ordem(m, lv);
  if (CONTINENTES.includes(m)) return o[mod(i, o.length)];
  const doGlobal = primeiraFora(ordem("g", lv), i, new Set(CONTINENTES.map(c => resposta(c, lv, chave))));
  return m === "g" ? doGlobal : primeiraFora(o, i, new Set([doGlobal]));
}
// escolhe o nível pelo seletor (clique no rótulo, como uma pessoa faria)
async function nivel(page, lv) {
  await page.locator(`label:has(#lv-${lv})`).click();
  await expect(page.locator(`#lv-${lv}`)).toBeChecked();
}

module.exports = { RAIZ, DATA, BY, NIVEL, cont, nomes, JSON_WIKI, preparar, semErros, palpite, resolver, semRolagemLateral, resposta, chaveHoje, dia, nivel };

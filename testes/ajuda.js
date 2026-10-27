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

module.exports = { RAIZ, DATA, cont, nomes, JSON_WIKI, preparar, semErros, palpite, resolver, semRolagemLateral };

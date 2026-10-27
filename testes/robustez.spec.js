// Situações difíceis: localStorage corrompido, desligado ou cheio, Wikipedia fora do ar e fotos locais com créditos
const { test, expect } = require("@playwright/test");
const { DATA, preparar, semErros, palpite } = require("./ajuda");

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const CORROMPIDOS = [
  "5", "\"texto\"", "null", "[1,2,3]", "{json quebrado",
  JSON.stringify({ games: "x", stats: [1] }),
  JSON.stringify({ stats: { g: { played: "9e999", won: -4, dist: { "__proto__": 3, "7": "2", "abc": 1 }, lastKey: "<img>" } } }),
  JSON.stringify({ games: { g: { key: hoje, guesses: ["constructor", "__proto__", "toString", "p001", 42, null, "p999"], hints: "h1" }, foto: { key: hoje, guesses: "p001" } } })
];
for (const valor of CORROMPIDOS) {
  test(`localStorage corrompido não quebra a página: ${valor.slice(0, 40)}`, async ({ page }) => {
    const erros = await preparar(page);
    await page.addInitScript(v => { try { localStorage.setItem("famosodle:v1", v); localStorage.setItem("famosodle:v1:ui", v); localStorage.setItem("famosodle:fotos:v1", v); } catch (e) { } }, valor);
    await page.goto("/");
    await palpite(page, "classic", "Marie Curie");
    await expect(page.locator("#classic-board .tile-person .cn").first()).toHaveText("Marie Curie");
    await page.click("#btn-stats");
    await expect(page.locator("#stats-table tbody tr")).toHaveCount(8);
    await expect(page.locator("#stats-table")).not.toContainText("NaN");
    await semErros(page, erros);
  });
}

test("localStorage desligado: o jogo funciona e avisa que não vai salvar", async ({ page }) => {
  const erros = await preparar(page);
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("bloqueado", "SecurityError"); } }); });
  await page.goto("/");
  await palpite(page, "classic", "Pelé");
  await expect(page.locator("#classic-board .tile-person .cn").first()).toHaveText("Pelé");
  await expect(page.locator("#toast")).toHaveText("Não deu para salvar o progresso neste navegador.");
  await semErros(page, erros);
});

test("localStorage cheio: o jogo continua", async ({ page }) => {
  const erros = await preparar(page);
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("cheio", "QuotaExceededError"); }; });
  await page.goto("/");
  await palpite(page, "classic", "Frida Kahlo");
  await expect(page.locator("#classic-board .row:not(.heads)")).toHaveCount(1);
  await semErros(page, erros);
});

test("Wikipedia fora do ar e sem fotos locais: a página funciona e mostra as iniciais", async ({ page }) => {
  const erros = await preparar(page, { wikipedia: "fora" });
  await page.route("**/fotos-1/creditos.json", r => r.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await palpite(page, "classic", "Albert Einstein");
  const ph = page.locator("#classic-board .tile-person .ph").first();
  await expect(ph.locator(".ini")).toHaveText("AE");
  await page.waitForTimeout(500);
  await expect(ph.locator("img")).toHaveCount(0);
  await page.click("#tab-photo");
  await expect(page.locator("#photo-state")).toContainText(/Não deu para carregar|não tem retrato/);
  await palpite(page, "photo", "Eddie Mabo");
  await expect(page.locator("#photo-guesses li")).toHaveCount(1);
  await semErros(page, erros, [/status of 404/, /ERR_INTERNET_DISCONNECTED|ERR_FAILED/]);
});

test("fotos locais (creditos.json de teste) vêm do próprio site e mostram os créditos", async ({ page }) => {
  const erros = await preparar(page);
  const fotos = {};
  for (const p of DATA.people.filter(x => x.ph)) {
    const n = Number(p.id.slice(1));
    fotos[p.id] = { f: `fotos-${Math.floor((n - 1) / 99) + 1}/${p.id}.jpg`, file: "Arquivo_de_teste.jpg", a: "Autora de Teste <script>", l: "CC BY 4.0", u: "https://commons.wikimedia.org/wiki/File:Arquivo_de_teste.jpg", v: "0123abcd" };
  }
  fotos.p002 = { f: "https://exemplo.com/x.jpg" }; // caminho fora do padrão é ignorado
  // chave __proto__ de verdade no JSON, como um arquivo adulterado poderia trazer
  const corpo = JSON.stringify({ fotos }).replace('{"fotos":{', '{"fotos":{"__proto__":{"f":"fotos-1/p001.jpg"},');
  await page.route("**/fotos-1/creditos.json", r => r.fulfill({ status: 200, contentType: "application/json", body: corpo }));
  const pedidos = [];
  page.on("request", r => pedidos.push(r.url()));
  await page.goto("/");
  await palpite(page, "classic", "Albert Einstein");
  const img = page.locator("#classic-board .tile-person .ph img").first();
  await expect(img).toHaveAttribute("src", "fotos-1/p001.jpg?v=0123abcd");
  await expect(page.locator("#classic-board .tile-person .ph.has")).toHaveCount(1);
  await page.click("#tab-photo");
  await expect(page.locator("#photo-credit")).toContainText("Licença: CC BY 4.0");
  await page.locator("[data-credit-show]").click();
  await expect(page.locator("#photo-credit")).toContainText("Foto: Autora de Teste <script>");
  await expect(page.locator("#photo-credit a")).toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Arquivo_de_teste.jpg");
  await expect(page.locator("#photo-credit script")).toHaveCount(0);
  expect(pedidos.filter(u => !u.startsWith("http://127.0.0.1:4173/"))).toEqual([]);
  await semErros(page, erros);
});

test("cabeçalhos de segurança e de cache servidos como no vercel.json", async ({ request }) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["content-security-policy"]).not.toContain("unsafe-inline");
  expect(h["content-security-policy"]).not.toContain("data:");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  expect(h["permissions-policy"]).not.toContain("interest-cohort");
  expect(h["cache-control"]).toBe("public, max-age=0, must-revalidate");
  const html = await r.text();
  expect(html).not.toMatch(/<script>|\son[a-z]+=|style="/i);
  const js = html.match(/assets\/app\.[0-9a-f]{10}\.js/)[0], cssArq = html.match(/assets\/famosodle\.[0-9a-f]{10}\.css/)[0];
  for (const a of [js, cssArq]) expect((await request.get("/" + a)).headers()["cache-control"]).toContain("immutable");
  for (const a of [js, cssArq, "fotos-1/p001.jpg", "bandeiras/br.png"]) expect((await request.get("/" + a)).headers()["cross-origin-resource-policy"], a).toBe("same-origin");
  const bandeira = await request.get("/bandeiras/br.png");
  expect(bandeira.headers()["content-type"]).toBe("image/png");
  expect(bandeira.headers()["cache-control"]).toBe("public, max-age=86400, stale-while-revalidate=604800");
  expect((await request.get("/og.png")).headers()["cross-origin-resource-policy"]).toBeUndefined();
  // um 404 em /assets/ não fica um ano em cache
  const falta = await request.get("/assets/nao-existe.js");
  expect(falta.status()).toBe(404);
  expect(falta.headers()["cache-control"]).not.toContain("immutable");
  // o servidor local não aceita outros nomes para o mesmo arquivo nem caminhos para fora da pasta
  for (const f of ["/index.html.", "/INDEX.HTML", "/index.html::$DATA", "/..%5Cpackage.json", "/assets/..%5C..%5Cpackage.json", "/%2e%2e/%2e%2e/package.json"]) expect((await request.get(f)).status(), f).toBe(404);
  const foto = await request.get("/fotos-1/p001.jpg");
  expect(foto.headers()["cache-control"]).toBe("public, max-age=86400, stale-while-revalidate=604800");
  for (const f of ["/robots.txt", "/sitemap.xml", "/og.png", "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png", "/site.webmanifest"]) expect((await request.get(f)).status(), f).toBe(200);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://famosodle.vercel.app/sitemap.xml");
});

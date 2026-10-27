// Fluxos do jogo: palpites em todos os modos, vitória, derrota, dicas, progresso salvo, teclado e virada do dia
const { test, expect } = require("@playwright/test");
const { DATA, cont, nomes, preparar, semErros, palpite, resolver, semRolagemLateral } = require("./ajuda");

const REGIOES = [["g", null], ["af", "af"], ["am", "am"], ["as", "as"], ["eu", "eu"], ["oc", "oc"]];
const OCEANIA = nomes(p => cont(p) === "oc");
const SEM_FRASE = nomes(p => !p.q);

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

test("carrega sem erros, sem violações de CSP e com a ajuda na primeira visita", async ({ page }) => {
  const erros = await preparar(page, { ajuda: true });
  const resp = await page.goto("/");
  expect(resp.headers()["content-security-policy"]).toContain("default-src 'none'");
  await expect(page.locator("#dlg-help")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#dlg-help")).toBeHidden();
  await expect(page.locator("#classic-meta")).toContainText("Ficha nº");
  await expect(page.locator("#foot-count")).toHaveText(`${DATA.people.length} figuras · ${Object.keys(DATA.countries).length} países · 8 modos`);
  await semErros(page, erros);
});

test("um palpite em cada modo clássico mostra cores, sinais e setas", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  for (const [id, c] of REGIOES) {
    await page.click(`[data-region="${id}"]`);
    await expect(page.locator(`[data-region="${id}"]`)).toHaveAttribute("aria-pressed", "true");
    const nome = nomes(p => !c || cont(p) === c)[3];
    await palpite(page, "classic", nome);
    const linha = page.locator("#classic-board .row:not(.heads)").first();
    await expect(linha.locator(".tile")).toHaveCount(7);
    await expect(linha.locator(".tile-person .cn")).toHaveText(nome);
    for (let i = 1; i < 7; i++) {
      const cls = await linha.locator(".tile").nth(i).getAttribute("class");
      expect(cls).toMatch(/\b(ok|near|bad)\b/);
      // todo quadro tem o sinal que não depende de cor
      await expect(linha.locator(".tile").nth(i).locator(".mk svg")).toHaveCount(1);
    }
    // a bandeira é imagem (o Windows desenha o emoji como duas letras) e carrega
    const bandeira = linha.locator(".tile").nth(2).locator("img.flag");
    await expect(bandeira).toHaveAttribute("src", `bandeiras/${DATA.people.find(p => p.n === nome).c.toLowerCase()}.png`);
    await expect.poll(() => bandeira.evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    // nascimento: se não é igual, tem seta
    const nasc = linha.locator(".tile").nth(4);
    if (!/\bok\b/.test(await nasc.getAttribute("class"))) await expect(nasc.locator("svg.arw")).toHaveCount(1);
    await expect(page.locator("#announce")).not.toHaveText("");
  }
  await semErros(page, erros);
});

test("modo Foto: foto do próprio site, desfoque que diminui e crédito que não entrega a resposta", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  await page.click("#tab-photo");
  const img = page.locator("#photo-img");
  await expect(img).toBeVisible();
  expect(await img.getAttribute("src")).toMatch(/^fotos-\d\/p\d{3}\.jpg\?v=[0-9a-f]{8}$/);
  expect(await img.evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
  await expect(img).toHaveAttribute("alt", "Retrato borrado da figura secreta");
  await expect(img).toHaveCSS("filter", "blur(34px)");
  const credito = page.locator("#photo-credit");
  await expect(credito).toContainText("ver autor e fonte");
  expect(await credito.locator("a").count()).toBe(0);
  await palpite(page, "photo", "Eddie Mabo"); // sem foto, nunca é a resposta do modo Foto
  await expect(img).toHaveCSS("filter", "blur(28px)");
  await expect(page.locator("#photo-guesses li")).toHaveCount(1);
  await expect(page.locator("#photo-guesses li .tags span")).toHaveCount(3);
  await credito.locator("[data-credit-show]").click();
  await expect(credito.locator("a")).toHaveAttribute("href", /^https:\/\/(commons\.wikimedia|en\.wikipedia)\.org\/wiki\/File:/);
  await expect(credito.locator("a")).toHaveAttribute("rel", "noopener noreferrer");
  await semErros(page, erros);
});

test("modo Frase: palpite mostra etiquetas e as dicas liberam com 5 e 10 erros", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  await page.click("#tab-quote");
  await expect(page.locator("#quote-text")).not.toHaveText("");
  const dicas = page.locator("#quote-hints .hint");
  // quem não tem frase nunca é a resposta do modo Frase, então todos estes palpites são erros
  for (let i = 0; i < 4; i++) await palpite(page, "quote", SEM_FRASE[i]);
  await expect(dicas.nth(0)).toContainText("libera em 1 erro");
  await expect(dicas.nth(0)).toBeDisabled();
  await palpite(page, "quote", SEM_FRASE[4]);
  await expect(page.locator("#announce")).toContainText("Dica liberada: Dica 1");
  await dicas.nth(0).click();
  await expect(page.locator("#quote-hints .hint.open")).toHaveCount(1);
  await expect(dicas.nth(1)).toContainText("libera em 5 erros");
  for (let i = 5; i < 10; i++) await palpite(page, "quote", SEM_FRASE[i]);
  await expect(page.locator("#quote-hints .hint.ready")).toHaveCount(1);
  await page.locator("#quote-hints .hint.ready").click();
  await expect(page.locator("#quote-hints .hint.open")).toHaveCount(2);
  await expect(page.locator("#quote-guesses li")).toHaveCount(10);
  await semErros(page, erros);
});

test("vitória no dia, compartilhar, treino com vitória e treino com derrota (tela de 360 px)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  await page.setViewportSize({ width: 360, height: 760 });
  const erros = await preparar(page);
  await page.goto("/");
  await page.click('[data-region="oc"]');
  await resolver(page, "classic", OCEANIA);
  await expect(page.locator("#classic-result .kicker")).toContainText("Encontrada em");
  await expect(page.locator("#classic-result h3")).toBeFocused();
  await expect(page.locator('[data-region="oc"] .ck')).toHaveCount(1);
  await expect(page.locator("#classic-result [data-cd]")).toHaveText(/^\d\d:\d\d:\d\d$/);
  await semRolagemLateral(page);
  // compartilhar
  await page.click('[data-act="share"]');
  await expect(page.locator("#toast")).toHaveText("Resultado copiado");
  // no Windows a área de transferência troca \n por \r\n
  const texto = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  expect(texto).toMatch(/^Famosodle nº \d+ · Clássico Oceania\nAcertei em \d+ palpites?\n/);
  expect(texto.trim().endsWith("http://127.0.0.1:4173/")).toBe(true);
  // treino: vitória
  await page.click('[data-act="practice"]');
  await expect(page.locator("#classic-meta")).toContainText("Treino");
  await expect(page.locator("#classic-reveal")).toBeVisible();
  await resolver(page, "classic", OCEANIA);
  await expect(page.locator('#classic-result [data-act="practice"]')).toHaveText("Nova figura aleatória");
  // treino: derrota (revelar a resposta)
  await page.click('#classic-result [data-act="practice"]');
  await palpite(page, "classic", OCEANIA[0]);
  if (await page.locator("#classic-reveal").isVisible()) {
    await page.click("#classic-reveal");
    await expect(page.locator("#classic-result .kicker")).toHaveText("Resposta revelada");
  }
  await page.click('[data-act="daily"]');
  await expect(page.locator("#classic-meta")).toContainText("Ficha nº");
  // as estatísticas registram o jogo do dia e não o treino
  await page.click("#btn-stats");
  const linha = page.locator("#stats-table tbody tr", { hasText: "Clássico Oceania" });
  await expect(linha.locator("td").nth(1)).toHaveText("1");
  await expect(linha.locator("td").nth(2)).toHaveText("1");
  await page.keyboard.press("Escape");
  await expect(page.locator("#btn-stats")).toBeFocused();
  await semErros(page, erros);
});

test("o progresso continua depois de recarregar", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  await page.click('[data-region="eu"]');
  await palpite(page, "classic", "Winston Churchill");
  await page.click("#tab-quote");
  await palpite(page, "quote", SEM_FRASE[0]);
  await page.reload();
  await expect(page.locator("#tab-quote")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#quote-guesses li")).toHaveCount(1);
  await page.click("#tab-classic");
  await expect(page.locator('[data-region="eu"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#classic-board .tile-person .cn").first()).toHaveText("Winston Churchill");
  await semErros(page, erros);
});

test("teclado: setas, Enter e Esc na busca, setas nas abas e foco de volta ao fechar diálogos", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  const inp = page.locator("#classic-input");
  await inp.fill("pedro");
  const lista = page.locator("#classic-list");
  await expect(lista).toBeVisible();
  await expect(inp).toHaveAttribute("aria-expanded", "true");
  await expect(lista.locator('[aria-selected="true"]')).toHaveCount(1);
  const primeiro = await lista.locator('[aria-selected="true"]').textContent();
  await inp.press("ArrowDown");
  expect(await lista.locator('[aria-selected="true"]').textContent()).not.toBe(primeiro);
  await expect(inp).toHaveAttribute("aria-activedescendant", "classic-opt-1");
  await inp.press("Escape");
  await expect(lista).toBeHidden();
  // nome exato vem primeiro mesmo com outros parecidos
  await inp.fill("Dom Pedro I");
  await inp.press("Enter");
  await expect(page.locator("#classic-board .tile-person .cn").first()).toHaveText("Dom Pedro I");
  await expect(inp).toBeFocused();
  // abas
  await page.locator("#tab-classic").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tab-photo")).toBeFocused();
  await expect(page.locator("#panel-photo")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.locator("#tab-quote")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(page.locator("#panel-classic")).toBeVisible();
  // diálogos
  await page.click("#btn-help");
  await expect(page.locator("#dlg-help")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#btn-help")).toBeFocused();
  await semErros(page, erros);
});

test("virada da meia-noite de Brasília com a página aberta", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-27T02:59:57Z") }); // 23:59:57 em Brasília
  const erros = await preparar(page);
  await page.goto("/");
  const antes = Number((await page.locator("#classic-meta").textContent()).match(/nº (\d+)/)[1]);
  await palpite(page, "classic", "Albert Einstein");
  await expect(page.locator("#classic-board .row:not(.heads)")).toHaveCount(1);
  await page.clock.runFor(4000);
  await expect(page.locator("#classic-meta")).toContainText(`nº ${antes + 1}`);
  await expect(page.locator("#classic-board .row:not(.heads)")).toHaveCount(0);
  await expect(page.locator("#classic-yesterday")).toContainText("A figura de ontem foi");
  await semErros(page, erros);
});

for (const largura of [360, 390, 430]) {
  test(`sem rolagem lateral e título inteiro em ${largura} px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    const erros = await preparar(page);
    await page.goto("/");
    await palpite(page, "classic", "Napoleão Bonaparte");
    await semRolagemLateral(page);
    const caixa = await page.evaluate(() => { const h = document.querySelector(".cover h1").getBoundingClientRect(), c = document.querySelector(".cover").getBoundingClientRect(); return { h: h.right, c: c.right, larg: document.querySelector(".cover h1").scrollWidth, vis: document.querySelector(".cover h1").clientWidth }; });
    expect(caixa.larg).toBeLessThanOrEqual(caixa.vis + 1);
    // áreas de toque com pelo menos 44 px
    for (const sel of ["#tab-classic", "#btn-help", "#btn-stats", '[data-region="g"]', "#classic-go"]) {
      const b = await page.locator(sel).boundingBox();
      expect(Math.round(b.height), sel).toBeGreaterThanOrEqual(44);
    }
    for (const aba of ["#tab-photo", "#tab-quote"]) { await page.click(aba); await semRolagemLateral(page); }
    await semErros(page, erros);
  });
}

test("página 404 no mesmo estilo", async ({ page }) => {
  const erros = await preparar(page);
  const resp = await page.goto("/nao/existe");
  expect(resp.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Esta página sumiu da história");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(239, 227, 200)");
  await expect(page.locator('a[href="/"]')).toBeVisible();
  await semErros(page, erros, [/status of 404/]);
});

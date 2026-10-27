// Níveis de dificuldade: seletor, resposta e treino de cada nível, estatísticas, migração do progresso antigo e compartilhar
const { test, expect } = require("@playwright/test");
const { DATA, BY, NIVEL, preparar, semErros, palpite, semRolagemLateral, resposta, chaveHoje, dia, nivel } = require("./ajuda");

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });
const hoje = chaveHoje();
const MODOS = Object.keys(DATA.levels);

test("seletor de nível: clique, teclado, foco visível, nível lembrado e marca de resolvido", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  const grupo = page.getByRole("radiogroup", { name: "Nível" });
  await expect(grupo.getByRole("radio")).toHaveCount(4);
  // primeira visita começa no Iniciante
  await expect(grupo.getByRole("radio", { name: "Iniciante" })).toBeChecked();
  await expect(page.locator("#classic-meta")).toContainText("· Global · Iniciante");
  // clique
  await nivel(page, 3);
  await expect(page.locator("#classic-meta")).toContainText("· Global · Médio");
  // teclado: as setas trocam de nível, como em qualquer grupo de rádio, com o contorno de foco visível
  await page.locator("#lv-3").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lv-4")).toBeChecked();
  await expect(page.locator("#lv-4")).toBeFocused();
  await expect(page.locator("#lv-4 + .opt")).toHaveCSS("outline-style", "solid");
  await expect(page.locator("#classic-meta")).toContainText("· Difícil");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#lv-3")).toBeChecked();
  // resolve o Global no Médio: marca no nível e na região, e o leitor de tela ouve "resolvido hoje"
  const alvo = BY[resposta("g", 3, hoje)];
  await palpite(page, "classic", alvo.n);
  await expect(page.locator("#classic-result .kicker")).toContainText("Médio");
  await expect(page.locator("label:has(#lv-3) .ck")).toBeVisible();
  await expect(grupo.getByRole("radio", { name: /^Médio\s*, resolvido hoje$/ })).toBeChecked();
  for (const lv of [1, 2, 4]) await expect(page.locator(`label:has(#lv-${lv}) .ck`)).toBeHidden();
  await expect(page.locator('[data-region="g"] .ck')).toHaveCount(1);
  // no Difícil, o Global continua por resolver e o tabuleiro está vazio
  await nivel(page, 4);
  await expect(page.locator('[data-region="g"] .ck')).toHaveCount(0);
  await expect(page.locator("#classic-board .row:not(.heads)")).toHaveCount(0);
  // a marca é do modo atual: no Foto nenhum nível foi resolvido
  await page.click("#tab-photo");
  await expect(page.locator("#levels .ck:visible")).toHaveCount(0);
  await expect(page.locator("#photo-meta")).toContainText("· Difícil");
  // o nível escolhido e a partida resolvida ficam guardados
  await page.reload();
  await expect(page.locator("#lv-4")).toBeChecked();
  await page.click("#tab-classic");
  await nivel(page, 3);
  await expect(page.locator("#classic-result h3")).toHaveText(alvo.n);
  await semErros(page, erros);
});

test("trocar de nível logo depois de acertar não rouba o foco do seletor ao voltar", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  await nivel(page, 2);
  await palpite(page, "classic", BY[resposta("g", 2, hoje)].n);
  // troca antes do cartão do resultado aparecer (ele espera a animação)
  await nivel(page, 3);
  await page.locator("#lv-3").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#lv-2")).toBeChecked();
  await expect(page.locator("#classic-result")).toBeVisible();
  await expect(page.locator("#lv-2")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lv-3")).toBeChecked();
  await semErros(page, erros);
});

test("os palpites aceitam figuras de qualquer nível, para as sugestões não entregarem o nível", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  await nivel(page, 1);
  const dificil = BY[DATA.levels.g[3][0]];
  await page.locator("#classic-input").fill(dificil.n);
  await expect(page.locator("#classic-list li").first()).toContainText(dificil.n);
  await semErros(page, erros);
});

for (const m of ["g", "af"]) {
  test(`cada nível do ${m === "g" ? "Global" : "modo África"} tem a resposta do dia da sua faixa`, async ({ page }) => {
    const erros = await preparar(page);
    await page.goto("/");
    if (m !== "g") await page.click(`[data-region="${m}"]`);
    const vistos = new Set();
    for (const lv of [1, 2, 3, 4]) {
      const id = resposta(m, lv, hoje);
      expect(DATA.levels[m][lv - 1], `resposta do nível ${lv} fora da faixa`).toContain(id);
      expect(vistos.has(id), `dois níveis com ${BY[id].n}`).toBe(false);
      vistos.add(id);
      await nivel(page, lv);
      await palpite(page, "classic", BY[id].n);
      await expect(page.locator("#classic-result h3")).toHaveText(BY[id].n);
      await expect(page.locator("#classic-result .kicker")).toContainText(NIVEL[lv]);
      await expect(page.locator(`label:has(#lv-${lv}) .ck`)).toBeVisible();
    }
    await semErros(page, erros);
  });
}

test("níveis de um modo nunca têm a mesma resposta no mesmo dia, e as regras de evitar valem em cada nível (400 dias)", () => {
  for (let d = 0; d < 400; d++) {
    const chave = new Date(Date.parse(hoje) + d * 86400e3).toISOString().slice(0, 10);
    for (const m of MODOS) {
      const r = [1, 2, 3, 4].map(lv => resposta(m, lv, chave));
      expect(new Set(r).size, `${m} em ${chave}`).toBe(4);
      r.forEach((id, i) => expect(DATA.levels[m][i].includes(id), `${m} nível ${i + 1} em ${chave}`).toBe(true));
    }
    for (const lv of [1, 2, 3, 4]) {
      const g = resposta("g", lv, chave);
      expect(["af", "am", "as", "eu", "oc"].map(c => resposta(c, lv, chave))).not.toContain(g);
      expect(resposta("foto", lv, chave)).not.toBe(g);
      expect(resposta("frase", lv, chave)).not.toBe(g);
    }
  }
});

test("treino sorteia figuras do nível escolhido", async ({ page }) => {
  const erros = await preparar(page);
  await page.goto("/");
  await nivel(page, 2);
  await palpite(page, "classic", BY[resposta("g", 2, hoje)].n);
  await page.click('#classic-result [data-act="practice"]');
  for (let i = 0; i < 6; i++) {
    await expect(page.locator("#classic-meta")).toContainText("Treino · figura aleatória · Fácil");
    await page.click("#classic-reveal");
    const nome = await page.locator("#classic-result h3").textContent();
    expect(DATA.levels.g[1].map(id => BY[id].n), `${nome} não é do nível Fácil`).toContain(nome);
    await page.click('#classic-result [data-act="practice"]');
  }
  await semErros(page, erros);
});

test("migração do progresso de antes dos níveis e estatísticas por nível, com total", async ({ page }) => {
  const antigo = {
    v: 1,
    stats: { g: { played: 7, won: 5, cur: 2, best: 4, lastKey: chaveHoje(-1), dist: { 3: 2, 5: 3 } }, frase: { played: 2, won: 2, cur: 1, best: 1, lastKey: "2026-10-26", dist: { 1: 2 } } },
    games: { g: { key: hoje, target: "p001", guesses: ["p002", "p003"], done: false, hints: [] } }
  };
  const erros = await preparar(page);
  await page.addInitScript(v => { localStorage.setItem("famosodle:v1", v); }, JSON.stringify(antigo));
  await page.goto("/");
  // a partida em andamento de antes dos níveis é descartada
  await expect(page.locator("#classic-board .row:not(.heads)")).toHaveCount(0);
  const linha = () => page.locator("#stats-table tbody tr", { hasText: "Clássico Global" });
  // as estatísticas abrem no nível atual, que começa do zero
  await page.click("#btn-stats");
  await expect(page.locator("#st-1")).toBeChecked();
  await expect(linha().locator("td").nth(1)).toHaveText("0");
  // no total entram as estatísticas de antes dos níveis
  await page.locator("label:has(#st-t)").click();
  await expect(linha().locator("td")).toHaveText(["Clássico Global", "7", "5", "2", "4", "4,2"]);
  await expect(page.locator("#stats-total-note")).toBeVisible();
  await page.keyboard.press("Escape");
  // ganha o Global no Iniciante e no Difícil
  for (const lv of [1, 4]) {
    await nivel(page, lv);
    await palpite(page, "classic", BY[resposta("g", lv, hoje)].n);
    await expect(page.locator("#classic-result")).toBeVisible();
  }
  await page.click("#btn-stats");
  await expect(page.locator("#st-4")).toBeChecked();
  await expect(linha().locator("td").nth(1)).toHaveText("1");
  await expect(linha().locator("td").nth(2)).toHaveText("1");
  await page.locator("label:has(#st-2)").click();
  await expect(linha().locator("td").nth(1)).toHaveText("0");
  await page.locator("label:has(#st-t)").click();
  await expect(linha().locator("td").nth(1)).toHaveText("9");
  await expect(linha().locator("td").nth(2)).toHaveText("7");
  await expect(page.locator("#stats-table tbody tr", { hasText: "Frase" }).locator("td").nth(1)).toHaveText("2");
  await page.keyboard.press("Escape");
  // o progresso antigo fica guardado como estava; o novo vai para o famosodle:v2
  const salvo = await page.evaluate(() => ({ v1: JSON.parse(localStorage.getItem("famosodle:v1")), v2: JSON.parse(localStorage.getItem("famosodle:v2")) }));
  expect(salvo.v1).toEqual(antigo);
  expect(salvo.v2.v).toBe(2);
  expect(salvo.v2.stats.g.played).toBe(7);
  expect(salvo.v2.stats["g:1"].won).toBe(1);
  // recarregar não migra de novo nem duplica o total
  await page.reload();
  await page.click("#btn-stats");
  await page.locator("label:has(#st-t)").click();
  await expect(linha().locator("td").nth(1)).toHaveText("9");
  await semErros(page, erros);
});

test("texto de compartilhar traz o modo e o nível", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });
  const erros = await preparar(page);
  await page.goto("/");
  for (const [aba, painel, modo, lv, rotulo] of [["#tab-classic", "classic", "g", 3, "Global · Médio"], ["#tab-photo", "photo", "foto", 4, "Foto · Difícil"]]) {
    await page.click(aba);
    await nivel(page, lv);
    await palpite(page, painel, BY[resposta(modo, lv, hoje)].n);
    await page.click(`#${painel}-result [data-act="share"]`);
    await expect(page.locator("#toast")).toHaveText("Resultado copiado");
    const texto = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
    expect(texto.split("\n")[0]).toBe(`Famosodle #${dia(hoje) + 1} · ${rotulo}`);
  }
  await semErros(page, erros);
});

test("em 360 px o seletor cabe numa linha, sem rolagem lateral, também nas estatísticas", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  const erros = await preparar(page);
  await page.goto("/");
  const topos = await page.locator("#levels label").evaluateAll(ls => ls.map(l => Math.round(l.getBoundingClientRect().top)));
  expect(new Set(topos).size).toBe(1);
  for (const lv of [1, 2, 3, 4]) {
    const b = await page.locator(`label:has(#lv-${lv})`).boundingBox();
    expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
  }
  await nivel(page, 4);
  await semRolagemLateral(page);
  await page.click("#btn-stats");
  const dlg = await page.locator("#dlg-stats .body").evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(dlg.sw).toBeLessThanOrEqual(dlg.cw);
  await semRolagemLateral(page);
  await semErros(page, erros);
});

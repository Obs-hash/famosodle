// Versão em arquivo único (dist/famosodle.html): abre por file:// e os dois botões de geração funcionam.
// A Wikipedia e o Commons são simulados: toda figura recebe a mesma foto de teste.
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { RAIZ, DATA, preparar, semErros } = require("./ajuda");

const URL_ARQUIVO = "file:///" + path.join(RAIZ, "dist", "famosodle.html").replace(/\\/g, "/");
const JPG = fs.readFileSync(path.join(RAIZ, "fotos", "fotos-1", "p001.jpg"));
const cors = { "access-control-allow-origin": "*" };
// controles bidirecionais no nome do autor: o jogo tira esses caracteres do crédito
const BIDI = [0x202e, 0x2066].map(c => String.fromCharCode(c));

async function simularWikimedia(page) {
  await page.route("https://en.wikipedia.org/w/api.php**", route => {
    const u = new URL(route.request().url()), titulos = (u.searchParams.get("titles") || "").split("|").filter(Boolean);
    const pages = u.searchParams.get("prop") === "pageimages"
      ? titulos.map((t, i) => ({ pageid: i + 1, title: t, pageimage: `Teste_${t.replace(/[^A-Za-z]/g, "")}.jpg`, thumbnail: { source: `https://upload.wikimedia.org/teste/${encodeURIComponent(t)}.jpg?utm_source=x`, width: 500, height: 625 } }))
      : titulos.map(t => ({ title: t, imagerepository: "shared", imageinfo: [{ descriptionurl: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(t.replace(/ /g, "_")), extmetadata: { Artist: { value: `<a href="//commons.wikimedia.org/wiki/User:X">Autora${BIDI[0]} de${BIDI[1]} teste</a><script>alert(1)</script>` }, LicenseShortName: { value: "CC BY 4.0" } } }] }));
    route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ batchcomplete: true, query: { pages } }) });
  });
  await page.route("https://upload.wikimedia.org/**", r => r.fulfill({ status: 200, contentType: "image/jpeg", headers: cors, body: JPG }));
}
// lê os nomes dos arquivos de um .zip pelo diretório central
function nomesNoZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(fim + 16);
  const n = buf.readUInt16LE(fim + 10), nomes = [];
  for (let i = 0; i < n; i++) { const len = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), com = buf.readUInt16LE(p + 32); nomes.push(buf.subarray(p + 46, p + 46 + len).toString("utf8")); p += 46 + len + extra + com; }
  return nomes;
}

test("abre por file://, mostra os botões e gera o pacote de fotos e a cópia offline", async ({ page }, info) => {
  test.setTimeout(240000);
  const erros = await preparar(page, { wikipedia: "nenhuma" });
  await simularWikimedia(page);
  await page.goto(URL_ARQUIVO);
  await expect(page.locator("#classic-meta")).toContainText("Ficha nº");
  await expect(page.locator("[data-pack]")).toBeVisible();
  await expect(page.locator("[data-build]")).toBeVisible();
  // o marcador continua no HTML para o botão de cópia offline funcionar
  expect(await page.content()).toContain("const PHOTO_EMBED = null; /*__EMBED__*/");
  // sem cabeçalhos por file://, o CSP vai numa meta
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", /default-src 'none'/);

  const [zip] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), page.click("[data-pack]")]);
  expect(zip.suggestedFilename()).toBe("famosodle-fotos.zip");
  const nomes = nomesNoZip(fs.readFileSync(await zip.path()));
  expect(nomes).toContain("fotos-1/creditos.json");
  expect(nomes).toContain("fotos-4/p375.jpg");
  expect(nomes.filter(n => n.endsWith(".jpg"))).toHaveLength(DATA.people.length);
  for (const d of ["fotos-1", "fotos-2", "fotos-3", "fotos-4"]) expect(nomes.filter(n => n.startsWith(d + "/")).length).toBeLessThanOrEqual(100);
  await expect(page.locator("[data-build-status]")).toContainText("Pronto:");

  const [copia] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), page.click("[data-build]")]);
  expect(copia.suggestedFilename()).toBe("famosodle-com-fotos.html");
  const destino = info.outputPath("famosodle-com-fotos.html");
  await copia.saveAs(destino);
  expect(fs.readFileSync(destino, "utf8")).toContain('<meta http-equiv="Content-Security-Policy"');
  // no arquivo único as bandeiras vêm embutidas, porque não existe a pasta bandeiras/ ao lado dele
  await page.locator("#classic-input").fill(DATA.people[0].n);
  await page.locator("#classic-input").press("Enter");
  await expect(page.locator("#classic-board .row:not(.heads)").first().locator(".tile").nth(2).locator("img.flag")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await semErros(page, erros);

  // a cópia offline funciona sem rede nenhuma
  const off = await page.context().newPage();
  const errosOff = await preparar(off, { wikipedia: "fora" });
  await off.goto("file:///" + destino.replace(/\\/g, "/"));
  await expect(off.locator("[data-offline-note]")).toHaveText(`Este arquivo já tem ${DATA.people.length} fotos dentro e funciona sem internet.`);
  await expect(off.locator("[data-build]")).toBeHidden();
  await off.click("#tab-photo");
  await expect(off.locator("#photo-img")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  await off.locator("[data-credit-show]").click();
  await expect(off.locator("#photo-credit")).toContainText("Foto: Autora de teste");
  await expect(off.locator("#photo-credit script")).toHaveCount(0);
  await semErros(off, errosOff);
});

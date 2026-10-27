// Baixa a bandeira de cada país das figuras para bandeiras/xx.png e grava bandeiras/creditos.json com autor,
// licença e página do arquivo. O arquivo de cada país vem do Wikidata (propriedade P41, bandeira, do item com o
// código ISO P297), e a imagem é a miniatura PNG que a própria Wikimedia gera a partir do SVG do Commons.
// O jogo mostra essas imagens no lugar do emoji de bandeira, que o Windows desenha como duas letras ("BR").
// Por padrão só baixa os países que ainda não têm bandeira; as que já existem ficam como estão. Com --todas, baixa todas.
// Uso: npm run baixar-bandeiras   ou   npm run baixar-bandeiras -- --todas
// (depois rode npm run build e faça commit da pasta bandeiras/)
"use strict";
const fs = require("fs");
const path = require("path");
const { api, pedir, COMMONS, WDQS, IMG, MAX_LADO, lotes, seguir, textoPuro, licenca, baixarImagem, ladosPng } = require("./wikimedia");

const LARGURA = 120; // um dos tamanhos padrão de miniatura da Wikimedia; na tela a bandeira tem uns 30 px de largura
// quando o Wikidata não indicar um arquivo só: código ISO e nome do arquivo no Commons
const ARQUIVOS = {};
const RAIZ = path.join(__dirname, "..", "bandeiras");
const TEMP = path.join(RAIZ, ".baixando");
const PAGINA = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/;
const CREDITOS = path.join(RAIZ, "creditos.json");
const TODAS = process.argv.includes("--todas");

(async () => {
  const dados = path.join(__dirname, "..", "dados", "data.json");
  if (!fs.existsSync(dados)) throw new Error("Rode antes: npm run dados");
  const paises = JSON.parse(fs.readFileSync(dados, "utf8")).countries;
  // bandeiras que já existem, com arquivo presente, ficam como estão
  const atuais = {};
  if (!TODAS && fs.existsSync(CREDITOS)) {
    for (const [c, e] of Object.entries((JSON.parse(fs.readFileSync(CREDITOS, "utf8")) || {}).bandeiras || {})) {
      if (paises[c] && e && e.f === c.toLowerCase() + ".png" && fs.existsSync(path.join(RAIZ, e.f))) atuais[c] = e;
    }
  }
  const codigos = Object.keys(paises).filter(c => !atuais[c]).sort();
  if (!TODAS) console.log(`${Object.keys(atuais).length} países já têm bandeira e ficam como estão.`);
  if (!codigos.length) { console.log("Nenhuma bandeira faltando."); return; }

  console.log(`Buscando no Wikidata a bandeira de ${codigos.length} países...`);
  const sparql = `SELECT ?code ?flag WHERE { VALUES ?code { ${codigos.map(c => `"${c}"`).join(" ")} } ?item wdt:P297 ?code; wdt:P41 ?flag. }`;
  const j = await (await pedir(`${WDQS}?format=json&query=${encodeURIComponent(sparql)}`)).json();
  const opcoes = new Map();
  for (const b of j.results.bindings) {
    // o valor vem como ".../Special:FilePath/Flag%20of%20Brazil.svg"
    const f = decodeURIComponent(b.flag.value.split("/").pop());
    if (!opcoes.has(b.code.value)) opcoes.set(b.code.value, new Set());
    opcoes.get(b.code.value).add(f);
  }
  const arquivo = new Map(), problemas = [];
  for (const c of codigos) {
    const lista = [...(opcoes.get(c) || [])].sort();
    if (ARQUIVOS[c]) arquivo.set(c, ARQUIVOS[c]);
    else if (lista.length === 1) arquivo.set(c, lista[0]);
    else problemas.push(`${c} ${paises[c].n}: ${lista.length ? "mais de uma bandeira no Wikidata (" + lista.join(", ") + ")" : "sem bandeira no Wikidata"}; ponha o arquivo em ARQUIVOS`);
  }

  console.log(`Buscando autor e licença de ${arquivo.size} arquivos no Commons...`);
  const info = new Map();
  for (const lote of lotes([...new Set(arquivo.values())], 25)) {
    const r = await api(COMMONS, { action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: String(LARGURA), iiextmetadatafilter: "Artist|Credit|LicenseShortName|UsageTerms", titles: lote.map(f => "File:" + f).join("|") });
    const q = r.query || {}, fim = seguir(q), pags = new Map((q.pages || []).map(p => [p.title, p]));
    for (const f of lote) {
      const pg = pags.get(fim("File:" + f)), ii = pg && pg.imageinfo && pg.imageinfo[0];
      if (!ii) continue;
      const em = ii.extmetadata || {};
      info.set(f, {
        thumb: String(ii.thumburl || "").replace(/\?.*$/, ""), pagina: ii.descriptionurl,
        autor: textoPuro(em.Artist && em.Artist.value, 100) || [textoPuro(em.Credit && em.Credit.value, 1000)].filter(c => c.length <= 60)[0] || "",
        licenca: licenca(textoPuro(em.LicenseShortName && em.LicenseShortName.value, 40) || textoPuro(em.UsageTerms && em.UsageTerms.value, 40))
      });
    }
  }

  fs.rmSync(TEMP, { recursive: true, force: true });
  fs.mkdirSync(TEMP, { recursive: true });
  const bandeiras = {};
  let bytes = 0;
  for (const c of codigos) {
    const f = arquivo.get(c), i = f && info.get(f);
    if (!f) continue;
    if (!i) { problemas.push(`${c} ${paises[c].n}: ${f} não está no Commons`); continue; }
    if (!IMG.test(i.thumb) || !PAGINA.test(i.pagina || "")) { problemas.push(`${c} ${paises[c].n}: endereço inesperado (${i.thumb})`); continue; }
    let buf;
    try { buf = await baixarImagem(i.thumb); }
    catch (e) { problemas.push(`${c} ${paises[c].n}: ${e.message}`); continue; }
    const lados = ladosPng(buf);
    if (!lados || lados.some(n => !n || n > MAX_LADO)) { problemas.push(`${c} ${paises[c].n}: a miniatura não é um PNG válido`); continue; }
    const nome = c.toLowerCase() + ".png";
    fs.writeFileSync(path.join(TEMP, nome), buf);
    bytes += buf.length;
    bandeiras[c] = { f: nome, w: lados[0], h: lados[1], file: f.replace(/ /g, "_"), a: i.autor, l: i.licenca, u: i.pagina, n: paises[c].n };
    process.stdout.write(`\r${Object.keys(bandeiras).length} bandeiras baixadas`);
  }
  console.log("");
  if (!Object.keys(bandeiras).length) {
    fs.rmSync(TEMP, { recursive: true, force: true });
    throw new Error("Nenhuma bandeira baixada; nada foi alterado na pasta bandeiras/.\n  " + problemas.join("\n  "));
  }
  // créditos em ordem de código: os que já existiam e os novos
  const todas = Object.fromEntries(Object.entries({ ...atuais, ...bandeiras }).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(path.join(TEMP, "creditos.json"), JSON.stringify({ gerado: new Date().toISOString(), fonte: "Wikimedia Commons", bandeiras: todas }, null, 1) + "\n");
  // troca os arquivos só no fim; sem --todas, as bandeiras antigas ficam onde estão
  if (TODAS) for (const f of fs.readdirSync(RAIZ)) if (/^([a-z]{2}\.png|creditos\.json)$/.test(f)) fs.rmSync(path.join(RAIZ, f));
  for (const f of fs.readdirSync(TEMP)) fs.renameSync(path.join(TEMP, f), path.join(RAIZ, f));
  fs.rmSync(TEMP, { recursive: true, force: true });

  console.log(`Pronto: ${Object.keys(bandeiras).length} de ${codigos.length} bandeiras ${TODAS ? "" : "novas "}(${(bytes / 1024).toFixed(0)} KB) | no pacote: ${Object.keys(todas).length}`);
  const licencas = {};
  for (const b of Object.values(todas)) licencas[b.l || "sem licença"] = (licencas[b.l || "sem licença"] || 0) + 1;
  console.log("Licenças:", JSON.stringify(licencas));
  if (problemas.length) console.log(`Sem bandeira (o jogo mostra o emoji):\n  ` + problemas.join("\n  "));
})().catch(e => { console.error("\nErro:", e.message); process.exit(1); });

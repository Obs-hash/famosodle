// Visitas de 12 meses de cada figura na Wikipedia em português, usadas pelo gerar-dados para ordenar as figuras de
// mesmo nível de fama (a mais vista primeiro). O título em português vem dos links entre idiomas (langlinks) do artigo
// em inglês. Quem não tem artigo em português usa as visitas da Wikipedia em inglês, convertidas pela proporção mediana
// entre as duas Wikipedias (calculada com as figuras que têm artigo nas duas), para ficar na mesma escala.
// Grava dados/visitas.json, que vai para o git: o build só lê esse arquivo e não usa a rede.
// No fim, lista as figuras cujas visitas destoam muito do nível em dados/fama.txt. É só uma sugestão: os níveis
// mudam só com a aprovação de quem cuida do projeto.
// Uso: npm run visitas   (precisa de dados/data.json; rode antes npm run dados)
"use strict";
const fs = require("fs");
const path = require("path");
const { api, pedir, WP, lotes, titulo, seguir, figuras } = require("./wikimedia");

const REST = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";
const SAIDA = path.join(__dirname, "..", "dados", "visitas.json");
const FAMA = path.join(__dirname, "..", "dados", "fama.txt");

// os 12 meses completos antes do mês atual
function periodo() {
  const hoje = new Date(), fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0));
  const ini = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() - 11, 1));
  const f = d => d.toISOString().slice(0, 10).replace(/-/g, "");
  return { ini: f(ini) + "00", fim: f(fim) + "00", texto: `${ini.toISOString().slice(0, 7)} a ${fim.toISOString().slice(0, 7)}` };
}
// soma das visitas de pessoas (sem robôs) no período; artigo sem dados conta zero
async function visitas(projeto, tit, per) {
  const url = `${REST}/${projeto}/all-access/user/${encodeURIComponent(tit.replace(/ /g, "_"))}/monthly/${per.ini}/${per.fim}`;
  try { return ((await (await pedir(url)).json()).items || []).reduce((s, x) => s + (Number(x.views) || 0), 0); }
  catch (e) { if (/HTTP 404/.test(e.message)) return 0; throw e; }
}
const mediana = v => { const a = v.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };

(async () => {
  const pessoas = figuras(), per = periodo();
  console.log(`Período: ${per.texto}. Buscando os títulos em português de ${pessoas.length} figuras...`);
  const tituloPt = new Map();
  for (const lote of lotes(pessoas, 50)) {
    const j = await api(WP, { action: "query", redirects: "1", prop: "langlinks", lllang: "pt", lllimit: "max", titles: lote.map(p => titulo(p.w)).join("|") });
    const q = j.query || {}, fim = seguir(q), pags = new Map((q.pages || []).map(p => [p.title, p]));
    for (const p of lote) { const pg = pags.get(fim(titulo(p.w))), ll = pg && (pg.langlinks || []).find(l => l.lang === "pt"); if (ll) tituloPt.set(p.id, ll.title); }
  }
  console.log(`${tituloPt.size} figuras têm artigo em português. Buscando as visitas...`);
  const res = [];
  for (const p of pessoas) {
    const pt = tituloPt.has(p.id) ? await visitas("pt.wikipedia.org", tituloPt.get(p.id), per) : null;
    const en = await visitas("en.wikipedia.org", titulo(p.w), per);
    res.push({ p, pt, en });
    process.stdout.write(`\r${res.length} de ${pessoas.length}`);
  }
  console.log("");
  const proporcao = mediana(res.filter(r => r.pt > 0 && r.en > 0).map(r => r.pt / r.en));
  const saida = {};
  for (const r of res) {
    const v = r.pt !== null ? r.pt : Math.round(r.en * proporcao);
    saida[r.p.n] = { v, wiki: r.pt !== null ? "pt" : "en", pt: r.pt, en: r.en, titulo: tituloPt.get(r.p.id) || null };
  }
  fs.writeFileSync(SAIDA, JSON.stringify({
    gerado: new Date().toISOString(), periodo: per.texto, fonte: "Wikimedia Pageviews API, visitas de pessoas (sem robôs)",
    proporcaoPtEn: Number(proporcao.toFixed(4)), visitas: saida
  }, null, 1) + "\n");
  console.log(`Gravado dados/visitas.json | proporção mediana pt/en ${proporcao.toFixed(3)} | sem artigo em português: ${res.filter(r => r.pt === null).length}`);

  // sugestões: nível 4 entre os 15% mais vistos ou nível 1 entre os 40% menos vistos
  if (!fs.existsSync(FAMA)) return;
  const fama = new Map(fs.readFileSync(FAMA, "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), "").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#")).map(l => l.split("|")).map(([n, nv]) => [n, Number(nv)]));
  const ordem = Object.entries(saida).sort((a, b) => b[1].v - a[1].v), N = ordem.length;
  const pos = new Map(ordem.map(([n], i) => [n, i]));
  const fmt = n => `${n} (nível ${fama.get(n)}, ${saida[n].v.toLocaleString("pt-BR")} visitas${saida[n].wiki === "en" ? " convertidas do inglês" : ""}, posição ${pos.get(n) + 1} de ${N})`;
  const sobe = ordem.filter(([n], i) => fama.get(n) === 4 && i < N * 0.15).map(([n]) => n);
  const desce = ordem.filter(([n], i) => fama.get(n) === 1 && i >= N * 0.6).map(([n]) => n);
  console.log(`\nNível 4 entre os 15% mais vistos (talvez devam ficar mais fáceis): ${sobe.length}`);
  sobe.forEach(n => console.log("  " + fmt(n)));
  console.log(`\nNível 1 entre os 40% menos vistos (talvez devam ficar mais difíceis): ${desce.length}`);
  desce.forEach(n => console.log("  " + fmt(n)));
})().catch(e => { console.error("\nErro:", e.message); process.exit(1); });

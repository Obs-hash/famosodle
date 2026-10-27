// Compara nascimento, morte e gênero de cada figura com o Wikidata e lista as diferenças.
// Serve principalmente para descobrir quem morreu depois da última revisão. Não muda nenhum arquivo.
// Uso: npm run verificar-dados
"use strict";
const { api, WP, WD, lotes, titulo, seguir, figuras } = require("./wikimedia");

const SEXO = { Q6581097: "M", Q6581072: "F" };
// valores de uma propriedade, preferindo os marcados como preferidos e ignorando os descartados
function valores(claims, prop) {
  const lista = (claims[prop] || []).filter(c => c.rank !== "deprecated");
  const pref = lista.filter(c => c.rank === "preferred");
  return (pref.length ? pref : lista).map(c => c.mainsnak);
}
// ano de um valor de data do Wikidata ("+1879-03-14T00:00:00Z", "-0356-..."); anos negativos são antes de Cristo
function ano(snak) {
  const v = snak.snaktype === "value" && snak.datavalue && snak.datavalue.value;
  const m = v && typeof v.time === "string" && /^([+-])(\d+)-/.exec(v.time);
  if (!m) return { desconhecido: true }; // sem valor ou num formato inesperado
  return { y: (m[1] === "-" ? -1 : 1) * Number(m[2]), prec: v.precision };
}
// confere se o nosso ano bate com algum valor do Wikidata, com folga para datas aproximadas e pouco precisas
function bate(nosso, circa, lista) {
  return lista.some(a => {
    if (a.desconhecido) return true;
    const folga = a.prec >= 9 ? (circa ? 5 : 1) : a.prec === 8 ? 10 : 100;
    return Math.abs(a.y - nosso) <= folga;
  });
}

(async () => {
  const pessoas = figuras(), qid = new Map();
  for (const lote of lotes(pessoas, 50)) {
    const j = await api(WP, { action: "query", redirects: "1", prop: "pageprops", ppprop: "wikibase_item", titles: lote.map(p => titulo(p.w)).join("|") });
    const q = j.query || {}, fim = seguir(q), pags = new Map((q.pages || []).map(p => [p.title, p]));
    for (const p of lote) { const pg = pags.get(fim(titulo(p.w))); if (pg && pg.pageprops && pg.pageprops.wikibase_item) qid.set(p.id, pg.pageprops.wikibase_item); }
  }
  const ent = new Map();
  for (const lote of lotes([...new Set(qid.values())], 50)) {
    const j = await api(WD, { action: "wbgetentities", ids: lote.join("|"), props: "claims" });
    for (const [id, e] of Object.entries(j.entities || {})) ent.set(id, e.claims || {});
  }
  const avisos = [];
  for (const p of pessoas) {
    const c = ent.get(qid.get(p.id));
    if (!c) { avisos.push(`${p.id} ${p.n}: sem item no Wikidata`); continue; }
    const nasc = valores(c, "P569").map(ano), mort = valores(c, "P570").map(ano), sexo = valores(c, "P21").map(s => s.datavalue && SEXO[s.datavalue.value.id]);
    if (nasc.length && !bate(p.b, p.bc, nasc)) avisos.push(`${p.id} ${p.n}: nascimento ${p.b} nos dados, ${nasc.map(a => a.y).join(" ou ")} no Wikidata`);
    if (p.d === null && mort.length) avisos.push(`${p.id} ${p.n}: está como viva nos dados, mas o Wikidata registra morte em ${mort.map(a => a.desconhecido ? "data desconhecida" : a.y).join(" ou ")}`);
    if (p.d !== null && !mort.length) avisos.push(`${p.id} ${p.n}: morte ${p.d} nos dados, sem data de morte no Wikidata`);
    if (p.d !== null && mort.length && !bate(p.d, p.dc, mort)) avisos.push(`${p.id} ${p.n}: morte ${p.d} nos dados, ${mort.map(a => a.y).join(" ou ")} no Wikidata`);
    if (sexo.length && sexo[0] && !sexo.includes(p.g)) avisos.push(`${p.id} ${p.n}: gênero ${p.g} nos dados, ${sexo.join(" ou ")} no Wikidata`);
  }
  console.log(`Figuras conferidas: ${pessoas.length} | com item no Wikidata: ${qid.size}`);
  console.log(avisos.length ? `\nDiferenças (${avisos.length}):\n  ` + avisos.join("\n  ") : "\nNenhuma diferença.");
})().catch(e => { console.error("Erro:", e.message); process.exit(1); });

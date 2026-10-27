// Confere o título da Wikipedia de cada figura e lista o que precisa de atenção:
// artigo inexistente, redirecionamento, página de desambiguação e artigo sem imagem principal livre.
// Não muda nenhum arquivo. Corrija os títulos editando a linha da figura no lugar, sem mover linhas.
// Uso: npm run verificar-fotos
"use strict";
const { api, WP, lotes, titulo, seguir, figuras } = require("./wikimedia");

(async () => {
  const pessoas = figuras();
  const faltando = [], redireciona = [], desambiguacao = [], semLivre = [];
  for (const lote of lotes(pessoas, 50)) {
    const j = await api(WP, { action: "query", redirects: "1", prop: "pageimages|pageprops", piprop: "name", pilicense: "free", ppprop: "disambiguation", titles: lote.map(p => titulo(p.w)).join("|") });
    const q = j.query || {}, fim = seguir(q);
    const redir = new Map((q.redirects || []).map(r => [r.from, r.to]));
    const norm = new Map((q.normalized || []).map(n => [n.from, n.to]));
    const pags = new Map((q.pages || []).map(p => [p.title, p]));
    for (const p of lote) {
      const t = titulo(p.w), tn = norm.get(t) || t, pg = pags.get(fim(t));
      if (!pg || pg.missing || pg.invalid) { faltando.push(p); continue; }
      if (redir.has(tn)) redireciona.push([p, fim(t)]);
      if (pg.pageprops && "disambiguation" in pg.pageprops) desambiguacao.push(p);
      if (!pg.pageimage) semLivre.push([p, fim(t)]);
    }
  }
  // para quem não tem imagem livre, vê se existe alguma imagem principal (não livre)
  const naoLivre = new Set();
  for (const lote of lotes(semLivre, 50)) {
    const j = await api(WP, { action: "query", prop: "pageimages", piprop: "name", pilicense: "any", titles: lote.map(([, t]) => t).join("|") });
    for (const pg of (j.query && j.query.pages) || []) if (pg.pageimage) naoLivre.add(pg.title);
  }
  const nome = p => `${p.id} ${p.n} (${p.w})`;
  const secao = (rotulo, itens, fmt) => { console.log(`\n${rotulo}: ${itens.length}`); itens.forEach(i => console.log("  " + fmt(i))); };
  console.log(`Figuras conferidas: ${pessoas.length}`);
  secao("Artigo não encontrado", faltando, nome);
  secao("Título que redireciona (troque pelo título final)", redireciona, ([p, t]) => `${nome(p)} -> ${t.replace(/ /g, "_")}`);
  secao("Página de desambiguação", desambiguacao, nome);
  secao("Sem imagem principal livre (o jogo mostra as iniciais)", semLivre, ([p, t]) => `${nome(p)}${naoLivre.has(t) ? " · a imagem principal existe, mas não é livre" : " · o artigo não tem imagem principal"}`);
  const total = faltando.length + redireciona.length + desambiguacao.length;
  console.log(total ? "\nHá títulos para corrigir em dados/figuras.txt ou dados/figuras-extra.txt." : "\nTodos os títulos estão certos.");
})().catch(e => { console.error("Erro:", e.message); process.exit(1); });

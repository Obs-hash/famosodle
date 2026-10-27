// Mede o site com o Lighthouse (perfil de celular, padrão do Lighthouse) servindo dist/famosodle localmente.
// O Lighthouse não é dependência do projeto: roda por npx, na versão fixa abaixo, e usa o Chrome instalado.
// Uso: node scripts/medir-lighthouse.js [rodadas] [pasta]   (relatórios em lighthouse/, fora do git)
"use strict";
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
// precisa ser assíncrono: o servidor roda neste mesmo processo e não pode ficar bloqueado
const rodar = cmd => new Promise((ok, falha) => exec(cmd, { timeout: 240000, windowsHide: true }, e => (e ? falha(e) : ok())));
const { iniciar } = require("./servir");

const VERSAO = "13.5.0";
const rodadas = Number(process.argv[2]) || 3;
const pasta = process.argv[3] || path.join(__dirname, "..", "dist", "famosodle");
const saida = path.join(__dirname, "..", "lighthouse");
fs.mkdirSync(saida, { recursive: true });
const mediana = v => v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];

iniciar({ pasta }).then(async server => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  const res = [];
  try {
    for (let i = 1; i <= rodadas; i++) {
      const arq = path.join(saida, `rodada-${i}`);
      await rodar(`npx --yes lighthouse@${VERSAO} ${url} --quiet --only-categories=performance,accessibility,best-practices,seo --output=json --output=html --output-path="${arq}" --chrome-flags="--headless=new"`);
      const j = JSON.parse(fs.readFileSync(arq + ".report.json", "utf8"));
      const c = j.categories, a = j.audits;
      const r = {
        perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100),
        bp: Math.round(c["best-practices"].score * 100), seo: Math.round(c.seo.score * 100),
        fcp: a["first-contentful-paint"].numericValue, lcp: a["largest-contentful-paint"].numericValue,
        tbt: a["total-blocking-time"].numericValue, cls: a["cumulative-layout-shift"].numericValue, si: a["speed-index"].numericValue
      };
      res.push(r);
      console.log(`rodada ${i}: desempenho ${r.perf} | acessibilidade ${r.a11y} | boas práticas ${r.bp} | SEO ${r.seo} | FCP ${Math.round(r.fcp)} ms | LCP ${Math.round(r.lcp)} ms | TBT ${Math.round(r.tbt)} ms | CLS ${r.cls.toFixed(3)}`);
      const falhas = Object.values(j.categories).flatMap(cat => cat.auditRefs.filter(ref => ref.weight > 0 && a[ref.id].score !== null && a[ref.id].score < 1).map(ref => `${cat.title}: ${a[ref.id].title}`));
      if (falhas.length) console.log("  itens abaixo do ideal:\n  - " + [...new Set(falhas)].join("\n  - "));
    }
  } finally { server.close(); }
  const m = k => mediana(res.map(r => r[k]));
  console.log(`\nMEDIANA de ${rodadas}: desempenho ${m("perf")} | acessibilidade ${m("a11y")} | boas práticas ${m("bp")} | SEO ${m("seo")} | FCP ${Math.round(m("fcp"))} ms | LCP ${Math.round(m("lcp"))} ms | TBT ${Math.round(m("tbt"))} ms | CLS ${m("cls").toFixed(3)}`);
});

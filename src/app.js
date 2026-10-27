"use strict";
// cópia do HTML original, usada para gerar a versão com as fotos embutidas
const PRISTINE = "<!doctype html>\n" + document.documentElement.outerHTML;
const PHOTO_EMBED = null; /*__EMBED__*/
const DATA = /*__DATA__*/{};
const SITE = /*__SITE__*/"";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const norm = s => String(s).normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const isObj = x => !!x && typeof x === "object" && !Array.isArray(x);
const dict = () => Object.create(null);
const str = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
const reducedMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

const PEOPLE = DATA.people;
const BY = dict(); PEOPLE.forEach(p => { BY[p.id] = p; });
// id válido: formato p000 e presente nos dados (BY não tem protótipo, então "constructor" e "__proto__" não passam)
const isId = id => typeof id === "string" && /^p\d{3}$/.test(id) && !!BY[id];
const CTRY = DATA.countries;
const contOf = p => CTRY[p.c].ct;
const AREA = { pol: "Política", cie: "Ciência", art: "Artes", mus: "Música", lit: "Literatura", esp: "Esporte", ati: "Ativismo", exp: "Exploração", mil: "Militar", fil: "Filosofia", neg: "Negócios", cin: "Cinema e TV", rel: "Religião" };
const LAUNCH = "2026-10-26";
const KEY = "famosodle:v1";
const PHOTO_KEY = "famosodle:fotos:v1";

/* ---------- modos ---------- */
const MODES = [
  { id: "g", kind: "classic", label: "Global", cont: null },
  { id: "af", kind: "classic", label: "África", cont: "af" },
  { id: "am", kind: "classic", label: "América", cont: "am" },
  { id: "as", kind: "classic", label: "Ásia", cont: "as" },
  { id: "eu", kind: "classic", label: "Europa", cont: "eu" },
  { id: "oc", kind: "classic", label: "Oceania", cont: "oc" },
  { id: "foto", kind: "photo", label: "Foto" },
  { id: "frase", kind: "quote", label: "Frase" }
];
const MODE = dict(); MODES.forEach(m => { MODE[m.id] = m; });
const CONT_MODES = MODES.filter(m => m.kind === "classic" && m.cont);
// o modo Foto sorteia só entre quem tem foto no pacote do site (ph), para a resposta não depender da rede
const HAS_PACK = PEOPLE.some(p => p.ph);
const POOL = dict();
MODES.forEach(m => {
  if (m.kind === "classic") POOL[m.id] = PEOPLE.filter(p => !m.cont || contOf(p) === m.cont).map(p => p.id);
  else if (m.kind === "quote") POOL[m.id] = PEOPLE.filter(p => p.q).map(p => p.id);
  else POOL[m.id] = PEOPLE.filter(p => p.ph || !HAS_PACK).map(p => p.id);
});
// quem pode ser digitado como palpite em cada modo
const ALL_IDS = PEOPLE.map(p => p.id);
const GUESSABLE = dict(); MODES.forEach(m => { GUESSABLE[m.id] = m.kind === "classic" ? POOL[m.id] : ALL_IDS; });
const PANEL = { classic: "classic", photo: "photo", quote: "quote" };
const KINDS = ["classic", "photo", "quote"];

/* ---------- datas e sorteio ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffled(list, seed) { const r = mulberry32(seed); const a = list.slice().sort(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const SEEDS = { g: 1966, af: 1957, am: 1888, as: 1947, eu: 1789, oc: 1893, foto: 1839, frase: 1963 };
const ORDER = dict(); MODES.forEach(m => { ORDER[m.id] = shuffled(POOL[m.id], SEEDS[m.id] * 7919); });
function spKey(offsetDays = 0) { return new Date(Date.now() - 3 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10); }
function dayIdx(key) { return Math.round((Date.parse(key) - Date.parse(LAUNCH)) / 86400e3); }
const yearNow = () => new Date(Date.now() - 3 * 3600e3).getUTCFullYear();
let curYear = yearNow();
const mod = (k, n) => ((k % n) + n) % n;
function contAnswers(key) { return CONT_MODES.map(m => ORDER[m.id][mod(dayIdx(key), ORDER[m.id].length)]); }
function globalAnswer(key) {
  const o = ORDER.g, used = new Set(contAnswers(key)), i = dayIdx(key);
  for (let k = 0; k < o.length; k++) { const c = o[mod(i + k, o.length)]; if (!used.has(c)) return c; }
  return o[mod(i, o.length)];
}
// resposta do dia em cada modo; Foto e Frase evitam a resposta do Global
function answer(modeId, key) {
  const o = ORDER[modeId], i = dayIdx(key);
  if (modeId === "g") return globalAnswer(key);
  if (MODE[modeId].kind === "classic") return o[mod(i, o.length)];
  const avoid = globalAnswer(key);
  for (let k = 0; k < o.length; k++) { const c = o[mod(i + k, o.length)]; if (c !== avoid) return c; }
  return o[mod(i, o.length)];
}
function msToMidnight() { const t = Date.now() - 3 * 3600e3; return 86400e3 - (t % 86400e3); }
function dateLabel(key) { return new Date(key + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/\./g, ""); }

/* ---------- textos ---------- */
const yr = (y, circa) => (y === null ? "" : (circa ? "c. " : "") + (y < 0 ? `${-y} a.C.` : String(y)));
const alive = p => p.d === null;
const vivo = p => (p.g === "F" ? "Viva" : "Vivo");
// anos entre duas datas; não existe ano zero entre 1 a.C. e 1 d.C.
const span = (from, to) => to - from - (from < 0 && to > 0 ? 1 : 0);
const age = p => span(p.b, alive(p) ? curYear : p.d);
const lifeSpan = p => alive(p) ? `nasceu em ${yr(p.b, p.bc)}` : `${yr(p.b, p.bc)} a ${yr(p.d, p.dc)}`;
const ctryName = c => CTRY[c].n;
const areasTxt = p => p.a.map(a => AREA[a]).join(" e ");
const flag = p => `<span class="flag" aria-hidden="true">${esc(CTRY[p.c].f)}</span>`;
const initials = n => n.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(w => w && !/^(de|da|do|dos|d|o|a|e|van|von|jr)$/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("");

/* ---------- comparação do modo clássico ---------- */
function setCmp(a, b) {
  const B = new Set(b), A = new Set(a), inter = [...A].filter(x => B.has(x)).length;
  if (inter === A.size && inter === B.size) return "ok";
  return inter ? "near" : "bad";
}
function numCmp(gv, tv, nearWithin) {
  if (gv === tv) return { s: "ok" };
  const up = tv > gv;
  const s = Number.isFinite(gv) && Number.isFinite(tv) && Math.abs(gv - tv) <= nearWithin ? "near" : "bad";
  return { s, arrow: up ? "up" : "down" };
}
// sinal que não depende de cor (✓ igual, ≈ perto, ✕ diferente) e seta de maior ou menor
const MARK = {
  ok: `<span class="mk" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2.5 6.3l2.2 2.2 4.8-5"/></svg></span>`,
  near: `<span class="mk" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M1.5 4c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0M1.5 8.5c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0"/></svg></span>`,
  bad: `<span class="mk" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6"/></svg></span>`
};
const ARROW = {
  up: `<svg class="arw" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8.5 9.5H15v9.5H9V12H3.5z"/></svg>`,
  down: `<svg class="arw" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5L3.5 12H9V2.5h6V12h5.5z"/></svg>`
};
const STATE = { ok: "igual", near: "perto", bad: "diferente" };
const ARROW_TXT = {
  4: { up: "a figura secreta nasceu depois", down: "a figura secreta nasceu antes" },
  5: { up: "a figura secreta morreu depois ou está viva", down: "a figura secreta morreu antes" },
  6: { up: "a figura secreta tem mais idade", down: "a figura secreta tem menos idade" }
};
function compare(g, t, modeId) {
  const same = g.id === t.id, cells = [];
  cells.push({ s: same ? "ok" : "neutral", cls: "tile-person", html: `${thumb(g, "ph")}<span class="cn">${esc(g.n)}</span>`, txt: g.n, tip: g.n });
  cells.push({ s: g.g === t.g ? "ok" : "bad", html: g.g === "F" ? "Mulher" : "Homem", txt: g.g === "F" ? "Mulher" : "Homem", tip: "Gênero" });
  let cs = "bad";
  if (g.c === t.c) cs = "ok";
  else if (modeId === "g" ? contOf(g) === contOf(t) : (CTRY[g.c].b || []).includes(t.c)) cs = "near";
  cells.push({ s: cs, html: `${flag(g)}${esc(ctryName(g.c))}`, txt: ctryName(g.c), tip: `País: ${ctryName(g.c)}` });
  cells.push({ s: setCmp(g.a, t.a), html: g.a.map(a => esc(AREA[a])).join("<br>"), txt: areasTxt(g), tip: "Área: " + areasTxt(g) });
  const b = same ? { s: "ok" } : numCmp(g.b, t.b, 10);
  cells.push({ ...b, html: `<span class="num">${esc(yr(g.b, g.bc))}</span>`, txt: yr(g.b, g.bc), tip: `Nascimento: ${yr(g.b, g.bc)}${b.arrow ? ". A " + ARROW_TXT[4][b.arrow].slice(2) + "." : ""}` });
  const gd = alive(g) ? Infinity : g.d, td = alive(t) ? Infinity : t.d;
  const d = same ? { s: "ok" } : numCmp(gd, td, 10);
  cells.push({ ...d, html: alive(g) ? vivo(g) : `<span class="num">${esc(yr(g.d, g.dc))}</span>`, txt: alive(g) ? vivo(g) : yr(g.d, g.dc), tip: alive(g) ? (g.g === "F" ? "Está viva" : "Está vivo") : `Morte: ${yr(g.d, g.dc)}${d.arrow ? ". A " + ARROW_TXT[5][d.arrow].slice(2) + "." : ""}` });
  const a = same ? { s: "ok" } : numCmp(age(g), age(t), 5);
  cells.push({ ...a, html: `<span class="num">${age(g)}</span><small>${alive(g) ? "anos hoje" : "anos"}</small>`, txt: `${age(g)} anos`, tip: `Idade: ${age(g)} anos` });
  cells.forEach((c, i) => { c.sr = c.s === "neutral" ? "" : STATE[c.s] + (c.arrow ? ", " + ARROW_TXT[i][c.arrow] : ""); });
  return cells;
}
const HEADS = ["Pessoa", "Gênero", "País", "Área", "Nascimento", "Morte", "Idade"];
const tileHtml = x => `<div class="tile ${x.s}${x.arrow ? " " + x.arrow : ""}${x.cls ? " " + x.cls : ""}" role="cell" title="${esc(x.tip)}">${x.arrow ? ARROW[x.arrow] : ""}${MARK[x.s] || ""}${x.html}${x.sr ? `<span class="sr">, ${x.sr}</span>` : ""}</div>`;
function shareRow(cells) {
  return cells.slice(1).map(c => c.s === "ok" ? "🟩" : c.arrow ? (c.arrow === "up" ? "🔼" : "🔽") : c.s === "near" ? "🟨" : "🟥").join("");
}
// etiquetas curtas dos modos foto e frase: [estado, texto]
function miniTags(g, t) {
  const cs = g.c === t.c ? "ok" : contOf(g) === contOf(t) ? "near" : "bad";
  const as = setCmp(g.a, t.a);
  const bs = g.b === t.b ? ["ok", "Mesma época"] : Math.abs(g.b - t.b) <= 25 ? ["near", t.b > g.b ? "Nasceu pouco depois ▲" : "Nasceu pouco antes ▼"] : ["bad", t.b > g.b ? "Nasceu depois ▲" : "Nasceu antes ▼"];
  return [[cs, cs === "ok" ? "Mesmo país" : cs === "near" ? "Mesmo continente" : "Outro continente"], [as, as === "ok" ? "Mesma área" : as === "near" ? "Área parecida" : "Outra área"], bs];
}

/* ---------- estado ---------- */
const store = {
  get(k) { try { const v = JSON.parse(localStorage.getItem(k)); return isObj(v) ? v : {}; } catch (e) { return {}; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const emptyStats = () => ({ played: 0, won: 0, cur: 0, best: 0, lastKey: null, dist: dict() });
const count = x => Math.min(1e6, Math.max(0, Math.floor(Number(x) || 0)));
// tudo que volta do localStorage é tratado como não confiável: só passam números, datas e ids conhecidos
function readState() {
  const raw = store.get(KEY), rs = isObj(raw.stats) ? raw.stats : {}, rg = isObj(raw.games) ? raw.games : {};
  const stats = dict(), games = dict();
  for (const m of MODES) {
    const r = isObj(rs[m.id]) ? rs[m.id] : {}, st = emptyStats();
    for (const f of ["played", "won", "cur", "best"]) st[f] = count(r[f]);
    st.lastKey = typeof r.lastKey === "string" && DAY.test(r.lastKey) ? r.lastKey : null;
    if (isObj(r.dist)) for (const [k, v] of Object.entries(r.dist)) if (/^(\d{1,2}|15\+)$/.test(k)) st.dist[k] = count(v);
    stats[m.id] = st;
    const g = rg[m.id];
    if (isObj(g) && typeof g.key === "string" && DAY.test(g.key)) games[m.id] = {
      key: g.key,
      guesses: Array.isArray(g.guesses) ? [...new Set(g.guesses.filter(isId))] : [],
      hints: Array.isArray(g.hints) ? [...new Set(g.hints.filter(h => h === "h1" || h === "h2"))] : []
    };
  }
  return { stats, games };
}
let S = readState();
let today = spKey();
const P = dict(); // treinos em andamento
let currentKind = "classic";
let currentRegion = "g";
const freshAnim = {};
const resultTimer = {};
let saveWarned = false;

function loadDaily() {
  today = spKey(); curYear = yearNow();
  for (const m of MODES) {
    let g = S.games[m.id];
    if (!g || g.key !== today) g = S.games[m.id] = { key: today, guesses: [], hints: [] };
    g.target = answer(m.id, today);
    g.done = g.guesses.includes(g.target);
  }
}
function save() {
  const out = { v: 1, stats: S.stats, games: {} };
  for (const m of MODES) { const g = S.games[m.id]; out.games[m.id] = { key: g.key, target: g.target, guesses: g.guesses, done: g.done, hints: g.hints }; }
  if (!store.set(KEY, out) && !saveWarned) { saveWarned = true; toast("Não deu para salvar o progresso neste navegador."); }
}
const game = id => P[id] || S.games[id];
const wrongCount = g => g.guesses.filter(x => x !== g.target).length;
function recordDaily(id, firstGuess, won) {
  const st = S.stats[id];
  if (firstGuess) st.played++;
  if (won) {
    st.won++;
    st.cur = st.lastKey === spKey(-1) ? st.cur + 1 : 1;
    st.best = Math.max(st.best, st.cur);
    st.lastKey = today;
    const n = S.games[id].guesses.length, b = n >= 15 ? "15+" : String(n);
    st.dist[b] = (st.dist[b] || 0) + 1;
  }
}
function guess(id, pid) {
  const g = game(id);
  if (!g.target || g.done || !isId(pid) || g.guesses.includes(pid)) return false;
  const first = g.guesses.length === 0, wrongBefore = wrongCount(g);
  g.guesses.push(pid);
  if (pid === g.target) g.done = true;
  if (!P[id]) { recordDaily(id, first, g.done); save(); }
  if (g.done) freshAnim[id] = true;
  render(id, true);
  announceGuess(id, pid, wrongBefore);
  return true;
}
// resumo falado de cada palpite, para quem usa leitor de tela
function announceGuess(id, pid, wrongBefore) {
  const g = game(id), p = BY[pid], t = BY[g.target], n = g.guesses.length;
  if (pid === g.target) { announce(`Acertou! A figura é ${p.n}, em ${n} ${n === 1 ? "palpite" : "palpites"}.`); return; }
  const parts = MODE[id].kind === "classic"
    ? compare(p, t, id).slice(1).map((c, i) => `${HEADS[i + 1]}: ${c.txt}, ${c.sr}`)
    : miniTags(p, t).map(x => x[1].replace(/ [▲▼]$/, ""));
  const w = wrongCount(g), unlocked = hintDefs(id).filter(h => wrongBefore < h.at && w >= h.at);
  announce(`${p.n}. ${parts.join(". ")}.${unlocked.map(h => ` Dica liberada: ${h.label}.`).join("")}`);
}
let announceTimer;
function announce(msg) {
  const el = $("#announce");
  el.textContent = "";
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.textContent = msg; }, 60);
}

/* ---------- retratos (fotos do site, Wikipedia e Commons) ---------- */
const photoMem = dict();
const IMG_HOST = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;
const PAGE_URL = /^https:\/\/(commons\.wikimedia|en\.wikipedia)\.org\/wiki\/File:[^\s"'<>]+$/;
const pageOf = u => (typeof u === "string" && PAGE_URL.test(u) ? u : "");
let photoCache = (() => {
  const raw = store.get(PHOTO_KEY), ok = dict();
  for (const [k, c] of Object.entries(raw)) {
    // data finita e no passado, senão a entrada nunca venceria
    if (!isId(k) || !isObj(c) || !Number.isFinite(c.t) || c.t > Date.now()) continue;
    const v = c.v;
    if (v === null) ok[k] = { t: c.t, v: null };
    else if (isObj(v) && typeof v.src === "string" && IMG_HOST.test(v.src)) ok[k] = { t: c.t, v: { src: v.src.slice(0, 600), file: str(v.file, 200), artist: str(v.artist, 120), license: str(v.license, 40), page: pageOf(v.page) } };
  }
  return ok;
})();
const API = "https://en.wikipedia.org/w/api.php?origin=*&format=json&formatversion=2&action=query";
const textOnly = html => {
  try {
    const doc = new DOMParser().parseFromString(String(html || "").slice(0, 4000), "text/html");
    doc.querySelectorAll("script, style, noscript, template").forEach(n => n.remove());
    // tira caracteres invisíveis e de controle bidirecional, que poderiam inverter o texto do crédito na tela
    let s = (doc.body.textContent || "").replace(/\p{Cf}/gu, "").replace(/[\s\p{Cc}]+/gu, " ").trim().slice(0, 300);
    s = s.replace(/^(.+?)\1$/, "$1").replace(/^Unknown author\.?$/i, "Autor desconhecido").replace(/^Unknown photographer$/i, "Fotógrafo desconhecido");
    return s;
  } catch (e) { return ""; }
};
const withTimeout = ms => (window.AbortSignal && AbortSignal.timeout ? { signal: AbortSignal.timeout(ms) } : {});
async function getJSON(url) {
  const r = await fetch(url, { credentials: "omit", ...withTimeout(10000) });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}
// resolve: {src, file, artist, license, page} | null (sem imagem livre). Rejeita se a rede falhar.
// Os pedidos feitos ao mesmo tempo são agrupados em lotes de até 50 nomes por consulta.
const photoWait = new Map();
let photoTimer = null;
// fotos hospedadas no próprio site: pastas fotos-1 a fotos-4, com os créditos em fotos-1/creditos.json (baixado só quando a primeira foto é pedida)
const LOCAL_PATH = /^fotos-\d\/p\d{3}\.jpg$/;
let localPromise = null;
function localPhotos() {
  if (!localPromise) localPromise = (PHOTO_EMBED || location.protocol === "file:") ? Promise.resolve(null)
    : fetch("fotos-1/creditos.json", { credentials: "omit", cache: "no-cache", ...withTimeout(10000) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!isObj(j) || !isObj(j.fotos)) return null;
        const out = dict();
        for (const [pid, e] of Object.entries(j.fotos)) {
          if (!isId(pid) || !isObj(e) || typeof e.f !== "string" || !LOCAL_PATH.test(e.f)) continue;
          // o hash do conteúdo vai na URL, para a foto nova não ficar presa no cache quando o pacote muda
          const v = typeof e.v === "string" && /^[0-9a-f]{8}$/.test(e.v) ? "?v=" + e.v : "";
          out[pid] = { src: e.f + v, file: str(e.file, 200), artist: str(e.a, 120), license: str(e.l, 40), page: pageOf(e.u) };
        }
        return Object.keys(out).length ? out : null;
      }).catch(() => null);
  return localPromise;
}
// foto embutida na cópia offline: só JPEG em data: e os mesmos limites das outras fontes
function embedded(pid) {
  const v = isId(pid) && PHOTO_EMBED[pid];
  if (!isObj(v) || typeof v.src !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.src)) return null;
  return { src: v.src, file: str(v.file, 200), artist: str(v.artist, 120), license: str(v.license, 40), page: pageOf(v.page) };
}
function fetchPhoto(pid) {
  if (PHOTO_EMBED) return Promise.resolve(embedded(pid));
  // foto do próprio site quando existir; se faltar no pacote, busca na Wikipedia
  return localPhotos().then(local => (local && local[pid] ? local[pid] : wikiPhoto(pid)));
}
function wikiPhoto(pid) {
  if (photoMem[pid] !== undefined) return Promise.resolve(photoMem[pid]);
  const c = photoCache[pid];
  if (c && Date.now() - c.t < 14 * 86400e3) { photoMem[pid] = c.v; return Promise.resolve(c.v); }
  return new Promise((resolve, reject) => {
    if (!photoWait.has(pid)) photoWait.set(pid, []);
    photoWait.get(pid).push([resolve, reject]);
    if (!photoTimer) photoTimer = setTimeout(flushPhotos, 40);
  });
}
const wTitle = pid => BY[pid].w.replace(/_/g, " ");
function follow(q) {
  const map = new Map();
  ((q && q.normalized) || []).forEach(n => { map.set(n.from, n.to); });
  ((q && q.redirects) || []).forEach(n => { map.set(n.from, n.to); });
  return t => { let x = t, k = 0; while (map.has(x) && k++ < 5) x = map.get(x); return x; };
}
async function flushPhotos() {
  photoTimer = null;
  const batch = [...photoWait.entries()].slice(0, 50);
  batch.forEach(([pid]) => photoWait.delete(pid));
  if (photoWait.size) photoTimer = setTimeout(flushPhotos, 40);
  const ids = batch.map(b => b[0]);
  try {
    const j = await getJSON(`${API}&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=500&pilicense=free&titles=${encodeURIComponent(ids.map(wTitle).join("|"))}`);
    const q = j.query || {}, fin = follow(q), byT = new Map();
    (q.pages || []).forEach(p => { byT.set(p.title, p); });
    const res = dict();
    for (const pid of ids) {
      const p = byT.get(fin(wTitle(pid)));
      res[pid] = p && !p.missing && p.thumbnail && typeof p.thumbnail.source === "string" && typeof p.pageimage === "string" && IMG_HOST.test(p.thumbnail.source)
        ? { src: p.thumbnail.source.replace(/\?.*$/, ""), file: p.pageimage.slice(0, 200), artist: "", license: "", page: "" } : null;
    }
    const files = [...new Set(Object.values(res).filter(Boolean).map(v => "File:" + v.file))];
    for (let i = 0; i < files.length; i += 25) {
      try {
        const m = await getJSON(`${API}&prop=imageinfo&iiprop=extmetadata|url&iiextmetadatafilter=Artist|LicenseShortName&titles=${encodeURIComponent(files.slice(i, i + 25).join("|"))}`);
        const mq = m.query || {}, mf = follow(mq), meta = new Map();
        (mq.pages || []).forEach(p => { const ii = p.imageinfo && p.imageinfo[0]; if (ii) meta.set(p.title, ii); });
        for (const pid of ids) {
          const v = res[pid]; if (!v) continue;
          const ii = meta.get(mf("File:" + v.file)) || meta.get("File:" + v.file.replace(/_/g, " "));
          if (!ii) continue;
          const em = ii.extmetadata || {};
          v.artist = textOnly(em.Artist && em.Artist.value).slice(0, 120);
          v.license = textOnly(em.LicenseShortName && em.LicenseShortName.value).slice(0, 40);
          v.page = pageOf(ii.descriptionurl);
        }
      } catch (e) { }
    }
    for (const pid of ids) { photoMem[pid] = res[pid]; photoCache[pid] = { t: Date.now(), v: res[pid] }; }
    store.set(PHOTO_KEY, photoCache);
    batch.forEach(([pid, cbs]) => cbs.forEach(([ok]) => ok(res[pid])));
  } catch (e) {
    batch.forEach(([, cbs]) => cbs.forEach(([, bad]) => bad(e)));
  }
}
function newImg(src, alt) {
  const img = new Image();
  img.alt = alt; img.decoding = "async"; img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer";
  img.src = src;
  return img;
}
// troca as iniciais pela foto em todo elemento [data-ph] dentro de root
function hydratePhotos(root) {
  root.querySelectorAll("[data-ph]:not([data-done])").forEach(el => {
    el.dataset.done = "1";
    fetchPhoto(el.dataset.ph).then(v => {
      if (!v || !el.isConnected) return;
      const img = newImg(v.src, "");
      img.loading = "lazy";
      img.onload = () => el.classList.add("has");
      img.onerror = () => img.remove();
      el.appendChild(img);
    }).catch(() => { });
  });
}
const thumb = (p, cls) => `<span class="${cls}" data-ph="${p.id}" aria-hidden="true"><span class="ini">${esc(initials(p.n))}</span></span>`;
/* ---------- cópia com as fotos dentro do arquivo ---------- */
let building = false;
async function imageToCanvas(src, maxW) {
  const r = await fetch(src, { mode: "cors", credentials: "omit" });
  if (!r.ok) throw new Error("http " + r.status);
  const bmp = await createImageBitmap(await r.blob());
  const scale = Math.min(1, maxW / bmp.width), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}
async function imageToJpegBytes(src) {
  const c = await imageToCanvas(src, 480);
  const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("jpeg"))), "image/jpeg", 0.8));
  return new Uint8Array(await blob.arrayBuffer());
}
/* zip simples, sem compressão (fotos JPEG já vêm comprimidas) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((a, b) => a + b.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
// pacote para hospedar as fotos no site: no máximo 100 arquivos por pasta (limite de envio do GitHub pelo navegador)
async function buildPhotoPack() {
  if (building || PHOTO_EMBED) return;
  building = true;
  const btns = document.querySelectorAll("[data-build],[data-pack]"), status = document.querySelectorAll("[data-build-status]");
  const say = t => status.forEach(el => { el.textContent = t; });
  btns.forEach(b => { b.disabled = true; });
  const ids = PEOPLE.map(p => p.id), bytes = {};
  let done = 0, ok = 0, k = 0, netFail = 0;
  say("Buscando a lista de fotos…");
  await Promise.all(ids.map(pid => fetchPhoto(pid).catch(() => null)));
  const worker = async () => {
    while (k < ids.length) {
      const pid = ids[k++];
      try { const v = await fetchPhoto(pid); if (v) { bytes[pid] = { data: await imageToJpegBytes(v.src), v }; ok++; } } catch (e) { netFail++; }
      done++; say(`Baixando fotos: ${done} de ${ids.length}`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (ok < 100) {
    say(netFail ? "Não deu para baixar as fotos. Confira a internet e tente de novo." : "Poucas fotos foram encontradas. Tente de novo mais tarde.");
    btns.forEach(b => { b.disabled = false; }); building = false; return;
  }
  const enc = new TextEncoder(), entries = [], fotos = {};
  for (const pid of ids) {
    if (!bytes[pid]) continue;
    const n = parseInt(pid.slice(1), 10), path = `fotos-${Math.floor((n - 1) / 99) + 1}/${pid}.jpg`, v = bytes[pid].v;
    entries.push({ name: path, data: bytes[pid].data });
    fotos[pid] = { f: path, file: v.file, a: v.artist, l: v.license, n: BY[pid].n };
    if (v.page) fotos[pid].u = v.page;
  }
  const folders = [...new Set(entries.map(e => e.name.split("/")[0]))];
  entries.push({ name: "fotos-1/creditos.json", data: enc.encode(JSON.stringify({ gerado: new Date().toISOString(), fonte: "Wikipedia e Wikimedia Commons", fotos }, null, 1)) });
  const readme = [
    "FAMOSODLE: FOTOS PARA O SITE", "",
    `Este pacote tem ${ok} fotos com licença livre, tiradas da Wikipedia e do Wikimedia Commons, e o arquivo de créditos.`, "",
    "Como usar:",
    `- Coloque as pastas ${folders.join(", ")} na mesma pasta do index.html do Famosodle.`,
    "- Se você usa o projeto completo (a pasta com o CLAUDE.md), coloque as pastas dentro da pasta fotos do projeto e rode npm run build. Lá também existe o comando npm run baixar-fotos, que faz este mesmo pacote sem o navegador.",
    "- No GitHub, envie uma pasta de cada vez, arrastando a pasta inteira para a página de upload. O envio pelo navegador aceita até 100 arquivos por vez, e cada pasta tem no máximo 100.",
    "- Não renomeie as pastas nem os arquivos.",
    "- O arquivo fotos-1/creditos.json guarda o autor e a licença de cada foto. O jogo mostra esses créditos em cada imagem, então mantenha esse arquivo junto com as fotos.",
    "- Se alguma foto faltar, o jogo busca a imagem direto na Wikipedia.", ""
  ].join("\r\n");
  entries.push({ name: "LEIA-ME.txt", data: enc.encode(readme) });
  const zip = makeZip(entries);
  downloadBlob(zip, "famosodle-fotos.zip");
  say(`Pronto: ${ok} fotos em famosodle-fotos.zip (${(zip.size / 1048576).toFixed(1).replace(".", ",")} MB), na sua pasta de downloads.`);
  btns.forEach(b => { b.disabled = false; }); building = false;
}
async function imageToDataUrl(src) {
  const r = await fetch(src, { mode: "cors", credentials: "omit" });
  if (!r.ok) throw new Error("http " + r.status);
  const bmp = await createImageBitmap(await r.blob());
  const scale = Math.min(1, 300 / bmp.width), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}
async function buildOffline() {
  if (building || PHOTO_EMBED) return;
  building = true;
  const btns = document.querySelectorAll("[data-build]"), status = document.querySelectorAll("[data-build-status]");
  const say = t => status.forEach(el => { el.textContent = t; });
  btns.forEach(b => { b.disabled = true; });
  const embed = {}, ids = PEOPLE.map(p => p.id);
  let done = 0, ok = 0, k = 0, netFail = 0;
  say("Buscando a lista de fotos…");
  // pede os dados de todas as fotos de uma vez, em poucos lotes
  await Promise.all(ids.map(pid => fetchPhoto(pid).catch(() => null)));
  const worker = async () => {
    while (k < ids.length) {
      const pid = ids[k++];
      try {
        const v = await fetchPhoto(pid);
        if (v) { embed[pid] = { src: await imageToDataUrl(v.src), file: v.file, artist: v.artist, license: v.license, page: v.page || "" }; ok++; }
      } catch (e) { netFail++; }
      done++;
      say(`Baixando fotos: ${done} de ${ids.length}`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (ok < 100) {
    say(netFail ? "Não deu para baixar as fotos. Confira a internet e tente de novo." : "Poucas fotos foram encontradas. Tente de novo mais tarde.");
    btns.forEach(b => { b.disabled = false; }); building = false; return;
  }
  const json = JSON.stringify(embed).replace(/</g, "\\u003c");
  const html = PRISTINE.replace("const PHOTO_EMBED = null; /*__EMBED__*/", () => `const PHOTO_EMBED = ${json}; /*__EMBED__*/`);
  const blob = new Blob([html], { type: "text/html" });
  downloadBlob(blob, "famosodle-com-fotos.html");
  say(`Pronto: ${ok} fotos no arquivo famosodle-com-fotos.html (${(blob.size / 1048576).toFixed(1).replace(".", ",")} MB), na sua pasta de downloads.`);
  btns.forEach(b => { b.disabled = false; }); building = false;
}
const licensePt = l => (/^public domain$/i.test(l) ? "Domínio público" : /^no restrictions$/i.test(l) ? "Sem restrições" : l);
// crédito da foto; com hidden, mostra só a licença e um botão, porque autor e nome do arquivo podem entregar a resposta
function creditHtml(v, hidden) {
  if (!v) return "";
  const lic = v.license ? esc(licensePt(v.license)) : "";
  if (hidden) return `${lic ? `Licença: ${lic} · ` : ""}<button type="button" class="linkbtn" data-credit-show>ver autor e fonte (pode entregar a resposta)</button>`;
  const link = v.page || (v.file ? `https://en.wikipedia.org/wiki/${encodeURIComponent("File:" + v.file)}` : "");
  const where = link.startsWith("https://commons.") ? "Wikimedia Commons" : "Wikipedia";
  return `${v.artist ? `Foto: ${esc(v.artist)}` : "Foto"}${lic ? " · " + lic : ""}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${where}</a>` : ""}`;
}
const BLUR = [34, 28, 23, 19, 15, 12, 9, 6, 4, 2, 0];
const creditShown = dict(); // figuras cujo crédito completo o jogador pediu para ver no modo Foto

/* ---------- busca com sugestões ---------- */
const searchMode = { classic: () => currentRegion, photo: () => "foto", quote: () => "frase" };
function setupSearch(panel) {
  const inp = $(`#${panel}-input`), list = $(`#${panel}-list`), box = $(`#${panel}-search`), go = $(`#${panel}-go`);
  let items = [], active = -1;
  const close = () => { list.hidden = true; inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); active = -1; };
  // a lista cabe no espaço visível acima do teclado do celular; se faltar espaço, a página sobe um pouco
  function fit() {
    if (list.hidden) return;
    const vv = window.visualViewport, bottom = vv ? vv.offsetTop + vv.height : innerHeight;
    let space = bottom - inp.getBoundingClientRect().bottom - 14;
    if (space < 160) { window.scrollBy(0, Math.max(0, Math.min(160 - space, inp.getBoundingClientRect().top - 12))); space = bottom - inp.getBoundingClientRect().bottom - 14; }
    list.style.maxHeight = Math.max(132, Math.min(330, space)) + "px";
  }
  function paint() {
    if (!items.length) { list.innerHTML = `<li class="empty" role="option" aria-disabled="true" aria-selected="false">Ninguém com esse nome nesta lista</li>`; return; }
    list.innerHTML = items.map((p, i) => `<li role="option" id="${panel}-opt-${i}" data-id="${p.id}" aria-selected="${i === active}">${flag(p)}${esc(p.n)}<small>${esc(AREA[p.a[0]])}</small></li>`).join("");
    if (active >= 0) { inp.setAttribute("aria-activedescendant", `${panel}-opt-${active}`); const el = list.children[active]; if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); }
  }
  function update() {
    const q = norm(inp.value);
    if (!q) { close(); items = []; return; }
    const id = searchMode[panel](), used = new Set(game(id).guesses), res = [];
    for (const pid of GUESSABLE[id]) {
      if (used.has(pid)) continue;
      const p = BY[pid];
      let best = 9;
      for (const k of p.k) {
        if (k === q) best = -1;
        else if (k.startsWith(q)) best = Math.min(best, k === p.k[0] ? 0 : 1);
        else if (k.split(" ").some(w => w.startsWith(q))) best = Math.min(best, 2);
        else if (q.length > 2 && k.includes(q)) best = Math.min(best, 3);
      }
      if (best < 9) res.push([best, p]);
    }
    res.sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n, "pt"));
    items = res.slice(0, 8).map(r => r[1]);
    active = items.length ? 0 : -1;
    list.hidden = false; inp.setAttribute("aria-expanded", "true");
    paint(); fit();
  }
  function shake() { box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); }
  function pick(pid) {
    inp.value = ""; close(); items = [];
    const id = searchMode[panel]();
    if (!guess(id, pid)) { shake(); return; }
    if (!game(id).done) inp.focus();
  }
  function submit() {
    if (!inp.value.trim()) { shake(); return; }
    update();
    const q = norm(inp.value), id = searchMode[panel](), used = game(id).guesses;
    const exact = GUESSABLE[id].map(x => BY[x]).find(p => !used.includes(p.id) && p.k.includes(q));
    if (active >= 0 && items[active]) pick(items[active].id);
    else if (exact) pick(exact.id);
    else shake();
  }
  inp.addEventListener("input", update);
  inp.addEventListener("focus", () => { if (inp.value) update(); });
  inp.addEventListener("blur", () => setTimeout(close, 120));
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && items.length) { e.preventDefault(); if (list.hidden) update(); active = (active + 1) % items.length; paint(); }
    else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Escape") close();
  });
  // mousedown só segura o foco no campo; a escolha acontece no click, que também chega de leitores de tela
  list.addEventListener("mousedown", e => e.preventDefault());
  list.addEventListener("click", e => { const li = e.target.closest("li[data-id]"); if (li && !list.hidden) pick(li.dataset.id); });
  go.addEventListener("click", submit);
  if (window.visualViewport) visualViewport.addEventListener("resize", fit);
}

/* ---------- dicas ---------- */
function hintDefs(id) {
  if (MODE[id].kind === "classic") return [{ k: "h1", label: "Ocupação", at: 5, val: t => t.h1 }, { k: "h2", label: "Feito", at: 10, val: t => t.h2 }];
  return [{ k: "h1", label: "Dica 1", at: 5, val: t => `${ctryName(t.c)} · ${t.h1}` }, { k: "h2", label: "Dica 2", at: 10, val: t => t.h2 }];
}
function renderHints(id) {
  const panel = PANEL[MODE[id].kind], g = game(id), box = $(`#${panel}-hints`);
  const t = BY[g.target], wrong = wrongCount(g);
  box.innerHTML = hintDefs(id).map(h => {
    if (g.done || g.hints.includes(h.k)) return `<span class="hint open"><b>${h.label}</b><span class="val">${esc(h.val(t))}</span></span>`;
    const left = h.at - wrong;
    if (left > 0) return `<button type="button" class="hint" disabled><b>${h.label}</b>libera em ${left} ${left === 1 ? "erro" : "erros"}</button>`;
    return `<button type="button" class="hint ready" data-h="${h.k}"><b>${h.label}</b>ver dica</button>`;
  }).join("");
}
function openHint(id, k) {
  const g = game(id);
  if (!g.hints.includes(k)) g.hints.push(k);
  if (!P[id]) save();
  renderHints(id);
  const h = hintDefs(id).find(x => x.k === k), b = $(`#${PANEL[MODE[id].kind]}-hints .hint.open:nth-child(${k === "h1" ? 1 : 2})`);
  if (h) announce(`${h.label}: ${h.val(BY[g.target])}`);
  if (b) { b.tabIndex = -1; b.focus(); }
}

/* ---------- renderização ---------- */
function renderMeta(id) {
  const m = MODE[id], panel = PANEL[m.kind], g = game(id);
  const meta = $(`#${panel}-meta`), date = $(`#${panel}-date`);
  if (P[id]) { meta.innerHTML = `<span class="tag">Treino</span> · figura aleatória`; date.textContent = `${g.guesses.length} ${g.guesses.length === 1 ? "palpite" : "palpites"}`; }
  else { meta.textContent = `Ficha nº ${dayIdx(today) + 1}${m.kind === "classic" ? " · " + m.label : ""}`; date.textContent = dateLabel(today); }
  const inp = $(`#${panel}-input`);
  inp.disabled = g.done; $(`#${panel}-go`).disabled = g.done;
  inp.placeholder = g.done ? "Resolvido. Veja a ficha abaixo." : "Digite um nome";
  $(`#${panel}-reveal`).hidden = !(P[id] && !g.done);
  if (m.kind === "classic") $("#classic-title").textContent = m.cont ? `Quem é a figura de hoje da ${m.label}?` : "Quem é a figura de hoje?";
}
function renderRegions() {
  $("#regions").innerHTML = MODES.filter(m => m.kind === "classic").map(m => {
    const solved = S.games[m.id] && S.games[m.id].done;
    return `<button type="button" data-region="${m.id}" aria-pressed="${m.id === currentRegion}">${solved ? `<span class="ck" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2.5 6.3l2.2 2.2 4.8-5"/></svg></span>` : ""}${m.label}${solved ? `<span class="sr">, resolvido</span>` : ""}</button>`;
  }).join("");
}
function renderClassic(id, animate) {
  const g = game(id), t = BY[g.target], board = $("#classic-board");
  const heads = `<div class="row heads" role="row">${HEADS.map(h => `<div role="columnheader">${h}</div>`).join("")}</div>`;
  $("#classic-empty").hidden = g.guesses.length > 0;
  board.innerHTML = heads + g.guesses.slice().reverse().map((pid, ri) => `<div class="row${animate && ri === 0 ? " anim" : ""}" role="row">${compare(BY[pid], t, id).map(tileHtml).join("")}</div>`).join("");
  hydratePhotos(board);
}
function renderGuessList(id, animate) {
  const panel = PANEL[MODE[id].kind], g = game(id), t = BY[g.target];
  $(`#${panel}-guesses`).innerHTML = g.guesses.slice().reverse().map((pid, i) => {
    const p = BY[pid], cls = (pid === t.id ? "win" : "") + (animate && i === 0 ? " anim" : "");
    const tags = pid === t.id ? [["ok", "Acertou"]] : miniTags(p, t);
    return `<li class="${cls.trim()}"><span class="nm">${thumb(p, "th")}${flag(p)}${esc(p.n)}</span><span class="tags">${tags.map(([s, txt]) => `<span class="${s}">${esc(txt)}</span>`).join("")}</span></li>`;
  }).join("");
  hydratePhotos($(`#${panel}-guesses`));
}
function renderPhoto(id) {
  const g = game(id), pid = g.target, img = $("#photo-img"), state = $("#photo-state"), tag = $("#photo-blur"), credit = $("#photo-credit");
  fetchPhoto(pid).then(v => {
    const cur = game(id);
    if (cur.target !== pid) return;
    if (!v) { img.hidden = true; img.removeAttribute("src"); delete img.dataset.src; state.hidden = false; state.textContent = "Esta figura não tem retrato livre. Use as dicas."; tag.hidden = true; credit.textContent = ""; return; }
    const blur = cur.done ? 0 : BLUR[Math.min(wrongCount(cur), BLUR.length - 1)];
    img.style.filter = blur ? `blur(${blur}px)` : "none";
    if (img.dataset.src !== v.src) {
      img.hidden = true; state.hidden = false; state.textContent = "Carregando o retrato…";
      img.onload = () => { img.hidden = false; state.hidden = true; };
      img.onerror = () => { state.textContent = "Não deu para carregar a imagem."; };
      img.dataset.src = v.src; img.src = v.src;
    } else if (img.complete && img.naturalWidth) { img.hidden = false; state.hidden = true; }
    tag.hidden = !blur; tag.textContent = `desfoque ${blur}`;
    credit.innerHTML = creditHtml(v, !cur.done && !creditShown[pid]);
  }).catch(() => { state.hidden = false; img.hidden = true; state.textContent = "Não deu para carregar o retrato. Confira a conexão."; });
}
function renderQuote(id) {
  $("#quote-text").textContent = BY[game(id).target].q;
}
function renderResult(id) {
  const m = MODE[id], panel = PANEL[m.kind], g = game(id), box = $(`#${panel}-result`);
  if (!g.done) { box.hidden = true; box.innerHTML = ""; return; }
  const t = BY[g.target], n = g.guesses.length;
  const actions = P[id]
    ? `<button type="button" class="btn primary" data-act="practice">Nova figura aleatória</button><button type="button" class="btn" data-act="daily">Voltar à figura do dia</button>`
    : `<button type="button" class="btn primary" data-act="share">Copiar resultado</button><button type="button" class="btn" data-act="practice">Treinar com figura aleatória</button><span class="countdown">Próxima figura em <b data-cd>--:--:--</b></span>`;
  box.innerHTML = `
    <div class="left"><div class="frame" data-photo="${t.id}"><div class="canvas"><div class="state" aria-hidden="true">${esc(initials(t.n))}</div></div></div><p class="credit" data-credit="${t.id}"></p></div>
    <div class="right">
      <div class="kicker">${g.gaveUp ? "Resposta revelada" : `Encontrada em ${n} ${n === 1 ? "palpite" : "palpites"}`}</div>
      <h3 class="disp" tabindex="-1">${esc(t.n)}</h3>
      <div class="life">${flag(t)} ${esc(ctryName(t.c))} · ${esc(areasTxt(t))} · ${esc(lifeSpan(t))}</div>
      <p class="what">${esc(t.h1)}. ${esc(t.h2)}.</p>
      ${t.q && m.kind !== "quote" ? `<p class="said">“${esc(t.q)}”</p>` : ""}
    </div>
    <div class="actions">${actions}</div>`;
  box.hidden = false;
  if (freshAnim[id]) {
    box.classList.remove("fresh"); void box.offsetWidth; box.classList.add("fresh"); freshAnim[id] = false;
    // leva o foco ao nome da figura, para quem joga pelo teclado ou com leitor de tela não ficar perdido
    box.querySelector("h3").focus();
  } else box.classList.remove("fresh");
  fetchPhoto(t.id).then(v => {
    if (!v) return;
    const fr = box.querySelector(`[data-photo="${t.id}"] .canvas`), cr = box.querySelector(`[data-credit="${t.id}"]`);
    if (!fr) return;
    const img = newImg(v.src, `Retrato de ${t.n}`);
    img.width = 400; img.height = 500;
    img.onload = () => { fr.textContent = ""; fr.appendChild(img); };
    if (cr) cr.innerHTML = creditHtml(v);
  }).catch(() => { });
  tick();
}
function renderYesterday(id) {
  const el = $(`#${PANEL[MODE[id].kind]}-yesterday`), key = spKey(-1);
  if (dayIdx(key) < 0) { el.textContent = ""; return; }
  const y = BY[answer(id, key)];
  el.innerHTML = `A figura de ontem foi ${flag(y)} <b>${esc(y.n)}</b>`;
}
function render(id, animate = false) {
  const m = MODE[id];
  if (m.kind === "classic" && id !== currentRegion) return;
  renderMeta(id);
  renderHints(id);
  if (m.kind === "classic") { renderRegions(); renderClassic(id, animate); }
  else renderGuessList(id, animate);
  if (m.kind === "photo") renderPhoto(id);
  if (m.kind === "quote") renderQuote(id);
  const g = game(id);
  const delay = animate && g.done ? (m.kind === "classic" ? 1000 : 400) : 0;
  clearTimeout(resultTimer[id]);
  // o cartão do resultado espera a animação; se o jogador trocar de modo nesse meio tempo, ele não aparece no lugar errado
  if (delay) { $(`#${PANEL[m.kind]}-result`).hidden = true; resultTimer[id] = setTimeout(() => { if (activeMode() === id) renderResult(id); }, delay); }
  else renderResult(id);
  renderYesterday(id);
}

/* ---------- compartilhar ---------- */
const shareUrl = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/[^/]*$/, "") : SITE);
function shareText(id) {
  const m = MODE[id], g = S.games[id], n = g.guesses.length, t = BY[g.target];
  let s = `Famosodle nº ${dayIdx(today) + 1} · ${m.kind === "classic" ? "Clássico " + m.label : m.label}\nAcertei em ${n} ${n === 1 ? "palpite" : "palpites"}\n`;
  if (m.kind === "classic") {
    const rows = g.guesses.map(pid => shareRow(compare(BY[pid], t, id)));
    if (rows.length > 6) s += `+${rows.length - 6} linhas\n`;
    s += rows.slice(-6).join("\n");
  } else s += g.guesses.map(pid => pid === t.id ? "🟩" : BY[pid].c === t.c ? "🟨" : "🟥").join("");
  return s + "\n" + shareUrl();
}
function copyShare(id) {
  const text = shareText(id), panel = PANEL[MODE[id].kind];
  const fallback = () => {
    let ta = $(`#${panel}-result .copybox`);
    if (!ta) { ta = document.createElement("textarea"); ta.className = "copybox"; ta.readOnly = true; ta.id = `${panel}-copybox`; ta.setAttribute("aria-label", "Resultado para copiar"); $(`#${panel}-result`).appendChild(ta); }
    ta.value = text; ta.focus(); ta.select(); toast("Selecionado. Copie com Ctrl+C ou toque e segure.");
  };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("Resultado copiado"), fallback); else fallback(); }
  catch (e) { fallback(); }
}
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400); announce(msg); }

/* ---------- treino ---------- */
function shuffle(list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startPractice(id) {
  const avoid = new Set([S.games[id].target, P[id] && P[id].target]);
  const pool = POOL[id].filter(x => !avoid.has(x));
  P[id] = { target: shuffle(pool.length ? pool : POOL[id])[0], guesses: [], done: false, hints: [] };
  render(id);
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  $(`#${PANEL[MODE[id].kind]}-input`).focus({ preventScroll: true });
}
function backToDaily(id) { delete P[id]; render(id); $(`#${PANEL[MODE[id].kind]}-input`).focus({ preventScroll: true }); }
function revealPractice(id) { const g = P[id]; if (!g || g.done) return; g.gaveUp = true; g.done = true; freshAnim[id] = true; render(id); announce(`Resposta revelada: ${BY[g.target].n}.`); }

/* ---------- abas e diálogos ---------- */
function activeMode() { return currentKind === "classic" ? currentRegion : currentKind === "photo" ? "foto" : "frase"; }
function saveUi() { try { localStorage.setItem(KEY + ":ui", JSON.stringify({ k: currentKind, r: currentRegion })); } catch (e) { } }
function setKind(k, focusTab) {
  currentKind = k;
  for (const x of KINDS) {
    const tab = $(`#tab-${x}`);
    $(`#panel-${x}`).hidden = x !== k;
    tab.setAttribute("aria-selected", String(x === k));
    tab.tabIndex = x === k ? 0 : -1;
  }
  if (focusTab) $(`#tab-${k}`).focus();
  saveUi();
  render(activeMode());
}
function setRegion(r) {
  if (!MODE[r] || MODE[r].kind !== "classic") return;
  currentRegion = r;
  const inp = $("#classic-input"); inp.value = ""; $("#classic-list").hidden = true;
  saveUi();
  render(r);
}
function openDlg(d) {
  if (d.open) return;
  const opener = document.activeElement;
  // devolve o foco a quem abriu o diálogo, em todos os navegadores
  d.addEventListener("close", () => { if (opener && opener !== document.body && opener.isConnected) opener.focus(); }, { once: true });
  if (d.showModal) { try { d.showModal(); return; } catch (e) { } }
  d.setAttribute("open", "");
}
function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute("open"); }
function renderStats() {
  const rows = MODES.map(m => {
    const st = S.stats[m.id];
    const cur = (st.lastKey === today || st.lastKey === spKey(-1)) ? st.cur : 0;
    const total = Object.entries(st.dist).reduce((a, [k, v]) => a + (k === "15+" ? 15 : +k) * v, 0);
    const avg = st.won ? (total / st.won).toFixed(1).replace(".", ",") : "0";
    return `<tr><td>${m.kind === "classic" ? "Clássico " + m.label : m.label}</td><td>${st.played}</td><td>${st.won}</td><td>${cur}</td><td>${st.best}</td><td>${avg}</td></tr>`;
  }).join("");
  $("#stats-table").innerHTML = `<thead><tr><th scope="col">Modo</th><th scope="col">Jogos</th><th scope="col">Acertos</th><th scope="col">Sequência</th><th scope="col">Recorde</th><th scope="col">Média</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ---------- relógio ---------- */
function tick() {
  if (spKey() !== today) { loadDaily(); render(activeMode()); }
  const ms = msToMidnight();
  const h = Math.floor(ms / 3600e3), mi = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1e3);
  const txt = [h, mi, s].map(v => String(v).padStart(2, "0")).join(":");
  document.querySelectorAll("[data-cd]").forEach(el => { el.textContent = txt; });
}

/* ---------- início ---------- */
function start() {
  loadDaily();
  try { const ui = JSON.parse(localStorage.getItem(KEY + ":ui")) || {}; if (KINDS.includes(ui.k)) currentKind = ui.k; if (typeof ui.r === "string" && MODE[ui.r] && MODE[ui.r].kind === "classic") currentRegion = ui.r; } catch (e) { }
  for (const panel of KINDS) {
    setupSearch(panel);
    $(`#${panel}-hints`).addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (b) openHint(searchMode[panel](), b.dataset.h); });
    $(`#${panel}-result`).addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const id = searchMode[panel](), a = b.dataset.act;
      if (a === "share") copyShare(id); else if (a === "practice") startPractice(id); else if (a === "daily") backToDaily(id);
    });
    $(`#${panel}-reveal`).addEventListener("click", () => revealPractice(searchMode[panel]()));
    $(`#tab-${panel}`).addEventListener("click", () => setKind(panel));
  }
  // teclado nas abas, como no padrão de abas: setas, Home e End
  $(".kinds").addEventListener("keydown", e => {
    const i = KINDS.indexOf(currentKind);
    let n;
    switch (e.key) { case "ArrowRight": n = i + 1; break; case "ArrowLeft": n = i - 1; break; case "Home": n = 0; break; case "End": n = KINDS.length - 1; break; default: return; }
    e.preventDefault();
    setKind(KINDS[(n + KINDS.length) % KINDS.length], true);
  });
  $("#photo-credit").addEventListener("click", e => { if (e.target.closest("[data-credit-show]")) { creditShown[game("foto").target] = true; renderPhoto("foto"); } });
  $("#regions").addEventListener("click", e => { const b = e.target.closest("[data-region]"); if (b) setRegion(b.dataset.region); });
  $("#btn-help").addEventListener("click", () => openDlg($("#dlg-help")));
  $("#btn-stats").addEventListener("click", () => { renderStats(); openDlg($("#dlg-stats")); });
  $("#btn-credits").addEventListener("click", () => openDlg($("#dlg-credits")));
  const canBuild = !PHOTO_EMBED && PRISTINE.includes("/*__EMBED__*/");
  document.querySelectorAll("[data-build]").forEach(b => { b.hidden = !canBuild; if (canBuild) b.addEventListener("click", buildOffline); });
  document.querySelectorAll("[data-pack]").forEach(b => { b.hidden = !canBuild; if (canBuild) b.addEventListener("click", buildPhotoPack); });
  if (!canBuild && !PHOTO_EMBED) document.querySelectorAll("[data-build-wrap]").forEach(el => { el.hidden = true; });
  document.querySelectorAll("[data-offline-note]").forEach(el => { el.hidden = !PHOTO_EMBED; if (PHOTO_EMBED) el.textContent = `Este arquivo já tem ${Object.keys(PHOTO_EMBED).length} fotos dentro e funciona sem internet.`; });
  if (PHOTO_EMBED) document.querySelectorAll("[data-online-note]").forEach(el => { el.hidden = true; });
  document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) closeDlg(d); }));
  $("#foot-count").textContent = `${PEOPLE.length} figuras · ${Object.keys(CTRY).length} países · ${MODES.length} modos`;
  setKind(currentKind);
  setInterval(tick, 1000); tick();
  // a aba volta do segundo plano: confere a virada do dia na hora
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  // outra aba salvou progresso: recarrega para uma não apagar o que a outra fez
  window.addEventListener("storage", e => { if (e.key === KEY) { S = readState(); loadDaily(); render(activeMode()); } });
  try { if (!localStorage.getItem(KEY + ":help")) { localStorage.setItem(KEY + ":help", "1"); openDlg($("#dlg-help")); } } catch (e) { }
}
start();

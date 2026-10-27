// Gera dados/data.json a partir de dados/figuras.txt, dados/figuras-extra.txt, da base de países,
// do pacote de fotos (fotos/fotos-1/creditos.json), que define quem entra no modo Foto,
// e das bandeiras (bandeiras/creditos.json), que dá o tamanho de cada imagem.
const fs = require("fs");
const path = require("path");
const wc = require("world-countries");
const cc = require("@rapideditor/country-coder");

const nomeBR = { NL: "Países Baixos", PL: "Polônia", PS: "Palestina", IR: "Irã", KE: "Quênia", VN: "Vietnã", SG: "Cingapura", CZ: "Tchéquia", RO: "Romênia", TW: "Taiwan", PE: "Peru", ZW: "Zimbábue", MM: "Mianmar", UA: "Ucrânia", KR: "Coreia do Sul", RW: "Ruanda", HU: "Hungria", HR: "Croácia", GW: "Guiné-Bissau", MZ: "Moçambique", SE: "Suécia", CH: "Suíça", IE: "Irlanda", NI: "Nicarágua", HT: "Haiti", MC: "Mônaco", SI: "Eslovênia" };
const contBR = { Africa: "África", Americas: "América", Asia: "Ásia", Europe: "Europa", Oceania: "Oceania" };
const contId = { Africa: "af", Americas: "am", Asia: "as", Europe: "eu", Oceania: "oc" };
const AREAS = ["pol", "cie", "art", "mus", "lit", "esp", "ati", "exp", "mil", "fil", "neg", "cin", "rel"];
const TRAVESSAO = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const ANO = /^~?-?\d{1,4}$/;
const ANO_ATUAL = new Date().getUTCFullYear();
const FRASE_MAX = 140;
// mesmo formato que o jogo aceita para as fotos do próprio site
const LOCAL_PATH = /^fotos-\d\/p\d{3}\.jpg$/;

const year = s => {
  if (s === "-") return { y: null, c: 0 };
  if (!ANO.test(s)) throw new Error("ano inválido " + s);
  return { y: parseInt(s.replace("~", ""), 10), c: s.startsWith("~") ? 1 : 0 };
};
const strip = s => s.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ALIAS = {
  "Napoleão Bonaparte": ["Napoleon"], "Júlio César": ["Julio Cesar", "Julius Caesar"], "Galileu Galilei": ["Galileo"],
  "Joana d'Arc": ["Joana Darc", "Joan of Arc"], "Rainha Vitória": ["Victoria"], "Cristóvão Colombo": ["Colombo", "Columbus"],
  "Martinho Lutero": ["Martin Luther", "Lutero"], "Fernão de Magalhães": ["Magalhaes", "Magellan"], "Princesa Diana": ["Diana", "Lady Di"],
  "Martin Luther King Jr.": ["MLK", "Luther King"], "John F. Kennedy": ["JFK", "Kennedy"], "Dom Pedro I": ["Pedro I"],
  "Santos Dumont": ["Alberto Santos Dumont"], "Zumbi dos Palmares": ["Zumbi"], "Che Guevara": ["Ernesto Guevara"], "Eva Perón": ["Evita"],
  "Cleópatra": ["Cleopatra"], "Tutancâmon": ["Tutankhamon", "Tutankamon"], "Ramsés II": ["Ramses"], "Shaka Zulu": ["Shaka"],
  "Muammar Kadafi": ["Gaddafi", "Khadafi"], "Aníbal": ["Hannibal", "Anibal Barca"], "Santo Agostinho": ["Agostinho", "Augustine"],
  "Mao Tsé-tung": ["Mao Zedong", "Mao"], "Confúcio": ["Confucius"], "Gengis Khan": ["Genghis Khan", "Chinggis Khan"],
  "Kim Jong-un": ["Kim Jong Un"], "Kim Il-sung": ["Kim Il Sung"], "Mustafa Kemal Atatürk": ["Ataturk"], "Solimão, o Magnífico": ["Suleiman", "Soleiman"],
  "Ciro, o Grande": ["Cyrus"], "Ruhollah Khomeini": ["Aiatola Khomeini", "Khomeini"], "Mahatma Gandhi": ["Gandhi"],
  "Alexandre, o Grande": ["Alexandre Magno", "Alexander"], "Don Bradman": ["Donald Bradman"], "Pelé": ["Edson Arantes do Nascimento"],
  "Sócrates": ["Socrates"], "Aristóteles": ["Aristoteles"], "Elizabeth II": ["Rainha Elizabeth", "Isabel II"],
  "Luiz Inácio Lula da Silva": ["Lula"], "Dilma Rousseff": ["Dilma"], "João Goulart": ["Jango"], "Fernando Henrique Cardoso": ["FHC"],
  "Juscelino Kubitschek": ["JK"], "Castelo Branco": ["Humberto Castelo Branco"], "Ronaldo Fenômeno": ["Ronaldo Nazario"], "Gustavo Kuerten": ["Guga"],
  "Duque de Caxias": ["Caxias", "Luis Alves de Lima e Silva"], "Dom Pedro II": ["Pedro II"], "Tom Jobim": ["Antonio Carlos Jobim"],
  "Franklin D. Roosevelt": ["FDR"], "Andrés Manuel López Obrador": ["AMLO"], "José Mujica": ["Pepe Mujica"], "Papa Francisco": ["Bergoglio", "Pope Francis"],
  "Papa João Paulo II": ["Karol Wojtyla"], "Papa Bento XVI": ["Bento XVI", "Ratzinger"], "Leon Trotsky": ["Trotski", "Leon Trotski"],
  "Rosa Luxemburgo": ["Rosa Luxemburg"], "Nicolau Maquiavel": ["Machiavelli", "Maquiavel"], "Liev Tolstói": ["Tolstoi", "Leo Tolstoy"],
  "Fiódor Dostoiévski": ["Dostoievski", "Dostoevsky"], "Piotr Tchaikovsky": ["Tchaikovski", "Tchaikovsky"], "Dmitri Mendeleiev": ["Mendeleev"],
  "Nicolau Copérnico": ["Copernico", "Copernicus"], "Volodymyr Zelensky": ["Zelenski", "Zelenskyy"], "Catarina, a Grande": ["Catarina II"],
  "Pedro, o Grande": ["Pedro I da Russia"], "Luís XIV": ["Rei Sol", "Luis 14"], "Henrique VIII": ["Henrique 8"], "Josip Broz Tito": ["Tito"],
  "Frederik de Klerk": ["F W de Klerk", "de Klerk"], "Chiang Kai-shek": ["Chiang Kai shek"], "Park Chung-hee": ["Park Chung hee"], "Ban Ki-moon": ["Ban Ki moon"],
  "Cristina Kirchner": ["Cristina Fernandez de Kirchner"], "Charles de Gaulle": ["De Gaulle"], "Grigori Rasputin": ["Rasputin"],
  "Josef Stálin": ["Stalin", "Joseph Stalin", "Estaline"], "Nikita Kruschev": ["Khrushchev", "Kruschov", "Krushchev"], "Ronaldinho": ["Ronaldinho Gaucho"],
  "Vinícius Júnior": ["Vini Jr", "Vinicius Jr"], "Mário Zagallo": ["Zagalo"], "Shaquille O'Neal": ["Shaq"], "Magic Johnson": ["Earvin Johnson"],
  "Dwayne Johnson": ["The Rock"], "Stephen Curry": ["Steph Curry"], "Pep Guardiola": ["Josep Guardiola"], "Alex Ferguson": ["Sir Alex Ferguson"],
  "Hortência": ["Hortencia Marcari"], "Oscar Schmidt": ["Mao Santa"], "Rubens Barrichello": ["Rubinho"], "Shah Rukh Khan": ["SRK"],
  "Cantinflas": ["Mario Moreno"], "Zlatan Ibrahimović": ["Ibra"], "Lev Yashin": ["Lev Iashin", "Aranha Negra"],
};

const ROOT = path.join(__dirname, "..");
const DADOS = path.join(ROOT, "dados");
// lê um texto sem a marca de UTF-8 (BOM) que alguns editores, como o Bloco de Notas, põem no começo do arquivo
const BOM = String.fromCharCode(0xfeff);
const lerTexto = f => fs.readFileSync(f, "utf8").replace(new RegExp("^" + BOM), "");
const lines = ["figuras.txt", "figuras-extra.txt"].map(f => lerTexto(path.join(DADOS, f))).join("\n").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
const errs = [], avisos = [];
const countries = {};
const people = lines.map((l, i) => {
  const p = l.split("|");
  if (p.length !== 10) errs.push("colunas " + l);
  const [n, w, g, c, ar, b, d, h1, h2, q] = p;
  if (p.some(x => x !== x.trim())) errs.push("espaço sobrando no começo ou no fim de um campo " + n);
  const C = wc.find(x => x.cca2 === c);
  if (!C) { errs.push("país " + c + " " + n); return null; }
  const areas = ar.split(",");
  areas.forEach(a => { if (!AREAS.includes(a)) errs.push("área " + a + " " + n); });
  if (!["M", "F"].includes(g)) errs.push("gênero " + n);
  if (!/^[^\s|]+$/.test(w || "")) errs.push("título da Wikipedia " + n);
  if (!h1 || !h2) errs.push("dica vazia " + n);
  if (q && q.length > FRASE_MAX) errs.push(`frase com mais de ${FRASE_MAX} caracteres ` + n);
  let B, Dd;
  try { B = year(b); Dd = year(d); } catch (e) { errs.push(e.message + " " + n); return null; }
  if (B.y === null) errs.push("nascimento vazio " + n);
  if (Dd.y !== null && Dd.y <= B.y) errs.push("datas " + n);
  if (B.y > ANO_ATUAL || (Dd.y || 0) > ANO_ATUAL) errs.push("ano no futuro " + n);
  if (Dd.y === null && ANO_ATUAL - B.y > 105) avisos.push(`${n} está como viva e teria ${ANO_ATUAL - B.y} anos`);
  if (TRAVESSAO.test(l)) errs.push("travessão " + n);
  if (!countries[c]) {
    countries[c] = {
      n: nomeBR[c] || C.translations.por.common,
      f: cc.emojiFlag(c),
      ct: contId[C.region],
      b: (C.borders || []).map(b3 => (wc.find(y => y.cca3 === b3) || {}).cca2).filter(Boolean),
    };
  }
  const id = "p" + String(i + 1).padStart(3, "0");
  const k = [...new Set([n, ...(ALIAS[n] || [])].map(strip))];
  return { id, n, w, g, c, a: areas, b: B.y, bc: B.c, d: Dd.y, dc: Dd.c, h1, h2, q: q || "", k };
}).filter(Boolean);

const names = new Set(), titulos = new Set(), chaves = new Map();
people.forEach(p => {
  if (names.has(p.n)) errs.push("duplicado " + p.n);
  if (titulos.has(p.w)) errs.push("título da Wikipedia repetido " + p.w);
  names.add(p.n); titulos.add(p.w);
});
Object.keys(ALIAS).forEach(n => { if (!names.has(n)) errs.push("apelido para figura que não existe: " + n); });
// um apelido não pode ser igual ao nome ou apelido de outra figura
people.forEach(p => p.k.forEach(k => { if (chaves.has(k) && chaves.get(k) !== p.n) errs.push(`"${k}" serve para ${chaves.get(k)} e ${p.n}`); chaves.set(k, p.n); }));

// quem tem foto no pacote do site entra no modo Foto (ph: 1); assim a resposta do dia não depende da rede
const creditos = path.join(ROOT, "fotos", "fotos-1", "creditos.json");
let comFoto = 0;
if (fs.existsSync(creditos)) {
  const fotos = (JSON.parse(fs.readFileSync(creditos, "utf8")) || {}).fotos || {};
  people.forEach(p => {
    const e = Object.prototype.hasOwnProperty.call(fotos, p.id) && fotos[p.id];
    if (e && typeof e.f === "string" && LOCAL_PATH.test(e.f) && fs.existsSync(path.join(ROOT, "fotos", e.f))) { p.ph = 1; comFoto++; }
  });
} else avisos.push("sem fotos/fotos-1/creditos.json: o modo Foto vai sortear entre todas as figuras e buscar as imagens na Wikipedia");

// países com bandeira em imagem ganham fl: [largura, altura]; os outros ficam com o emoji
const credBandeiras = path.join(ROOT, "bandeiras", "creditos.json");
let comBandeira = 0;
if (fs.existsSync(credBandeiras)) {
  const bandeiras = (JSON.parse(fs.readFileSync(credBandeiras, "utf8")) || {}).bandeiras || {};
  Object.keys(countries).forEach(c => {
    const e = Object.prototype.hasOwnProperty.call(bandeiras, c) && bandeiras[c];
    if (e && e.f === c.toLowerCase() + ".png" && Number.isInteger(e.w) && Number.isInteger(e.h) && e.w > 0 && e.h > 0 && fs.existsSync(path.join(ROOT, "bandeiras", e.f))) {
      countries[c].fl = [e.w, e.h]; comBandeira++;
    }
  });
}
if (comBandeira < Object.keys(countries).length) avisos.push(`${Object.keys(countries).length - comBandeira} países sem bandeira em imagem (rode npm run baixar-bandeiras); o jogo mostra o emoji`);

// fama de cada figura do ponto de vista de quem joga no Brasil: 1 Iniciante, 2 Fácil, 3 Médio, 4 Difícil
const famaArq = path.join(DADOS, "fama.txt"), fama = new Map();
if (!fs.existsSync(famaArq)) errs.push("falta dados/fama.txt");
else {
  lerTexto(famaArq).split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#")).forEach(l => {
    const [n, nv, ...resto] = l.split("|");
    if (nv === undefined || resto.length) { errs.push("linha inválida em fama.txt (use nome|nível): " + l); return; }
    if (fama.has(n)) errs.push("nome repetido em fama.txt: " + n);
    if (!/^[1-4]$/.test(nv)) errs.push("nível fora de 1 a 4 em fama.txt: " + l);
    if (!names.has(n)) errs.push("nome em fama.txt que não é de nenhuma figura: " + n);
    fama.set(n, Number(nv));
  });
  people.forEach(p => { if (!fama.has(p.n)) errs.push("figura sem nível em fama.txt: " + p.n); });
}
// visitas de 12 meses na Wikipedia (dados/visitas.json, gerado por npm run visitas): desempate dentro do mesmo nível de fama
const visArq = path.join(DADOS, "visitas.json"), vis = new Map();
if (fs.existsSync(visArq)) {
  for (const [n, e] of Object.entries((JSON.parse(fs.readFileSync(visArq, "utf8")) || {}).visitas || {})) if (e && Number.isFinite(e.v)) vis.set(n, e.v);
} else avisos.push("sem dados/visitas.json: dentro de cada nível de fama vale a ordem dos ids (rode npm run visitas)");

if (errs.length) { console.log(errs); process.exit(1); }
avisos.forEach(a => console.log("aviso:", a));

/* ---------- níveis de dificuldade ---------- */
// cada modo divide as figuras que podem ser resposta em 4 faixas sem repetição. As faixas seguem a fama; em modos
// pequenos, cada faixa tem pelo menos MIN figuras, então os níveis viram relativos (Iniciante na África são os africanos
// mais famosos). Mesma definição de modo que o jogo usa em src/app.js.
const NIVEIS = ["Iniciante", "Fácil", "Médio", "Difícil"];
const MODOS = {
  g: ["Global", () => true], af: ["África", p => countries[p.c].ct === "af"], am: ["América", p => countries[p.c].ct === "am"],
  as: ["Ásia", p => countries[p.c].ct === "as"], eu: ["Europa", p => countries[p.c].ct === "eu"], oc: ["Oceania", p => countries[p.c].ct === "oc"],
  foto: ["Foto", p => p.ph || !comFoto], frase: ["Frase", p => !!p.q]
};
function faixas(lista) {
  // mais famoso primeiro: nível de fama, depois mais visitas (quem não tem visitas vai para o fim do nível), depois id
  const ord = lista.slice().sort((a, b) => fama.get(a.n) - fama.get(b.n) || vis.has(b.n) - vis.has(a.n) || (vis.get(b.n) || 0) - (vis.get(a.n) || 0) || a.id.localeCompare(b.id));
  const N = ord.length, MIN = Math.min(12, Math.floor(N / 4));
  let [b1, b2, b3] = [1, 2, 3].map(k => ord.filter(p => fama.get(p.n) <= k).length);
  b1 = Math.max(b1, MIN); b2 = Math.max(b2, b1 + MIN); b3 = Math.max(b3, b2 + MIN);
  b3 = Math.min(b3, N - MIN); b2 = Math.min(b2, b3 - MIN); b1 = Math.min(b1, b2 - MIN);
  return [ord.slice(0, b1), ord.slice(b1, b2), ord.slice(b2, b3), ord.slice(b3)].map(f => f.map(p => p.id));
}
const levels = {};
for (const [m, [nome, filtro]] of Object.entries(MODOS)) {
  levels[m] = faixas(people.filter(filtro));
  levels[m].forEach((f, i) => { if (!f.length) errs.push(`o nível ${NIVEIS[i]} do modo ${nome} ficou vazio`); });
}
if (errs.length) { console.log(errs); process.exit(1); }

const out = { people, countries, conts: Object.entries(contId).map(([en, id]) => ({ id, n: contBR[en] })), levels };
fs.writeFileSync(path.join(DADOS, "data.json"), JSON.stringify(out));
const byC = {};
people.forEach(p => { const ct = countries[p.c].ct; byC[ct] = (byC[ct] || 0) + 1; });
console.log("figuras", people.length, "| por continente", byC, "| com frase", people.filter(p => p.q).length, "| com foto", comFoto,
  "| vivos", people.filter(p => p.d === null).length, "| países", Object.keys(countries).length, "| bandeiras", comBandeira,
  "| mulheres", people.filter(p => p.g === "F").length, "|", (JSON.stringify(out).length / 1024).toFixed(1), "KB");
console.log("figuras por nível:   " + NIVEIS.map(n => n.padStart(9)).join("") + "    total");
for (const [m, [nome]] of Object.entries(MODOS)) console.log("  " + nome.padEnd(18) + levels[m].map(f => String(f.length).padStart(9)).join("") + String(levels[m].flat().length).padStart(9));

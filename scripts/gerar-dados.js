// Gera dados/data.json a partir de dados/figuras.txt, dados/figuras-extra.txt, da base de países
// e do pacote de fotos (fotos/fotos-1/creditos.json), que define quem entra no modo Foto.
const fs = require("fs");
const path = require("path");
const wc = require("world-countries");
const cc = require("@rapideditor/country-coder");

const nomeBR = { NL: "Países Baixos", PL: "Polônia", PS: "Palestina", IR: "Irã", KE: "Quênia", VN: "Vietnã", SG: "Cingapura", CZ: "Tchéquia", RO: "Romênia", TW: "Taiwan", PE: "Peru", ZW: "Zimbábue", MM: "Mianmar", UA: "Ucrânia", KR: "Coreia do Sul", RW: "Ruanda", HU: "Hungria", HR: "Croácia", GW: "Guiné-Bissau", MZ: "Moçambique", SE: "Suécia", CH: "Suíça", IE: "Irlanda", NI: "Nicarágua", HT: "Haiti" };
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
};

const ROOT = path.join(__dirname, "..");
const DADOS = path.join(ROOT, "dados");
const lines = ["figuras.txt", "figuras-extra.txt"].map(f => fs.readFileSync(path.join(DADOS, f), "utf8")).join("\n").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#"));
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

if (errs.length) { console.log(errs); process.exit(1); }
avisos.forEach(a => console.log("aviso:", a));

const out = { people, countries, conts: Object.entries(contId).map(([en, id]) => ({ id, n: contBR[en] })) };
fs.writeFileSync(path.join(DADOS, "data.json"), JSON.stringify(out));
const byC = {};
people.forEach(p => { const ct = countries[p.c].ct; byC[ct] = (byC[ct] || 0) + 1; });
console.log("figuras", people.length, "| por continente", byC, "| com frase", people.filter(p => p.q).length, "| com foto", comFoto,
  "| vivos", people.filter(p => p.d === null).length, "| países", Object.keys(countries).length,
  "| mulheres", people.filter(p => p.g === "F").length, "|", (JSON.stringify(out).length / 1024).toFixed(1), "KB");

/*
 * Atol — reklama. Scena liczona klatka po klatce.
 *
 * Zasada: czas T = numer klatki / 60. Wszystko (sprężyny wyspy, wejścia treści, napisy, kamera) zależy tylko od T,
 * więc każdy render daje identyczny film, zgrany co do klatki z muzyką (120 BPM: cięcia na uderzeniach).
 * Wyspa to wierna kopia prawdziwej (okna/wyspa.js): te same rozmiary, sprężyny, clip-path, kolejność wejścia treści.
 */
'use strict';

const FPS = 60;
const DLUGOSC = 45;          // v3: bez sceny „pastylka albo notch” (−2 takty = −3,75 s)
window.MUZ = { kliki: [], dzw: [], whoosh: [] };
let T = 0, nr = -1;

/* ============================== narzędzia ============================== */

function el(tag, klasa, rodzic, html) {
  const e = document.createElement(tag);
  if (klasa) e.className = klasa;
  if (html != null) e.innerHTML = html;
  if (rodzic) rodzic.appendChild(e);
  return e;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;

function bezier(x1, y1, x2, y2) {
  const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
    return by((lo + hi) / 2);
  };
}
const E = {
  lin: (x) => x,
  wej: bezier(0.2, 0.8, 0.2, 1),          // wejście treści wyspy
  wyj: bezier(0.4, 0, 1, 1),              // wyjście treści wyspy
  easeIn: bezier(0.42, 0, 1, 1),
  easeOut: bezier(0, 0, 0.58, 1),
  ease: bezier(0.25, 0.1, 0.25, 1),
  tekst: bezier(0.2, 1.2, 0.4, 1),        // podmiana tytułu
  okl: bezier(0.3, 1.45, 0.55, 1),        // nowa okładka
  spr: bezier(0.3, 1.4, 0.5, 1),          // "sprężyna" w ustawieniach
  apple: bezier(0.16, 1, 0.3, 1),         // napisy
  kamera: bezier(0.7, 0, 0.18, 1),        // ruchy kamery
  inOut: bezier(0.65, 0, 0.35, 1),
  kropka: bezier(0.32, 1.25, 0.5, 1)      // --przejscie-wej z okna/wyspa.css (kropki stron)
};

// wartość animacji od t0 przez dur (przed: a, po: b)
function anim(t0, dur, a, b, e = E.inOut) {
  if (T <= t0) return a;
  if (T >= t0 + dur) return b;
  return lerp(a, b, e((T - t0) / dur));
}
// tor: [[t, v, easing?], ...] — wartość w chwili T
function tor(punkty) {
  return () => {
    if (T <= punkty[0][0]) return punkty[0][1];
    for (let i = 1; i < punkty.length; i++) {
      const [t1, v1, e] = punkty[i];
      if (T <= t1) {
        const [t0, v0] = punkty[i - 1];
        return t1 === t0 ? v1 : lerp(v0, v1, (e || E.inOut)((T - t0) / (t1 - t0)));
      }
    }
    return punkty[punkty.length - 1][1];
  };
}
function hash(a, b, c) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return h - Math.floor(h);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (k) => 'rgb(' + k.map((x) => Math.round(x)).join(',') + ')';
const f2 = (n) => n.toFixed(2);

/* ============================== zdarzenia ============================== */

const kolejka = [];
let licznikZd = 0;
function o(t, fn) {
  kolejka.push({ t, fn, n: licznikZd++ });
  kolejka.sort((a, b) => a.t - b.t || a.n - b.n);
}
function uruchomZdarzenia() {
  while (kolejka.length && kolejka[0].t <= T + 1e-7) kolejka.shift().fn();
}

/* ============================== sprężyny (jak w wyspa.js) ============================== */

const SPREZYNY_INNE = [];
class Sprezyna {
  constructor(x, eps) { this.x = x; this.v = 0; this.cel = x; this.k = 300; this.c = 26; this.eps = eps; }
  ustaw(cel, p) { this.cel = cel; if (p) { this.k = p.k; this.c = p.c; } }
  krok(dt) { const a = -this.k * (this.x - this.cel) - this.c * this.v; this.v += a * dt; this.x += this.v * dt; }
  spoczywa() { return Math.abs(this.x - this.cel) < this.eps && Math.abs(this.v) < this.eps * 8; }
  dociagnij() { this.x = this.cel; this.v = 0; }
}
const P = {
  rozwin: { k: 240, c: 21 }, zwin: { k: 300, c: 28 }, kompakt: { k: 270, c: 21 }, powiad: { k: 520, c: 31 },
  wcisnij: { k: 700, c: 40 }, pusc: { k: 340, c: 15 }, pokaz: { k: 190, c: 17 }, schowaj: { k: 260, c: 30 }
};

/* ============================== ikony (z wyspa.js) ============================== */

const IKONY = {
  zegar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
  bateria: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/><rect class="wyp-ik" x="5" y="10" width="8" height="4" rx="1"/></svg>',
  glosnik: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  cpu: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/></svg>',
  piorun: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  nuta: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M5 5h2.4v14H5zM20 5.6v12.8a.8.8 0 0 1-1.25.66L9.5 12.66a.8.8 0 0 1 0-1.32l9.25-6.4A.8.8 0 0 1 20 5.6z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16.6 5H19v14h-2.4zM4 5.6v12.8a.8.8 0 0 0 1.25.66l9.25-6.4a.8.8 0 0 0 0-1.32l-9.25-6.4A.8.8 0 0 0 4 5.6z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.9v14.2a.9.9 0 0 0 1.37.77l11.4-7.1a.9.9 0 0 0 0-1.54L8.37 4.13A.9.9 0 0 0 7 4.9z"/></svg>',
  pauza: '<svg viewBox="0 0 24 24"><rect x="5.5" y="4.5" width="4.6" height="15" rx="1.3"/><rect x="13.9" y="4.5" width="4.6" height="15" rx="1.3"/></svg>',
  // dodatkowe (pulpit, ustawienia)
  szukaj: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  wstecz: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  dalej: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  odswiez: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  klodka: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/></svg>',
  pelnyEkran: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  wyspaIk: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4"/></svg>',
  moduly: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  dzwonek: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/></svg>',
  system: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
  schowek: '<svg viewBox="0 0 24 24"><path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5.6 5h12.8L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/></svg>',
  upusc: '<svg viewBox="0 0 24 24"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>'
};
function wstawIkony(korzen) {
  korzen.querySelectorAll('[data-ik]').forEach((e) => { e.innerHTML = IKONY[e.dataset.ik] || ''; });
}

/* ============================== okładki (rysowane, wymyślone) ============================== */

function plotno(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }

function okladkaLato() {
  const [c, g] = plotno(512), S = 2;
  const tlo = g.createLinearGradient(0, 0, 0, 512);
  tlo.addColorStop(0, '#2b0f5c'); tlo.addColorStop(0.5, '#b2307f'); tlo.addColorStop(1, '#ff8a4c');
  g.fillStyle = tlo; g.fillRect(0, 0, 512, 512);
  // słońce w paski
  const sl = g.createLinearGradient(0, 120 * S, 0, 230 * S);
  sl.addColorStop(0, '#ffe76a'); sl.addColorStop(1, '#ff4f8b');
  g.save(); g.beginPath(); g.arc(128 * S, 150 * S, 74 * S, 0, Math.PI * 2); g.clip();
  g.fillStyle = sl;
  let y = 70 * S;
  const paski = [[158, 3], [172, 5], [186, 7], [200, 9], [214, 11]];
  for (const [py, ph] of paski) { g.fillRect(0, y, 512, py * S - y); y = (py + ph) * S; }
  g.fillRect(0, y, 512, 512 - y);
  g.restore();
  // siatka
  g.strokeStyle = 'rgba(255,120,220,.55)'; g.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const yy = (196 + Math.pow(i / 6, 1.8) * 60) * S; g.beginPath(); g.moveTo(0, yy); g.lineTo(512, yy); g.stroke(); }
  for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo((128 + i * 6) * S, 196 * S); g.lineTo((128 + i * 40) * S, 256 * S); g.stroke(); }
  g.fillStyle = 'rgba(20,0,40,.25)'; g.fillRect(0, 196 * S, 512, 2);
  return c;
}
function okladkaGodzina() {
  const [c, g] = plotno(512), S = 2;
  const tlo = g.createLinearGradient(0, 0, 512, 512);
  tlo.addColorStop(0, '#0b1d4d'); tlo.addColorStop(0.55, '#1a6fa8'); tlo.addColorStop(1, '#3fd0c9');
  g.fillStyle = tlo; g.fillRect(0, 0, 512, 512);
  g.save(); g.shadowColor = 'rgba(255,233,168,.9)'; g.shadowBlur = 60;
  g.fillStyle = '#fff1c1'; g.beginPath(); g.arc(172 * S, 86 * S, 36 * S, 0, Math.PI * 2); g.fill(); g.restore();
  const fale = [['rgba(120,230,240,.35)', 150, 10], ['rgba(16,60,120,.75)', 172, 12], ['rgba(8,34,80,.9)', 196, 9], ['#061631', 222, 7]];
  fale.forEach(([kol, yb, amp], i) => {
    g.fillStyle = kol; g.beginPath(); g.moveTo(0, 512);
    for (let x = 0; x <= 256; x += 4) g.lineTo(x * S, (yb + Math.sin(x / 22 + i * 1.7) * amp) * S);
    g.lineTo(512, 512); g.closePath(); g.fill();
  });
  return c;
}
function okladkaFilm() {
  const [c, g] = plotno(512);
  const tlo = g.createLinearGradient(0, 0, 0, 512);
  tlo.addColorStop(0, '#2a1a6e'); tlo.addColorStop(0.35, '#7a3bbf'); tlo.addColorStop(0.65, '#ff6f91'); tlo.addColorStop(0.85, '#ffb36b');
  g.fillStyle = tlo; g.fillRect(0, 0, 512, 512);
  const sl = g.createRadialGradient(256, 330, 0, 256, 330, 120);
  sl.addColorStop(0, '#fff6d8'); sl.addColorStop(0.45, '#ffd98a'); sl.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = sl; g.fillRect(0, 0, 512, 512);
  [['#5b2f8f', [[0, 330], [80, 270], [160, 320], [250, 240], [340, 310], [430, 250], [512, 300]]],
   ['#3b1f6b', [[0, 380], [100, 320], [200, 370], [300, 330], [400, 380], [512, 330]]],
   ['#1d1240', [[0, 440], [120, 400], [260, 450], [380, 410], [512, 440]]]].forEach(([k, pk]) => {
    g.fillStyle = k; g.beginPath(); g.moveTo(0, 512); pk.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(512, 512); g.closePath(); g.fill();
  });
  return c;
}
// kolor słupków z okładki — ten sam algorytm co w wyspa.js
function kolorZOkladki(canvas) {
  const [c, g] = plotno(16);
  g.drawImage(canvas, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0, gr = 0, b = 0, waga = 0;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    let wg = (mx - mn) / 255 + 0.05;
    if (mx < 40) wg *= 0.2;
    r += d[i] * wg; gr += d[i + 1] * wg; b += d[i + 2] * wg; waga += wg;
  }
  r /= waga; gr /= waga; b /= waga;
  const max = Math.max(r, gr, b, 1), skala = Math.max(1, 210 / max);
  return [r, gr, b].map((x) => Math.min(255, Math.round(x * skala)));
}

const UTWORY = {};
function przygotujUtwory() {
  const dodaj = (klucz, tytul, wykonawca, dlugosc, canvas) => {
    UTWORY[klucz] = { klucz, tytul, wykonawca, dlugosc, okladka: canvas.toDataURL('image/png'), kolor: kolorZOkladki(canvas) };
  };
  dodaj('lato', 'Neonowe lato', 'Lumen', 204, okladkaLato());
  dodaj('godzina', 'Złota godzina', 'Aurora Park', 187, okladkaGodzina());
  dodaj('film', 'Zachód nad górami', 'Kanał Podróże', 750, okladkaFilm());
}
const utwor = (k, pozycja, gra = true) => Object.assign({}, UTWORY[k], { pozycja, gra });

/* ============================== WYSPA ============================== */

const GEOM = {
  pusta: { w: 122, h: 34 }, muzyka: { w: 236, h: 34 }, timer: { w: 184, h: 34 }, muzykaTimer: { w: 296, h: 34 },
  powiad: { w: 344, h: 68, r: 34 }, rozw: { w: 372, r: 40 }
};
const SCHOWANY_WEJ = { o: 0, b: 8, y: 8, s: 0.85 };
const SCHOWANY_WYJ = { o: 0, b: 6, y: 0, s: 0.9 };
const WIDOCZNY = { o: 1, b: 0, y: 0, s: 1 };
const CZAS_WEJSCIA = { kompakt: 0.42, powiad: 0.38, rozw: 0.54 };
const PROFIL = [0.6, 0.9, 1, 0.8, 0.65];
const mieszaj = (a, b, k) => ({ o: lerp(a.o, b.o, k), b: lerp(a.b, b.b, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) });

const SZABLON_WYSPY = `
<div class="w-scena"><div class="w-wyspa">
  <div class="kompakt">
    <div class="k-lewa">
      <div class="okl mala k-okl" data-a><i class="okl-w"></i><i class="okl-w"></i></div>
      <span class="k-ikona-timer" data-ik="zegar" data-a></span>
    </div>
    <div class="k-prawa">
      <span class="k-timer" data-a></span>
      <span class="viz k-viz" data-a><i></i><i></i><i></i><i></i><i></i></span>
    </div>
  </div>
  <div class="powiad">
    <span class="p-ikona" data-a></span>
    <div class="p-tekst">
      <strong class="p-tytul" data-a></strong>
      <span class="p-opis" data-a></span>
      <div class="tor p-tor" data-a><div class="wyp p-wyp"></div></div>
    </div>
  </div>
  <div class="rozw">
    <section class="karta" hidden>
      <div class="karta-gora">
        <div class="okl duza r-okl" data-a><i class="okl-w"></i><i class="okl-w"></i></div>
        <div class="opis" data-a><strong class="r-tytul"></strong><span class="r-wyk"></span></div>
        <span class="viz duzy r-viz" data-a><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="postep" data-a><span class="r-poz">0:00</span><div class="tor"><div class="wyp r-wyp"></div></div><span class="r-zost">-0:00</span></div>
      <div class="sterowanie" data-a>
        <span class="s-btn s-prev" data-ik="prev"></span>
        <span class="s-btn glowny s-toggle"></span>
        <span class="s-btn s-next" data-ik="next"></span>
      </div>
    </section>
    <section class="kafle" hidden>
      <div class="kafel b" data-a><span class="kafel-ikona" data-ik="bateria"></span><div class="kafel-tekst"><span class="etykieta">Bateria</span><strong>76%<small>⚡</small></strong></div><div class="tor"><div class="wyp" style="transform:scaleX(.76);background:var(--zielony)"></div></div></div>
      <div class="kafel g" data-a><span class="kafel-ikona" data-ik="glosnik"></span><div class="kafel-tekst"><span class="etykieta">Głośność</span><strong>70%</strong></div><div class="tor"><div class="wyp" style="transform:scaleX(.7);background:var(--niebieski)"></div></div></div>
      <div class="kafel c" data-a><span class="kafel-ikona" data-ik="cpu"></span><div class="kafel-tekst"><span class="etykieta">Procesor</span><strong>23%</strong></div><div class="tor"><div class="wyp" style="transform:scaleX(.23);background:var(--fiolet)"></div></div></div>
    </section>
    <section class="minutnik" hidden data-a>
      <span class="kafel-ikona" data-ik="zegar"></span>
      <strong class="m-czas">5:00</strong>
      <span class="chip">Zatrzymaj</span>
    </section>
    <section class="schowek" hidden>
      <div class="sch-naglowek" data-a><span class="sch-ikona" data-ik="schowek"></span><strong>Schowek</strong><span class="sch-licznik"></span></div>
      <div class="sch-lista" data-a></div>
      <div class="sch-pusty" data-a><span class="sch-strzalka" data-ik="upusc"></span><span>Przeciągnij tu plik — poczeka, aż będzie potrzebny</span></div>
      <div class="sch-upusc"><span class="sch-strzalka" data-ik="upusc"></span><strong>Upuść, żeby zachować</strong></div>
    </section>
    <div class="kropki" hidden><i></i><i></i></div>
  </div>
</div></div>`;

const WYSPY = [];

class Wyspa {
  constructor(rodzic, opcje = {}) {
    this.uchwyt = el('div', 'w-uchwyt', rodzic);
    this.okno = el('div', 'w-okno', this.uchwyt, SZABLON_WYSPY);
    wstawIkony(this.okno);
    const q = (s) => this.okno.querySelector(s);
    const qa = (s) => [...this.okno.querySelectorAll(s)];
    this.scena = q('.w-scena'); this.wyspa = q('.w-wyspa');
    this.kLewa = q('.k-lewa'); this.kPrawa = q('.k-prawa');
    this.warstwy = { kompakt: q('.kompakt'), powiad: q('.powiad'), rozw: q('.rozw') };
    this.aktywne = new Set();
    this.elementyA = qa('[data-a]');
    this.warstwaEl = new Map(this.elementyA.map((e) => [e, e.closest('.kompakt,.powiad,.rozw')]));
    this.e = {
      karta: q('.karta'), kafle: q('.kafle'), minutnik: q('.minutnik'), schowek: q('.schowek'), schLista: q('.sch-lista'), schPusty: q('.sch-pusty'), kropki: q('.kropki'), schLicznik: q('.sch-licznik'), schZona: q('.sch-upusc'),
      kafel: { bateria: q('.kafel.b'), glosnosc: q('.kafel.g'), procesor: q('.kafel.c') },
      tytul: q('.r-tytul'), wyk: q('.r-wyk'), poz: q('.r-poz'), zost: q('.r-zost'), wyp: q('.r-wyp'), toggle: q('.s-toggle'),
      kTimer: q('.k-timer'), mCzas: q('.m-czas'),
      pIkona: q('.p-ikona'), pTytul: q('.p-tytul'), pOpis: q('.p-opis'), pTor: q('.p-tor'), pWyp: q('.p-wyp'),
      prev: q('.s-prev'), next: q('.s-next')
    };
    this.slupki = qa('.k-viz i').map((k, i) => ({ el: [k, qa('.r-viz i')[i]], x: 0.18 }));

    this.notch = false; this.plotnoY = 8;
    this.sW = new Sprezyna(GEOM.pusta.w, 0.05);
    this.sH = new Sprezyna(GEOM.pusta.h, 0.05);
    this.sR = new Sprezyna(GEOM.pusta.h / 2, 0.05);
    this.sV = new Sprezyna(opcje.widoczna ? 1 : 0, 0.002);
    this.sprezyny = [this.sW, this.sH, this.sR, this.sV];

    this.stan = 'pusta'; this.rozwinieta = false; this.powiadAktywne = false; this.wcisnieta = false;
    this.media = null; this.timer = null;
    this.moduly = { bateria: false, glosnosc: false, procesor: false, timer: false };
    this.wysokoscRozw = 200;
    this.strona = 'glowna'; this.pliki = []; this.zona = { on: false, t0: -9 };
    // kropki stron jak w okna/wyspa.css: pionowo przy prawej krawędzi, aktywna 5→14 px (0,35 s), kolor 0,25 s,
    // całość znika z opacity 0,2 s, gdy warstwa .rozw nie jest aktywna
    this.kropkiI = qa('.kropki i');
    this.kr = { akt: 0, t0: -9, od: [{ h: 14, a: 0.85 }, { h: 5, a: 0.28 }] };
    this.kOp = { od: 0, do: 0, t0: -9 };
    this.anim = new Map();
    this.teksty = new Map();
    this.okl = [q('.k-okl'), q('.r-okl')].map((e) => ({
      w: [...e.querySelectorAll('.okl-w')], akt: 0, url: null,
      st: [{ base: { o: 0, s: 1 }, a: null, url: '' }, { base: { o: 0, s: 1 }, a: null, url: '' }]
    }));
    this.kolor = { od: [242, 242, 247], do: [242, 242, 247], t0: -9 };
    this.cien = { od: 0, do: 0, t0: -9 };
    this.pasek = { od: 0, do: 0, t0: -9 };
    this.postep = { baza: 0, czas: 0, gra: false, dl: 0 };
    this.vizGra = false;
    this.ziarno = opcje.ziarno || 1;
    this.tokenK = 0;
    this.wstrzymaj = false;
    this.ustawToggle(true);
    WYSPY.push(this);
  }

  ustaw(x, y, s) {
    this.uchwyt.style.left = f2(x) + 'px'; this.uchwyt.style.top = f2(y) + 'px';
    this.okno.style.transform = 'scale(' + s.toFixed(4) + ')';
  }

  /* ---------- geometria ---------- */
  maKompakt() { return !!this.media || !!this.timer; }
  maCoRozwinac() { const m = this.moduly; return this.strona === 'schowek' || !!this.media || m.bateria || m.glosnosc || m.procesor || m.timer; }
  geometria(s) {
    if (s === 'rozw') return { w: GEOM.rozw.w, h: this.wysokoscRozw, r: this.notch ? 30 : GEOM.rozw.r };
    if (s === 'powiad') return this.notch ? { w: GEOM.powiad.w, h: GEOM.powiad.h + 2, r: 24 } : GEOM.powiad;
    const g = s === 'kompakt' ? (this.media && this.timer ? GEOM.muzykaTimer : this.media ? GEOM.muzyka : GEOM.timer) : GEOM.pusta;
    if (this.notch) return { w: s === 'pusta' ? 150 : g.w, h: g.h + 2, r: 12 };
    return { w: g.w, h: g.h, r: g.h / 2 };
  }
  ksztalt() {
    const { sW, sH, sR, sV } = this;
    if (!this.notch) {
      const h0 = Math.max(8, sH.x);
      return { w: sW.x, h: h0, r: Math.max(0, Math.min(sR.x, h0 / 2, sW.x / 2)), e: 0 };
    }
    const v = Math.max(0, sV.x);
    const h = Math.max(0, sH.x * v);
    const w = sW.x * (0.72 + 0.28 * Math.min(1, v));
    let e = Math.min(14, 6 + sH.x * 0.025) * Math.min(1, v);
    e = Math.min(e, h * 0.5);
    const r = Math.max(0, Math.min(sR.x, h - e, w / 2));
    return { w, h, r, e };
  }

  /* ---------- stan ---------- */
  odswiez(p) { if (!this.wstrzymaj) this.aktualizujStan(p); }
  zbiorczo(fn) { this.wstrzymaj = true; fn(); this.wstrzymaj = false; this.aktualizujStan(); }

  aktualizujStan(wym) {
    if (this.rozwinieta && !this.maCoRozwinac()) this.rozwinieta = false;
    const poprzedni = this.stan;
    this.stan = this.rozwinieta ? 'rozw' : this.powiadAktywne ? 'powiad' : this.maKompakt() ? 'kompakt' : 'pusta';
    if (this.stan !== 'pusta') this.wcisnieta = false;
    this.wyspa.classList.toggle('z-muzyka', !!this.media);
    this.wyspa.classList.toggle('z-timer', !!this.timer);
    const cienCel = this.stan === 'rozw' ? 1 : 0;
    if (cienCel !== this.cien.do) this.cien = { od: this.wartoscCienia(), do: cienCel, t0: T };

    const duzy = (s) => s === 'rozw' || s === 'powiad';
    const p = wym || (this.stan === 'powiad' ? P.powiad : duzy(this.stan) ? P.rozwin : duzy(poprzedni) ? P.zwin : P.kompakt);
    let g = this.geometria(this.stan);
    if (this.stan === 'pusta' && this.wcisnieta) g = { w: g.w + 16, h: g.h + 4, r: this.notch ? g.r : (g.h + 4) / 2 };

    this.tokenK++;
    let opozn = 0;
    if (this.stan !== poprzedni) {
      const gp = this.geometria(poprzedni);
      const zmniejsza = g.w * g.h < gp.w * gp.h;
      const stara = this.warstwy[poprzedni], nowa = this.warstwy[this.stan];
      if (stara) this.animujWyjscie(stara, zmniejsza ? 0.14 : 0.11);
      if (stara && zmniejsza) opozn = 0.11;
      if (nowa) this.animujWejscie(nowa, opozn, CZAS_WEJSCIA[this.stan]);
    }
    const ust = () => { this.sW.ustaw(g.w, p); this.sH.ustaw(g.h, p); this.sR.ustaw(g.r, p); };
    if (opozn) { const tok = this.tokenK; o(T + opozn, () => { if (tok === this.tokenK) ust(); }); } else ust();
  }

  /* ---------- wejście / wyjście treści ---------- */
  elementy(warstwa) { return [...warstwa.querySelectorAll('[data-a]')].filter((e) => e.getClientRects().length > 0); }
  trwa(e) { const a = this.anim.get(e); return !!a && T < a.t0 + a.dur; }
  wartosc(e) {
    const a = this.anim.get(e);
    if (!a || T >= a.t0 + a.dur) return this.aktywne.has(this.warstwaEl.get(e)) ? WIDOCZNY : SCHOWANY_WYJ;
    if (T < a.t0) return a.od;
    return mieszaj(a.od, a.do, a.e((T - a.t0) / a.dur));
  }
  animujWejscie(warstwa, opozn, Tw) {
    const lista = this.elementy(warstwa);
    const start = lista.map((e) => (this.trwa(e) ? this.wartosc(e) : SCHOWANY_WEJ));
    this.aktywne.add(warstwa);
    lista.forEach((e, i) => this.anim.set(e, { od: start[i], do: WIDOCZNY, t0: T + opozn + Tw * 0.25 + i * 0.045, dur: Tw * 0.6, e: E.wej }));
  }
  animujWyjscie(warstwa, czas) {
    const lista = this.elementy(warstwa);
    const start = lista.map((e) => this.wartosc(e));
    this.aktywne.delete(warstwa);
    lista.forEach((e, i) => this.anim.set(e, { od: start[i], do: SCHOWANY_WYJ, t0: T, dur: czas, e: E.wyj }));
  }

  rozwin() {
    if (!this.maCoRozwinac()) return;
    this.rozwinieta = true; this.powiadAktywne = false;
    this.wysokoscRozw = Math.ceil(this.warstwy.rozw.offsetHeight);
    this.odswiez();
  }
  zwin() { if (!this.rozwinieta) return; this.rozwinieta = false; this.odswiez(); }
  wcisnij() { this.wcisnieta = true; this.aktualizujStan(P.wcisnij); }
  pusc() { this.wcisnieta = false; this.aktualizujStan(P.pusc); }
  pokaz(p = P.pokaz) { this.sV.ustaw(1, p); }
  schowaj() { this.zwin(); this.sV.ustaw(0, P.schowaj); }

  zastosujStyl(s) {
    this.notch = s === 'notch';
    this.plotnoY = this.notch ? 0 : 8;
    this.okno.classList.toggle('notch', this.notch);
    this.aktualizujStan();
    this.tokenK++;
    const g = this.geometria(this.stan);
    this.sW.ustaw(g.w); this.sH.ustaw(g.h); this.sR.ustaw(g.r);
    [this.sW, this.sH, this.sR].forEach((s) => s.dociagnij());
  }
  zmienStyl(s) {
    if ((s === 'notch') === this.notch) return;
    if (this.sV.cel === 1) {
      this.zwin();
      this.sV.ustaw(0, P.schowaj);
      o(T + 0.38, () => { this.zastosujStyl(s); this.sV.x = 0; this.sV.v = 0; this.sV.ustaw(1, P.pokaz); });
    } else this.zastosujStyl(s);
  }

  /* ---------- multimedia ---------- */
  ustawToggle(gra) { this.e.toggle.innerHTML = '<span>' + IKONY[gra ? 'pauza' : 'play'] + '</span>'; }
  zmienTekst(e, tekst, animuj) {
    if (!animuj) { this.teksty.delete(e); e.textContent = tekst; return; }
    this.teksty.set(e, { t0: T, tekst });
  }
  ustawOkladke(url, animuj) {
    for (const ok of this.okl) {
      if (url === ok.url) continue;
      ok.url = url;
      const stara = ok.st[ok.akt], nowa = ok.st[1 - ok.akt];
      const opStara = this.wartOkl(stara).o;
      ok.akt = 1 - ok.akt;
      nowa.url = url || '';
      ok.w[ok.akt].style.backgroundImage = url ? 'url("' + url + '")' : '';
      nowa.base = { o: url ? 1 : 0, s: 1 };
      stara.base = { o: 0, s: 1 };
      nowa.a = stara.a = null;
      if (!animuj) continue;
      if (url) nowa.a = { od: { o: 0, s: 0.78 }, do: { o: 1, s: 1 }, t0: T, dur: 0.56, e: E.okl };
      stara.a = { od: { o: opStara, s: 1 }, do: { o: 0, s: 1.1 }, t0: T, dur: 0.28, e: E.easeOut };
    }
  }
  wartOkl(st) {
    const a = st.a;
    if (!a || T >= a.t0 + a.dur) return st.base;
    if (T < a.t0) return a.od;
    const k = a.e((T - a.t0) / a.dur);
    return { o: clamp(lerp(a.od.o, a.do.o, k), 0, 1), s: lerp(a.od.s, a.do.s, k) };
  }
  ustawKolor(k, animuj) {
    this.kolor = { od: animuj ? this.wartoscKoloru() : k, do: k, t0: T };
  }
  wartoscKoloru() {
    const p = E.ease(clamp((T - this.kolor.t0) / 0.6, 0, 1));
    return this.kolor.od.map((x, i) => lerp(x, this.kolor.do[i], p));
  }
  ustawMedia(m) {
    const poprzednie = this.media;
    this.media = m ? Object.assign({}, m) : null;
    if (this.media) {
      const nowy = !poprzednie || poprzednie.klucz !== m.klucz;
      const animuj = !!poprzednie;
      this.zmienTekst(this.e.tytul, m.tytul, animuj && nowy);
      this.zmienTekst(this.e.wyk, m.wykonawca, animuj && nowy);
      if (m.okladka !== this.okl[1].url) {
        const animOkl = animuj || this.stan === 'kompakt' || this.stan === 'rozw';
        this.ustawOkladke(m.okladka, animOkl);
        this.ustawKolor(m.kolor, !!poprzednie);
      }
      if (nowy && poprzednie && this.stan === 'kompakt') this.sW.v += 240;
      this.postep = { baza: m.pozycja || 0, czas: T, gra: !!m.gra, dl: m.dlugosc };
      this.ustawToggle(!!m.gra);
      this.vizGra = !!m.gra;
    } else {
      this.vizGra = false;
      this.ustawOkladke(null, false);
    }
    this.e.karta.hidden = !this.media || this.strona === 'schowek';
    this.kropkiOdswiez();
    this.odswiez();
  }
  pozycja() {
    const p = this.postep.baza + (this.postep.gra ? T - this.postep.czas : 0);
    return this.postep.dl > 0 ? Math.min(this.postep.dl, p) : p;
  }

  /* ---------- moduły, minutnik ---------- */
  ustawModuly(m) {
    Object.assign(this.moduly, m);
    let jaki = false;
    for (const k of ['bateria', 'glosnosc', 'procesor']) { this.e.kafel[k].hidden = !this.moduly[k]; if (this.moduly[k]) jaki = true; }
    this.e.kafle.hidden = !jaki;
    this.e.minutnik.hidden = !this.moduly.timer;
    this.odswiez();
  }
  startTimer(sek) { this.timer = { koniec: T + sek }; this.odswiez(); }
  stopTimer() { this.timer = null; this.odswiez(); }

  /* ---------- powiadomienia ---------- */
  powiadomienie(z) {
    let o2;
    if (z.typ === 'glosnosc') o2 = { ikona: 'glosnik', tytul: 'Głośność ' + z.poziom + '%', pasek: z.poziom };
    else if (z.typ === 'ladowanie') o2 = { ikona: 'piorun', tytul: 'Ładowanie rozpoczęte', opis: 'Bateria: ' + z.procent + '%' };
    else if (z.typ === 'bateria') o2 = { ikona: 'bateria', tytul: 'Niski poziom baterii', opis: z.procent + '% — podłącz ładowarkę' };
    else if (z.typ === 'timer') o2 = { ikona: 'zegar', tytul: 'Minutnik zakończony', opis: z.min + ' min minęło' };
    this.e.pIkona.className = 'p-ikona ' + o2.ikona;
    this.e.pIkona.innerHTML = IKONY[o2.ikona];
    this.e.pTytul.textContent = o2.tytul;
    const maPasek = o2.pasek !== undefined;
    this.e.pOpis.style.display = maPasek ? 'none' : '';
    this.e.pOpis.textContent = o2.opis || '';
    this.e.pTor.classList.toggle('widoczny', maPasek);
    if (maPasek) {
      const teraz = this.wartoscPaska();
      this.pasek = { od: this.powiadAktywne ? teraz : o2.pasek / 100, do: o2.pasek / 100, t0: T };
      this.e.pWyp.style.backgroundColor = 'var(--niebieski)';
    }
    this.powiadAktywne = true;
    this.odswiez();
  }
  koniecPowiad() { this.powiadAktywne = false; this.odswiez(); }
  kropkiOp() { return lerp(this.kOp.od, this.kOp.do, E.ease(clamp((T - this.kOp.t0) / 0.2, 0, 1))); }
  wartoscPaska() { return lerp(this.pasek.od, this.pasek.do, E.easeOut(clamp((T - this.pasek.t0) / 0.18, 0, 1))); }
  wartoscCienia() { return lerp(this.cien.od, this.cien.do, E.ease(clamp((T - this.cien.t0) / 0.45, 0, 1))); }

  /* ---------- schowek na pliki ---------- */
  ustawStrone(st) {
    this.strona = st;
    this.e.karta.hidden = !this.media || st === 'schowek';
    this.e.schowek.hidden = st !== 'schowek';
    this.kropkiOdswiez();
  }
  kropkiOdswiez() {
    const ukryte = !(this.media && this.pliki.length);
    this.e.kropki.hidden = ukryte;
    const akt = this.strona === 'schowek' ? 1 : 0;
    // przejście CSS rusza tylko na widocznych kropkach (display:none → od razu stan końcowy)
    if (akt !== this.kr.akt) this.kr = { akt, t0: ukryte ? -9 : T, od: this.kropkiWartosc() };
  }
  kropkiWartosc() {
    const k = this.kr, ph = E.kropka(clamp((T - k.t0) / 0.35, 0, 1)), pa = E.ease(clamp((T - k.t0) / 0.25, 0, 1));
    return [0, 1].map((i) => ({ h: lerp(k.od[i].h, i === k.akt ? 14 : 5, ph), a: lerp(k.od[i].a, i === k.akt ? 0.85 : 0.28, pa) }));
  }
  // elementy [data-a] jednej strony (jak elementy(stronaEl(n)) w wyspa.js) — tylko widoczne
  elementyStrony(st) {
    return this.elementy(this.warstwy.rozw).filter((e) => !!e.closest('.schowek') === (st === 'schowek'));
  }
  // przewinięcie kółkiem — DOKŁADNIE jak zmienStrone() w okna/wyspa.js: kropki od razu; stara strona wychodzi
  // 130 ms (blur 6 px, ∓14 px, skala .96, cubic-bezier(.4,0,1,1)); po 120 ms podmiana stron i wejście nowej
  // (blur 8 px, ±16 px, skala .96 → normalnie, 380 ms, co 40 ms, cubic-bezier(.2,.8,.2,1)); nowa wysokość karty
  // trafia do sprężyny wysokości jak z ResizeObservera (sH.ustaw(h) — parametry z rozwinięcia).
  zmienStrone(st) {
    if (this.stan !== 'rozw' || st === this.strona) return;
    const stara = this.strona, wDol = st === 'schowek';
    this.strona = st;
    this.kropkiOdswiez();
    this.elementyStrony(stara).forEach((e) =>
      this.anim.set(e, { od: this.wartosc(e), do: { o: 0, b: 6, y: wDol ? -14 : 14, s: 0.96 }, t0: T, dur: 0.13, e: E.wyj }));
    o(T + 0.12, () => {
      this.warstwy.rozw.querySelectorAll('[data-a]').forEach((e) => this.anim.delete(e));
      this.ustawStrone(st);
      this.elementyStrony(st).forEach((e, i) =>
        this.anim.set(e, { od: { o: 0, b: 8, y: wDol ? 16 : -16, s: 0.96 }, do: WIDOCZNY, t0: T + i * 0.04, dur: 0.38, e: E.wej }));
      const h = Math.ceil(this.warstwy.rozw.offsetHeight);
      if (h !== this.wysokoscRozw) { this.wysokoscRozw = h; this.sH.ustaw(h); }
    });
  }
  przemierz() {
    if (this.stan !== 'rozw') return;
    const h = Math.ceil(this.warstwy.rozw.offsetHeight);
    if (h !== this.wysokoscRozw) { this.wysokoscRozw = h; this.sH.ustaw(h, P.rozwin); }
  }
  dropZone(on) {
    if (on === this.zona.on) return;
    this.zona = { on, t0: T };
    this.e.schowek.classList.toggle('upuszczanie', on);
    if (on && !this.rozwinieta) { this.ustawStrone('schowek'); this.rozwin(); } else this.przemierz();
  }
  dodajPlik(rodzaj, nazwa) {
    const e = el('div', 'sch-plik', null, '<div class="sch-miniatura">' + MINI[rodzaj] + '</div><span class="sch-nazwa">' + nazwa + '</span>');
    this.e.schLista.prepend(e);
    this.pliki.unshift({ e, nazwa, t0: T });
    const n = this.pliki.length;
    this.e.schLicznik.textContent = n + (n === 1 ? ' plik' : n < 5 ? ' pliki' : ' plików');
    this.e.schPusty.style.display = 'none';
    this.kropkiOdswiez();
    this.przemierz();
  }

  /* ---------- zakończ wszystkie animacje (start ujęcia) ---------- */
  natychmiast() {
    this.tokenK++;
    const g = this.geometria(this.stan);
    this.sW.ustaw(g.w); this.sH.ustaw(g.h); this.sR.ustaw(g.r);
    this.sprezyny.forEach((s) => s.dociagnij());
    this.anim.clear();
    this.teksty.forEach((v, e) => { e.textContent = v.tekst; e.style.opacity = ''; e.style.transform = ''; });
    this.teksty.clear();
    this.okl.forEach((ok) => ok.st.forEach((s) => { s.a = null; }));
    this.kolor.t0 = -9; this.cien = { od: this.cien.do, do: this.cien.do, t0: -9 };
  }

  /* ---------- fizyka (co klatkę) ---------- */
  krok(dt) {
    const n = 4, h = dt / n;
    for (let i = 0; i < n; i++) for (const s of this.sprezyny) s.krok(h);
    if (this.sprezyny.every((s) => s.spoczywa())) this.sprezyny.forEach((s) => s.dociagnij());
    const kCel = this.aktywne.has(this.warstwy.rozw) ? 1 : 0;
    if (kCel !== this.kOp.do) this.kOp = { od: this.kropkiOp(), do: kCel, t0: T };
    if (!this.media) return;
    // słupki: w rytm muzyki (16-tki), mocniej na uderzeniu stopy
    const krokN = Math.floor(T / 0.125);
    const faza = (T % 0.5) / 0.5;
    const bit = (T >= 7.5 && T < 37.35) || (T >= 37.5 && T < 43.15);
    this.slupki.forEach((s, i) => {
      let cel = 0.18;
      if (this.vizGra) {
        cel = 0.22 + hash(krokN, i, this.ziarno) * 0.78 * PROFIL[i];
        if (bit) cel = Math.min(1, cel * 0.8 + 0.42 * Math.exp(-faza * 5) * PROFIL[i]);
      }
      const szybkosc = this.vizGra ? 15 : 6;
      s.x += (cel - s.x) * (1 - Math.exp(-dt * szybkosc));
    });
  }

  /* ---------- rysowanie (co klatkę) ---------- */
  rysuj() {
    const k = this.ksztalt(), w = k.w, h = k.h, r = k.r;
    const bok = (420 - w) / 2;
    if (!this.notch) {
      this.wyspa.style.clipPath = 'inset(0px ' + f2(bok) + 'px ' + f2(480 - h) + 'px ' + f2(bok) + 'px round ' + f2(r) + 'px)';
      const v = this.sV.x;
      this.scena.style.opacity = clamp(v * 1.4 - 0.15, 0, 1).toFixed(3);
      this.scena.style.transform = 'translate3d(0,' + f2((1 - v) * -22) + 'px,0) scale(' + (0.6 + 0.4 * v).toFixed(4) + ')';
    } else {
      const L = bok, R = bok + w, e = k.e;
      this.wyspa.style.clipPath = h < 0.5 ? 'inset(0 0 100% 0)' : 'path("M ' + f2(L - e) + ' 0 A ' + f2(e) + ' ' + f2(e) + ' 0 0 1 ' + f2(L) + ' ' + f2(e) +
        ' L ' + f2(L) + ' ' + f2(h - r) + ' A ' + f2(r) + ' ' + f2(r) + ' 0 0 0 ' + f2(L + r) + ' ' + f2(h) +
        ' L ' + f2(R - r) + ' ' + f2(h) + ' A ' + f2(r) + ' ' + f2(r) + ' 0 0 0 ' + f2(R) + ' ' + f2(h - r) +
        ' L ' + f2(R) + ' ' + f2(e) + ' A ' + f2(e) + ' ' + f2(e) + ' 0 0 1 ' + f2(R + e) + ' 0 Z")';
      this.scena.style.opacity = this.sV.x > 0.02 ? '1' : '0';
      this.scena.style.transform = 'none';
    }
    this.kLewa.style.transform = 'translate3d(' + f2(bok + 5) + 'px,0,0)';
    this.kPrawa.style.transform = 'translate3d(' + f2(-(bok + 13)) + 'px,0,0)';

    // treść
    for (const e of this.elementyA) {
      const v = this.wartosc(e);
      e.style.opacity = clamp(v.o, 0, 1).toFixed(3);
      e.style.filter = v.b > 0.02 ? 'blur(' + v.b.toFixed(2) + 'px)' : 'none';
      e.style.transform = 'translateY(' + v.y.toFixed(2) + 'px) scale(' + v.s.toFixed(4) + ')';
    }
    // kropki stron
    if (!this.e.kropki.hidden) {
      this.e.kropki.style.opacity = this.kropkiOp().toFixed(3);
      this.kropkiWartosc().forEach((v, i) => {
        this.kropkiI[i].style.height = f2(v.h) + 'px';
        this.kropkiI[i].style.backgroundColor = 'rgba(255,255,255,' + v.a.toFixed(3) + ')';
      });
    }
    // podmiana tytułu / wykonawcy
    this.teksty.forEach((a, e) => {
      const dt = T - a.t0;
      if (dt < 0.15) {
        const p = E.easeIn(dt / 0.15);
        e.style.opacity = (1 - p).toFixed(3); e.style.transform = 'translateY(' + f2(-6 * p) + 'px)';
      } else {
        if (e.textContent !== a.tekst) e.textContent = a.tekst;
        const p = E.tekst(clamp((dt - 0.15) / 0.38, 0, 1));
        e.style.opacity = clamp(p, 0, 1).toFixed(3); e.style.transform = 'translateY(' + f2(6 * (1 - p)) + 'px)';
      }
    });
    // okładki
    for (const ok of this.okl) ok.st.forEach((st, i) => {
      const v = this.wartOkl(st);
      ok.w[i].style.opacity = v.o.toFixed(3);
      ok.w[i].style.transform = 'scale(' + v.s.toFixed(4) + ')';
    });
    // słupki
    this.wyspa.style.setProperty('--viz-kolor', rgb(this.wartoscKoloru()));
    for (const s of this.slupki) { const tr = 'scaleY(' + s.x.toFixed(3) + ')'; s.el[0].style.transform = tr; s.el[1].style.transform = tr; }
    // postęp
    if (this.media) {
      const p = this.pozycja(), dl = this.postep.dl;
      this.e.wyp.style.transform = 'scaleX(' + (p / dl).toFixed(4) + ')';
      this.e.poz.textContent = czas(p);
      this.e.zost.textContent = '-' + czas(Math.max(0, Math.round(dl) - Math.floor(p)));
    }
    // minutnik
    if (this.timer) {
      const ms = Math.max(0, this.timer.koniec - T) * 1000;
      const s = Math.ceil(ms / 1000 - 1e-6), tx = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      this.e.kTimer.textContent = tx; this.e.mCzas.textContent = tx;
    }
    // pasek głośności
    this.e.pWyp.style.transform = 'scaleX(' + this.wartoscPaska().toFixed(4) + ')';
    // schowek: strefa "Upuść" i wskakiwanie plików
    this.e.schZona.style.opacity = (this.zona.on ? E.easeOut(clamp((T - this.zona.t0) / 0.18, 0, 1)) : 1 - E.easeOut(clamp((T - this.zona.t0) / 0.18, 0, 1))).toFixed(3);
    for (const p of this.pliki) {
      const k = clamp((T - p.t0) / 0.5, 0, 1);
      p.e.style.opacity = clamp((T - p.t0) / 0.2, 0, 1).toFixed(3);
      p.e.style.transform = 'scale(' + lerp(0.6, 1, E.okl(k)).toFixed(4) + ')';
    }
    // cień rozwiniętej
    const c = this.wartoscCienia();
    this.scena.style.filter = c > 0.001
      ? 'drop-shadow(0 10px 22px rgba(0,0,0,' + (0.45 * c).toFixed(3) + ')) drop-shadow(0 0 2px rgba(0,0,0,' + (0.35 * c).toFixed(3) + '))'
      : 'none';
  }
}
function czas(sek) {
  const s = Math.max(0, Math.floor(sek));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

/* ============================== KURSOR ============================== */

const KURSOR_SVG = '<svg viewBox="0 0 22 30" style="fill:none;stroke:none"><path d="M2 2 L2 24.5 L7.6 19.2 L11.3 27.8 L14.9 26.3 L11.2 17.8 L18.8 17.8 Z" style="fill:#fff;stroke:#111;stroke-width:1.5;stroke-linejoin:round"/></svg>';
class Kursor {
  constructor(rodzic) {
    this.e = el('div', 'kursor', rodzic, KURSOR_SVG);
    this.pkt = [[0, 0, 0]];
    this.kliki = [];
    this.widocznosc = [[0, 1]];
  }
  // ruch do (x, y) w czasie [t0, t1]
  ruch(t0, t1, x, y) {
    const ost = this.pkt[this.pkt.length - 1];
    if (t0 > ost[0]) this.pkt.push([t0, ost[1], ost[2]]);
    this.pkt.push([t1, x, y]);
    return this;
  }
  start(x, y) { this.pkt = [[0, x, y]]; return this; }
  klik(t) { this.kliki.push(t); MUZ.kliki.push(t); return this; }
  poz() { const tx = tor(this.pkt.map(([t, x]) => [t, x, E.inOut])), ty = tor(this.pkt.map(([t, , y]) => [t, y, E.inOut])); return { x: tx(), y: ty() }; }
  widoczny(t, v) { this.widocznosc.push([t, v]); return this; }
  rysuj() {
    const tx = tor(this.pkt.map(([t, x]) => [t, x, E.inOut])), ty = tor(this.pkt.map(([t, , y]) => [t, y, E.inOut]));
    let s = 1;
    for (const k of this.kliki) {
      if (T >= k - 0.07 && T < k) s = Math.min(s, lerp(1, 0.84, E.easeOut((T - (k - 0.07)) / 0.07)));
      else if (T >= k && T < k + 0.2) s = Math.min(s, lerp(0.84, 1, E.spr((T - k) / 0.2)));
    }
    let wid = 1;
    for (const [t, v] of this.widocznosc) if (T >= t) wid = v;
    this.e.style.opacity = wid;
    this.e.style.transform = 'translate(' + f2(tx()) + 'px,' + f2(ty()) + 'px) scale(' + (s * 1.9).toFixed(3) + ')';
  }
}
function pozycjaW(e, korzen) {       // pozycja środka elementu w układzie korzenia (bez transformacji)
  let x = 0, y = 0, n = e;
  while (n && n !== korzen) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x: x + e.offsetWidth / 2, y: y + e.offsetHeight / 2 };
}
/* ============================== NAPISY ============================== */

const NAPISY = [];
// napis(rodzic, html, klasy, y, tWej, tWyj, opcje) — wejście: rozmycie + wysunięcie (słowo po słowie)
function napis(rodzic, html, klasy, y, tWej, tWyj, op = {}) {
  const e = el('div', 'napis ' + klasy, rodzic);
  e.style.top = y + 'px';
  const czesci = [];
  if (op.calosc) { e.innerHTML = html; czesci.push(e); }
  else {
    // każde słowo osobno (znaczniki <span class=...> zachowane jako całe słowa)
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    [...tmp.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((s) => {
          if (!s) return;
          if (/^\s+$/.test(s)) { e.appendChild(document.createTextNode(s)); return; }
          const sp = el('span', '', e, ''); sp.textContent = s; sp.style.display = 'inline-block'; czesci.push(sp);
        });
      } else { const sp = n.cloneNode(true); sp.style.display = 'inline-block'; e.appendChild(sp); czesci.push(sp); }
    });
  }
  NAPISY.push({ e, czesci, tWej, tWyj, dWej: op.dWej || 0.7, dWyj: op.dWyj || 0.32, odstep: op.odstep != null ? op.odstep : 0.07, y: op.przes != null ? op.przes : 34 });
  return e;
}
function rysujNapisy() {
  for (const n of NAPISY) {
    const widoczny = T >= n.tWej && T < n.tWyj + n.dWyj + 0.01;
    n.e.style.display = widoczny ? 'block' : 'none';
    if (!widoczny) continue;
    n.czesci.forEach((c, i) => {
      const pw = E.apple(clamp((T - n.tWej - i * n.odstep) / n.dWej, 0, 1));
      const pz = E.wyj(clamp((T - n.tWyj - i * n.odstep * 0.4) / n.dWyj, 0, 1));
      c.style.opacity = (pw * (1 - pz)).toFixed(3);
      const b = (1 - pw) * 18 + pz * 12;
      c.style.filter = b > 0.05 ? 'blur(' + f2(b) + 'px)' : 'none';
      c.style.transform = 'translateY(' + f2((1 - pw) * n.y - pz * 16) + 'px)';
    });
  }
}

/* ============================== UJĘCIA I SCENARIUSZ ============================== */

const UJECIA = [];
function ujecie(od, doT, tlo) {
  const e = el('div', 'ujecie', document.getElementById('ekran'));
  if (tlo) e.style.background = tlo;
  const u = { e, od, do: doT, rysuj: [] };
  UJECIA.push(u);
  return u;
}

let zaciemnienie;

/* ---------- miniatury plików (SVG 48×48) ---------- */
const MINI = {
  pdf: '<svg viewBox="0 0 48 48"><g stroke="none"><path d="M11 4h18l10 10v28a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="#f4f4f8"/><path d="M29 4l10 10h-7a3 3 0 0 1-3-3z" fill="#c9c9d4"/><rect x="8" y="26" width="32" height="13" rx="2" fill="#ff453a"/><text x="24" y="36" font-size="9.5" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI, sans-serif">PDF</text><rect x="14" y="14" width="12" height="2" rx="1" fill="#b4b4c2"/><rect x="14" y="19" width="18" height="2" rx="1" fill="#b4b4c2"/></g></svg>',
  jpg: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a6e"/><stop offset=".55" stop-color="#ff6f91"/><stop offset="1" stop-color="#ffb36b"/></linearGradient><clipPath id="cj"><rect x="4" y="7" width="40" height="34" rx="6"/></clipPath></defs><g stroke="none" clip-path="url(#cj)"><rect x="4" y="7" width="40" height="34" fill="url(#gj)"/><circle cx="32" cy="19" r="5" fill="#fff1c1"/><path d="M4 41V31l11-9 10 10 7-5 12 9v5z" fill="#3b1f6b"/></g></svg>',
  folder: '<svg viewBox="0 0 48 48"><g stroke="none"><path d="M5 14a3 3 0 0 1 3-3h10l4 5h18a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#64b5ff"/><path d="M5 20h38v17a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#8cc8ff"/></g></svg>'
};

/* duch przeciąganego pliku: punkty [t, x, y, skala, krycie], między nimi E.inOut */
class Duch {
  constructor(rodzic, rodzaj, nazwa, rozm) {
    this.e = el('div', 'duch', rodzic, '<div class="duch-mini" style="width:' + rozm + 'px;height:' + rozm + 'px">' + MINI[rodzaj] + '</div><span>' + nazwa + '</span>');
    this.pkt = [];
  }
  przeciagnij(tg, td, x0, y0, x1, y1) {
    this.pkt = [[tg, x0, y0, 1, 0], [tg + 0.08, x0, y0, 1.1, 1], [tg + 0.1, x0, y0, 1.1, 1], [td, x1, y1, 1, 1], [td + 0.25, x1, y1, 0.3, 0]];
  }
  rysuj() {
    const p = this.pkt;
    if (!p.length || T < p[0][0]) { this.e.style.opacity = 0; return; }
    let v = p[p.length - 1].slice(1);
    for (let i = 1; i < p.length; i++) {
      if (T <= p[i][0]) {
        const a = p[i - 1], b = p[i], k = b[0] === a[0] ? 1 : E.inOut((T - a[0]) / (b[0] - a[0]));
        v = [1, 2, 3, 4].map((j) => lerp(a[j], b[j], k));
        break;
      }
    }
    this.e.style.opacity = clamp(v[3], 0, 1).toFixed(3);
    this.e.style.transform = 'translate(' + f2(v[0]) + 'px,' + f2(v[1]) + 'px) scale(' + v[2].toFixed(3) + ')';
  }
}
// środek elementu wyspy w pikselach kadru (wyspa w (x, y) przy skali s; skalowanie od punktu 220,0)
function ekran(w, sel, s, x, y) {
  const p = pozycjaW(w.okno.querySelector(sel), w.okno);
  return { x: x + (p.x - 220) * s, y: y + p.y * s };
}


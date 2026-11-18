/*
 * Atol — reklama. Scena liczona klatka po klatce.
 *
 * Zasada: czas T = numer klatki / 60. Wszystko (sprężyny wyspy, wejścia treści, napisy, kamera) zależy tylko od T,
 * więc każdy render daje identyczny film, zgrany co do klatki z muzyką (120 BPM: cięcia na uderzeniach).
 * Wyspa to wierna kopia prawdziwej (okna/wyspa.js): te same rozmiary, sprężyny, clip-path, kolejność wejścia treści.
 */
'use strict';

const FPS = 60;
const DLUGOSC = 50.5;
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
  inOut: bezier(0.65, 0, 0.35, 1)
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
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>'
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
      karta: q('.karta'), kafle: q('.kafle'), minutnik: q('.minutnik'), kafel: { bateria: q('.kafel.b'), glosnosc: q('.kafel.g'), procesor: q('.kafel.c') },
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
  maCoRozwinac() { const m = this.moduly; return !!this.media || m.bateria || m.glosnosc || m.procesor || m.timer; }
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
    this.e.karta.hidden = !this.media;
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
  wartoscPaska() { return lerp(this.pasek.od, this.pasek.do, E.easeOut(clamp((T - this.pasek.t0) / 0.18, 0, 1))); }
  wartoscCienia() { return lerp(this.cien.od, this.cien.do, E.ease(clamp((T - this.cien.t0) / 0.45, 0, 1))); }

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
    if (!this.media) return;
    // słupki: w rytm muzyki (16-tki), mocniej na uderzeniu stopy
    const krokN = Math.floor(T / 0.125);
    const faza = (T % 0.5) / 0.5;
    const bit = (T >= 8 && T < 32) || (T >= 36 && T < 44);
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
  klik(t) { this.kliki.push(t); return this; }
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
    this.e.style.transform = 'translate(' + f2(tx()) + 'px,' + f2(ty()) + 'px) scale(' + s.toFixed(3) + ')';
  }
}

/* ============================== PULPIT ============================== */

function pozycjaW(e, korzen) {       // pozycja środka elementu w układzie korzenia (bez transformacji)
  let x = 0, y = 0, n = e;
  while (n && n !== korzen) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x: x + e.offsetWidth / 2, y: y + e.offsetHeight / 2 };
}

class Pulpit {
  constructor(rodzic, opcje) {
    this.strona = opcje.strona;
    this.root = el('div', 'pulpit', rodzic);
    const tab = opcje.strona === 'film'
      ? '<i style="background:linear-gradient(135deg,#7a3bbf,#ff6f91)"></i><span class="pr-tab-tx">Zachód nad górami · Kanał Podróże</span><em>✕</em>'
      : '<i style="background:linear-gradient(135deg,#ff6f91,#ff9f0a)"></i><span class="pr-tab-tx">Neonowe lato · Lumen</span><em>✕</em>';
    const url = opcje.strona === 'film' ? 'wideo.local/zachod-nad-gorami' : 'odtwarzacz.local/lumen';
    const strona = opcje.strona === 'film' ? `
      <div class="film"><div class="film-obraz"><div class="niebo"></div><div class="slonce"></div><div class="gory g1"></div><div class="gory g2"></div><div class="gory g3"></div></div>
        <div class="film-pasek"></div><div class="film-tor"><b></b></div>
        <div class="film-ster"><span class="pelna" data-ik="pauza"></span><span class="pelna" data-ik="next"></span><span data-ik="glosnik"></span><em class="film-czas">4:12 / 12:30</em></div>
        <div class="film-pelny" data-ik="pelnyEkran"></div>
      </div>` : `
      <div class="odtw"><div class="odtw-tlo"></div><div class="odtw-tlo-ciemne"></div>
        <div class="odtw-okl"></div>
        <div class="odtw-info"><div class="odtw-etyk">Teraz odtwarzane</div><div class="odtw-tytul">Neonowe lato</div><div class="odtw-wyk">Lumen</div>
          <div class="odtw-postep"><span class="o-poz">0:16</span><div class="tor"><div class="wyp o-wyp"></div></div><span class="o-dl">3:24</span></div>
          <div class="odtw-ster"><span class="o-prev" data-ik="prev"></span><span class="gl"><span class="graj" data-ik="play"></span><span class="pauza" data-ik="pauza"></span></span><span class="o-next" data-ik="next"></span></div>
        </div></div>`;
    this.root.innerHTML = `
      <div class="tapeta"><i class="f1"></i><i class="f2"></i><i class="f3"></i></div>
      <div class="ikony-pulpitu">
        <div class="ik-pulpit"><b style="background:linear-gradient(160deg,#ffd76a,#f0a020)"></b>Projekty</div>
        <div class="ik-pulpit"><b style="background:linear-gradient(160deg,#9fd8ff,#3f86e0)"></b>Zdjęcia</div>
        <div class="ik-pulpit"><b style="background:linear-gradient(160deg,#f2f2f7,#a5a5b5)"></b>Kosz</div>
        <div class="ik-pulpit"><b style="background:url(../build/icon.png) center/cover;width:44px;height:44px;border-radius:10px"></b>Atol</div>
      </div>
      <div class="przegl">
        <div class="pr-belka"><div class="pr-tab">${tab}</div><div class="pr-plus">+</div>
          <div class="pr-ster"><span><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></span><span><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg></span><span><svg viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg></span></div></div>
        <div class="pr-adres"><span class="nav" data-ik="wstecz"></span><span class="nav" data-ik="dalej"></span><span class="nav" data-ik="odswiez"></span>
          <div class="pr-url"><span data-ik="klodka" style="width:12px;height:12px;display:block"></span>${url}</div></div>
        <div class="pr-strona">${strona}</div>
      </div>
      <div class="pasek-zadan">
        <div class="pz-ik"><b style="background:linear-gradient(135deg,#4cc2ff,#2a6cf0);border-radius:6px;box-shadow:inset 0 0 0 7px rgba(255,255,255,.0)"></b></div>
        <div class="pz-szukaj"><span data-ik="szukaj" style="width:15px;height:15px;display:block"></span>Szukaj</div>
        <div class="pz-ik"><b style="background:linear-gradient(160deg,#ffd76a,#f0a020)"></b></div>
        <div class="pz-ik aktywna"><b style="background:conic-gradient(from 200deg,#ff6f91,#ff9f0a,#7c6cff,#36c5ff,#ff6f91);border-radius:50%"></b></div>
        <div class="pz-ik"><b style="background:linear-gradient(160deg,#8e8e9e,#55556a)"></b></div>
        <div class="pz-ik"><b style="background:linear-gradient(160deg,#30d158,#1a9a3f)"></b></div>
        <div class="pz-ik"><b style="background:url(../build/icon.png) center/cover"></b></div>
        <div class="zasobnik"><span class="ikz" data-ik="wifi"></span><span class="ikz" data-ik="glosnik"></span><span class="ikz" data-ik="bateria"></span>
          <div class="zegar-pz">21:07<br>18.11.2026</div></div>
      </div>`;
    wstawIkony(this.root);
    const q = (s) => this.root.querySelector(s);
    this.przegl = q('.przegl'); this.belka = q('.pr-belka'); this.adres = q('.pr-adres'); this.stronaEl = q('.pr-strona');
    this.tabTx = q('.pr-tab-tx');
    this.okno = { x: 236, y: 96, w: 1064, h: 620 };
    this.pelny = { t0: -9, wej: true };          // animacja pełnego ekranu
    this.wyspa = new Wyspa(this.root, { widoczna: true, ziarno: opcje.ziarno || 3 });
    this.wyspa.ustaw(768, 0, 1);
    this.kursor = new Kursor(this.root);
    this.kamera = () => 1.25;
    if (opcje.strona === 'film') {
      this.film = { obraz: q('.film-obraz'), slonce: q('.slonce'), tor: q('.film-tor b'), czas: q('.film-czas') };
    } else {
      this.odtw = { okl: q('.odtw-okl'), tlo: q('.odtw-tlo'), tytul: q('.odtw-tytul'), wyk: q('.odtw-wyk'), poz: q('.o-poz'), dl: q('.o-dl'), wyp: q('.o-wyp'), gl: q('.gl') };
      this.utwor = null;
    }
    this.ustawGeometrie(this.okno);
  }
  // pozycja elementu strony / wyspy w układzie pulpitu
  punkt(sel) { return pozycjaW(this.root.querySelector(sel), this.root); }
  punktWyspy(sel) {
    const p = pozycjaW(this.wyspa.okno.querySelector(sel), this.wyspa.okno);
    return { x: 768 - 220 + p.x, y: p.y };
  }
  grajUtwor(u) {               // strona odtwarzacza
    this.utwor = u;
    this.odtw.okl.style.backgroundImage = 'url("' + u.okladka + '")';
    this.odtw.tlo.style.backgroundImage = 'url("' + u.okladka + '")';
    this.odtw.tytul.textContent = u.tytul; this.odtw.wyk.textContent = u.wykonawca;
    this.odtw.dl.textContent = czas(u.dlugosc);
    this.odtw.gl.classList.toggle('gra', !!u.gra);
    this.tabTx.textContent = u.tytul + ' · ' + u.wykonawca;
    this.utworT0 = T;
  }
  pelnyEkran(wej) { this.pelny = { t0: T, wej }; }
  ustawGeometrie(g) {
    const s = this.przegl.style;
    s.left = f2(g.x) + 'px'; s.top = f2(g.y) + 'px'; s.width = f2(g.w) + 'px'; s.height = f2(g.h) + 'px';
  }
  rysuj() {
    // kamera: górny środek ekranu przyklejony do góry kadru
    const s = this.kamera();
    this.root.style.transform = 'translate(' + f2(960 - 768 * s) + 'px,0) scale(' + s.toFixed(4) + ')';
    // okno przeglądarki / pełny ekran
    const p = this.pelny.wej ? E.inOut(clamp((T - this.pelny.t0) / 0.45, 0, 1)) : 1 - E.inOut(clamp((T - this.pelny.t0) / 0.45, 0, 1));
    const fs = this.pelny.t0 < 0 ? 0 : p;
    const g = { x: lerp(this.okno.x, 0, fs), y: lerp(this.okno.y, 0, fs), w: lerp(this.okno.w, 1536, fs), h: lerp(this.okno.h, 864, fs) };
    this.ustawGeometrie(g);
    const hb = 40 * (1 - fs), ha = 42 * (1 - fs);
    this.belka.style.height = f2(hb) + 'px'; this.adres.style.height = f2(ha) + 'px';
    this.adres.style.borderBottomWidth = fs > 0.98 ? '0' : '1px';
    this.przegl.style.borderRadius = f2(9 * (1 - fs)) + 'px';
    this.przegl.style.zIndex = fs > 0 ? 5 : '';
    this.stronaEl.style.top = f2(hb + ha) + 'px';
    if (this.film) {
      const sw = g.w, sh = g.h - hb - ha;
      const sk = Math.max(sw / 1536, sh / 864) * (1.0 + 0.04 * clamp((T - 30) / 8, 0, 1));
      this.film.obraz.style.transform = 'scale(' + sk.toFixed(4) + ')';
      this.film.slonce.style.transform = 'translateY(' + f2(-(T - 30) * 6) + 'px)';
      const pos = 252 + (T - 30);
      this.film.tor.style.width = (pos / 750 * 100).toFixed(3) + '%';
      this.film.czas.textContent = czas(pos) + ' / 12:30';
    } else if (this.utwor) {
      const pos = Math.min(this.utwor.dlugosc, this.utwor.pozycja + (this.utwor.gra ? T - this.utworT0 : 0));
      this.odtw.poz.textContent = czas(pos);
      this.odtw.wyp.style.transform = 'scaleX(' + (pos / this.utwor.dlugosc).toFixed(4) + ')';
    }
    this.kursor.rysuj();
    this.wyspa.rysuj();
  }
}

/* ============================== USTAWIENIA (makieta) ============================== */

const wiersz = (ik, kol, tytul, opis, id, wl) => `
  <div class="ust-wiersz"><span class="ik" data-ik="${ik}" style="background:${kol}22;color:${kol}"></span>
    <div class="tx"><b>${tytul}</b><span>${opis}</span></div>
    <div class="przel" data-id="${id}" data-wl="${wl ? 1 : 0}"><b></b><i></i></div></div>`;

class Ustawienia {
  constructor(rodzic) {
    this.e = el('div', 'ust', rodzic, `
      <div class="ust-belka"><span><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></span><span><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg></span><span><svg viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg></span></div>
      <div class="ust-app">
        <aside class="ust-bok">
          <div class="ust-marka"><img src="../build/icon.png"><div><b>Atol</b><small>od <em>studio SZykAI</em></small></div></div>
          <nav class="ust-menu"><div class="ust-wsk"></div>
            <div class="ust-poz akt"><span data-ik="wyspaIk"></span>Wyspa</div>
            <div class="ust-poz"><span data-ik="moduly"></span>Moduły</div>
            <div class="ust-poz"><span data-ik="dzwonek"></span>Powiadomienia</div>
            <div class="ust-poz"><span data-ik="system"></span>System</div>
            <div class="ust-poz"><span data-ik="info"></span>O aplikacji</div>
          </nav>
          <div class="ust-stopka"><div class="ust-stan"><span class="ust-kropka"><i></i></span>Wyspa działa</div><div class="ust-wersja">Atol 4.0.1</div></div>
        </aside>
        <main class="ust-tresc">
          <div class="ust-nagl"><h1>Wyspa</h1><p>Wygląd i zachowanie wyspy</p></div>
          <div class="ust-sekcja">
            <div class="ust-karta"><h3>Stan</h3>
              <div class="ust-podglad"><i class="mini-wyspa" style="position:absolute;left:50%;top:14px;width:120px;height:30px;margin-left:-60px;border-radius:15px;background:#000"></i></div>
              <div class="ust-przyc" style="margin-top:12px"><span class="gl">Uruchom ponownie</span><span>Wyłącz</span></div>
            </div>
            <div class="ust-karta"><h3>Wygląd wyspy</h3>
              <div class="style-kafle">
                <div class="styl-kafel wyb"><div class="styl-pod"><i style="top:10px;width:70px;height:20px;margin-left:-35px;border-radius:10px"></i></div><b>Pastylka</b><span>Unosi się pod krawędzią</span></div>
                <div class="styl-kafel"><div class="styl-pod"><i style="top:0;width:84px;height:22px;margin-left:-42px;border-radius:0 0 9px 9px"></i></div><b>Notch</b><span>Przyczepiony do krawędzi</span></div>
              </div>
            </div>
          </div>
          <div class="ust-sekcja">
            <div class="ust-karta"><h3>Na wyspie</h3>
              ${wiersz('nuta', '#bf5af2', 'Muzyka', 'Okładka i wizualizator, karta z postępem', 'muzyka', true)}
              ${wiersz('bateria', '#30d158', 'Bateria', 'Poziom naładowania po rozwinięciu', 'bateria', false)}
              ${wiersz('glosnik', '#0a84ff', 'Głośność', 'Aktualny poziom dźwięku', 'glosnosc', true)}
              ${wiersz('cpu', '#bf5af2', 'Procesor', 'Obciążenie procesora na żywo', 'procesor', false)}
              ${wiersz('zegar', '#ff9f0a', 'Minutnik', '1, 5, 10 lub 25 minut', 'timer', true)}
            </div>
          </div>
          <div class="ust-sekcja">
            <div class="ust-karta"><h3>Pokazuj powiadomienia</h3>
              ${wiersz('zegar', '#ff9f0a', 'Minutnik', 'Gdy minie ustawiony czas', 'p-timer', true)}
              ${wiersz('bateria', '#ffd60a', 'Bateria', 'Niski poziom: 20% i 10%', 'p-bateria', true)}
              ${wiersz('glosnik', '#0a84ff', 'Głośność', 'Przy każdej zmianie', 'p-glosnosc', true)}
              ${wiersz('piorun', '#30d158', 'Ładowanie', 'Podłączenie i odłączenie ładowarki', 'p-ladowanie', true)}
            </div>
          </div>
        </main>
      </div>`);
    wstawIkony(this.e);
    const q = (s) => this.e.querySelector(s);
    this.wsk = q('.ust-wsk'); this.pozycje = [...this.e.querySelectorAll('.ust-poz')];
    this.h1 = q('.ust-nagl h1'); this.opis = q('.ust-nagl p');
    this.sekcje = [...this.e.querySelectorAll('.ust-sekcja')].map((s) => ({ e: s, el: [...s.querySelectorAll('.ust-karta > *')] }));
    this.przel = new Map([...this.e.querySelectorAll('.przel')].map((p) => [p.dataset.id, { e: p, wl: p.dataset.wl === '1', t0: -9 }]));
    this.kropka = q('.ust-kropka i');
    this.sW = new Sprezyna(0, 0.05); SPREZYNY_INNE.push(this.sW);
    this.akt = 0; this.stara = -1; this.tSek = -9;
    this.tytulAnim = { t0: -9, tytul: 'Wyspa', opis: 'Wygląd i zachowanie wyspy' };
    this.kursor = new Kursor(this.e);
    this.wejscie = 36;
  }
  punkt(sel) { return pozycjaW(this.e.querySelector(sel), this.e); }
  sekcja(i) {
    const TY = [['Wyspa', 'Wygląd i zachowanie wyspy'], ['Moduły', 'Co wyspa pokazuje na stałe'], ['Powiadomienia', 'Krótkie komunikaty na wyspie']];
    this.stara = this.akt; this.akt = i; this.tSek = T;
    this.sekcje.forEach((s, j) => { s.e.style.display = j === i || j === this.stara ? 'block' : 'none'; });
    this.sW.ustaw(i * 42, { k: 300, c: 22 });
    this.pozycje.forEach((p, j) => p.classList.toggle('akt', j === i));
    this.tytulAnim = { t0: T, tytul: TY[i][0], opis: TY[i][1] };
  }
  przelacz(id) { const p = this.przel.get(id); p.wl = !p.wl; p.t0 = T; }
  rysuj() {
    // wejście okna
    const k = anim(this.wejscie, 0.7, 0.9, 1, E.spr), op = anim(this.wejscie, 0.3, 0, 1, E.ease);
    this.e.style.transform = 'translate(-50%,-50%) scale(' + (1.3 * k).toFixed(4) + ')';
    this.e.style.opacity = op.toFixed(3);
    // wskaźnik menu
    this.wsk.style.transform = 'translateY(' + f2(this.sW.x) + 'px)';
    // nagłówek: rozmycie przy zmianie
    const ta = this.tytulAnim, dt = T - ta.t0;
    if (dt < 0.12) { const p = dt / 0.12; this.h1.style.opacity = this.opis.style.opacity = (1 - p).toFixed(3); this.h1.style.filter = 'blur(' + f2(6 * p) + 'px)'; }
    else {
      if (this.h1.textContent !== ta.tytul) { this.h1.textContent = ta.tytul; this.opis.textContent = ta.opis; }
      const p = E.apple(clamp((dt - 0.12) / 0.4, 0, 1));
      this.h1.style.opacity = this.opis.style.opacity = p.toFixed(3);
      this.h1.style.filter = p < 0.99 ? 'blur(' + f2(6 * (1 - p)) + 'px)' : 'none';
    }
    // sekcje
    this.sekcje.forEach((s, i) => {
      if (i === this.akt) {
        s.e.style.display = 'block'; s.e.style.opacity = 1;
        s.el.forEach((e, j) => {
          const p = E.apple(clamp((T - this.tSek - 0.06 - j * 0.045) / 0.5, 0, 1));
          e.style.opacity = p.toFixed(3);
          e.style.transform = 'translateY(' + f2(14 * (1 - p)) + 'px)';
          e.style.filter = p < 0.99 ? 'blur(' + f2(3 * (1 - p)) + 'px)' : 'none';
        });
      } else if (i === this.stara && T < this.tSek + 0.14) {
        s.e.style.display = 'block'; s.e.style.opacity = (1 - (T - this.tSek) / 0.14).toFixed(3);
      } else s.e.style.display = 'none';
    });
    // przełączniki
    this.przel.forEach((p) => {
      const q = clamp((T - p.t0) / 0.42, 0, 1), x = p.wl ? E.spr(q) : 1 - E.spr(q);
      p.e.querySelector('i').style.transform = 'translateX(' + f2(18 * x) + 'px)';
      p.e.querySelector('b').style.opacity = clamp(p.wl ? q * 2.5 : 1 - q * 2.5, 0, 1).toFixed(3);
    });
    // puls kropki stanu
    const f = ((T - 36) % 2.2) / 2.2;
    this.kropka.style.transform = 'scale(' + (1 + 2 * E.easeOut(f)).toFixed(3) + ')';
    this.kropka.style.opacity = (0.7 * (1 - E.easeOut(f))).toFixed(3);
    this.kursor.rysuj();
  }
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

function scenariusz() {
  const JASNE = '#f5f5f7';

  /* ---------------- 1. WSTĘP (0–8 s): jasne tło, wyspa w centrum ---------------- */
  {
    const u = ujecie(0, 8, JASNE);
    const w = new Wyspa(u.e, { ziarno: 11 });
    const s = tor([[0, 3.0], [3.99, 3.0], [4.0, 2.4]]);
    const y = tor([[0, 384], [3.99, 384], [4.0, 250]]);
    u.rysuj.push(() => { w.ustaw(960, y(), s()); w.rysuj(); });

    o(0.6, () => w.pokaz());
    o(1.5, () => w.ustawMedia(utwor('lato', 16)));
    o(2.5, () => w.ustawMedia(null));
    o(3.5, () => w.wcisnij()); o(3.68, () => w.pusc());
    o(5.0, () => w.wcisnij()); o(5.18, () => w.pusc());
    o(6.0, () => w.ustawMedia(utwor('lato', 20)));
    o(6.5, () => w.powiadomienie({ typ: 'glosnosc', poziom: 60 }));
    o(7.0, () => w.zbiorczo(() => { w.koniecPowiad(); w.ustawMedia(null); w.startTimer(300); }));
    o(7.5, () => w.ustawMedia(utwor('lato', 22)));

    napis(u.e, 'Poznaj <span class="grad">Atol.</span>', 'duzy jasny', 600, 2.75, 3.72);
    napis(u.e, 'Dynamiczna wyspa.', 'duzy jasny', 470, 4.0, 5.72);
    napis(u.e, '<span class="grad">Teraz na Windows.</span>', 'duzy jasny', 600, 5.0, 5.72, { odstep: 0.09 });
    const slowa = [['Muzyka.', 6.0], ['Powiadomienia.', 6.5], ['Minutnik.', 7.0], ['I wiele więcej.', 7.5]];
    slowa.forEach(([tx, t], i) => napis(u.e, tx, 'duzy jasny', 540, t, i < 3 ? t + 0.42 : 7.86,
      { dWej: 0.34, dWyj: 0.1, odstep: 0.03, przes: 22 }));
  }

  /* ---------------- 2. PULPIT: MUZYKA (8–16 s) ---------------- */
  {
    const u = ujecie(8, 16);
    const d = new Pulpit(u.e, { strona: 'muzyka', ziarno: 5 });
    const w = d.wyspa;
    const przyc = el('div', 'zaciemnienie');
    d.root.insertBefore(przyc, d.wyspa.uchwyt);          // przyciemnia pulpit POD wyspą (wyspa zostaje wyraźna)
    const scrim = el('div', 'scrim-dol', u.e);
    d.kamera = tor([[8, 1.25], [9.5, 1.32, E.ease], [10.6, 3.0, E.kamera], [15.25, 3.0], [16.0, 1.9, E.kamera]]);
    const ciemno = tor([[8, 0], [10.0, 0], [10.8, 0.42, E.ease], [15.2, 0.42], [15.9, 0, E.ease]]);
    u.rysuj.push(() => {
      d.rysuj();
      przyc.style.opacity = ciemno().toFixed(3);
      scrim.style.opacity = (ciemno() / 0.42).toFixed(3);
    });

    o(8, () => {
      d.grajUtwor(utwor('lato', 15.5, false));
      const gr = d.punkt('.gl');
      d.kursor.start(gr.x + 70, gr.y + 60).ruch(8.0, 8.2, gr.x + 3, gr.y + 4).klik(8.25);
      d.kursor.ruch(10.5, 11.1, 768 + 18, 22).klik(11.25);
      d.kursor.widoczny(10.0, 0).widoczny(10.45, 1);
    });
    o(8.25, () => d.grajUtwor(utwor('lato', 15.75, true)));
    o(8.5, () => w.ustawMedia(utwor('lato', 16)));
    o(11.25, () => {
      w.rozwin();
      const nx = d.punktWyspy('.s-next');
      d.kursor.ruch(12.2, 12.65, nx.x + 2, nx.y + 3).klik(12.75);
      d.kursor.ruch(14.45, 14.9, 1010, 300).klik(15.0);
    });
    o(12.75, () => { w.ustawMedia(utwor('godzina', 0)); d.grajUtwor(utwor('godzina', 0)); });
    o(15.0, () => w.zwin());

    napis(u.e, 'Twoja muzyka. <span class="grad">Zawsze na wierzchu.</span>', 'sredni ciemny', 850, 13.1, 15.2);
  }

  /* ---------------- 3. POWIADOMIENIA I MODUŁY (16–28 s) ---------------- */
  {
    const u = ujecie(16, 28);
    el('div', 'tlo-szklo', u.e);
    const pos = el('div', 'poswiata', u.e);
    el('div', 'winieta', u.e);
    const w = new Wyspa(u.e, { widoczna: true, ziarno: 7 });
    const s = tor([[16, 2.8], [24.0, 2.8], [24.6, 1.9, E.kamera], [26.0, 1.9], [26.6, 2.8, E.kamera]]);
    const y = tor([[16, 250], [24.0, 250], [24.6, 92, E.kamera], [26.0, 92], [26.6, 250, E.kamera]]);
    const KOLORY = [[16, '#0a84ff'], [18.5, '#30d158'], [20.5, '#ffd60a'], [22.5, '#ff9f0a'], [24, '#7c6cff'], [26, '#ff9f0a']];
    u.rysuj.push(() => {
      w.ustaw(960, y(), s()); w.rysuj();
      let i = 0; while (i + 1 < KOLORY.length && T >= KOLORY[i + 1][0]) i++;
      const k0 = hex(KOLORY[Math.max(0, i - 1)][1]), k1 = hex(KOLORY[i][1]);
      const p = E.ease(clamp((T - KOLORY[i][0]) / 0.5, 0, 1));
      pos.style.background = rgb(k0.map((x, j) => lerp(x, k1[j], i === 0 ? 1 : p)));
      pos.style.opacity = anim(16.3, 0.6, 0, 0.5, E.ease).toFixed(3);
    });

    o(16, () => {
      w.zbiorczo(() => { w.ustawMedia(utwor('godzina', 3.2)); });
      w.natychmiast();
    });
    o(16.5, () => w.powiadomienie({ typ: 'glosnosc', poziom: 55 }));
    o(16.75, () => w.powiadomienie({ typ: 'glosnosc', poziom: 60 }));
    o(17.0, () => w.powiadomienie({ typ: 'glosnosc', poziom: 65 }));
    o(17.25, () => w.powiadomienie({ typ: 'glosnosc', poziom: 70 }));
    o(18.0, () => w.koniecPowiad());
    o(18.5, () => w.powiadomienie({ typ: 'ladowanie', procent: 76 }));
    o(20.0, () => w.koniecPowiad());
    o(20.5, () => w.powiadomienie({ typ: 'bateria', procent: 19 }));
    o(22.0, () => w.koniecPowiad());
    o(22.5, () => w.powiadomienie({ typ: 'timer', min: 5 }));
    o(23.6, () => w.koniecPowiad());
    o(23.75, () => w.zbiorczo(() => { w.ustawModuly({ bateria: true, glosnosc: true, procesor: true, timer: true }); w.startTimer(299.6); }));
    o(24.0, () => w.rozwin());
    o(26.0, () => w.zwin());

    napis(u.e, '<span class="grad">Powiadomienia</span>', 'brew ciemny', 590, 16.4, 23.7, { calosc: true });
    [['Głośność.', 16.5, 18.2], ['Ładowanie.', 18.5, 20.2], ['Bateria.', 20.5, 22.2], ['Minutnik.', 22.5, 23.7]]
      .forEach(([tx, a, b]) => napis(u.e, tx, 'sredni ciemny', 640, a, b, { dWej: 0.5 }));
    napis(u.e, '<span class="grad">Moduły</span>', 'brew ciemny', 860, 24.3, 25.75, { calosc: true });
    napis(u.e, 'Wszystko w jednym miejscu.', 'sredni ciemny', 905, 24.4, 25.75);
    napis(u.e, '<span class="grad">Minutnik i muzyka</span>', 'brew ciemny', 590, 26.3, 27.7, { calosc: true });
    napis(u.e, 'Jednym spojrzeniem.', 'sredni ciemny', 640, 26.4, 27.7);
  }

  /* ---------------- 4. PASTYLKA / NOTCH (28–32 s) ---------------- */
  {
    const u = ujecie(28, 32);
    const d = new Pulpit(u.e, { strona: 'muzyka', ziarno: 9 });
    d.okno = { x: 236, y: 440, w: 1064, h: 400 };          // okno poza kadrem: pod wyspą tylko tapeta
    d.ustawGeometrie(d.okno);
    const w = d.wyspa;
    el('div', 'scrim-dol', u.e);
    d.kamera = tor([[28, 2.7], [32, 2.85, E.lin]]);
    u.rysuj.push(() => d.rysuj());
    o(28, () => {
      d.grajUtwor(utwor('godzina', 15));
      w.zbiorczo(() => w.ustawMedia(utwor('godzina', 15)));
      w.natychmiast();
      d.kursor.start(1010, 330).widoczny(28, 0).widoczny(30.2, 1).ruch(30.2, 30.65, 768 + 30, 16).klik(30.75);
    });
    o(29.4, () => w.zmienStyl('notch'));
    o(30.75, () => w.rozwin());
    napis(u.e, 'Pastylka.', 'sredni ciemny', 860, 28.25, 29.3);
    napis(u.e, 'Albo <span class="grad">notch.</span>', 'sredni ciemny', 860, 29.9, 31.75);
  }

  /* ---------------- 5. PEŁNY EKRAN (32–36 s) ---------------- */
  {
    const u = ujecie(32, 36);
    const d = new Pulpit(u.e, { strona: 'film', ziarno: 13 });
    const w = d.wyspa;
    d.kamera = tor([[32, 1.25], [36, 1.25]]);
    u.rysuj.push(() => d.rysuj());
    o(32, () => {
      w.zbiorczo(() => w.ustawMedia(utwor('film', 252)));
      w.natychmiast();
      const pe = d.punkt('.film-pelny');
      d.kursor.start(pe.x - 90, pe.y - 70).ruch(32.0, 32.3, pe.x + 1, pe.y + 2).klik(32.4).widoczny(32.5, 0);
    });
    o(32.4, () => d.pelnyEkran(true));
    o(32.6, () => w.schowaj());
    o(34.5, () => d.pelnyEkran(false));
    o(34.95, () => w.pokaz());
    napis(u.e, 'Pełny ekran? <span class="grad-ciepla">Wyspa znika.</span>', 'sredni ciemny', 880, 33.0, 34.3);
    napis(u.e, 'I wraca, <span class="grad">gdy trzeba.</span>', 'sredni ciemny', 905, 35.0, 35.82, { dWyj: 0.16 });
  }

  /* ---------------- 6. USTAWIENIA (36–40 s) ---------------- */
  {
    const u = ujecie(36, 40);
    el('div', 'tlo-szklo', u.e);
    el('div', 'winieta', u.e);
    const st = new Ustawienia(u.e);
    st.e.style.left = '960px'; st.e.style.top = '610px';
    u.rysuj.push(() => st.rysuj());
    o(36, () => {
      const m = st.punkt('.ust-poz:nth-child(3)'), pw = st.punkt('.ust-poz:nth-child(4)');
      st.kursor.start(520, 420).ruch(36.3, 36.9, m.x - 30, m.y + 4).klik(37.0);
      o(37.0, () => {
        st.sekcja(1);
        const b = st.punkt('[data-id="bateria"]'), c = st.punkt('[data-id="procesor"]');
        st.kursor.ruch(37.08, 37.42, b.x + 2, b.y + 3).klik(37.5).ruch(37.6, 37.92, c.x + 2, c.y + 3).klik(38.0)
          .ruch(38.08, 38.42, pw.x - 30, pw.y + 4).klik(38.5);
      });
    });
    o(37.5, () => st.przelacz('bateria'));
    o(38.0, () => st.przelacz('procesor'));
    o(38.5, () => st.sekcja(2));
    napis(u.e, 'Ustawienia, które <span class="grad">po prostu działają.</span>', 'sredni ciemny', 62, 36.2, 39.75, { dWyj: 0.22 });
  }

  /* ---------------- 7. MONTAŻ + PLANSZA KOŃCOWA (40–50,5 s) ---------------- */
  {
    const u = ujecie(40, 99, JASNE);
    const w = new Wyspa(u.e, { widoczna: true, ziarno: 17 });
    const s = tor([[40, 2.6], [44.0, 2.6], [44.9, 2.1, E.kamera]]);
    const y = tor([[40, 230], [44.0, 230], [44.9, 205, E.kamera]]);
    const ikona = el('img', 'logo-ikona', u.e); ikona.src = '../build/icon.png';
    u.rysuj.push(() => {
      w.ustaw(960, y(), s()); w.rysuj();
      const p = E.apple(clamp((T - 46.5) / 0.8, 0, 1));
      ikona.style.top = f2(750 + 20 * (1 - p)) + 'px';
      ikona.style.opacity = p.toFixed(3);
      ikona.style.transform = 'scale(' + (0.6 + 0.4 * E.spr(clamp((T - 46.5) / 0.6, 0, 1))).toFixed(4) + ')';
      ikona.style.width = ikona.style.height = '96px'; ikona.style.marginLeft = '-48px'; ikona.style.borderRadius = '22px';
    });
    o(40, () => { w.natychmiast(); });
    o(40.5, () => w.ustawMedia(utwor('lato', 40)));
    o(41.0, () => w.powiadomienie({ typ: 'glosnosc', poziom: 80 }));
    o(41.5, () => w.zbiorczo(() => { w.koniecPowiad(); w.startTimer(124.5); }));
    o(42.0, () => w.rozwin());
    o(43.0, () => w.zbiorczo(() => { w.zwin(); w.powiadomienie({ typ: 'ladowanie', procent: 82 }); }));
    o(43.5, () => w.zbiorczo(() => { w.koniecPowiad(); w.ustawMedia(null); }));
    o(44.0, () => w.stopTimer());
    o(45.0, () => w.wcisnij()); o(45.18, () => w.pusc());
    o(46.0, () => w.ustawMedia(utwor('lato', 41, true)));
    o(48.2, () => w.ustawMedia(null));

    napis(u.e, '<span class="grad">Atol</span>', 'jasny', 330, 45.0, 99, { calosc: true, dWej: 1.0, przes: 40 })
      .style.cssText += 'font-size:200px;font-weight:700;letter-spacing:-8px;line-height:1.1;';
    napis(u.e, 'Dynamiczna wyspa dla Windows.', 'maly jasny', 590, 45.6, 99, { dWej: 0.8, odstep: 0.05 })
      .style.cssText += 'font-size:46px;letter-spacing:-1px;';
    napis(u.e, 'studio SZykAI', 'maly szary', 868, 46.8, 99, { calosc: true, dWej: 0.8 })
      .style.cssText += 'font-size:26px;letter-spacing:.5px;font-weight:600;';
  }

  // zaciemnienie początku i końca
  zaciemnienie = el('div', 'zaciemnienie', document.getElementById('ekran'));
  zaciemnienie.style.zIndex = 50;
  znacznik = el('div', '', document.body);
  znacznik.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;z-index:99;';
}
let znacznik;

/* ============================== PĘTLA ============================== */

function rysujWszystko() {
  for (const u of UJECIA) {
    const wid = T >= u.od && T < u.do;
    u.e.classList.toggle('widoczne', wid);
    if (wid) u.rysuj.forEach((f) => f());
  }
  rysujNapisy();
  const z = Math.max(1 - clamp(T / 0.45, 0, 1), E.inOut(clamp((T - 49.3) / 1.1, 0, 1)));
  zaciemnienie.style.opacity = z.toFixed(3);
}

window.przygotuj = async function () {
  await document.fonts.load('700 100px "Segoe UI Variable Display"');
  await document.fonts.load('600 14px "Segoe UI Variable Text"');
  przygotujUtwory();
  scenariusz();
  // obrazki (ikona) muszą być wczytane przed pierwszą klatką
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((ok) => { im.onload = im.onerror = ok; }))));
  await new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = '../build/icon.png'; });
  return true;
};

window.klatka = async function (n, bezRysowania) {
  while (nr < n) {
    nr++;
    T = nr / FPS;
    uruchomZdarzenia();
    for (const w of WYSPY) w.krok(1 / FPS);
    for (const s of SPREZYNY_INNE) for (let i = 0; i < 4; i++) s.krok(1 / FPS / 4);
  }
  if (bezRysowania) return;
  rysujWszystko();
  // znacznik numeru klatki (1 piksel w rogu; render.js go sprawdza i zamazuje)
  znacznik.style.background = 'rgb(' + (n % 64) * 4 + ',' + (Math.floor(n / 64) % 64) * 4 + ',77)';
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
};

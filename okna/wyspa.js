/*
 * Wyspa — logika pastylki.
 *
 * Stany (od najważniejszego):
 *   rozw     — rozwinięta karta (kliknięcie): multimedia + włączone moduły
 *   powiad   — krótkie powiadomienie (~3 s)
 *   kompakt  — zwinięta z treścią: okładka + wizualizator (muzyka) i/lub licznik minutnika
 *   pusta    — mała czarna pastylka
 *
 * Animacje:
 *   - Kształt pastylki (szerokość, wysokość, zaokrąglenie) liczą trzy SPRĘŻYNY (fizyka: siła sprężystości
 *     + tłumienie), krok po kroku w każdej klatce (requestAnimationFrame, ~60 fps). Dzięki temu animacja
 *     ma lekkie przestrzelenie i powrót, a przerwana w połowie płynnie zmienia kierunek z zachowaniem prędkości.
 *   - Kształt jest wycinany przez clip-path z dużego czarnego prostokąta — nie zmieniamy rozmiaru żadnego
 *     elementu, więc przeglądarka nie przelicza układu strony w każdej klatce (brak szarpania).
 *   - Treść porusza się wyłącznie przez transform i opacity.
 *   - Okno ma stały rozmiar i jest przezroczyste; kliknięcia poza pastylką przechodzą do aplikacji pod spodem.
 *
 * Rozwinięta wyspa ma dwie strony (4.1), przełączane kółkiem myszy: 1 — muzyka, kafelki, minutnik;
 * 2 — schowek na pliki. Plik przeciągnięty nad wyspę sam ją rozwija na stronie schowka.
 * Pusty schowek to nie duży panel, tylko mały pasek (ikona i „0”) — dalej w stanie „rozw”.
 * Karta muzyki ma drugi widok: tekst piosenki (mikrofon; moduł „tekst” w ustawieniach).
 */
(function () {
  'use strict';

  var api = window.wyspa;
  var $ = function (id) { return document.getElementById(id); };

  var scena = $('scena');
  var wyspa = $('wyspa');
  var rozwEl = $('rozw');

  /* ====================== geometria ====================== */

  // "Płótno" #wyspa w oknie (musi się zgadzać z wyspa.css). W stylu NOTCH płótno zaczyna się na samej górze
  // ekranu (plotnoY = 0), a kształt jest "przyczepiony" do krawędzi.
  var PLOTNO_W = 420, PLOTNO_H = 480, PLOTNO_X = 10;
  var plotnoY = 8;
  var notch = false;

  var GEOM = {
    pusta:       { w: 122, h: 34 },
    muzyka:      { w: 236, h: 34 },
    timer:       { w: 184, h: 34 },
    muzykaTimer: { w: 296, h: 34 },
    powiad:      { w: 344, h: 68, r: 34 },
    rozw:        { w: 372, r: 40 }          // wysokość wynika z treści (mierzona)
  };

  /* ====================== ikony (SVG) ====================== */

  var IKONY = {
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
    schowek: '<svg viewBox="0 0 24 24"><path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5.6 5h12.8L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/></svg>',
    upusc: '<svg viewBox="0 0 24 24"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
    plik: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    mikrofon: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>'
  };

  Array.prototype.forEach.call(document.querySelectorAll('[data-ikona]'), function (el) {
    el.innerHTML = IKONY[el.dataset.ikona] || '';
  });

  /* ====================== sprężyny ====================== */
  // a = -k·(x - cel) - c·v   (k: sztywność, c: tłumienie, masa = 1)
  // Mniejsze tłumienie = wyraźniejsze przestrzelenie.

  function Sprezyna(x, eps) {
    this.x = x; this.v = 0; this.cel = x;
    this.k = 300; this.c = 26;
    this.eps = eps;                  // dokładność, przy której uznajemy, że spoczywa
  }
  Sprezyna.prototype.ustaw = function (cel, p) {
    this.cel = cel;
    if (p) { this.k = p.k; this.c = p.c; }
    budz();
  };
  Sprezyna.prototype.krok = function (dt) {
    var a = -this.k * (this.x - this.cel) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  };
  Sprezyna.prototype.spoczywa = function () {
    return Math.abs(this.x - this.cel) < this.eps && Math.abs(this.v) < this.eps * 8;
  };
  Sprezyna.prototype.dociagnij = function () { this.x = this.cel; this.v = 0; };

  // Ustawienia sprężyn dla różnych przejść (tłumienie względne ζ = c / (2·√k))
  var P = {
    rozwin:  { k: 240, c: 21 },   // ζ≈0,68 — wyraźne, żywe odbicie
    zwin:    { k: 300, c: 28 },   // ζ≈0,81 — delikatne odbicie, bez "zapadania się"
    kompakt: { k: 270, c: 21 },   // ζ≈0,64 — pojawienie się / zniknięcie muzyki
    powiad:  { k: 520, c: 31 },   // ζ≈0,68 — powiadomienie: szybkie (akcje systemowe), z lekkim odbiciem
    wcisnij: { k: 700, c: 40 },   // ζ≈0,76 — przytrzymanie pustej pastylki: szybko rośnie
    pusc:    { k: 340, c: 15 },   // ζ≈0,41 — puszczenie: sprężyste odbicie do normalnego rozmiaru
    pokaz:   { k: 190, c: 17 },   // ζ≈0,62 — wysunięcie wyspy
    schowaj: { k: 260, c: 30 }    // ζ≈0,93 — schowanie (szybko, bez odbicia)
  };

  var sW = new Sprezyna(GEOM.pusta.w, 0.05);
  var sH = new Sprezyna(GEOM.pusta.h, 0.05);
  var sR = new Sprezyna(GEOM.pusta.h / 2, 0.05);
  var sV = new Sprezyna(0, 0.002);          // widoczność całej wyspy: 0 = schowana, 1 = widoczna
  var SPREZYNY = [sW, sH, sR, sV];

  /* ====================== pętla animacji ====================== */

  var rafId = 0, ostatniCzas = 0, tWolnej = 0;
  var kLewa = $('k-lewa'), kPrawa = $('k-prawa');

  function budz() {
    if (tWolnej) { clearTimeout(tWolnej); tWolnej = 0; rafId = 0; }      // przerwij "wolny" tryb — kształt rusza
    if (!rafId) { ostatniCzas = performance.now(); rafId = requestAnimationFrame(klatka); }
  }

  function klatka(t) {
    var dt = Math.min(0.05, Math.max(0, (t - ostatniCzas) / 1000));
    ostatniCzas = t;

    // fizyka w małych krokach (1/240 s) — stabilna niezależnie od liczby klatek na sekundę
    var n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (var i = 0; i < n; i++) for (var j = 0; j < SPREZYNY.length; j++) SPREZYNY[j].krok(h);

    var ksztaltWRuchu = !SPREZYNY.every(function (s) { return s.spoczywa(); });
    if (!ksztaltWRuchu) SPREZYNY.forEach(function (s) { s.dociagnij(); });

    rysuj();
    var vizWRuchu = krokWizualizatora(dt, t);
    var postepWRuchu = krokPostepu();
    if (!ksztaltWRuchu) sprawdzMysz();      // kształt się ustalił — kursor mógł znaleźć się poza nim

    // Kształt w ruchu — pełne 60 klatek/s. Same słupki muzyki / pasek postępu — ok. 30 klatek/s:
    // różnicy nie widać, a przezroczyste okno odświeża się dwa razy rzadziej (mniej pracy dla komputera).
    if (ksztaltWRuchu) rafId = requestAnimationFrame(klatka);
    else if (vizWRuchu || postepWRuchu) {
      rafId = -1;                                                        // "zajęte", ale bez rAF
      tWolnej = setTimeout(function () { tWolnej = 0; rafId = requestAnimationFrame(klatka); }, 26);
    }
    else rafId = 0;
  }

  // Kształt widoczny w tej klatce. Pastylka: wprost ze sprężyn. Notch: widoczność (sV) "wysuwa" go z krawędzi
  // ekranu (wysokość od 0), a wklęsłe "uszka" (e) łączące go z krawędzią rosną razem z wysokością.
  function ksztalt() {
    if (!notch) {
      var h0 = Math.max(8, sH.x);
      return { w: sW.x, h: h0, r: Math.max(0, Math.min(sR.x, h0 / 2, sW.x / 2)), e: 0 };
    }
    var v = Math.max(0, sV.x);
    var h = Math.max(0, sH.x * v);
    var w = sW.x * (0.72 + 0.28 * Math.min(1, v));
    var e = Math.min(14, 6 + sH.x * 0.025) * Math.min(1, v);
    e = Math.min(e, h * 0.5);
    var r = Math.max(0, Math.min(sR.x, h - e, w / 2));
    return { w: w, h: h, r: r, e: e };
  }

  function rysuj() {
    var k = ksztalt(), w = k.w, h = k.h, r = k.r;
    var bok = (PLOTNO_W - w) / 2;
    if (!notch) {
      wyspa.style.clipPath = 'inset(0px ' + bok.toFixed(2) + 'px ' + (PLOTNO_H - h).toFixed(2) + 'px ' + bok.toFixed(2) + 'px round ' + r.toFixed(2) + 'px)';
      var v = sV.x;
      scena.style.opacity = Math.max(0, Math.min(1, v * 1.4 - 0.15)).toFixed(3);
      scena.style.transform = 'translate3d(0,' + ((1 - v) * -22).toFixed(2) + 'px,0) scale(' + (0.6 + 0.4 * v).toFixed(4) + ')';
    } else {
      // notch: proste górne rogi przy krawędzi ekranu, wklęsłe uszka po bokach, zaokrąglony dół
      var L = bok, R = bok + w, e = k.e, f = function (n) { return n.toFixed(2); };
      wyspa.style.clipPath = h < 0.5 ? 'inset(0 0 100% 0)' : 'path("M ' + f(L - e) + ' 0 A ' + f(e) + ' ' + f(e) + ' 0 0 1 ' + f(L) + ' ' + f(e) +
        ' L ' + f(L) + ' ' + f(h - r) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(L + r) + ' ' + f(h) +
        ' L ' + f(R - r) + ' ' + f(h) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(R) + ' ' + f(h - r) +
        ' L ' + f(R) + ' ' + f(e) + ' A ' + f(e) + ' ' + f(e) + ' 0 0 1 ' + f(R + e) + ' 0 Z")';
      scena.style.opacity = sV.x > 0.02 ? '1' : '0';
      scena.style.transform = 'none';
    }
    // zawartość zwiniętej wyspy "jedzie" razem z krawędziami kształtu
    kLewa.style.transform = 'translate3d(' + (bok + 5).toFixed(2) + 'px,0,0)';
    kPrawa.style.transform = 'translate3d(' + (-(bok + 13)).toFixed(2) + 'px,0,0)';
  }

  /* ====================== mysz ====================== */
  // Okno przepuszcza kliknięcia, dopóki kursor nie jest nad pastylką. Ruch myszy i tak dostajemy
  // (proces główny ustawia "forward"), więc sami sprawdzamy, czy kursor jest w zaokrąglonym kształcie.

  var mysz = { x: -1, y: -1 };
  var przechwytuje = false;

  function wewnatrz(x, y) {
    if (sV.cel === 0 || sV.x < 0.6) return false;
    var k = ksztalt(), w = k.w, h = k.h, r = k.r;
    var lx = PLOTNO_X + (PLOTNO_W - w) / 2, px = lx + w, gy = plotnoY, dy = plotnoY + h;
    if (x < lx || x > px || y < gy || y > dy) return false;
    var ox = x < lx + r ? lx + r - x : (x > px - r ? x - (px - r) : 0);
    // notch ma proste górne rogi (przyczepiony do krawędzi ekranu)
    var oy = (!notch && y < gy + r) ? gy + r - y : (y > dy - r ? y - (dy - r) : 0);
    return ox * ox + oy * oy <= r * r;
  }

  function ustawPrzechwytywanie(v) {
    if (v === przechwytuje) return;
    przechwytuje = v;
    api.ignorujMysz(!v);
  }
  // w trakcie przewijania (i przytrzymania −/+ minutnika) trzymamy mysz także poza kształtem —
  // inaczej puszczenie przycisku trafiłoby obok
  function sprawdzMysz() { ustawPrzechwytywanie(!!przeciaganie || !!przytrzymanie || wewnatrz(mysz.x, mysz.y) || wStrefieUpuszczania(mysz.x, mysz.y)); }

  document.addEventListener('mousemove', function (e) { mysz.x = e.clientX; mysz.y = e.clientY; sprawdzMysz(); });
  document.addEventListener('mouseleave', function () { mysz.x = mysz.y = -1; if (!przeciaganie && !przytrzymanie) ustawPrzechwytywanie(false); });

  /* ====================== stan wyspy ====================== */

  var stan = 'pusta';
  var rozwinieta = false;
  var powiadAktywne = false;
  var media = null;
  var przeciaganie = null;             // przewijanie na pasku postępu: { id, klucz, ulamek } albo null
  var timer = null;                    // { koniec: ms, min } albo null
  var przytrzymanie = null;            // przytrzymany przycisk −/+ minutnika (uchwyt setTimeout) albo null
  var ustawienia = {
    moduly: { muzyka: true, bateria: false, procesor: false, glosnosc: false, timer: false },
    powiadomienia: { timer: true, bateria: true, glosnosc: true, ladowanie: true },
    minutnik: { dzwiek: true, wlasny: 15 }
  };
  var wysokoscRozw = 200;

  function maKompakt() { return !!media || !!timer; }
  // strona 1 (muzyka, kafelki, minutnik) ma co pokazać
  function maGlowna() {
    var m = ustawienia.moduly;
    return !!media || m.bateria || m.glosnosc || m.procesor || m.timer;
  }
  function maCoRozwinac() { return maGlowna() || !!ustawienia.moduly.schowek; }

  function geometria(s) {
    if (s === 'rozw' && jestPasek()) {
      // pusty schowek: pasek wielkości zwiniętej wyspy; z plikiem nad nim lekko większy
      var d = upuszczanie.aktywne ? 1 : 0;
      var hp = GEOM.timer.h + (notch ? 2 : 0) + d * 6;
      return { w: GEOM.timer.w + d * 16, h: hp, r: notch ? 12 : hp / 2 };
    }
    if (s === 'rozw') return { w: GEOM.rozw.w, h: wysokoscRozw, r: notch ? 30 : GEOM.rozw.r };
    if (s === 'powiad') return notch ? { w: GEOM.powiad.w, h: GEOM.powiad.h + 2, r: 24 } : GEOM.powiad;
    var g = s === 'kompakt'
      ? (media && timer ? GEOM.muzykaTimer : media ? GEOM.muzyka : GEOM.timer)
      : GEOM.pusta;
    // notch: trochę wyższy (sięga od samej krawędzi ekranu), szerszy w spoczynku, mniej zaokrąglony dół
    if (notch) return { w: s === 'pusta' ? 150 : g.w, h: g.h + 2, r: 12 };
    return { w: g.w, h: g.h, r: g.h / 2 };
  }

  // Styl: 'pastylka' (lewituje) albo 'notch' (przyczepiony do górnej krawędzi). Zmiana jest animowana:
  // stary kształt się chowa, nowy się pojawia (notch — wysuwa się z krawędzi ekranu).
  var styl = 'pastylka';
  function zastosujStyl(s) {
    styl = s;
    notch = s === 'notch';
    plotnoY = notch ? 0 : 8;
    document.body.classList.toggle('notch', notch);
    scena.style.transform = ''; scena.style.opacity = '';
    aktualizujStan();
    // wyspa jest schowana — od razu docelowy kształt (bez czekania na opóźnione kurczenie)
    clearTimeout(tKsztaltu);
    var g = geometria(stan);
    sW.ustaw(g.w); sH.ustaw(g.h); sR.ustaw(g.r);
    SPREZYNY.slice(0, 3).forEach(function (sp) { sp.dociagnij(); });
    rysuj();
  }
  function zmienStyl(s) {
    if (s === styl) return;
    if (sV.cel === 1) {
      zwin();
      sV.ustaw(0, P.schowaj);
      setTimeout(function () { zastosujStyl(s); sV.x = 0; sV.v = 0; zastosujWidocznosc(P.pokaz); }, 380);
    } else {
      zastosujStyl(s);
    }
  }

  function aktualizujStan(wymuszonaSprezyna) {
    if (rozwinieta && !maCoRozwinac()) { rozwinieta = false; api.ustawRozwiniecie(false); }
    odswiezStrony();
    var poprzedni = stan;
    stan = rozwinieta ? 'rozw' : powiadAktywne ? 'powiad' : maKompakt() ? 'kompakt' : 'pusta';
    if (stan !== 'pusta') wcisnieta = false;      // inny stan przejmuje kształt
    if (stan !== 'rozw') koniecPrzewijania(false);   // pasek znika — przewijanie przerwane
    if (stan !== 'rozw') koniecPrzytrzymania();

    wyspa.dataset.stan = stan;
    scena.classList.toggle('cien', stan === 'rozw');     // lekki cień wokół rozwiniętej wyspy
    wyspa.setAttribute('aria-expanded', String(stan === 'rozw'));
    wyspa.classList.toggle('z-muzyka', !!media);
    wyspa.classList.toggle('z-timer', !!timer);

    var duzy = function (s) { return s === 'rozw' || s === 'powiad'; };
    var p = wymuszonaSprezyna || (stan === 'powiad' ? P.powiad : duzy(stan) ? P.rozwin : duzy(poprzedni) ? P.zwin : P.kompakt);
    var g = geometria(stan);
    if (stan === 'pusta' && wcisnieta) g = { w: g.w + 16, h: g.h + 4, r: notch ? g.r : (g.h + 4) / 2 };

    // Zmiana stanu: stara treść znika, nowa wchodzi razem z kształtem.
    // Przy ZMNIEJSZANIU treść znika najpierw, a pastylka kurczy się dopiero po chwili.
    clearTimeout(tKsztaltu);
    var opoznienie = 0;
    if (stan !== poprzedni) {
      var gp = geometria(poprzedni);
      var zmniejsza = g.w * g.h < gp.w * gp.h;
      var stara = WARSTWY[poprzedni], nowa = WARSTWY[stan];
      if (stara) animujWyjscie(stara, zmniejsza ? CZAS_WYJSCIA_MS : 110);
      if (stara && zmniejsza) opoznienie = OPOZNIENIE_KURCZENIA_MS;
      if (nowa) animujWejscie(nowa, opoznienie, CZAS_WEJSCIA[stan]);
    }
    pilnujTekstu();
    var ustawKsztalt = function () { sW.ustaw(g.w, p); sH.ustaw(g.h, p); sR.ustaw(g.r, p); };
    if (opoznienie) tKsztaltu = setTimeout(ustawKsztalt, opoznienie);
    else ustawKsztalt();
  }

  /* ---------- wejście / wyjście treści (każdy element osobno) ---------- */
  // Wejście: od ~25% do ~85% animacji kształtu: opacity 0→1, blur 8→0 px, skala 0,85→1, przesunięcie 8→0 px,
  // elementy kolejno co 45 ms. Wyjście: opacity →0, blur →6 px, skala →0,9 w ~140 ms.
  var WARSTWY = { kompakt: $('kompakt'), powiad: $('powiad'), rozw: rozwEl };
  var CZAS_WEJSCIA = { kompakt: 420, powiad: 380, rozw: 540 };   // przybliżony czas sprężyny danego stanu
  var CZAS_WYJSCIA_MS = 140;
  var OPOZNIENIE_KURCZENIA_MS = 110;  // pastylka zaczyna się kurczyć, gdy treść już prawie zniknęła
  var ODSTEP_MS = 45;                 // stagger
  var tKsztaltu = null;

  var SCHOWANY_WEJ = { opacity: 0, filter: 'blur(8px)', transform: 'translateY(8px) scale(0.85)' };
  var SCHOWANY_WYJ = { opacity: 0, filter: 'blur(6px)', transform: 'scale(0.9)' };
  var WIDOCZNY = { opacity: 1, filter: 'blur(0px)', transform: 'none' };

  // Widoczne (nie display:none) elementy warstwy, w kolejności z dokumentu
  function elementy(warstwa) {
    return [].filter.call(warstwa.querySelectorAll('[data-a]'), function (e) { return e.getClientRects().length > 0; });
  }

  // Bieżący wygląd elementu (także w połowie przerwanej animacji) — od niego zaczynamy następną,
  // żeby nic nie "przeskakiwało"
  function biezacy(e) {
    var cs = getComputedStyle(e);
    return { opacity: cs.opacity, filter: cs.filter === 'none' ? 'blur(0px)' : cs.filter, transform: cs.transform };
  }

  function animujWejscie(warstwa, opoznienie, T) {
    var lista = elementy(warstwa);
    var start = lista.map(function (e) { return e.getAnimations().length ? biezacy(e) : SCHOWANY_WEJ; });
    warstwa.classList.add('aktywna');
    lista.forEach(function (e, i) {
      e.getAnimations().forEach(function (a) { a.cancel(); });
      e.animate([start[i], WIDOCZNY], {
        duration: Math.round(T * 0.6),
        delay: opoznienie + Math.round(T * 0.25) + i * ODSTEP_MS,
        easing: 'cubic-bezier(.2, .8, .2, 1)',
        fill: 'backwards'                      // w czasie opóźnienia element jest jeszcze schowany
      });
    });
  }

  function animujWyjscie(warstwa, czas) {
    var lista = elementy(warstwa);
    var start = lista.map(biezacy);
    warstwa.classList.remove('aktywna');       // stan końcowy (schowany) daje CSS
    lista.forEach(function (e, i) {
      e.getAnimations().forEach(function (a) { a.cancel(); });
      e.animate([start[i], SCHOWANY_WYJ], { duration: czas, easing: 'cubic-bezier(.4, 0, 1, 1)' });
    });
  }

  // naStrone: 1 = od razu schowek; bez podania — strona 1, a jeśli nie ma na niej nic — schowek
  function rozwin(naStrone) {
    if (!maCoRozwinac()) return;
    rozwinieta = true;
    powiadAktywne = false;
    clearTimeout(tPowiad);
    ustawTrybTekstu(false, false);                    // po zwinięciu zawsze zaczynamy od zwykłej karty
    edycjaMinutnika(false);                           // i od gotowych czasów minutnika
    pokazStrone(naStrone === 1 || !maGlowna() ? 1 : 0);
    wysokoscRozw = Math.ceil(rozwEl.offsetHeight);
    aktualizujStan();
    api.ustawRozwiniecie(true);
    budz();
  }

  function zwin() {
    if (!rozwinieta) return;
    rozwinieta = false;
    aktualizujStan();
    api.ustawRozwiniecie(false);
  }

  // Pusta pastylka (nie ma czego rozwinąć): przytrzymanie lekko ją powiększa, puszczenie — wraca
  // sprężyście do normalnego rozmiaru.
  var wcisnieta = false;

  wyspa.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || !wewnatrz(e.clientX, e.clientY)) return;
    if (stan !== 'pusta' || maCoRozwinac()) return;
    wcisnieta = true;
    try { wyspa.setPointerCapture(e.pointerId); } catch (x) { /* bez przechwycenia też zadziała */ }
    aktualizujStan(P.wcisnij);
  });

  function pusc() {
    if (!wcisnieta) return;
    wcisnieta = false;
    aktualizujStan(P.pusc);
  }
  wyspa.addEventListener('pointerup', pusc);
  wyspa.addEventListener('pointercancel', pusc);
  wyspa.addEventListener('lostpointercapture', pusc);

  wyspa.addEventListener('click', function (e) {
    if (!wewnatrz(e.clientX, e.clientY)) return;
    // przyciski, pliki, pasek przewijania i widok tekstu robią swoje, nie zwijają wyspy
    if (klikZPaska || e.target.closest('button, .sch-plik, .karta.tryb-tekst, .postep.mozna .tor-pole, .minutnik.edycja')) return;
    if (stan === 'rozw') zwin();
    else if (maCoRozwinac()) rozwin();
    else if (stan === 'powiad') { powiadAktywne = false; aktualizujStan(); }
  });

  // Klik poza rozwiniętą wyspą (okno straciło fokus) albo Esc → zwiń
  api.naZwin(zwin);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zwin(); });

  // Wysokość rozwiniętej karty wynika z treści (moduły, karta muzyki)
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      var h = Math.ceil(rozwEl.offsetHeight);
      if (h === wysokoscRozw) return;
      wysokoscRozw = h;
      if (stan === 'rozw' && !jestPasek()) sH.ustaw(h);
    }).observe(rozwEl);
  }

  /* ====================== strony rozwiniętej wyspy ====================== */
  // strona — ta, którą wyspa ma pokazywać; wyswietlona — ta, która jest teraz w DOM (różnią się przez
  // ~120 ms podmiany: stara treść znika, potem wchodzi nowa, a wysokość wyspy dopasowuje sprężyna).

  var strona = 0, wyswietlona = 0, tStrony = null;
  var stronaGlowna = $('strona-glowna'), stronaSchowek = $('strona-schowek');
  var kropki = document.querySelectorAll('#kropki i');

  function stronaEl(n) { return n === 1 ? stronaSchowek : stronaGlowna; }
  function dozwolona(n) { return n === 1 ? !!ustawienia.moduly.schowek : maGlowna(); }

  function odswiezKropki() {
    rozwEl.classList.toggle('dwie-strony', dozwolona(0) && dozwolona(1));
    kropki[0].classList.toggle('aktywna-kropka', strona === 0);
    kropki[1].classList.toggle('aktywna-kropka', strona === 1);
  }

  // Natychmiast (bez animacji) — przy rozwijaniu i gdy bieżąca strona przestała być dostępna
  function pokazStrone(n) {
    clearTimeout(tStrony); tStrony = null;
    strona = wyswietlona = n;
    [stronaGlowna, stronaSchowek].forEach(function (s) {
      elementy(s).forEach(function (e) { e.getAnimations().forEach(function (a) { a.cancel(); }); });
    });
    stronaGlowna.hidden = n !== 0;
    stronaSchowek.hidden = n !== 1;
    ukladSchowka();
    odswiezKropki();
    pilnujTekstu();
  }

  // Pusty schowek na ekranie → mały pasek zamiast panelu
  function jestPasek() { return wyswietlona === 1 && !schowekLista.length; }

  // Po wywołaniu trzeba zawołać aktualizujStan (nowy rozmiar kształtu)
  function ukladSchowka() {
    rozwEl.classList.toggle('pasek', jestPasek());
    wysokoscRozw = Math.ceil(rozwEl.offsetHeight);
  }

  function odswiezStrony() {
    if (rozwinieta && !dozwolona(strona)) pokazStrone(strona === 1 ? 0 : 1);
    else odswiezKropki();
  }

  function zmienStrone(n) {
    if (stan !== 'rozw' || n === strona || !dozwolona(n)) return;
    strona = n;
    odswiezKropki();
    if (n === wyswietlona) {                 // powrót, zanim stara strona zdążyła zniknąć
      clearTimeout(tStrony); tStrony = null;
      elementy(stronaEl(n)).forEach(function (e) {
        var b = biezacy(e);
        e.getAnimations().forEach(function (a) { a.cancel(); });
        e.animate([b, WIDOCZNY], { duration: 220, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      });
      return;
    }
    var wDol = n > wyswietlona;
    elementy(stronaEl(wyswietlona)).forEach(function (e) {
      var b = biezacy(e);
      e.getAnimations().forEach(function (a) { a.cancel(); });
      e.animate([b, { opacity: 0, filter: 'blur(6px)', transform: 'translateY(' + (wDol ? -14 : 14) + 'px) scale(.96)' }],
        { duration: 130, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    });
    clearTimeout(tStrony);
    tStrony = setTimeout(function () {
      pokazStrone(strona);
      elementy(stronaEl(strona)).forEach(function (e, i) {
        e.animate([{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(' + (wDol ? 16 : -16) + 'px) scale(.96)' }, WIDOCZNY],
          { duration: 380, delay: i * 40, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' });
      });
      if (stan === 'rozw') aktualizujStan();
    }, 120);
  }

  // Kółko myszy: w dół → schowek, w górę → strona 1. Lista plików, która się przewija, ma pierwszeństwo.
  var kolko = { suma: 0, blokada: 0, t: null };
  wyspa.addEventListener('wheel', function (e) {
    if (stan !== 'rozw' || przeciaganie || !rozwEl.classList.contains('dwie-strony')) return;
    if (e.target.closest && e.target.closest('.t-lista')) return;   // nad tekstem kółko przewija tylko tekst
    var lista = e.target.closest && e.target.closest('.sch-lista');
    if (lista && strona === 1) {
      if (e.deltaY > 0 && lista.scrollTop + lista.clientHeight < lista.scrollHeight - 1) return;
      if (e.deltaY < 0 && lista.scrollTop > 0) return;
    }
    var t = performance.now();
    if (t < kolko.blokada) return;            // jeden ruch kółkiem = jedna zmiana strony
    kolko.suma += e.deltaY;
    clearTimeout(kolko.t);
    kolko.t = setTimeout(function () { kolko.suma = 0; }, 200);
    if (Math.abs(kolko.suma) < 40) return;    // gładzik daje wiele małych kroków — sumujemy je
    var cel = kolko.suma > 0 ? 1 : 0;
    kolko.suma = 0;
    if (cel !== strona) { zmienStrone(cel); kolko.blokada = t + 450; }
  }, { passive: true });

  /* ====================== schowek na pliki ====================== */
  // Przeciągnięcie pliku nad wyspę: rozwija się na stronie schowka z niebieską strefą "Upuść"
  // (pusty schowek: mały pasek, który z plikiem nad nim lekko rośnie).
  // Okno wyspy przepuszcza mysz poza kształtem, więc pliki można upuścić tylko na sam kształt —
  // gdy kursor z plikiem z niego zjedzie, oddajemy okno aplikacji pod spodem.

  var schowekLista = [];
  var nowePliki = null;                 // ścieżki właśnie upuszczone (dostaną animację "wskoczenia")
  var wlasnePrzeciaganie = false;       // plik wyciągany Z wyspy — nie traktuj go jak nowego
  var upuszczanie = { aktywne: false, bylaRozw: false, bylaStrona: 0, strefa: null, t: null };
  var tPoUpuszczeniu = null;

  function odmianaPlikow(n) {
    var j = n % 10, d = n % 100;
    return n === 1 ? 'plik' : (j >= 2 && j <= 4 && (d < 10 || d >= 20)) ? 'pliki' : 'plików';
  }

  function naSchowek(lista) {
    schowekLista = Array.isArray(lista) ? lista : [];
    var el = $('sch-lista');
    el.textContent = '';
    schowekLista.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'sch-plik' + (p.istnieje ? '' : ' brak');
      d.title = p.istnieje ? p.sciezka + '\nKliknij — otwórz · prawy przycisk — pokaż w folderze · przeciągnij — wstaw gdzie indziej'
        : p.sciezka + '\nPlik został przeniesiony albo usunięty';
      d.draggable = !!p.istnieje;
      var m = document.createElement('div');
      m.className = 'sch-miniatura' + (p.folder ? ' folder' : '');
      if (p.ikona) { var img = new Image(); img.src = p.ikona; img.alt = ''; img.draggable = false; m.appendChild(img); }
      else m.innerHTML = IKONY[p.folder ? 'folder' : 'plik'];
      var n = document.createElement('span');
      n.className = 'sch-nazwa';
      n.textContent = p.nazwa;
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'sch-usun';
      x.setAttribute('aria-label', 'Usuń ze schowka: ' + p.nazwa);
      x.innerHTML = IKONY.x;
      x.addEventListener('click', function (e) { e.stopPropagation(); api.schowekUsun(p.sciezka); });
      d.addEventListener('click', function () { if (p.istnieje) api.schowekOtworz(p.sciezka); });
      d.addEventListener('contextmenu', function (e) { e.preventDefault(); if (p.istnieje) api.schowekPokaz(p.sciezka); });
      d.addEventListener('dragstart', function (e) {
        e.preventDefault();                  // przeciąganie robi Windows (proces główny: startDrag)
        if (!p.istnieje) return;
        wlasnePrzeciaganie = true;
        api.schowekPrzeciagnij(p.sciezka);
      });
      if (nowePliki && nowePliki[p.sciezka.toLowerCase()]) d.classList.add('nowy');
      d.append(m, n, x);
      el.appendChild(d);
    });
    nowePliki = null;
    var ile = schowekLista.length;
    $('sch-zero').hidden = ile > 0;
    $('sch-licznik').textContent = ile ? ile + ' ' + odmianaPlikow(ile) : '';
    // pierwszy plik albo usunięcie ostatniego: podmiana pasek ↔ lista
    if (rozwEl.classList.contains('pasek') !== jestPasek()) {
      ukladSchowka();
      if (stan !== 'rozw') return;
      elementy(stronaSchowek).forEach(function (e, i) {
        e.getAnimations().forEach(function (a) { a.cancel(); });
        e.animate([SCHOWANY_WEJ, WIDOCZNY],
          { duration: 380, delay: i * 40, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' });
      });
      aktualizujStan();
    }
  }

  // Panel kurczy się w pasek pod kursorem z plikiem. Żeby wyspa nie migotała (zwiń → rozwiń → ...),
  // do końca przeciągania celem jest też miejsce, które zajmowała na jego początku.
  function wStrefieUpuszczania(x, y) {
    var s = upuszczanie.strefa;
    if (!upuszczanie.aktywne || !s || schowekLista.length) return false;
    return Math.abs(x - (PLOTNO_X + PLOTNO_W / 2)) <= s.w / 2 && y >= plotnoY && y <= plotnoY + s.h;
  }

  function maPliki(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0;
  }

  function koniecUpuszczania() {
    clearTimeout(upuszczanie.t);
    upuszczanie.aktywne = false;
    rozwEl.classList.remove('upuszczanie');
    if (stan === 'rozw' && jestPasek()) aktualizujStan();     // pasek wraca do zwykłego rozmiaru
  }

  // Plik odjechał z wyspy bez upuszczenia — wracamy do tego, co było przed
  function anulujUpuszczanie() {
    if (!upuszczanie.aktywne) return;
    koniecUpuszczania();
    if (!upuszczanie.bylaRozw) zwin();
    else zmienStrone(upuszczanie.bylaStrona);
    sprawdzMysz();
  }

  function nadWyspa(e) {
    if (!ustawienia.moduly.schowek || wlasnePrzeciaganie || sV.cel !== 1 || !maPliki(e)) return;
    mysz.x = e.clientX; mysz.y = e.clientY;
    if (!wewnatrz(e.clientX, e.clientY) && !wStrefieUpuszczania(e.clientX, e.clientY)) {
      // nad przezroczystą częścią okna — nie przyjmujemy; oddajemy okno temu, co jest pod spodem
      anulujUpuszczanie();
      ustawPrzechwytywanie(false);
      return;
    }
    e.preventDefault();                      // "tak, można tu upuścić"
    e.dataTransfer.dropEffect = 'copy';
    if (!upuszczanie.aktywne) {
      upuszczanie.aktywne = true;
      upuszczanie.bylaRozw = rozwinieta;
      upuszczanie.bylaStrona = strona;
      var k = ksztalt();
      upuszczanie.strefa = { w: k.w, h: k.h };
      clearInterval(tPoUpuszczeniu);
      ustawPrzechwytywanie(true);
      if (!rozwinieta) rozwin(1);
      else if (strona !== 1) zmienStrone(1);
      else aktualizujStan();                 // już na schowku — pasek ma urosnąć
      rozwEl.classList.add('upuszczanie');
    }
    // dragover przychodzi co ~50 ms, także gdy kursor stoi — brak przez 300 ms = plik opuścił wyspę
    clearTimeout(upuszczanie.t);
    upuszczanie.t = setTimeout(anulujUpuszczanie, 300);
  }
  document.addEventListener('dragenter', nadWyspa);
  document.addEventListener('dragover', nadWyspa);

  document.addEventListener('drop', function (e) {
    e.preventDefault();                      // bez tego Chromium otworzyłby plik w oknie wyspy
    if (wlasnePrzeciaganie) { wlasnePrzeciaganie = false; return; }
    if (!upuszczanie.aktywne) return;
    var bylaRozw = upuszczanie.bylaRozw;
    koniecUpuszczania();
    var sciezki = [].map.call(e.dataTransfer.files || [], function (f) { return api.sciezkaPliku(f); })
      .filter(Boolean);
    if (sciezki.length) {
      nowePliki = {};
      sciezki.forEach(function (s) { nowePliki[s.toLowerCase()] = true; });
      api.schowekDodaj(sciezki);
    }
    // Wyspa rozwinęła się sama (przez przeciąganie) — zwija się, gdy kursor odjedzie z niej na ~1,5 s.
    // (Okno nie zawsze dostaje fokus w trakcie przeciągania, więc zwykłe "klik poza" mogłoby nie zadziałać.)
    if (!bylaRozw) {
      var poza = 0;
      clearInterval(tPoUpuszczeniu);
      tPoUpuszczeniu = setInterval(function () {
        if (stan !== 'rozw') { clearInterval(tPoUpuszczeniu); return; }
        if (wewnatrz(mysz.x, mysz.y)) poza = 0;
        else if ((poza += 250) >= 1500) { clearInterval(tPoUpuszczeniu); zwin(); }
      }, 250);
    }
  });

  document.addEventListener('dragend', function () { wlasnePrzeciaganie = false; });
  document.addEventListener('mousemove', function (e) { if (wlasnePrzeciaganie && e.buttons === 0) wlasnePrzeciaganie = false; });


  // Pokazanie / schowanie całej wyspy (start, pełny ekran w innej aplikacji, wyłączenie)
  var widocznaSystem = false;

  function zastosujWidocznosc(p) {
    var cel = widocznaSystem ? 1 : 0;
    if (cel === 0) { ustawPrzechwytywanie(false); zwin(); }
    if (sV.cel !== cel) sV.ustaw(cel, p);
  }

  api.naWidocznosc(function (widoczna) {
    widocznaSystem = !!widoczna;
    zastosujWidocznosc(widoczna ? P.pokaz : P.schowaj);
  });

  /* ====================== okładka ====================== */
  // Dwie warstwy: nowa okładka wjeżdża (skala + przenikanie), stara gaśnie.

  function Okladka(el) {
    this.el = el;
    this.warstwy = el.querySelectorAll('.okl-w');
    this.aktywna = 0;
    this.url = null;
  }
  Okladka.prototype.ustaw = function (url, animuj) {
    url = url || null;
    if (url === this.url) return;
    this.url = url;
    var stara = this.warstwy[this.aktywna];
    var nowa = this.warstwy[1 - this.aktywna];
    this.aktywna = 1 - this.aktywna;
    this.el.classList.toggle('ma-obraz', !!url);

    var opStara = getComputedStyle(stara).opacity;
    stara.getAnimations().forEach(function (a) { a.cancel(); });
    nowa.getAnimations().forEach(function (a) { a.cancel(); });

    nowa.style.backgroundImage = url ? 'url("' + url + '")' : '';
    nowa.style.opacity = url ? '1' : '0';
    stara.style.opacity = '0';
    if (!animuj) return;
    if (url) {
      nowa.animate([{ opacity: 0, transform: 'scale(.78)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 560, easing: 'cubic-bezier(.3, 1.45, .55, 1)' });
    }
    stara.animate([{ opacity: opStara, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.1)' }],
      { duration: 280, easing: 'ease-out' });
  };

  var oklMala = new Okladka($('k-okladka'));
  var oklDuza = new Okladka($('r-okladka'));

  // Kolor słupków: uśredniony, nasycony kolor okładki (jak w iPhonie)
  function kolorZOkladki(url) {
    if (!url) { wyspa.style.setProperty('--viz-kolor', '#f2f2f7'); return; }
    var img = new Image();
    img.onload = function () {
      if (url !== oklDuza.url) return;
      try {
        var c = document.createElement('canvas'); c.width = c.height = 16;
        var g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, 16, 16);
        var d = g.getImageData(0, 0, 16, 16).data;
        var r = 0, gr = 0, b = 0, waga = 0;
        for (var i = 0; i < d.length; i += 4) {
          var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          var wg = (mx - mn) / 255 + 0.05;                      // piksele nasycone ważą więcej
          if (mx < 40) wg *= 0.2;                               // prawie czarne prawie się nie liczą
          r += d[i] * wg; gr += d[i + 1] * wg; b += d[i + 2] * wg; waga += wg;
        }
        r /= waga; gr /= waga; b /= waga;
        // rozjaśnij, żeby słupki były dobrze widoczne na czarnym tle
        var max = Math.max(r, gr, b, 1), skala = Math.max(1, 210 / max);
        var k = [r, gr, b].map(function (x) { return Math.min(255, Math.round(x * skala)); });
        wyspa.style.setProperty('--viz-kolor', 'rgb(' + k.join(',') + ')');
      } catch (e) { wyspa.style.setProperty('--viz-kolor', '#f2f2f7'); }
    };
    img.src = url;
  }

  /* ====================== wizualizator ====================== */
  // Słupki to animacja (system nie udostępnia widma dźwięku). Gdy gra — każdy co chwilę losuje nową
  // wysokość i płynnie do niej dąży; gdy pauza — wszystkie płynnie opadają.

  var vizSlupki = [].slice.call(document.querySelectorAll('#k-viz i')).map(function (k, i) {
    return { el: [k, document.querySelectorAll('#r-viz i')[i]], x: 0.18, cel: 0.18, nast: 0 };
  });
  var PROFIL = [0.6, 0.9, 1, 0.8, 0.65];      // środkowe słupki zwykle wyższe
  var vizGra = false;
  var oczekiwanaGra = null;                   // { gra, do } — stan zaraz po kliknięciu play/pauza

  function krokWizualizatora(dt, t) {
    if (!media || sV.cel === 0) return false;
    var ruch = false;
    vizSlupki.forEach(function (s, i) {
      if (vizGra) {
        if (t >= s.nast) {
          s.cel = 0.22 + Math.random() * 0.78 * PROFIL[i];
          s.nast = t + 110 + Math.random() * 190;
        }
      } else {
        s.cel = 0.18;
      }
      var szybkosc = vizGra ? 15 : 6;
      s.x += (s.cel - s.x) * (1 - Math.exp(-dt * szybkosc));
      if (Math.abs(s.cel - s.x) > 0.002) ruch = true;
      var tr = 'scaleY(' + s.x.toFixed(3) + ')';
      s.el[0].style.transform = tr;
      s.el[1].style.transform = tr;
    });
    return vizGra || ruch;
  }

  /* ====================== multimedia ====================== */

  var el = {
    karta: $('karta'), tytul: $('r-tytul'), wykonawca: $('r-wykonawca'),
    postep: $('r-postep'), poz: $('r-poz'), zostalo: $('r-zostalo'), wyp: $('r-wyp'), pole: $('r-pole'),
    prev: $('s-prev'), next: $('s-next'), toggle: $('s-toggle')
  };

  var postep = { baza: 0, czas: 0, gra: false, dl: 0, ostSek: -1 };

  function formatCzasu(sekundy) {
    var s = Math.max(0, Math.floor(sekundy));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + r).slice(-2);
  }

  function pozycjaTeraz() {
    var p = postep.baza + (postep.gra ? (performance.now() - postep.czas) / 1000 : 0);
    return postep.dl > 0 ? Math.min(postep.dl, p) : p;
  }

  function krokPostepu() {
    if (!media || stan !== 'rozw' || !(postep.dl > 0)) return false;
    // w trakcie przeciągania pasek i czasy pokazują wybierane miejsce
    var p = przeciaganie ? przeciaganie.ulamek * postep.dl : pozycjaTeraz();
    el.wyp.style.transform = 'scaleX(' + (p / postep.dl).toFixed(4) + ')';
    var s = Math.floor(p);
    if (s !== postep.ostSek) {
      postep.ostSek = s;
      el.poz.textContent = formatCzasu(s);
      el.zostalo.textContent = '-' + formatCzasu(Math.max(0, Math.round(postep.dl) - s));
    }
    return postep.gra;
  }

  // Płynna podmiana tekstu (stary znika w górę, nowy wjeżdża od dołu)
  function zmienTekst(e, tekst, animuj) {
    e.dataset.cel = tekst;
    if (e.textContent === tekst && !e.getAnimations().length) return;
    if (!animuj) { e.getAnimations().forEach(function (a) { a.cancel(); }); e.textContent = tekst; return; }
    if (e.dataset.zmienia === '1') return;            // trwa podmiana — weźmie najnowszy tekst z data-cel
    e.dataset.zmienia = '1';
    e.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }],
      { duration: 150, easing: 'ease-in', fill: 'forwards' }).onfinish = function () {
      e.getAnimations().forEach(function (a) { a.cancel(); });
      e.textContent = e.dataset.cel;
      e.dataset.zmienia = '';
      e.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, easing: 'cubic-bezier(.2, 1.2, .4, 1)' });
    };
  }

  function naMedia(m) {
    var poprzednie = media;
    media = m && typeof m === 'object' && m.klucz ? m : null;

    if (media) {
      var nowyUtwor = !poprzednie || poprzednie.klucz !== media.klucz;
      var animuj = !!poprzednie;                         // pierwsze pojawienie się: bez podmiany treści

      zmienTekst(el.tytul, media.tytul || 'Bez tytułu', animuj && nowyUtwor);
      zmienTekst(el.wykonawca, media.wykonawca || media.album || media.zrodlo || '', animuj && nowyUtwor);

      var url = media.okladka || (nowyUtwor ? null : oklDuza.url);
      if (url !== oklDuza.url) {
        var animOkl = animuj || stan === 'kompakt' || stan === 'rozw';
        oklMala.ustaw(url, animOkl);
        oklDuza.ustaw(url, animOkl);
        kolorZOkladki(url);
      }

      // zmiana utworu na zwiniętej wyspie: delikatne "podskoczenie" szerokości
      if (nowyUtwor && poprzednie && stan === 'kompakt') { sW.v += 240; budz(); }

      // postęp: zegar lokalny; korygujemy tylko przy zmianie utworu, play/pauzy lub dużej różnicy
      var maDl = media.dlugosc > 0;
      // po kliknięciu play/pauza system odpowiada z opóźnieniem i przez chwilę podaje JESZCZE STARY stan
      // (to dawało „bug”: słupki/ikona wracały do poprzedniego stanu). Dlatego ~1,5 s ufamy kliknięciu.
      var graTeraz = !!media.gra;
      if (oczekiwanaGra) {
        if (nowyUtwor || performance.now() > oczekiwanaGra.do || graTeraz === oczekiwanaGra.gra) oczekiwanaGra = null;
        else graTeraz = oczekiwanaGra.gra;
      }
      if (nowyUtwor || postep.gra !== graTeraz || Math.abs(pozycjaTeraz() - media.pozycja) > 1.2 || postep.dl !== media.dlugosc) {
        postep.baza = media.pozycja || 0;
        postep.czas = performance.now();
        postep.ostSek = -1;
      }
      postep.gra = graTeraz;
      postep.dl = media.dlugosc || 0;
      el.postep.classList.toggle('bez-dlugosci', !maDl);
      el.postep.classList.toggle('mozna', maDl && !!media.przewijanie);
      if (!maDl) el.wyp.style.transform = 'scaleX(0)';
      if (przeciaganie && (przeciaganie.klucz !== media.klucz || !maDl || !media.przewijanie)) koniecPrzewijania(false);

      el.prev.disabled = !media.poprzedni;
      el.next.disabled = !media.nastepny;
      el.toggle.classList.toggle('gra', graTeraz);
      vizGra = graTeraz;
    } else {
      vizGra = false;
      oczekiwanaGra = null;
      koniecPrzewijania(false);
      oklMala.ustaw(null, false);
      oklDuza.ustaw(null, false);
      ustawTrybTekstu(false, false);
    }
    $('t-tytul').textContent = media ? media.tytul || 'Bez tytułu' : '';
    $('t-wykonawca').textContent = media ? media.wykonawca || media.album || media.zrodlo || '' : '';
    odswiezMikrofon();
    el.karta.hidden = !media;
    aktualizujStan();
    budz();
  }

  el.prev.addEventListener('click', function () { api.mediaKomenda('prev'); });
  el.toggle.addEventListener('click', function () {
    // natychmiastowa reakcja ikony; prawdziwy stan przyjdzie z systemu za chwilę
    var nowaGra = !vizGra;
    el.toggle.classList.toggle('gra', nowaGra);
    oczekiwanaGra = { gra: nowaGra, do: performance.now() + 1500 };
    if (media) {
      postep.baza = pozycjaTeraz();           // pasek postępu staje / rusza od razu
      postep.czas = performance.now();
      postep.gra = nowaGra;
      vizGra = nowaGra;
      budz();
    }
    api.mediaKomenda('toggle');
  });
  el.next.addEventListener('click', function () { api.mediaKomenda('next'); });

  /* ---------- przewijanie: klik albo przeciągnięcie na pasku postępu ---------- */
  var klikZPaska = false;          // ostatnie naciśnięcie zaczęło się na pasku → jego „click” nie zwija wyspy

  function wskazPozycje(e) {
    var r = el.pole.firstElementChild.getBoundingClientRect();
    przeciaganie.ulamek = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    postep.ostSek = -1;
    krokPostepu();
  }

  // wyslij: true = puszczono mysz (przewiń), false = przerwane (pasek wraca do bieżącej pozycji)
  function koniecPrzewijania(wyslij) {
    var p = przeciaganie;
    if (!p) return;
    przeciaganie = null;
    el.postep.classList.remove('przeciaga');
    if (el.pole.hasPointerCapture(p.id)) el.pole.releasePointerCapture(p.id);
    if (wyslij && media && media.klucz === p.klucz && postep.dl > 0) {
      postep.baza = p.ulamek * postep.dl;
      postep.czas = performance.now();
      przewinietoDo = null;                      // tekst piosenki od razu idzie za nową pozycją
      recznieDo = 0;
      api.mediaPrzewin(postep.baza, p.klucz);
      tikTekstu();
    }
    postep.ostSek = -1;
    krokPostepu();
    sprawdzMysz();
    budz();
  }

  document.addEventListener('pointerdown', function () { klikZPaska = false; }, true);
  el.pole.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || stan !== 'rozw' || !el.postep.classList.contains('mozna') || !wewnatrz(e.clientX, e.clientY)) return;
    e.preventDefault();
    klikZPaska = true;
    przeciaganie = { id: e.pointerId, klucz: media.klucz, ulamek: 0 };
    try { el.pole.setPointerCapture(e.pointerId); } catch (x) { /* bez przechwycenia też zadziała */ }
    el.postep.classList.add('przeciaga');
    ustawPrzechwytywanie(true);
    wskazPozycje(e);
  });
  el.pole.addEventListener('pointermove', function (e) {
    if (!przeciaganie || e.pointerId !== przeciaganie.id) return;
    mysz.x = e.clientX; mysz.y = e.clientY;
    if (!(e.buttons & 1)) koniecPrzewijania(false);       // zgubione puszczenie przycisku
    else wskazPozycje(e);
  });
  el.pole.addEventListener('pointerup', function (e) {
    if (!przeciaganie || e.pointerId !== przeciaganie.id || e.button !== 0) return;
    mysz.x = e.clientX; mysz.y = e.clientY;
    wskazPozycje(e);
    koniecPrzewijania(true);
  });
  el.pole.addEventListener('pointercancel', function () { koniecPrzewijania(false); });
  el.pole.addEventListener('lostpointercapture', function () { koniecPrzewijania(false); });
  // zapas, gdyby przechwycenie wskaźnika się nie udało
  document.addEventListener('mousemove', function (e) { if (przeciaganie && e.buttons === 0) koniecPrzewijania(false); });

  /* ====================== tekst piosenki ====================== */
  // Dane z procesu głównego: null, { klucz, szukam } albo { klucz, synchroniczny, linie: [{ czas?, tekst }] }.
  // Teksty pochodzą z internetu — wstawiamy je wyłącznie przez textContent.

  var slowa = null;
  var trybTekstu = false;
  var tTikTekstu = null;
  var liniaTeraz = -1, przewinietoDo = null, recznieDo = 0;
  var WYPRZEDZENIE_S = 0.25;            // linia zapala się odrobinę przed czasem — tak się lepiej czyta
  var PRZERWA_PO_PRZEWINIECIU_MS = 3000;
  var tLista = $('t-lista');
  var mniejRuchu = window.matchMedia('(prefers-reduced-motion: reduce)');

  function maTekst() {
    return !!(media && slowa && slowa.klucz === media.klucz && slowa.linie && slowa.linie.length);
  }

  function odswiezMikrofon() {
    var b = $('s-mik'), pokaz = maTekst();
    if (b.hidden !== pokaz) return;               // bez zmian
    b.hidden = !pokaz;
    if (pokaz && stan === 'rozw' && !trybTekstu) {
      b.animate([{ opacity: 0, transform: 'scale(.5)' }, WIDOCZNY], { duration: 320, easing: 'cubic-bezier(.3, 1.45, .55, 1)' });
    }
  }

  function wypelnijTekst() {
    var gotowy = maTekst();
    var sync = gotowy && !!slowa.synchroniczny;
    tLista.textContent = '';
    tLista.classList.toggle('sync', sync);
    $('t-dopisek').hidden = !gotowy || sync;
    (gotowy ? slowa.linie : [{ tekst: 'Szukam tekstu…' }]).forEach(function (l) {
      var p = document.createElement('p');
      p.className = 't-linia';
      p.textContent = l.tekst || (sync ? '♪' : ' ');
      tLista.appendChild(p);
    });
    tLista.scrollTop = 0;
    liniaTeraz = -1;
    przewinietoDo = null;
    recznieDo = 0;
  }

  // Podświetla trwającą linię i przewija listę tak, żeby była na środku
  function tikTekstu(odRazu) {
    if (!maTekst() || !slowa.synchroniczny) return;
    var p = pozycjaTeraz() + WYPRZEDZENIE_S, i = -1;
    while (i + 1 < slowa.linie.length && slowa.linie[i + 1].czas <= p) i++;
    var linie = tLista.children;
    if (i !== liniaTeraz) {
      if (linie[liniaTeraz]) linie[liniaTeraz].classList.remove('teraz');
      if (linie[i]) linie[i].classList.add('teraz');
      liniaTeraz = i;
    }
    if (!odRazu && (performance.now() < recznieDo || przewinietoDo === i)) return;
    var cel = linie[Math.max(0, i)];
    if (!cel) return;
    przewinietoDo = i;
    tLista.scrollTo({
      top: cel.offsetTop - (tLista.clientHeight - cel.offsetHeight) / 2,
      behavior: odRazu || mniejRuchu.matches ? 'auto' : 'smooth'
    });
  }

  // Odświeżanie działa tylko, gdy widok tekstu naprawdę widać
  function pilnujTekstu() {
    var widac = trybTekstu && stan === 'rozw' && wyswietlona === 0 && sV.cel === 1 && maTekst() && slowa.synchroniczny;
    if (widac && !tTikTekstu) {
      tTikTekstu = setInterval(tikTekstu, 150);
      tikTekstu(true);
    } else if (!widac && tTikTekstu) {
      clearInterval(tTikTekstu);
      tTikTekstu = null;
    }
  }

  function ustawTrybTekstu(wlacz, animuj) {
    if (wlacz === trybTekstu) return;
    trybTekstu = wlacz;
    [].forEach.call(stronaGlowna.querySelectorAll('[data-a]'), function (e) {
      e.getAnimations().forEach(function (a) { a.cancel(); });
    });
    el.karta.classList.toggle('tryb-tekst', wlacz);
    stronaGlowna.classList.toggle('tryb-tekst', wlacz);
    $('tekst-widok').hidden = !wlacz;
    if (wlacz) wypelnijTekst();
    if (animuj && stan === 'rozw' && wyswietlona === 0) {
      elementy(stronaGlowna).forEach(function (e, i) {
        e.animate([SCHOWANY_WEJ, WIDOCZNY],
          { duration: 360, delay: i * 40, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' });
      });
    }
    clearInterval(tTikTekstu);
    tTikTekstu = null;
    pilnujTekstu();
  }

  function naTekst(t) {
    slowa = t && typeof t === 'object' && t.klucz ? t : null;
    // utwór bez tekstu → zwykła karta; w trakcie szukania (zmiana utworu) widok tekstu zostaje
    if (!slowa || (!slowa.szukam && !(slowa.linie && slowa.linie.length))) ustawTrybTekstu(false, true);
    else if (trybTekstu) {
      wypelnijTekst();
      clearInterval(tTikTekstu);
      tTikTekstu = null;
    }
    odswiezMikrofon();
    pilnujTekstu();
  }

  $('s-mik').addEventListener('click', function () { if (maTekst()) ustawTrybTekstu(true, true); });
  $('t-mik').addEventListener('click', function () { ustawTrybTekstu(false, true); });
  // ręczne przewijanie: przez chwilę nie wracamy sami do aktualnej linii
  tLista.addEventListener('wheel', function () {
    recznieDo = performance.now() + PRZERWA_PO_PRZEWINIECIU_MS;
    przewinietoDo = null;
  }, { passive: true });

  /* ====================== dane systemowe (kafelki) ====================== */

  var kafel = {
    b: { w: $('b-wartosc'), p: $('b-wyp') },
    g: { w: $('g-wartosc'), p: $('g-wyp') },
    c: { w: $('c-wartosc'), p: $('c-wyp') }
  };

  // undefined → jeszcze nie odczytano ("…"), null → "brak danych"
  function pokazKafel(k, html, procent, kolor) {
    if (procent === undefined || procent === null) {
      k.w.className = 'brak';
      k.w.textContent = procent === null ? 'brak danych' : '…';
      k.p.style.transform = 'scaleX(0)';
      return;
    }
    k.w.className = '';
    k.w.innerHTML = html;
    k.p.style.transform = 'scaleX(' + Math.max(0, Math.min(100, procent)) / 100 + ')';
    k.p.style.backgroundColor = kolor;
  }

  function naDane(d) {
    d = d || {};
    var b = d.bateria;
    if (b) {
      var kolor = b.laduje ? 'var(--zielony)' : b.procent <= 15 ? 'var(--czerwony)' : b.procent <= 30 ? 'var(--zolty)' : 'var(--zielony)';
      pokazKafel(kafel.b, b.procent + '%' + (b.laduje ? '<small>⚡</small>' : ''), b.procent, kolor);
    } else pokazKafel(kafel.b, '', b === null ? null : undefined);

    var g = d.glosnosc;
    if (g) pokazKafel(kafel.g, g.wyciszony ? 'wycisz.' : g.poziom + '%', g.wyciszony ? 0 : g.poziom, 'var(--niebieski)');
    else pokazKafel(kafel.g, '', g === null ? null : undefined);

    var c = d.procesor;
    if (c != null) pokazKafel(kafel.c, c + '%', c, c >= 85 ? 'var(--czerwony)' : c >= 60 ? 'var(--pomarancz)' : 'var(--fiolet)');
    else pokazKafel(kafel.c, '', c === null ? null : undefined);
  }

  /* ====================== ustawienia (moduły) ====================== */

  function naUstawienia(u) {
    if (!u || !u.moduly) return;
    ustawienia = u;
    zmienStyl(u.wyglad && u.wyglad.styl === 'notch' ? 'notch' : 'pastylka');
    // własny czas minutnika (nie nadpisuj, gdy właśnie ustawiany i jeszcze niezapisany)
    if (!tZapisuWlasnego) wlasnyMin = M.ogranicz(u.minutnik && u.minutnik.wlasny);
    pokazWlasny();
    var m = u.moduly;
    var jakiKafel = false;
    Array.prototype.forEach.call(document.querySelectorAll('.kafel[data-modul]'), function (k) {
      k.hidden = !m[k.dataset.modul];
      if (!k.hidden) jakiKafel = true;
    });
    $('kafle').hidden = !jakiKafel;
    $('minutnik').hidden = !m.timer;
    if (!m.timer && timer) stopTimer();
    if (!m.muzyka && media) naMedia(null);
    aktualizujStan();
  }

  /* ====================== minutnik ====================== */

  var timerInterwal = null;
  var minutnikEl = $('minutnik'), mCzas = $('m-czas'), kTimer = $('k-timer');

  function formatMinutnika(ms) {
    var s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
    return m + ':' + ('0' + (s % 60)).slice(-2);
  }

  function tikTimer() {
    if (!timer) return;
    var pozostalo = timer.koniec - Date.now();
    if (pozostalo <= 0) { zakonczTimer(timer.min); return; }
    var tekst = formatMinutnika(pozostalo);
    kTimer.textContent = tekst;
    mCzas.textContent = tekst;
  }

  function startTimer(minuty) {
    edycjaMinutnika(false);
    timer = { koniec: Date.now() + minuty * 60000, min: minuty };
    api.minutnik(timer.koniec);
    minutnikEl.classList.remove('koniec');
    minutnikEl.classList.add('dziala');
    if (!timerInterwal) timerInterwal = setInterval(tikTimer, 250);
    tikTimer();
    aktualizujStan();
  }

  function stopTimer() {
    timer = null;
    api.minutnik(0);
    clearInterval(timerInterwal);
    timerInterwal = null;
    minutnikEl.classList.remove('dziala');
    mCzas.textContent = 'Minutnik';
    kTimer.textContent = '';
    aktualizujStan();
  }

  function zakonczTimer(minuty) {
    stopTimer();
    // dźwięk ma własny przełącznik; gra także przy ukrytej wyspie (pełny ekran)
    if (!ustawienia.minutnik || ustawienia.minutnik.dzwiek !== false) window.AtolDzwiek.zagraj();
    if (!ustawienia.powiadomienia.timer) return;      // powiadomienia nie zależą od modułów
    if (rozwinieta) {
      mCzas.textContent = 'Koniec!';
      minutnikEl.classList.add('koniec');
      setTimeout(function () { minutnikEl.classList.remove('koniec'); if (!timer) mCzas.textContent = 'Minutnik'; }, 3000);
    } else {
      pokazPowiadomienie({ typ: 'timer', min: minuty });
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('#m-chipy [data-min]'), function (b) {
    b.addEventListener('click', function () { startTimer(parseInt(b.dataset.min, 10)); });
  });
  $('m-stop').addEventListener('click', stopTimer);

  /* ---------- własny czas ---------- */
  var M = window.AtolMinutnik;
  var mWartosc = $('m-wartosc'), mMniej = $('m-mniej'), mWiecej = $('m-wiecej');
  var wlasnyMin = M.DOMYSLNY;
  var tZapisuWlasnego = null;
  var resztaKolka = 0;

  function pokazWlasny() {
    mWartosc.textContent = wlasnyMin + ' min';
    // klasa zamiast "disabled": wyłączony przycisk nie dostaje zdarzeń puszczenia myszy
    mMniej.classList.toggle('kres', wlasnyMin <= M.MIN);
    mWiecej.classList.toggle('kres', wlasnyMin >= M.MAKS);
  }

  function zapiszWlasny() {
    if (!tZapisuWlasnego) return;
    clearTimeout(tZapisuWlasnego);
    tZapisuWlasnego = null;
    if (ustawienia.minutnik) ustawienia.minutnik.wlasny = wlasnyMin;
    api.minutnikWlasny(wlasnyMin);
  }

  function ustawWlasny(minuty) {
    var nowe = M.ogranicz(minuty);
    if (nowe === wlasnyMin) return;
    wlasnyMin = nowe;
    pokazWlasny();
    clearTimeout(tZapisuWlasnego);
    tZapisuWlasnego = setTimeout(zapiszWlasny, 400);     // przy przytrzymaniu nie zapisujemy co krok
  }

  function edycjaMinutnika(wlacz) {
    koniecPrzytrzymania();
    zapiszWlasny();
    resztaKolka = 0;
    minutnikEl.classList.toggle('edycja', wlacz);
  }

  function koniecPrzytrzymania() {
    if (!przytrzymanie) return;
    clearTimeout(przytrzymanie);
    przytrzymanie = null;
  }

  function przytrzymaj(kierunek) {
    koniecPrzytrzymania();
    ustawWlasny(M.przesun(wlasnyMin, kierunek, 1));
    var n = 0;
    (function dalej() {
      var p = M.powtorzenie(n++);
      przytrzymanie = setTimeout(function () {
        ustawWlasny(M.przesun(wlasnyMin, kierunek, p.krok));
        dalej();
      }, p.po);
    })();
  }

  [[mMniej, -1], [mWiecej, 1]].forEach(function (para) {
    var b = para[0], kierunek = para[1];
    b.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* bez przechwycenia też zadziała */ }
      przytrzymaj(kierunek);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (typ) {
      b.addEventListener(typ, function () { koniecPrzytrzymania(); sprawdzMysz(); });
    });
    // klawiatura (Enter / spacja) — mysz obsłużył już pointerdown
    b.addEventListener('click', function (e) { if (e.detail === 0) ustawWlasny(M.przesun(wlasnyMin, kierunek, 1)); });
  });
  window.addEventListener('blur', koniecPrzytrzymania);

  // kółko nad edytorem zmienia czas i NIE dochodzi do wyspy (nie przełącza strony)
  minutnikEl.addEventListener('wheel', function (e) {
    if (stan !== 'rozw' || !minutnikEl.classList.contains('edycja')) return;
    e.stopPropagation();
    var w = M.zKolka(resztaKolka, e.deltaY);
    resztaKolka = w.reszta;
    if (w.kroki) ustawWlasny(wlasnyMin + w.kroki);
  }, { passive: true });

  $('m-wlasny').addEventListener('click', function () { edycjaMinutnika(true); });
  $('m-wroc').addEventListener('click', function () { edycjaMinutnika(false); });
  $('m-start').addEventListener('click', function () { startTimer(wlasnyMin); });
  api.naMinutnikTik(tikTimer);          // budzik z procesu głównego (patrz main.js)

  /* ====================== powiadomienia ====================== */

  var CZAS_POWIADOMIENIA_MS = 3000;
  var CZAS_GLOSNOSCI_MS = 1500;      // głośność: krótko, jak w iPhonie (kolejne zmiany wydłużają pokaz)
  var tPowiad = null;

  function opisPowiadomienia(z) {
    switch (z.typ) {
      case 'timer':
        return { ikona: 'zegar', tytul: 'Minutnik zakończony', opis: z.min + (z.min === 1 ? ' minuta minęła' : ' min minęło') };
      case 'bateria':
        return z.prog <= 10
          ? { ikona: 'bateria', klasa: 'krytyczna', tytul: 'Bateria prawie pusta', opis: z.procent + '% — podłącz ładowarkę' }
          : { ikona: 'bateria', tytul: 'Niski poziom baterii', opis: z.procent + '% — podłącz ładowarkę' };
      case 'glosnosc':
        return { ikona: 'glosnik', tytul: z.wyciszony ? 'Wyciszono' : 'Głośność ' + z.poziom + '%', pasek: z.wyciszony ? 0 : z.poziom };
      case 'ladowanie':
        return z.laduje
          ? { ikona: 'piorun', tytul: 'Ładowanie rozpoczęte', opis: 'Bateria: ' + z.procent + '%' }
          : { ikona: 'piorun', klasa: 'koniec', tytul: 'Ładowanie zakończone', opis: 'Bateria: ' + z.procent + '%' };
    }
    return null;
  }

  function pokazPowiadomienie(z) {
    if (!z || rozwinieta || sV.cel === 0) return;    // rozwinięta i tak pokazuje dane na żywo
    var o = opisPowiadomienia(z);
    if (!o) return;
    $('p-ikona').className = 'p-ikona ' + o.ikona + (o.klasa ? ' ' + o.klasa : '');
    $('p-ikona').innerHTML = IKONY[o.ikona];
    $('p-tytul').textContent = o.tytul;
    var maPasek = o.pasek !== undefined;
    $('p-opis').style.display = maPasek ? 'none' : '';
    $('p-opis').textContent = o.opis || '';
    $('p-tor').classList.toggle('widoczny', maPasek);
    if (maPasek) {
      $('p-wyp').style.transform = 'scaleX(' + o.pasek / 100 + ')';
      $('p-wyp').style.backgroundColor = 'var(--niebieski)';
    }
    powiadAktywne = true;
    aktualizujStan();
    clearTimeout(tPowiad);   // kolejne zdarzenie (np. dalsza zmiana głośności) odświeża treść i wydłuża pokaz
    tPowiad = setTimeout(function () { powiadAktywne = false; aktualizujStan(); },
      z.typ === 'glosnosc' ? CZAS_GLOSNOSCI_MS : CZAS_POWIADOMIENIA_MS);
  }

  /* ====================== start ====================== */

  api.naUstawienia(naUstawienia);
  api.naDane(naDane);
  api.naMedia(naMedia);
  api.naTekst(naTekst);
  api.naPowiadomienie(pokazPowiadomienie);
  api.naSchowek(naSchowek);

  api.start().then(function (s) {
    naUstawienia(s.ustawienia);
    naDane(s.dane);
    naMedia(s.media);
    naTekst(s.tekst);
    naSchowek(s.schowek);
    if (s.widoczna) { widocznaSystem = true; zastosujWidocznosc(P.pokaz); }
  }).catch(function () { aktualizujStan(); });

  rysuj();
})();

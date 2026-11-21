/*
 * Atol 4.2 — promo v3: scenariusz (45 s, 128 BPM).
 * Cięcia i akcje wypadają na uderzeniach muzyki: b(n) = n * 0,46875 s, takt = b(4) = 1,875 s.
 * v3: usunięta scena „Pastylka albo notch” (dawniej b(64)–b(72)); wszystko od strony z nową wersją jest
 * wcześniej o 8 uderzeń (2 takty = 3,75 s), więc cięcia nadal są na uderzeniach, a drop na „4.2 — sama się aktualizuje”.
 */
'use strict';

const BIT = 60 / 128, b = (n) => n * BIT;
const spikeB = (t0, a) => (T >= t0 ? a * Math.exp(-(T - t0) / 0.12) : 0);
let znacznik, blyskEl;
const BLYSKI = [[b(16), 0.55], [b(80), 0.9], [b(84), 0.7]];

function scenariusz() {
  const EK = document.getElementById('ekran');
  const pokazane = (t0, d = 0.6) => E.apple(clamp((T - t0) / d, 0, 1));

  /* ---------- elementy wspólne ---------- */
  const tapeta = (rodzic) => el('div', 'tapeta2', rodzic, '<i class="f1"></i><i class="f2"></i><i class="f3"></i>');
  const pasekZadan = (rodzic) => {
    const pz = el('div', 'pz-wrap', rodzic, `<div class="pasek-zadan">
      <div class="pz-ik"><b style="background:linear-gradient(135deg,#4cc2ff,#2a6cf0);border-radius:6px"></b></div>
      <div class="pz-szukaj"><span data-ik="szukaj" style="width:15px;height:15px;display:block"></span>Szukaj</div>
      <div class="pz-ik"><b style="background:linear-gradient(160deg,#ffd76a,#f0a020)"></b></div>
      <div class="pz-ik aktywna"><b style="background:conic-gradient(from 200deg,#ff6f91,#ff9f0a,#7c6cff,#36c5ff,#ff6f91);border-radius:50%"></b></div>
      <div class="pz-ik"><b style="background:linear-gradient(160deg,#30d158,#1a9a3f)"></b></div>
      <div class="pz-ik"><b style="background:url(../../build/icon.png) center/cover"></b></div>
      <div class="zasobnik"><span class="ikz" data-ik="wifi"></span><span class="ikz" data-ik="glosnik"></span><span class="ikz" data-ik="bateria"></span><div class="zegar-pz">21:07<br>21.11.2026</div></div></div>`);
    wstawIkony(pz); pz.style.zIndex = 30;
    return pz;
  };
  const kamera = (swiat, z, cx, cy) => { swiat.style.transform = 'translate(' + f2(960 - cx * z) + 'px,' + f2(540 - cy * z) + 'px) scale(' + z.toFixed(4) + ')'; };
  const dzw = (t, m1, m2) => MUZ.dzw.push([t, m1, m2]);
  const NOTY = [[88, 95], [91, 95], [83, 91], [88, 91]];

  blyskEl = el('div', 'blysk', EK); blyskEl.style.zIndex = 40;

  /* =========================================================
     U1 (0 – 7,5 s): hook + słowa na uderzenia
     ========================================================= */
  const u1 = ujecie(0, b(16));
  el('div', 'tlo-szklo', u1.e);
  const pos = el('div', 'poswiata', u1.e);
  el('div', 'winieta', u1.e);
  const w1 = new Wyspa(u1.e, { ziarno: 11 });
  const sf1 = tor([[0, 3.4], [3.6, 3.4], [4.4, 2.5, E.kamera]]);
  const KOL1 = [[0, '#7c6cff'], [3.75, '#bf5af2'], [4.6875, '#0a84ff'], [5.625, '#ff9f0a'], [6.5625, '#36c5ff']];
  u1.rysuj.push(() => {
    let i = 0; while (i + 1 < KOL1.length && T >= KOL1[i + 1][0]) i++;
    const k0 = hex(KOL1[Math.max(0, i - 1)][1]), k1 = hex(KOL1[i][1]);
    const p = E.ease(clamp((T - KOL1[i][0]) / 0.4, 0, 1));
    pos.style.background = rgb(k0.map((x, j) => lerp(x, k1[j], i === 0 ? 1 : p)));
    pos.style.opacity = anim(0.3, 0.8, 0, 0.55).toFixed(3);
    w1.ustaw(960, 40, sf1()); w1.rysuj();
  });
  o(b(1), () => w1.pokaz());
  o(b(6), () => w1.wcisnij()); o(b(6) + 0.18, () => w1.pusc());
  napis(u1.e, 'Twój komputer ma <span class="grad">wyspę.</span>', 'duzy ciemny', 520, 0.9, 3.45)
    .style.cssText += 'font-size:108px;letter-spacing:-3.6px;';
  [[b(8), 'Muzyka.'], [b(10), 'Pliki.'], [b(12), 'Minutnik.'], [b(14), 'Powiadomienia.']].forEach(([t, tx]) =>
    napis(u1.e, '<span class="grad">' + tx + '</span>', 'duzy ciemny', 690, t, t + b(2) - 0.12, { calosc: true, dWej: 0.5, dWyj: 0.2, przes: 40 })
      .style.cssText += 'font-size:168px;letter-spacing:-6px;');
  o(b(8), () => w1.ustawMedia(utwor('lato', 16)));
  o(b(10), () => { w1.ustawMedia(null); w1.dropZone(true); });
  o(b(10) + 0.55, () => { w1.dropZone(false); w1.dodajPlik('jpg', 'Wakacje.jpg'); w1.dodajPlik('pdf', 'Raport.pdf'); dzw(b(10) + 0.55, 88, 95); });
  o(b(12), () => w1.zbiorczo(() => { w1.rozwinieta = false; w1.ustawStrone('glowna'); w1.ustawMedia(utwor('lato', 16)); w1.startTimer(300); }));
  o(b(14), () => { w1.stopTimer(); w1.powiadomienie({ typ: 'glosnosc', poziom: 70 }); });

  /* =========================================================
     U2 (7,5 – 30 s): pulpit — muzyka, schowek
     ========================================================= */
  const u2 = ujecie(b(16), b(64));
  const sw = el('div', 'swiat', u2.e);
  tapeta(sw);
  pasekZadan(sw);

  const ikona = (rodzaj, nazwa, x, y) => {
    const e = el('div', 'ikp', sw, '<div class="ikp-sel"></div><div class="ikp-mini">' + MINI[rodzaj] + '</div><span>' + nazwa + '</span><i class="ikp-odznaka">1</i>');
    e.style.left = x + 'px'; e.style.top = y + 'px';
    return { e, x, y: y - 7, sel: e.querySelector('.ikp-sel'), odz: e.querySelector('.ikp-odznaka'), drag: null };
  };
  const iRaport = ikona('pdf', 'Raport.pdf', 120, 190);
  const iSzkola = ikona('folder', 'Szkoła', 120, 400);
  const iProjekty = ikona('folder', 'Projekty', 1790, 330);
  const iWakacje = ikona('jpg', 'Wakacje.jpg', 430, 830);
  const iZachod = ikona('jpg', 'Zachód.jpg', 595, 830);
  const iNotatki = ikona('pdf', 'Notatki.pdf', 760, 830);
  const iPlan = ikona('pdf', 'Plan.pdf', 925, 830);
  const WSZYSTKIE = [iRaport, iSzkola, iProjekty, iWakacje, iZachod, iNotatki, iPlan];
  const eks = el('div', 'eks', sw, `<div class="eks-bar"><b>Zdjęcia i dokumenty</b></div>
    <div class="eks-pasek"><span>Nowy</span><span>Sortuj</span><span>Widok</span></div>
    <div class="eks-bok"><em>Pulpit</em><span>Pobrane</span><span>Dokumenty</span><span>Zdjęcia</span></div>`);
  const wiad = el('div', 'wiad', sw, `
    <div class="wiad-bar"><b>Nowa wiadomość</b></div>
    <div class="wiad-pole"><span>Do</span><em>Ola Kowalska</em></div>
    <div class="wiad-pole"><span>Temat</span><em>Notatki na jutro</em></div>
    <div class="wiad-tresc"><i style="width:88%"></i><i style="width:72%"></i></div>
    <div class="wiad-zal"><span class="wiad-pusty">Upuść załącznik tutaj</span><div class="wiad-chip"><div class="wiad-mini">${MINI.pdf}</div><b>Notatki.pdf</b></div></div>`);
  const chip = wiad.querySelector('.wiad-chip'), zalPusty = wiad.querySelector('.wiad-pusty');

  const w2 = new Wyspa(sw, { ziarno: 5 });
  const SW = 2.4, yw = () => (w2.notch ? 0 : 24);
  const k2 = new Kursor(sw); k2.e.style.zIndex = 20; k2.widocznosc = [[0, 0]]; k2.start(1500, 560);
  const mk = (rodzaj, nazwa) => new Duch(sw, rodzaj, nazwa, 110);
  const dI = [mk('pdf', 'Raport.pdf'), mk('jpg', 'Wakacje.jpg'), mk('folder', 'Szkoła'), mk('pdf', 'Notatki.pdf')];
  const dO = [mk('pdf', 'Notatki.pdf'), mk('jpg', 'Wakacje.jpg')];
  const kolko = el('div', 'kolko', sw, '<i></i>');
  const OKNA_KOLKA = [[b(50) - 0.15, b(50) + 0.4], [b(52) - 0.15, b(52) + 0.4]];
  const zCam = tor([[b(16), 1.35], [12.9, 1.35], [13.7, 1.0, E.kamera], [22.5, 1.0], [23.3, 1.5, E.kamera], [25.2, 1.5], [26.0, 1.0, E.kamera]]);
  const DROP_CEL = { x: 960, y: 290 }, ZAL = { x: 1450, y: 949 }, PROJ = { x: 1790, y: 280 };
  const DROP_T = [0, 1, 2, 3].map((i) => b(36) + i * 1.875);       // 16,875 / 18,75 / 20,625 / 22,5
  const WYJ_T = [b(59), b(63)];                                      // 27,66 / 29,53
  const ZRODLA = [iRaport, iWakacje, iSzkola, iNotatki];

  u2.rysuj.push(() => {
    const z = zCam(), cy = lerp(540, 300, clamp((z - 1) / 0.5, 0, 1));
    kamera(sw, z, 960, cy);
    WSZYSTKIE.forEach((ik, i) => {
      const p = pokazane(12.9 + i * 0.09);
      let op = p;
      const g = ik.drag;
      if (g && T >= g[0] && T < g[1] + 0.2) op *= 0.4;
      ik.e.style.opacity = op.toFixed(3);
      ik.e.style.transform = 'translateY(' + f2((1 - p) * 28) + 'px)';
      ik.sel.style.opacity = (g && T >= g[0] - 0.05 && T < g[1] + 0.25) ? 1 : 0;
    });
    const pe = pokazane(13.3);
    eks.style.opacity = pe.toFixed(3); eks.style.transform = 'translateY(' + f2((1 - pe) * 40) + 'px)';
    const pw = pokazane(13.5);
    wiad.style.opacity = pw.toFixed(3); wiad.style.transform = 'translateY(' + f2((1 - pw) * 40) + 'px)';
    const pc = clamp((T - WYJ_T[0]) / 0.45, 0, 1);
    chip.style.opacity = clamp(pc * 3, 0, 1).toFixed(3); chip.style.transform = 'scale(' + lerp(0.6, 1, E.okl(pc)).toFixed(4) + ')';
    zalPusty.style.opacity = (1 - clamp(pc * 3, 0, 1)).toFixed(3);
    const po = clamp((T - WYJ_T[1]) / 0.45, 0, 1);
    iProjekty.odz.style.opacity = clamp(po * 3, 0, 1).toFixed(3); iProjekty.odz.style.transform = 'scale(' + lerp(0.4, 1, E.okl(po)).toFixed(4) + ')';
    if (T > WYJ_T[1] - 0.35 && T < WYJ_T[1] + 0.5) iProjekty.sel.style.opacity = 1;
    w2.ustaw(960, yw(), SW); w2.rysuj();
    dI.forEach((d) => d.rysuj()); dO.forEach((d) => d.rysuj());
    let kv = 0, ph = 0;
    OKNA_KOLKA.forEach(([a, c]) => { if (T >= a && T < c) { kv = Math.min(1, (T - a) / 0.1, (c - T) / 0.12); ph = (T - a) / 0.55; } });
    const kp = k2.poz();
    kolko.style.opacity = kv.toFixed(3);
    kolko.style.transform = 'translate(' + f2(kp.x + 56) + 'px,' + f2(kp.y - 4) + 'px) scale(' + lerp(0.85, 1, kv).toFixed(3) + ')';
    kolko.firstChild.style.transform = 'translateY(' + f2(10 * Math.abs(Math.sin(ph * Math.PI * 2))) + 'px)';
    k2.rysuj();
  });

  // --- muzyka na wyspie (7,5 – 13 s)
  o(b(15) - 0.2, () => w2.pokaz());
  o(b(15), () => w2.ustawMedia(utwor('lato', 16)));
  k2.widoczny(8.0, 1).ruch(8.1, 9.2, 972, 86).klik(b(20));
  o(b(20), () => w2.rozwin());
  o(9.6, () => { const nx = ekran(w2, '.s-next', SW, 960, yw()); k2.ruch(9.7, 11.1, nx.x + 2, nx.y + 3).klik(b(24)); });
  o(b(24), () => w2.ustawMedia(utwor('godzina', 0)));
  k2.ruch(11.7, 12.1, 1560, 640).klik(b(26));
  o(b(26), () => w2.zwin());
  napis(u2.e, 'Muzyka. <span class="grad">Zawsze na wierzchu.</span>', 'sredni ciemny', 905, 8.0, 12.8);

  // --- schowek: pliki na wyspę (15 – 22,5 s)
  const TYPY = [['pdf', 'Raport.pdf'], ['jpg', 'Wakacje.jpg'], ['folder', 'Szkoła'], ['pdf', 'Notatki.pdf']];
  ZRODLA.forEach((zr, i) => {
    const td = DROP_T[i], tg = td - 0.9375;
    zr.drag = [tg, td];
    const sx = zr.x, sy = zr.y;
    o(tg - (i === 0 ? 1.4 : 0.85), () => { k2.ruch(tg - (i === 0 ? 1.4 : 0.85), tg - 0.08, sx + 3, sy + 4).klik(tg); });
    o(tg, () => {
      dI[i].przeciagnij(tg, td, sx, sy + 7, DROP_CEL.x, DROP_CEL.y);
      k2.ruch(tg + 0.1, td, DROP_CEL.x, DROP_CEL.y).klik(td);
    });
    o(td - 0.55, () => w2.dropZone(true));
    o(td, () => { w2.dropZone(false); w2.dodajPlik(TYPY[i][0], TYPY[i][1]); dzw(td, NOTY[i][0], NOTY[i][1]); });
  });
  napis(u2.e, 'Przeciągnij plik <span class="grad">na wyspę.</span>', 'sredni ciemny', 545, 15.0, 18.3);
  napis(u2.e, '<span class="grad">Schowek na pliki.</span>', 'sredni ciemny', 545, 18.7, 22.2, { calosc: true })
    .style.cssText += 'font-size:88px;letter-spacing:-3px;';

  // --- schowek: kółko myszy i wyciąganie (22,5 – 30 s)
  o(22.6, () => k2.ruch(22.65, 23.2, 1250, 395));
  o(b(50), () => w2.zmienStrone('glowna'));
  o(b(52), () => w2.zmienStrone('schowek'));
  napis(u2.e, 'Przewiń <span class="grad">kółkiem.</span>', 'sredni ciemny', 940, 22.7, 25.15);
  const tgO = WYJ_T.map((t) => t - 0.9375);                // 26,72 / 28,59
  o(26.0, () => {
    const p = ekran(w2, '.sch-plik:nth-child(1)', SW, 960, yw());
    k2.ruch(26.0, tgO[0] - 0.07, p.x + 2, p.y + 3).klik(tgO[0]);
    o(tgO[0], () => { dO[0].przeciagnij(tgO[0], WYJ_T[0], p.x, p.y, ZAL.x, ZAL.y); k2.ruch(tgO[0] + 0.1, WYJ_T[0], ZAL.x, ZAL.y).klik(WYJ_T[0]); dzw(WYJ_T[0], 91, 95); });
  });
  o(WYJ_T[0] + 0.2, () => {
    const p = ekran(w2, '.sch-plik:nth-child(3)', SW, 960, yw());
    k2.ruch(WYJ_T[0] + 0.25, tgO[1] - 0.07, p.x + 2, p.y + 3).klik(tgO[1]);
    o(tgO[1], () => { dO[1].przeciagnij(tgO[1], WYJ_T[1], p.x, p.y, PROJ.x, PROJ.y); k2.ruch(tgO[1] + 0.1, WYJ_T[1], PROJ.x, PROJ.y).klik(WYJ_T[1]); dzw(WYJ_T[1], 88, 95); });
  });
  napis(u2.e, 'A potem <span class="grad">wyciągnij.</span>', 'sredni ciemny', 545, 25.9, 29.3);
  o(29.9, () => k2.widoczny(29.9, 0));

  // (v3: scena „Pastylka albo notch” + minutnik usunięta — minutnik bez zmiany stylu nie miał tu osobnego ujęcia,
  //  a pokazuje go już hook w U1)

  /* =========================================================
     U3 (30 – 33,75 s): strona z nową wersją
     ========================================================= */
  const T3 = b(64);
  const u3 = ujecie(T3, b(72));
  const sw3 = el('div', 'swiat', u3.e);
  tapeta(sw3); pasekZadan(u3.e);
  const przegl = el('div', 'przegl', sw3, `
    <div class="pr-belka"><div class="pr-tab"><i style="background:linear-gradient(135deg,#7c6cff,#36c5ff)"></i><span>Atol — studio SZykAI</span><em>✕</em></div><div class="pr-plus">+</div>
      <div class="pr-ster"><span><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></span><span><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg></span><span><svg viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg></span></div></div>
    <div class="pr-adres"><span class="nav" data-ik="wstecz"></span><span class="nav" data-ik="dalej"></span><span class="nav" data-ik="odswiez"></span>
      <div class="pr-url"><span data-ik="klodka" style="width:12px;height:12px;display:block"></span>szykai.pages.dev/projects/atol</div></div>
    <div class="pr-strona"><div class="pg">
      <div class="pg-tlo"></div>
      <div class="pg-nav"><b>SZyk<span>AI</span></b><span>Projekty</span><span>O nas</span><span>Kontakt</span></div>
      <div class="pg-hero">
        <img class="pg-ikona" src="../../build/icon.png">
        <div class="pg-h1">Atol<span>.</span></div>
        <div class="pg-lead">Dynamiczna wyspa dla Windows.<br>Muzyka, schowek, minutnik — zawsze na wierzchu.</div>
        <div class="pg-przyc"><div class="pg-btn">Pobierz za darmo</div><div class="pg-mala">Windows 10 / 11</div></div>
      </div>
      <div class="pg-wersja"><i></i>Wersja 4.1.1</div>
      <div class="pg-fala"></div><div class="pg-fala"></div><div class="pg-fala"></div>
      <div class="pg-nowa">✦ Nowa wersja 4.2</div>
      <div class="pg-karta"><h3>Atol <span>4.2</span></h3><p>Co nowego</p>
        <div class="pg-pkt"><span class="ik" data-ik="odswiez" style="background:rgba(48,209,88,.16);color:#30d158"></span>Sama się aktualizuje</div>
        <div class="pg-pkt"><span class="ik" data-ik="schowek" style="background:rgba(255,214,10,.16);color:#ffd60a"></span>Schowek na pliki</div>
        <div class="pg-pkt"><span class="ik" data-ik="piorun" style="background:rgba(10,132,255,.2);color:#64b5ff"></span>Szybszy start</div>
      </div></div></div>`);
  wstawIkony(przegl);
  const pgChip = przegl.querySelector('.pg-wersja'), pgNowa = przegl.querySelector('.pg-nowa'), pgFale = [...przegl.querySelectorAll('.pg-fala')];
  const pgKarta = przegl.querySelector('.pg-karta'), pgWiersze = [...przegl.querySelectorAll('.pg-pkt')];
  pgChip.style.left = pgNowa.style.left = '268px'; pgChip.style.top = pgNowa.style.top = '158px';
  pgFale.forEach((f) => { f.style.left = '268px'; f.style.top = '158px'; f.style.width = '250px'; f.style.height = '46px'; });
  przegl.style.left = '160px'; przegl.style.top = '50px'; przegl.style.width = '1600px'; przegl.style.height = '830px';
  const zCam3 = tor([[T3, 1.0], [b(72), 1.06, E.easeOut]]);
  u3.rysuj.push(() => {
    kamera(sw3, zCam3(), 960, 540);
    const k = anim(T3, 0.7, 0.93, 1, E.spr), op = anim(T3, 0.25, 0, 1, E.ease);
    przegl.style.transform = 'scale(' + k.toFixed(4) + ')'; przegl.style.opacity = op.toFixed(3);
    const tf = b(66), pf = clamp((T - tf) / 0.5, 0, 1);
    pgChip.style.opacity = (1 - clamp(pf * 4, 0, 1)).toFixed(3);
    pgChip.style.transform = 'translateY(' + f2(-10 * clamp(pf * 3, 0, 1)) + 'px)';
    pgNowa.style.opacity = clamp(pf * 4, 0, 1).toFixed(3);
    pgNowa.style.transform = 'scale(' + lerp(0.6, 1, E.okl(pf)).toFixed(4) + ')';
    pgFale.forEach((f, i) => {
      const q = clamp((T - tf - i * 0.2) / 0.9, 0, 1);
      f.style.opacity = (T < tf + i * 0.2 ? 0 : 0.9 * (1 - q)).toFixed(3);
      f.style.transform = 'scale(' + lerp(1, 1.5 + i * 0.1, E.easeOut(q)).toFixed(3) + ')';
    });
    const tk = b(67), pk = E.apple(clamp((T - tk) / 0.8, 0, 1));
    pgKarta.style.opacity = E.apple(clamp((T - tk) / 0.5, 0, 1)).toFixed(3);
    pgKarta.style.transform = 'translateX(' + f2((1 - pk) * 90) + 'px)';
    pgWiersze.forEach((r, i) => {
      const q = E.apple(clamp((T - tk - 0.35 - i * 0.16) / 0.5, 0, 1));
      r.style.opacity = q.toFixed(3); r.style.transform = 'translateY(' + f2((1 - q) * 18) + 'px)';
    });
  });
  napis(u3.e, 'Wychodzi nowa wersja <span class="grad">4.2.</span>', 'sredni ciemny', 905, T3 + 0.25, b(72) - 0.1);

  /* =========================================================
     U4 (33,75 – 39,375 s): ustawienia Atola — aktualizacja i restart
     ========================================================= */
  const T4 = b(72), T_POB = T4 + 0.47, T_GOT = b(77), T_KLIK = b(79), T_ZN = b(80);
  const u4 = ujecie(T4, b(84));
  const sw4 = el('div', 'swiat', u4.e);
  tapeta(sw4); pasekZadan(sw4);
  const ust = el('div', 'ust', sw4, `
    <div class="ust-belka"><span><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></span><span><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg></span><span><svg viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/></svg></span></div>
    <div class="ust-app">
      <aside class="ust-bok">
        <div class="ust-marka"><img src="../../build/icon.png"><div><b>Atol</b><small>od <em>studio SZykAI</em></small></div></div>
        <nav class="ust-menu"><div class="ust-wsk" style="transform:translateY(168px)"></div>
          <div class="ust-poz"><span data-ik="wyspaIk"></span>Wyspa</div>
          <div class="ust-poz"><span data-ik="moduly"></span>Moduły</div>
          <div class="ust-poz"><span data-ik="dzwonek"></span>Powiadomienia</div>
          <div class="ust-poz"><span data-ik="system"></span>System</div>
          <div class="ust-poz akt"><span data-ik="info"></span>O aplikacji</div>
        </nav>
        <div class="ust-stopka"><div class="ust-stan"><span class="ust-kropka"><i></i></span>Wyspa działa</div><div class="ust-wersja">Atol 4.1.1</div></div>
      </aside>
      <main class="ust-tresc">
        <div class="ust-nagl"><h1>O aplikacji</h1><p>&nbsp;</p></div>
        <div class="ust-sekcja" style="display:block">
          <div class="oa-karta"><img class="oa-ikona" src="../../build/icon.png"><div class="oa-nazwa">Atol</div><div class="oa-wersja">wersja 4.1.1</div>
            <div class="oa-opis">Dynamiczna wyspa na górze ekranu Windows — muzyka, schowek na pliki, powiadomienia i minutnik.</div>
            <div class="oa-studio"><span>Zbudowane przez</span><strong>studio <b>SZykAI</b></strong></div></div>
          <div class="oa-wiersz"><span class="ik" data-ik="odswiez"></span><div class="tx"><b>Aktualizacje</b><span class="oa-status">Sprawdzam…</span></div><div class="oa-btn" style="width:230px;text-align:center">Sprawdź aktualizacje</div><div class="oa-pasek"><b></b></div></div>
        </div>
      </main></div>`);
  wstawIkony(ust);
  ust.style.left = '960px'; ust.style.top = '572px';
  const oaStatus = ust.querySelector('.oa-status'), oaBtn = ust.querySelector('.oa-btn'), oaPasek = ust.querySelector('.oa-pasek b'), oaPasekW = ust.querySelector('.oa-pasek');
  const kropka = ust.querySelector('.ust-kropka i');
  const w4 = new Wyspa(sw4, { ziarno: 9 });
  const k4 = new Kursor(sw4); k4.e.style.zIndex = 20; k4.widocznosc = [[0, 0]]; k4.start(1560, 900);
  u4.rysuj.push(() => {
    kamera(sw4, 1, 960, 540);
    const wej = anim(T4, 0.7, 0.9, 1, E.spr), opw = anim(T4, 0.3, 0, 1, E.ease);
    const wyj = T < T_KLIK + 0.1 ? 0 : E.easeIn(clamp((T - T_KLIK - 0.1) / 0.3, 0, 1));
    ust.style.transform = 'translate(-50%,-50%) scale(' + (1.3 * wej * (1 - 0.06 * wyj)).toFixed(4) + ')';
    ust.style.opacity = (opw * (1 - wyj)).toFixed(3);
    const pct = Math.round(100 * E.ease(clamp((T - T_POB) / (T_GOT - T_POB - 0.1), 0, 1)));
    let tekst;
    if (T < T_POB) tekst = 'Sprawdzam…';
    else if (T < T_GOT) tekst = 'Pobieram wersję 4.2.0 — ' + pct + '%';
    else if (T < T_KLIK) tekst = 'Wersja 4.2.0 jest gotowa do instalacji.';
    else tekst = 'Zamykam Atol i instaluję…';
    oaStatus.textContent = tekst;
    const gotowa = T >= T_GOT;
    oaBtn.textContent = gotowa ? 'Uruchom ponownie i zainstaluj' : 'Sprawdź aktualizacje';
    oaBtn.className = 'oa-btn' + (gotowa ? ' gl' : '');
    const pp = gotowa ? clamp((T - T_GOT) / 0.45, 0, 1) : 0;
    const klik = T >= T_KLIK - 0.07 && T < T_KLIK ? lerp(1, 0.93, (T - (T_KLIK - 0.07)) / 0.07) : T >= T_KLIK && T < T_KLIK + 0.25 ? lerp(0.93, 1, E.spr((T - T_KLIK) / 0.25)) : 1;
    oaBtn.style.transform = 'scale(' + ((gotowa ? lerp(0.9, 1, E.okl(pp)) : 1) * klik).toFixed(4) + ')';
    oaBtn.style.opacity = gotowa ? '1' : '0.4';
    oaPasek.style.transform = 'scaleX(' + (T < T_POB ? 0 : pct / 100).toFixed(4) + ')';
    oaPasekW.style.opacity = (T < T_POB ? 0 : 1 - clamp((T - T_GOT) / 0.3, 0, 1)).toFixed(3);
    const f = ((T - T4) % 2.2) / 2.2;
    kropka.style.transform = 'scale(' + (1 + 2 * E.easeOut(f)).toFixed(3) + ')'; kropka.style.opacity = (0.7 * (1 - E.easeOut(f))).toFixed(3);
    w4.ustaw(960, 24, SW); w4.rysuj(); k4.rysuj();
  });
  o(b(71) - 0.2, () => w4.pokaz());
  o(b(71), () => w4.ustawMedia(utwor('godzina', 40)));
  o(35.35, () => {
    const p = pozycjaW(oaBtn, ust);
    const bx = 960 + (p.x - 430) * 1.3, by = 572 + (p.y - 310) * 1.3;
    k4.widoczny(35.45, 1).ruch(35.55, 36.8, bx + 4, by + 4).klik(T_KLIK);
  });
  o(37.2, () => k4.widoczny(37.2, 0));
  o(b(78) + 0.1, () => w4.schowaj());                      // restart: wyspa znika…
  o(T_ZN, () => w4.pokaz());                                // …i wraca razem z dropem
  napis(u4.e, '4.2 — sama się <span class="grad">aktualizuje.</span>', 'duzy ciemny', 440, T_ZN + 0.05, b(84) - 0.12, { dWej: 0.45, odstep: 0.04, przes: 40 })
    .style.cssText += 'font-size:104px;letter-spacing:-3.5px;';

  /* =========================================================
     U5 (39,375 – 45 s): plansza końcowa
     ========================================================= */
  const T5 = b(84);
  const u5 = ujecie(T5, 99);
  el('div', 'tlo-szklo', u5.e);
  const pos5 = el('div', 'poswiata', u5.e);
  el('div', 'winieta', u5.e);
  const ik5 = el('img', 'logo-ikona', u5.e); ik5.src = '../../build/icon.png';
  u5.rysuj.push(() => {
    const p = E.apple(clamp((T - T5) / 0.8, 0, 1));
    ik5.style.top = f2(110 + 20 * (1 - p)) + 'px'; ik5.style.opacity = p.toFixed(3);
    ik5.style.transform = 'scale(' + (0.6 + 0.4 * E.spr(clamp((T - T5) / 0.6, 0, 1))).toFixed(4) + ')';
    ik5.style.width = ik5.style.height = '160px'; ik5.style.marginLeft = '-80px'; ik5.style.borderRadius = '36px';
    pos5.style.background = rgb(hex('#7c6cff').map((x, j) => lerp(x, hex('#36c5ff')[j], clamp((T - T5) / 5, 0, 1))));
    pos5.style.opacity = (0.55 + 0.2 * Math.sin((T - T5) * 1.4)).toFixed(3);
  });
  napis(u5.e, 'Atol', 'duzy ciemny', 290, T5 + 0.4, 99, { calosc: true, dWej: 1.0, przes: 40 })
    .style.cssText += 'font-size:220px;font-weight:700;letter-spacing:-9px;line-height:1.1;';
  napis(u5.e, 'Za darmo · Windows · studio SZykAI', 'maly ciemny', 590, b(87), 99, { calosc: true, dWej: 0.8 })
    .style.cssText += 'font-size:52px;';
  napis(u5.e, 'szykai.pages.dev/projects/atol', 'sredni ciemny', 760, b(89), 99, { calosc: true, dWej: 0.8 })
    .style.cssText += 'font-size:64px;letter-spacing:-1.5px;';

  /* ---------- dźwięk przejść (whoosh) i wygaszenie ---------- */
  // v3: bez b(64) − 0,3 (najazd kamery na notch) — w tym miejscu jest teraz cięcie do U3 z własnym T3 − 0,35
  MUZ.whoosh.push(b(16) - 0.4, b(36) - 0.3, T3 - 0.35, T4 - 0.35);
  zaciemnienie = el('div', 'zaciemnienie', EK);
  zaciemnienie.style.zIndex = 50;
  znacznik = el('div', '', document.body);
  znacznik.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;z-index:99;';
}

/* ============================== PĘTLA ============================== */

function rysujWszystko() {
  for (const u of UJECIA) {
    const wid = T >= u.od && T < u.do;
    u.e.classList.toggle('widoczne', wid);
    if (wid) u.rysuj.forEach((f) => f());
  }
  rysujNapisy();
  let bl = 0;
  for (const [t, a] of BLYSKI) bl = Math.max(bl, spikeB(t, a));
  blyskEl.style.opacity = clamp(bl, 0, 1).toFixed(3);
  const z = Math.max(1 - clamp(T / 0.45, 0, 1), E.inOut(clamp((T - 44.2) / 0.75, 0, 1)));
  zaciemnienie.style.opacity = z.toFixed(3);
}

window.przygotuj = async function () {
  await document.fonts.load('700 100px "Segoe UI Variable Display"');
  await document.fonts.load('600 14px "Segoe UI Variable Text"');
  przygotujUtwory();
  scenariusz();
  await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((ok) => { im.onload = im.onerror = ok; }))));
  await new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = '../../build/icon.png'; });
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
  znacznik.style.background = 'rgb(' + (n % 64) * 4 + ',' + (Math.floor(n / 64) % 64) * 4 + ',77)';
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
};

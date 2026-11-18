/*
 * Atol — reklama: muzyka.
 *
 * Utwór jest skomponowany tutaj, w kodzie, i "nagrywany" przez Web Audio (OfflineAudioContext) — bez cudzych
 * nagrań, więc nie ma problemu z prawami autorskimi. Tempo 120 BPM: 1 takt = 2 s, 1 uderzenie = 0,5 s,
 * dzięki czemu każde cięcie w filmie wypada dokładnie na uderzeniu stopy.
 *
 * Plan (sekundy):
 *   0–4    wstęp: miękki pad, pierwsze dźwięki arpeggio
 *   4–8    narastanie: arpeggio się otwiera, szum "wznoszący", tyknięcia przy słowach (6; 6,5; 7; 7,5)
 *   8–16   wejście bitu (uderzenie), bas, melodia dzwonków             — muzyka na pulpicie
 *   16–24  bit + szelest 16-tek, "dzwonki" powiadomień                  — powiadomienia
 *   24–32  pełny bit + melodia, przejście werblem                       — moduły, notch
 *   32–36  wyciszenie (pełny ekran — wyspa znika), narastanie, pauza
 *   36–44  ostatnie wejście, najpełniej                                 — ustawienia, montaż
 *   44–50  zakończenie: uderzenie, długi akord, wybrzmienie              — logo
 */
'use strict';

async function zrobMuzyke() {
  const SR = 48000, DL = 50.6;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DL), SR);
  const B = 0.5;                 // uderzenie (ćwierćnuta)
  const T = 2;                   // takt

  // --- powtarzalny "los" (ten sam utwór przy każdym renderze) ---
  let ziarno = 20261118;
  const los = () => { ziarno = (ziarno * 1664525 + 1013904223) >>> 0; return ziarno / 4294967296; };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // --- szum ---
  const szum = ctx.createBuffer(2, SR * 2, SR);
  for (let c = 0; c < 2; c++) { const d = szum.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = los() * 2 - 1; }

  // --- pogłos (odpowiedź impulsowa: gasnący szum, lekko filtrowany) ---
  const dlIR = Math.floor(SR * 3.4);
  const ir = ctx.createBuffer(2, dlIR, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < dlIR; i++) {
      const x = i / dlIR;
      lp += ((los() * 2 - 1) - lp) * (0.55 - 0.4 * x);       // im później, tym ciemniej
      d[i] = lp * Math.pow(1 - x, 3.0) * Math.min(1, i / (SR * 0.012));
    }
  }

  // --- tor główny ---
  const master = ctx.createGain(); master.gain.value = 0.9;
  const kompr = ctx.createDynamicsCompressor();
  kompr.threshold.value = -16; kompr.knee.value = 12; kompr.ratio.value = 3.2;
  kompr.attack.value = 0.006; kompr.release.value = 0.22;
  const ciecieNisko = ctx.createBiquadFilter(); ciecieNisko.type = 'highpass'; ciecieNisko.frequency.value = 28;
  const powietrze = ctx.createBiquadFilter(); powietrze.type = 'highshelf'; powietrze.frequency.value = 6000; powietrze.gain.value = 3;
  master.connect(ciecieNisko); ciecieNisko.connect(powietrze); powietrze.connect(kompr); kompr.connect(ctx.destination);

  // końcowe wyciszenie
  master.gain.setValueAtTime(0.9, 0);
  master.gain.setValueAtTime(0.9, 48.2);
  master.gain.linearRampToValueAtTime(0.0, 50.5);

  const poglos = ctx.createConvolver(); poglos.buffer = ir; poglos.normalize = true;
  const poglosWyj = ctx.createGain(); poglosWyj.gain.value = 0.55;
  poglos.connect(poglosWyj); poglosWyj.connect(master);

  // echo (ósemka z kropką = 0,375 s), przyciemniane w pętli
  const echo = ctx.createDelay(1.5); echo.delayTime.value = 0.375;
  const echoFb = ctx.createGain(); echoFb.gain.value = 0.34;
  const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 3200;
  const echoWyj = ctx.createGain(); echoWyj.gain.value = 0.42;
  echo.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echo);
  echoLp.connect(echoWyj); echoWyj.connect(master);
  const echoDoPoglosu = ctx.createGain(); echoDoPoglosu.gain.value = 0.3; echoWyj.connect(echoDoPoglosu); echoDoPoglosu.connect(poglos);

  // "pompowanie" (sidechain): pad, bas i arpeggio przyciszają się przy każdej stopie
  const pompa = ctx.createGain(); pompa.connect(master);

  // pad: wspólny filtr, który "otwiera się" i "zamyka" w czasie utworu
  const padBus = ctx.createGain(); padBus.gain.value = 1;
  const padLp = ctx.createBiquadFilter(); padLp.type = 'lowpass'; padLp.Q.value = 0.6;
  padBus.connect(padLp); padLp.connect(pompa);
  const padPoglos = ctx.createGain(); padPoglos.gain.value = 0.45; padLp.connect(padPoglos); padPoglos.connect(poglos);
  const f = padLp.frequency;
  f.setValueAtTime(420, 0); f.exponentialRampToValueAtTime(1300, 7.9);
  f.setValueAtTime(2200, 8); f.setValueAtTime(2200, 32); f.exponentialRampToValueAtTime(520, 33);
  f.exponentialRampToValueAtTime(1600, 35.9); f.setValueAtTime(2800, 36); f.setValueAtTime(2800, 44);
  f.exponentialRampToValueAtTime(1500, 50);

  // arpeggio: wspólny filtr
  const arpBus = ctx.createGain();
  const arpLp = ctx.createBiquadFilter(); arpLp.type = 'lowpass'; arpLp.Q.value = 2.2;
  arpBus.connect(arpLp); arpLp.connect(pompa);
  const arpEcho = ctx.createGain(); arpEcho.gain.value = 0.35; arpLp.connect(arpEcho); arpEcho.connect(echo);
  const arpPoglos = ctx.createGain(); arpPoglos.gain.value = 0.25; arpLp.connect(arpPoglos); arpPoglos.connect(poglos);
  const fa = arpLp.frequency;
  fa.setValueAtTime(700, 2); fa.exponentialRampToValueAtTime(1100, 4); fa.exponentialRampToValueAtTime(5200, 7.95);
  fa.setValueAtTime(3600, 8); fa.setValueAtTime(3600, 32); fa.exponentialRampToValueAtTime(600, 32.8);
  fa.exponentialRampToValueAtTime(6000, 35.75); fa.setValueAtTime(4200, 36); fa.setValueAtTime(4200, 44);
  fa.exponentialRampToValueAtTime(900, 49);

  // ---------- instrumenty ----------
  function zrodloSzumu(t, dl) {
    const s = ctx.createBufferSource(); s.buffer = szum; s.loop = true;
    s.start(t, los() * 1.5); s.stop(t + dl + 0.05);
    return s;
  }
  function obwiednia(g, t, szczyt, atak, zanik) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(szczyt, t + atak);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atak + zanik);
  }

  function stopa(t, v = 1) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(175, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.4);
    const g = ctx.createGain(); obwiednia(g, t, 0.78 * v, 0.002, 0.42);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.5);
    // klik
    const n = zrodloSzumu(t, 0.02), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const gk = ctx.createGain(); obwiednia(gk, t, 0.18 * v, 0.0005, 0.012);
    n.connect(hp); hp.connect(gk); gk.connect(master);
    // pompowanie
    pompa.gain.setValueAtTime(0.32, t);
    pompa.gain.linearRampToValueAtTime(1, t + 0.3);
  }

  function klask(t, v = 1) {
    const n = zrodloSzumu(t, 0.3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 0.9;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 650;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 3; k++) {
      const tk = t + k * 0.011;
      g.gain.setValueAtTime(0.55 * v, tk);
      g.gain.exponentialRampToValueAtTime(0.05 * v, tk + 0.009);
    }
    g.gain.setValueAtTime(0.5 * v, t + 0.034);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master);
    const wys = ctx.createGain(); wys.gain.value = 0.35; g.connect(wys); wys.connect(poglos);
  }

  function talerz(t, v, otwarty, pan = 0) {
    const dl = otwarty ? 0.32 : 0.05;
    const n = zrodloSzumu(t, dl + 0.05);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = otwarty ? 6500 : 7800;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 10500; pk.gain.value = 6;
    const g = ctx.createGain(); obwiednia(g, t, v, 0.001, dl);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    n.connect(hp); hp.connect(pk); pk.connect(g); g.connect(p); p.connect(master);
  }

  function szelest(t, v, pan) {
    const n = zrodloSzumu(t, 0.06);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6000; bp.Q.value = 1.4;
    const g = ctx.createGain(); obwiednia(g, t, v, 0.006, 0.035);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
  }

  function werbel(t, v = 1) {
    const n = zrodloSzumu(t, 0.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.7;
    const g = ctx.createGain(); obwiednia(g, t, 0.32 * v, 0.001, 0.13);
    n.connect(bp); bp.connect(g); g.connect(master);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
    const go = ctx.createGain(); obwiednia(go, t, 0.22 * v, 0.001, 0.09);
    o.connect(go); go.connect(master); o.start(t); o.stop(t + 0.15);
    const wys = ctx.createGain(); wys.gain.value = 0.3; g.connect(wys); wys.connect(poglos);
  }

  function tykniecie(t, v = 1) {        // drewienko: krótkie, jasne "tik" pod słowa
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1850, t); o.frequency.exponentialRampToValueAtTime(1250, t + 0.04);
    const g = ctx.createGain(); obwiednia(g, t, 0.16 * v, 0.001, 0.07);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 620;
    const g2 = ctx.createGain(); obwiednia(g2, t, 0.13 * v, 0.001, 0.09);
    o2.connect(g2); g2.connect(master); o2.start(t); o2.stop(t + 0.12);
    const wys = ctx.createGain(); wys.gain.value = 0.6; g.connect(wys); wys.connect(poglos);
  }

  function klikMyszy(t, v = 1) {
    const n = zrodloSzumu(t, 0.02);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3800; bp.Q.value = 2;
    const g = ctx.createGain(); obwiednia(g, t, 0.09 * v, 0.0005, 0.018);
    n.connect(bp); bp.connect(g); g.connect(master);
  }

  function bas(t, midi, dl, v = 1) {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = hz(midi);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(midi - 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(260, t + dl * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.006);
    g.gain.setValueAtTime(0.2 * v, t + dl * 0.7); g.gain.linearRampToValueAtTime(0, t + dl);
    const gs = ctx.createGain(); gs.gain.value = 0.85;
    o1.connect(lp); lp.connect(g); o2.connect(gs); gs.connect(g); g.connect(pompa);
    o1.start(t); o2.start(t); o1.stop(t + dl + 0.02); o2.stop(t + dl + 0.02);
  }

  function pad(t, dl, nuty, v = 1) {
    nuty.forEach((m, i) => {
      [-9, 0, 8].forEach((rozstr, j) => {
        const o = ctx.createOscillator(); o.type = j === 1 ? 'triangle' : 'sawtooth';
        o.frequency.value = hz(m); o.detune.value = rozstr;
        const g = ctx.createGain();
        const s = (j === 1 ? 0.062 : 0.034) * v;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(s, t + 0.45);
        g.gain.setValueAtTime(s, t + dl); g.gain.linearRampToValueAtTime(0, t + dl + 0.9);
        const p = ctx.createStereoPanner(); p.pan.value = (j - 1) * 0.55 + (i % 2 ? 0.1 : -0.1);
        o.connect(g); g.connect(p); p.connect(padBus); o.start(t); o.stop(t + dl + 1);
      });
    });
  }

  function szarpniecie(t, midi, v, pan) {   // pluck do arpeggio
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(midi);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = hz(midi); o2.detune.value = 7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(480, t + 0.16);
    const g = ctx.createGain(); obwiednia(g, t, 0.1 * v, 0.002, 0.24);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(p); p.connect(arpBus);
    o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
  }

  function dzwonek(t, midi, dl, v = 1, pan = 0) {   // melodia: "szklany" dzwonek z alikwotami
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    const wyj = ctx.createGain(); wyj.gain.value = v;
    p.connect(wyj); wyj.connect(master);
    const we = ctx.createGain(); we.gain.value = 0.32 * v; wyj.connect(we); we.connect(echo);
    const wp = ctx.createGain(); wp.gain.value = 0.4; wyj.connect(wp); wp.connect(poglos);
    [[1, 0.17, 1.0], [2, 0.07, 0.5], [3.01, 0.03, 0.28], [4.2, 0.016, 0.16]].forEach(([mn, s, zan]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(midi) * mn;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(s, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, Math.min(dl + 0.4, 1.6)) * zan + 0.05);
      o.connect(g); g.connect(p); o.start(t); o.stop(t + 1.8);
    });
  }

  function wznoszenie(t0, t1, v = 1) {   // szum filtrowany w górę + rosnąca głośność
    const n = zrodloSzumu(t0, t1 - t0);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(320, t0); bp.frequency.exponentialRampToValueAtTime(7500, t1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16 * v, t1 - 0.02);
    g.gain.linearRampToValueAtTime(0, t1);
    const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.4, t0); p.pan.linearRampToValueAtTime(0.4, t1);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    const wp = ctx.createGain(); wp.gain.value = 0.5; g.connect(wp); wp.connect(poglos);
  }

  function opadanie(t, v = 1) {          // "fiuu" w dół (wyspa się chowa)
    const n = zrodloSzumu(t, 0.7);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(5000, t); bp.frequency.exponentialRampToValueAtTime(400, t + 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    n.connect(bp); bp.connect(g); g.connect(master);
    const wp = ctx.createGain(); wp.gain.value = 0.6; g.connect(wp); wp.connect(poglos);
  }
  function wzlot(t, v = 1) {             // "fiuu" w górę (wyspa wraca)
    const n = zrodloSzumu(t, 0.6);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(4500, t + 0.45);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(bp); bp.connect(g); g.connect(master);
    const wp = ctx.createGain(); wp.gain.value = 0.6; g.connect(wp); wp.connect(poglos);
  }

  function uderzenie(t, v = 1) {        // "boom" na wejściach
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    const g = ctx.createGain(); obwiednia(g, t, 0.55 * v, 0.003, 1.7);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.9);
    const n = zrodloSzumu(t, 1.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 1.0);
    const gn = ctx.createGain(); obwiednia(gn, t, 0.22 * v, 0.002, 1.1);
    n.connect(lp); lp.connect(gn); gn.connect(master);
    const wp = ctx.createGain(); wp.gain.value = 1.2; gn.connect(wp); wp.connect(poglos);
  }

  function rozkwit(t, v = 1) {          // miękki akord na pojawienie się wyspy
    [76, 79, 84, 88].forEach((m, i) => dzwonek(t + i * 0.035, m, 1.4, 0.5 * v, (i - 1.5) * 0.3));
  }

  // ---------- harmonia ----------
  // F(add9) – G6 – Am7 – Cmaj7: jasno, "do przodu", bez patosu
  const AKORDY = [
    { pad: [53, 57, 60, 64, 67], arp: [65, 69, 72, 76, 79, 76, 72, 69], bas: 41 },   // F
    { pad: [55, 59, 62, 64, 67], arp: [67, 71, 74, 76, 79, 76, 74, 71], bas: 43 },   // G
    { pad: [57, 60, 64, 67, 71], arp: [69, 72, 76, 79, 81, 79, 76, 72], bas: 45 },   // Am
    { pad: [52, 55, 60, 64, 71], arp: [67, 72, 76, 79, 83, 79, 76, 72], bas: 36 }    // C/E → bas C
  ];
  const akord = (takt) => takt >= 22 ? (takt === 22 ? AKORDY[0] : AKORDY[3]) : AKORDY[takt % 4];

  // melodia na 4 takty (uderzenie w takcie, nuta, długość w uderzeniach)
  const MELODIA = [
    [[0, 76, 1], [1.5, 72, 0.5], [2, 74, 1], [3, 72, 1]],
    [[0, 71, 1.5], [1.5, 74, 0.5], [2, 79, 2]],
    [[0, 76, 1], [1, 81, 1], [2, 79, 1], [3, 76, 1]],
    [[0, 79, 1.5], [1.5, 76, 0.5], [2, 74, 1], [3, 72, 0.5], [3.5, 74, 0.5]]
  ];

  // ---------- aranżacja ----------
  rozkwit(0.6, 0.9);

  for (let takt = 0; takt < 25; takt++) {
    const t = takt * T, a = akord(takt);

    // pad: każdy takt (koniec: dłużej)
    if (takt < 22) pad(t, T, a.pad, takt < 4 ? 1.15 : 1);
    else if (takt === 22) pad(t, T, a.pad, 1.15);
    else if (takt === 23) pad(t, 4.2, a.pad.concat([74]), 1.05);

    // arpeggio 16-tkami
    const arpOd = 1, arpGlos = takt < 2 ? 0.45 : takt < 4 ? 0.75 : takt >= 22 ? 0.7 : 1;
    if (takt >= arpOd && takt <= 23) {
      for (let k = 0; k < 16; k++) {
        const tk = t + k * B / 4;
        if (takt === 17 && tk >= 35.75) continue;                 // pauza przed ostatnim wejściem
        if (takt >= 23 && k % 2) continue;                        // wybrzmienie: rzadziej
        const nuta = a.arp[k % 8] + (k >= 8 && takt >= 4 && takt % 2 ? 12 : 0);
        const zanik = takt >= 23 ? Math.max(0.15, 1 - (tk - 46) / 4) : 1;
        szarpniecie(tk, nuta, arpGlos * zanik * (k % 4 === 0 ? 1 : 0.72), k % 2 ? 0.35 : -0.35);
      }
    }

    const bit = (takt >= 4 && takt <= 15) || (takt >= 18 && takt <= 21);
    if (bit) {
      for (let u = 0; u < 4; u++) {
        const tu = t + u * B;
        stopa(tu);
        if (u % 2 === 1) klask(tu);
        talerz(tu + B / 2, takt >= 12 ? 0.2 : 0.16, takt >= 12 && takt <= 15 || takt >= 18, 0.15);
        // bas na ósemkach (za stopą), z oktawą na końcu taktu
        bas(tu + B / 2, a.bas + (u === 3 ? 12 : 0), B / 2 - 0.02, 1);
        bas(tu + B * 0.75, a.bas, B / 4 - 0.02, 0.6);
      }
      if (takt >= 8) for (let k = 0; k < 16; k++) szelest(t + k * B / 4, (k % 4 === 2 ? 0.09 : 0.05) * (takt >= 18 ? 1.2 : 1), k % 2 ? 0.45 : -0.45);
    }

    // melodia dzwonków
    if ((takt >= 4 && takt <= 7) || (takt >= 12 && takt <= 15) || (takt >= 18 && takt <= 21)) {
      MELODIA[takt % 4].forEach(([u, m, d]) => dzwonek(t + u * B, m + (takt >= 18 ? 12 : 0), d * B, takt >= 18 ? 0.8 : 1, 0.1));
    }
  }

  // ---------- wydarzenia (zgrane z obrazem) ----------
  wznoszenie(4.5, 8.0, 1);
  [6, 6.5, 7, 7.5].forEach((t) => tykniecie(t, 1));
  [3.0, 4.0, 5.0].forEach((t) => tykniecie(t, 0.6));
  uderzenie(8, 1);
  uderzenie(36, 1.1);
  uderzenie(44, 1.15);
  stopa(44, 1.1);

  // klik myszy (kursor w filmie)
  [8.25, 11.25, 12.75, 15.0, 30.75, 32.4, 37.0, 37.5, 38.0, 38.5].forEach((t) => klikMyszy(t));

  // "dzwonki" powiadomień
  [[16.5, 88, 95], [18.5, 84, 91], [20.5, 86, 93], [22.5, 91, 96]].forEach(([t, m1, m2]) => {
    dzwonek(t, m1, 0.4, 0.55, -0.2); dzwonek(t + 0.09, m2, 0.6, 0.45, 0.2);
  });
  [16.75, 17.0, 17.25].forEach((t) => tykniecie(t, 0.35));

  // przejście werblem 31–32 i narastanie 34–36
  for (let k = 0; k < 8; k++) werbel(31 + k * 0.125, 0.35 + k * 0.08);
  for (let k = 0; k < 4; k++) werbel(34.5 + k * 0.25, 0.3 + k * 0.08);
  for (let k = 0; k < 8; k++) if (35.5 + k * 0.0625 < 35.75) werbel(35.5 + k * 0.0625, 0.6 + k * 0.08);
  wznoszenie(33.6, 35.75, 1.2);
  opadanie(32.4, 1);
  wzlot(34.9, 1);
  // pauza: wszystko w pompie cichnie na ostatnią szesnastkę przed 36 s
  pompa.gain.setValueAtTime(1, 35.7); pompa.gain.linearRampToValueAtTime(0, 35.76);
  pompa.gain.setValueAtTime(0, 35.99);          // o 36 s stopa sama ustawia pompę (0,32 → 1)

  // ---------- nagranie ----------
  const buf = await ctx.startRendering();

  // normalizacja do -1 dBFS
  const L = buf.getChannelData(0), P = buf.getChannelData(1);
  let szczyt = 0;
  for (let i = 0; i < L.length; i++) szczyt = Math.max(szczyt, Math.abs(L[i]), Math.abs(P[i]));
  const k = szczyt > 0 ? 0.89 / szczyt : 1;

  // WAV 16 bit stereo
  const n = L.length, bajty = 44 + n * 4;
  const ab = new ArrayBuffer(bajty), dv = new DataView(ab);
  const pisz = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  pisz(0, 'RIFF'); dv.setUint32(4, bajty - 8, true); pisz(8, 'WAVE'); pisz(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  pisz(36, 'data'); dv.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const ch of [L, P]) {
      const x = Math.max(-1, Math.min(1, ch[i] * k + (los() - los()) / 32768));
      dv.setInt16(o, Math.round(x * 32767), true); o += 2;
    }
  }
  // na base64 (kawałkami — duży bufor)
  const u8 = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  console.log('muzyka: szczyt przed normalizacją ' + (20 * Math.log10(szczyt)).toFixed(1) + ' dBFS');
  return btoa(bin);
}

/*
 * Atol 4.2 — promo v2: muzyka (własna, składana w kodzie przez Web Audio, bez cudzych nagrań).
 *
 * Inny utwór niż w pierwszej reklamie: e-moll, 128 BPM, nowoczesny pop-elektroniczny podkład — kick „na cztery”,
 * klaśnięcie, otwarty hi-hat, bas z sidechainem (pompowanie), arpeggio typu pluck, lead z kilku detunowanych piłokształtnych,
 * build-up (szum, werbel) przed sceną aktualizacji, pauza i mocny drop w chwili „4.2 — sama się aktualizuje”.
 * 1 uderzenie = 0,46875 s, 1 takt = 1,875 s, 24 takty = 45 s. Kliknięcia myszy, dzwonki i „whoosh” biorą czasy
 * ze sceny (window.MUZ), więc są zgrane z obrazem co do klatki.
 *
 * v3: usunięta przerwa (dawne takty 16–17, scena „pastylka albo notch”) — dalsze takty przesunięte o 2 (3,75 s).
 * W pętli aranżacji `takt` to DAWNY numer taktu (harmonia i warunki bez zmian), a czas liczy się z nowego numeru.
 * Poprawki dźwięku v3: bas miał zamienione argumenty (grał 4–8 Hz przez 40 s → stały offset, trzaski piły 8 Hz,
 * kompresor „pompował” na niesłyszalnym), łagodne obwiednie (≥ 3 ms) na każdym głosie, wygładzony sidechain
 * i pauza przed dropem, filtr górnoprzepustowy 25 Hz na sumie, limiter z wyprzedzeniem i szczyt −2,5 dBFS.
 *
 * Plan (nowe takty → sekundy):
 *   0–3   (0–7,5)       wstęp: pad, arpeggio, narastanie, werbel
 *   4–7   (7,5–15)      DROP 1: bit + bas + lead         — muzyka na wyspie
 *   8–11  (15–22,5)     bit, arpeggio, szelest           — schowek: przeciąganie plików
 *   12–15 (22,5–30)     pełny bit + lead + fill          — schowek: kółko, wyciąganie
 *   16–19 (30–37,5)     bit wraca, build-up, pauza        — strona z nową wersją, ustawienia
 *   20–22 (37,5–43,1)   DROP 2 (największy)               — „sama się aktualizuje”, plansza
 *   23    (43,1–45)     wybrzmienie i wyciszenie
 */
'use strict';

async function zrobMuzyke() {
  const SR = 48000, BPM = 128, B = 60 / BPM, TK = B * 4, TAKTY = 24, DLUG = TAKTY * TK;
  const NT = (staryTakt) => (staryTakt >= 18 ? staryTakt - 2 : staryTakt) * TK;   // dawny takt → czas w v3
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * (DLUG + 0.4)), SR);
  const M = window.MUZ || { kliki: [], dzw: [], whoosh: [] };

  // --- powtarzalny „los” ---
  let ziarno = 20261121;
  const los = () => { ziarno = (Math.imul(ziarno, 1664525) + 1013904223) >>> 0; return ziarno / 4294967296; };
  const szumBuf = ctx.createBuffer(1, SR * 2, SR);
  { const d = szumBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = los() * 2 - 1; }
  const szum = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = szumBuf; s.start(t, los() * 0.4, dur); return s; };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // --- tor główny ---
  const mix = ctx.createGain();
  const komp = ctx.createDynamicsCompressor();
  komp.threshold.value = -16; komp.knee.value = 8; komp.ratio.value = 3.5; komp.attack.value = 0.004; komp.release.value = 0.14;
  const pauza = ctx.createGain();
  const master = ctx.createGain(); master.gain.value = 0.9;
  // filtr górnoprzepustowy 25 Hz na sumie: wycina stały offset i niesłyszalne drgania, które zjadały zapas głośności
  const hpSuma = ctx.createBiquadFilter(); hpSuma.type = 'highpass'; hpSuma.frequency.value = 25; hpSuma.Q.value = 0.7;
  mix.connect(hpSuma); hpSuma.connect(komp); komp.connect(pauza); pauza.connect(master); master.connect(ctx.destination);
  master.gain.setValueAtTime(0.9, DLUG - 1.9); master.gain.linearRampToValueAtTime(0, DLUG - 0.05);
  // pauza przed dropem (dawny takt 22 → 37,5 s); powrót rampą 5 ms zamiast skoku (wcześniej trzask na ogonach pogłosu)
  const DROP2 = NT(22);
  pauza.gain.setValueAtTime(1, DROP2 - 0.16); pauza.gain.linearRampToValueAtTime(0, DROP2 - 0.12);
  pauza.gain.setValueAtTime(0, DROP2 - 0.005); pauza.gain.linearRampToValueAtTime(1, DROP2);

  // pompowanie (sidechain): pad, bas, arpeggio i lead przyciszają się przy każdej stopie
  const pompa = ctx.createGain(); pompa.connect(mix);

  // pogłos (gasnący szum) i echo (ósemka z kropką)
  const ir = ctx.createBuffer(2, Math.floor(SR * 2.4), SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < d.length; i++) { lp += (los() * 2 - 1 - lp) * 0.5; d[i] = lp * Math.exp(-i / SR * 2.8) * (1 - Math.exp(-i / SR * 60)); }
  }
  const rev = ctx.createConvolver(); rev.buffer = ir;
  const revIn = ctx.createGain(); revIn.connect(rev);
  const revOut = ctx.createGain(); revOut.gain.value = 0.42; rev.connect(revOut); revOut.connect(pauza);
  const dly = ctx.createDelay(2); dly.delayTime.value = B * 0.75;
  const dlyF = ctx.createBiquadFilter(); dlyF.type = 'lowpass'; dlyF.frequency.value = 3200;
  const dlyFb = ctx.createGain(); dlyFb.gain.value = 0.36;
  const dlyIn = ctx.createGain(); dlyIn.connect(dly); dly.connect(dlyF); dlyF.connect(dlyFb); dlyFb.connect(dly);
  const dlyOut = ctx.createGain(); dlyOut.gain.value = 0.5; dlyF.connect(dlyOut); dlyOut.connect(mix);

  // podłączenie: o.p === false → poza pompą; o.r / o.d → wysyłka do pogłosu / echa; o.pan
  function wyslij(node, o = {}) {
    let last = node;
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; node.connect(p); last = p; }
    last.connect(o.p === false ? mix : pompa);
    if (o.r) { const g = ctx.createGain(); g.gain.value = o.r; last.connect(g); g.connect(revIn); }
    if (o.d) { const g = ctx.createGain(); g.gain.value = o.d; last.connect(g); g.connect(dlyIn); }
  }
  // obwiednia głośności: atak a (min. 3 ms), trzymanie do dur, wybrzmienie r — kończy się DOKŁADNIE na zerze
  // (wcześniej setTargetAtTime zostawiał kilka % sygnału, który oscylator ucinał przy stop() → trzask)
  function obw(t, dur, a, r, szczyt) {
    const g = ctx.createGain();
    a = Math.max(0.003, a);
    const tr = Math.max(t + a, t + dur);
    g.gain.value = 0;                 // przed pierwszym zdarzeniem AudioParam ma .value (domyślnie 1!)
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(szczyt, t + a);
    g.gain.setValueAtTime(szczyt, tr);
    g.gain.exponentialRampToValueAtTime(szczyt * 0.003, tr + r * 1.5);
    g.gain.linearRampToValueAtTime(0, tr + r * 1.5 + 0.005);
    return g;
  }
  const koniecObw = (t, dur, r) => Math.max(t + 0.003, t + dur) + r * 1.5 + 0.02;   // kiedy wolno zatrzymać oscylator
  // krótki atak (3 ms) zamiast skoku od pełnej głośności — dla perkusji i efektów
  function atak(g, t, szczyt, a = 0.003) { g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(szczyt, t + a); }

  // ---------- instrumenty ----------
  const kopniaki = [];
  function stopa(t, g = 1, pompuj = true) {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(165, t); osc.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    const gn = ctx.createGain();
    gn.gain.value = 0; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + 0.003);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(gn); wyslij(gn, { p: false }); osc.start(t); osc.stop(t + 0.45);
    const k = szum(t, 0.015), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const kg = ctx.createGain(); atak(kg, t, 0.14 * g, 0.002); kg.gain.exponentialRampToValueAtTime(0.0005, t + 0.014); kg.gain.linearRampToValueAtTime(0, t + 0.015);
    k.connect(hp); hp.connect(kg); wyslij(kg, { p: false });
    if (pompuj) kopniaki.push(t);
  }
  function klask(t, g = 1) {
    [0, 0.011, 0.023].forEach((dt, i) => {
      const s = szum(t + dt, i < 2 ? 0.02 : 0.2), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.9;
      const gn = ctx.createGain(); atak(gn, t + dt, 0.5 * g);
      gn.gain.exponentialRampToValueAtTime(0.001, t + dt + (i < 2 ? 0.02 : 0.18));
      s.connect(bp); bp.connect(gn); wyslij(gn, { p: false, r: i === 2 ? 0.35 : 0 });
    });
  }
  function talerz(t, otwarty, g = 0.2, pan = 0.2) {
    const s = szum(t, otwarty ? 0.22 : 0.06), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    const gn = ctx.createGain(); atak(gn, t, g); gn.gain.exponentialRampToValueAtTime(0.001, t + (otwarty ? 0.2 : 0.045));
    s.connect(hp); hp.connect(gn); wyslij(gn, { p: false, pan });
  }
  function werbel(t, g = 0.4) {
    const s = szum(t, 0.16), bp = ctx.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 1400;
    // v3: górę szumu obcinamy (7,5 kHz) — w szybkich rolkach build-upu sam biały szum dawał ostre „syczenie”
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500; lp.Q.value = 0.5;
    const gn = ctx.createGain(); atak(gn, t, g); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    s.connect(bp); bp.connect(lp); lp.connect(gn); wyslij(gn, { p: false, r: 0.15 });
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const og = ctx.createGain(); atak(og, t, g * 0.5); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og); wyslij(og, { p: false }); o.start(t); o.stop(t + 0.12);
  }
  function bas(t, dur, m, g = 1) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(260, t + Math.max(0.08, dur));
    const gn = obw(t, dur, 0.004, 0.05, 0.42 * g);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(m - 12);
    const g2 = ctx.createGain(); g2.gain.value = 0.9;
    o1.connect(f); f.connect(gn); o2.connect(g2); g2.connect(gn); wyslij(gn);
    const stop = koniecObw(t, dur, 0.05);
    o1.start(t); o2.start(t); o1.stop(stop); o2.stop(stop);
  }
  // pad: wspólny filtr, który „otwiera się” w czasie utworu
  const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.Q.value = 0.7;
  const padG = ctx.createGain(); padG.gain.value = 1; padF.connect(padG); wyslij(padG, { r: 0.25 });
  function pad(t, dur, nuty, g = 1) {
    nuty.forEach((m, i) => {
      [-9, 9].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        const gn = obw(t, dur, 0.2, 0.5, 0.045 * g);
        o.connect(gn); gn.connect(padF); o.start(t); o.stop(koniecObw(t, dur, 0.5));
      });
    });
  }
  function arp(t, m, g, pan) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(1000, t + 0.15);
    const gn = ctx.createGain(); atak(gn, t, 0.11 * g);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mtof(m); o2.detune.value = 7;
    o.connect(f); o2.connect(f); f.connect(gn); wyslij(gn, { pan, d: 0.3, r: 0.12 });
    o.start(t); o2.start(t); o.stop(t + 0.22); o2.stop(t + 0.22);
  }
  function lead(t, dur, m, g = 1, pan = 0) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3600; f.Q.value = 0.8;
    const gn = obw(t, dur, 0.012, 0.28, 0.06 * g);
    [-16, -8, 0, 8, 16].forEach((det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(koniecObw(t, dur, 0.28));
    });
    f.connect(gn); wyslij(gn, { r: 0.3, d: 0.3, pan });
  }
  function dzwonek(t, m, g = 1, pan = 0) {
    [[1, 1], [2.01, 0.35], [3.99, 0.14]].forEach(([c, a]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m) * c;
      const gn = ctx.createGain(); gn.gain.value = 0; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.16 * a * g, t + 0.004);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 1.0 / Math.sqrt(c));
      o.connect(gn); wyslij(gn, { p: false, pan, r: 0.5 }); o.start(t); o.stop(t + 1.1);
    });
  }
  function klikMyszy(t) {
    const s = szum(t, 0.03), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.4;
    const gn = ctx.createGain(); atak(gn, t, 0.3); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.connect(bp); bp.connect(gn); wyslij(gn, { p: false });
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.04);
    const og = ctx.createGain(); atak(og, t, 0.18); og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(og); wyslij(og, { p: false }); o.start(t); o.stop(t + 0.06);
  }
  function whoosh(t, dl = 0.45, g = 0.35, w = true) {
    const s = szum(t, dl + 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(w ? 500 : 5500, t); bp.frequency.exponentialRampToValueAtTime(w ? 6500 : 500, t + dl);
    const gn = ctx.createGain(); gn.gain.value = 0; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + dl * 0.55);
    gn.gain.linearRampToValueAtTime(0.0001, t + dl);
    s.connect(bp); bp.connect(gn); wyslij(gn, { p: false, pan: w ? -0.2 : 0.2 });
  }
  function narastanie(t0, t1, g = 0.45) {
    const s = szum(t0, t1 - t0 + 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(350, t0); bp.frequency.exponentialRampToValueAtTime(9000, t1);
    const gn = ctx.createGain(); gn.gain.value = 0; gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t1);
    gn.gain.linearRampToValueAtTime(0, t1 + 0.04);          // wcześniej szum urywał się na pełnej głośności
    s.connect(bp); bp.connect(gn); wyslij(gn, { p: false, r: 0.1 });
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(1500, t1);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t0); f.frequency.exponentialRampToValueAtTime(5000, t1);
    const og = ctx.createGain(); og.gain.value = 0; og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.09 * g / 0.45, t1);
    og.gain.linearRampToValueAtTime(0, t1 + 0.04);
    o.connect(f); f.connect(og); wyslij(og, { p: false }); o.start(t0); o.stop(t1 + 0.05);
  }
  function uderzenie(t, g = 1) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.7);
    const gn = ctx.createGain(); gn.gain.value = 0; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.9 * g, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(gn); wyslij(gn, { p: false }); o.start(t); o.stop(t + 1.7);
    const s = szum(t, 1.6), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const sg = ctx.createGain(); sg.gain.value = 0; sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.3 * g, t + 0.01); sg.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    s.connect(hp); hp.connect(sg); wyslij(sg, { p: false, r: 0.4 });
  }

  // ---------- harmonia: Em – C – G – D ----------
  const AKORDY = [
    { pad: [52, 59, 64, 67], arp: [76, 79, 83, 88], bas: 40 },
    { pad: [48, 55, 60, 64], arp: [72, 76, 79, 84], bas: 36 },
    { pad: [55, 59, 62, 67], arp: [74, 79, 83, 86], bas: 43 },
    { pad: [50, 57, 62, 66], arp: [74, 78, 81, 86], bas: 38 }
  ];
  const MELODIA = [
    [[0, 83, 1.5], [1.5, 79, 0.5], [2, 81, 1], [3, 79, 1]],
    [[0, 76, 1], [1, 79, 1], [2, 84, 1.5], [3.5, 83, 0.5]],
    [[0, 86, 1.5], [1.5, 83, 0.5], [2, 79, 1], [3, 83, 1]],
    [[0, 81, 1], [1, 79, 0.5], [1.5, 78, 0.5], [2, 81, 2]]
  ];
  const WZOR = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 2];

  // filtr padu
  padF.frequency.setValueAtTime(480, 0); padF.frequency.exponentialRampToValueAtTime(2400, 7.45);
  padF.frequency.setValueAtTime(3000, 7.5); padF.frequency.setValueAtTime(3000, 29.9);
  padF.frequency.exponentialRampToValueAtTime(1500, 30); padF.frequency.exponentialRampToValueAtTime(5500, DROP2 - 0.1);
  padF.frequency.exponentialRampToValueAtTime(3600, DROP2); padF.frequency.setValueAtTime(3600, NT(25) - 0.075);
  padF.frequency.exponentialRampToValueAtTime(900, DLUG);

  // ---------- aranżacja ----------
  // nt = takt w v3, takt = dawny numer (bez przerwy 16–17) — harmonia i warunki jak w v2
  for (let nt = 0; nt < TAKTY; nt++) {
    const takt = nt < 16 ? nt : nt + 2;
    const t = nt * TK, a = AKORDY[takt % 4];
    const kick = (takt >= 4 && takt <= 15) || (takt >= 18 && takt <= 20) || (takt >= 22 && takt <= 24);
    const clapBar = kick;
    const bit = kick;

    // pad
    if (takt <= 24) pad(t, TK + 0.05, a.pad, takt < 4 ? 1.2 : takt >= 22 ? 1.1 : 1);
    else pad(t, 2.4, a.pad, 1.1);

    // arpeggio 16-tkami
    if (takt >= 1 && takt <= 24) {
      const gl = takt < 2 ? 0.45 : takt < 4 ? 0.75 : takt >= 16 && takt <= 17 ? 0.8 : takt >= 22 ? 1.1 : 1;
      for (let k = 0; k < 16; k++) {
        const tk = t + k * B / 4;
        if (tk >= DROP2 - 0.15 && tk < DROP2 - 0.001) continue;
        if (takt === 24 && k >= 8) continue;
        arp(tk, a.arp[WZOR[k]], gl * (k % 4 === 0 ? 1 : 0.7), k % 2 ? 0.4 : -0.4);
      }
    }
    // bit
    if (bit) {
      for (let u = 0; u < 4; u++) {
        const tu = t + u * B;
        if (takt === 21 && u >= 2) continue;
        stopa(tu, 1);
        if (clapBar && u % 2 === 1) klask(tu, 0.9);
        talerz(tu + B / 2, true, takt >= 22 ? 0.22 : 0.17, 0.2);
        // v3: kolejność argumentów bas(t, dur, nuta, g) — w v2 nuta i czas były zamienione (bas 4–8 Hz)
        bas(tu + B / 2, B / 2 - 0.03, a.bas + (u === 3 ? 12 : 0), 1);
        bas(tu + B * 0.75 + 0.0001, B / 4 - 0.03, a.bas + (u % 2 ? 7 : 0), 0.55);
      }
      if (takt >= 8) for (let k = 0; k < 16; k++) if (k % 2) talerz(t + k * B / 4, false, 0.07, k % 4 === 1 ? -0.3 : 0.3);
    }
    // lead
    if ((takt >= 4 && takt <= 7) || (takt >= 12 && takt <= 15) || (takt >= 22 && takt <= 24)) {
      MELODIA[takt % 4].forEach(([u, m, d]) => lead(t + u * B, d * B * 0.95, m + (takt >= 22 ? 0 : 0), takt >= 22 ? 1.15 : 1, 0.1));
    }
    if (takt === 25) lead(t, 3.2, 83, 0.9);
  }

  // ---------- wydarzenia ----------
  // wstęp: narastanie i werbel (takty 2–3)
  narastanie(2 * TK, 4 * TK, 0.4);
  for (let k = 0; k < 8; k++) werbel(3.5 * TK + k * B / 2, 0.22 + k * 0.05);
  for (let k = 0; k < 8; k++) werbel(3 * TK + k * B / 2 + 0.0001, 0.12 + k * 0.025);
  uderzenie(4 * TK, 1);
  whoosh(4 * TK - 0.4, 0.4, 0.3);

  // fill na końcu taktu 15 (v3: bez opadającego „whoosh” do przerwy — przerwy już nie ma, przejście ma whoosh ze sceny)
  for (let k = 0; k < 8; k++) werbel(15 * TK + 3 * B + k * B / 8, 0.25 + k * 0.05);

  // powrót bitu + build-up przed aktualizacją (dawne takty 18–21 → 16–19)
  uderzenie(NT(18), 0.6);
  narastanie(NT(18), NT(20), 0.25);
  for (let k = 0; k < 4; k++) werbel(NT(19) + 2 * B + k * B / 2, 0.2 + k * 0.05);
  narastanie(NT(20), DROP2 - 0.14, 0.6);
  { let tt = NT(20) + 1.5 * TK, gap = 0.234, n = 0;
    while (tt < DROP2 - 0.15) { werbel(tt, 0.25 + Math.min(0.55, n * 0.025)); gap = Math.max(0.045, gap * 0.9); tt += gap; n++; } }
  whoosh(NT(20), TK * 2, 0.15);

  // DROP 2
  uderzenie(DROP2, 1.3);
  // v3: „crash” dropu = biały szum powyżej 5 kHz — górę obcinamy na 10 kHz (to on dawał najostrzejsze skoki próbek)
  { const s0 = szum(DROP2, 2), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const s = ctx.createBiquadFilter(); s.type = 'lowpass'; s.frequency.value = 10000; s.Q.value = 0.5; s0.connect(s);
    const gn = ctx.createGain(); gn.gain.value = 0; gn.gain.setValueAtTime(0.0001, DROP2); gn.gain.linearRampToValueAtTime(0.35, DROP2 + 0.02); gn.gain.exponentialRampToValueAtTime(0.001, DROP2 + 1.9);
    s.connect(hp); hp.connect(gn); wyslij(gn, { p: false, r: 0.5 }); }
  uderzenie(NT(23), 0.7);
  uderzenie(NT(25), 0.8);

  // zdarzenia ze sceny
  M.kliki.forEach((t) => klikMyszy(t));
  M.dzw.forEach(([t, m1, m2]) => { dzwonek(t, m1, 0.9, -0.2); dzwonek(t + 0.09, m2, 0.7, 0.2); });
  M.whoosh.forEach((t) => whoosh(t, 0.4, 0.28));

  // sidechain: przycisz pompę przy każdej stopie
  // v3: zejście w 5 ms zamiast skoku 1 → 0,2 w jednej próbce (to dawało trzask na padzie / basie / leadzie)
  kopniaki.sort((x, y) => x - y).forEach((t) => {
    pompa.gain.setValueAtTime(1, t); pompa.gain.linearRampToValueAtTime(0.2, t + 0.005); pompa.gain.linearRampToValueAtTime(1, t + 0.3);
  });

  // ---------- nagranie ----------
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), P = buf.getChannelData(1);
  let szczyt = 0;
  for (let i = 0; i < L.length; i++) szczyt = Math.max(szczyt, Math.abs(L[i]), Math.abs(P[i]));
  // Limiter z wyprzedzeniem (5 ms), wspólny dla obu kanałów: po sprowadzeniu szczytu do 1,0 ścina tylko najwyższe
  // 3 dB (stopa + uderzenia w dropie) gładko — wzmocnienie schodzi PRZED szczytem (minimum okna + średnia ruchoma),
  // wraca w ~80 ms. Potem całość na −2,5 dBFS (zapas na kodowanie AAC). Żadna próbka nie dochodzi do 0 dBFS.
  {
    const n0 = L.length, LA = Math.round(SR * 0.005), PROG = 0.708, SUFIT = 0.75 / PROG;
    const pre = szczyt > 0 ? 1 / szczyt : 1;
    const gr = new Float32Array(n0);
    for (let i = 0; i < n0; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(P[i])) * pre; gr[i] = a > PROG ? PROG / a : 1; }
    const m = new Float32Array(n0);                         // minimum w oknie [i, i+LA] (kolejka monotoniczna)
    const q = new Int32Array(n0 + LA + 2); let h = 0, tl = 0;
    for (let j = n0 - 1 + LA; j >= 0; j--) {
      if (j < n0) { while (tl > h && gr[q[tl - 1]] >= gr[j]) tl--; q[tl++] = j; }
      while (tl > h && q[h] > j + LA) h++;
      if (j < n0) m[j] = gr[q[h]];
    }
    // q wypełniana od końca — kolejka trzyma indeksy malejąco; minimum okna [j, j+LA] jest w q[h]
    const rel = 1 - Math.exp(-1 / (SR * 0.08));
    let r = 1;
    for (let i = 0; i < n0; i++) { r = Math.min(m[i], r + (1 - r) * rel); m[i] = r; }
    let suma = 0; const sm = new Float32Array(n0);
    for (let i = 0; i < n0; i++) { suma += m[i]; if (i >= LA) suma -= m[i - LA]; sm[i] = suma / Math.min(i + 1, LA); }
    let po = 0, scisniete = 0;
    for (let i = 0; i < n0; i++) {
      const g = pre * sm[i] * SUFIT;
      if (sm[i] < 0.999) scisniete++;
      L[i] *= g; P[i] *= g; po = Math.max(po, Math.abs(L[i]), Math.abs(P[i]));
    }
    console.log('limiter: ściśnięte ' + (100 * scisniete / n0).toFixed(2) + '% próbek, szczyt po ' + (20 * Math.log10(po)).toFixed(2) + ' dBFS');
  }
  const k = 1;

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
  const u8 = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  console.log('muzyka: szczyt przed normalizacją ' + (20 * Math.log10(szczyt)).toFixed(1) + ' dBFS, długość ' + (n / SR).toFixed(2) + ' s');
  return btoa(bin);
}

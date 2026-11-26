// Atol — studio SZykAI
// Dźwięk końca minutnika: łagodny "dzwonek" liczony przez Web Audio (bez plików). Wspólny dla wyspy
// i okna ustawień (przycisk "Odsłuchaj").
(function (cel) {
  'use strict';

  // [start w s, częstotliwość w Hz, głośność, czas wybrzmiewania w s] — akord E-dur "od dołu do góry"
  var NUTY = [
    [0.00, 659.25, 0.20, 0.9],     // E5
    [0.16, 830.61, 0.17, 0.9],     // G#5
    [0.32, 987.77, 0.17, 1.1],     // B5
    [0.78, 1318.51, 0.15, 1.5]     // E6
  ];
  var ALIKWOTY = [[1, 1], [2, 0.12]];   // [mnożnik częstotliwości, udział] — cichy drugi ton daje "szkło"
  var ATAK_S = 0.018;                   // miękkie wejście, bez trzasku
  var DLUGOSC_S = Math.max.apply(null, NUTY.map(function (n) { return n[0] + n[3]; }));

  // Układa nuty w podanym kontekście od chwili "od". Zwraca oscylator, który kończy się ostatni.
  function zaplanuj(ctx, od) {
    var ostatni = null, ostatniKoniec = 0;
    NUTY.forEach(function (n) {
      ALIKWOTY.forEach(function (a) {
        var t = od + n[0], koniec = t + n[3];
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = n[1] * a[0];
        g.gain.value = 0;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(n[2] * a[1], t + ATAK_S);
        g.gain.exponentialRampToValueAtTime(0.0001, koniec);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(koniec + 0.02);
        if (koniec > ostatniKoniec) { ostatni = osc; ostatniKoniec = koniec; }
      });
    });
    return ostatni;
  }

  var gra = null;       // { ctx, od } — w trakcie grania nie zaczynamy drugi raz

  // Gra raz. Kontekst powstaje na czas dźwięku i jest zamykany (nie trzyma urządzenia audio).
  // Zamykamy po zdarzeniu "ended", nie po setTimeout — ukryte okno (pełny ekran) spowalnia timery.
  function zagraj() {
    if (gra && Date.now() - gra.od < (DLUGOSC_S + 0.5) * 1000) return false;
    var ctx;
    try { ctx = new cel.AudioContext(); } catch (e) { return false; }
    var to = gra = { ctx: ctx, od: Date.now() };
    function sprzataj() {
      if (gra === to) gra = null;
      if (ctx.state !== 'closed') ctx.close().catch(function () { /* już zamknięty */ });
    }
    ctx.resume().then(function () {
      zaplanuj(ctx, ctx.currentTime + 0.05).onended = sprzataj;
    }).catch(sprzataj);
    return true;
  }

  var api = { zagraj: zagraj, zaplanuj: zaplanuj, DLUGOSC_S: DLUGOSC_S };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else cel.AtolDzwiek = api;
})(this);

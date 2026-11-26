// Atol — studio SZykAI
// Słupki wizualizatora z prawdziwego poziomu dźwięku. Pomocnik daje JEDEN poziom szczytowy (0..1), a słupków
// jest pięć. Czysta logika — używa jej wyspa (zwykły <script>, bo strona nie ma require) oraz testy (require).
(function (cel) {
  'use strict';

  var SPOCZYNEK = 0.18;         // wysokość słupka w ciszy / przy pauzie (jak w wyspa.css)
  var SWIEZY_MS = 400;          // starszy odczyt = brak danych → zwykła animacja
  var ATAK = 32, OPADANIE = 10; // szybkość dążenia do celu (1/s): w górę szybko, w dół wolniej
  var MIN_ODNIESIENIE = 0.01;   // cichszego sygnału nie wzmacniamy bardziej (nie rozdmuchujemy szumu)
  var CISZA = 0.0005;           // poniżej tego traktujemy jako ciszę
  var PAMIEC_S = 4;             // w tyle sekund "najgłośniejszy ostatnio" wyraźnie maleje
  var KONTRAST = 1.8;           // potęga: współczesna muzyka ma mało wahań, więc je uwydatniamy
  var PROFIL = [0.7, 0.92, 1, 0.84, 0.74];     // środkowe słupki zwykle wyższe

  function utworz(los) {
    los = los || Math.random;
    var odniesienie = MIN_ODNIESIENIE, glosnosc = 0, ostatni = -Infinity;
    var mnozniki = PROFIL.slice();

    return {
      // nowy poziom (0..1) w chwili t (ms)
      odczyt: function (p, t) {
        if (typeof p !== 'number' || !Number.isFinite(p)) return;
        p = Math.max(0, Math.min(1, p));
        var dt = Math.max(0, Math.min(1, (t - ostatni) / 1000));
        ostatni = t;
        // normalizacja do najgłośniejszego z ostatnich chwil — przy cichym dźwięku słupki też się ruszają
        odniesienie = Math.max(p, MIN_ODNIESIENIE, odniesienie * Math.exp(-dt / PAMIEC_S));
        glosnosc = p < CISZA ? 0 : Math.pow(p / odniesienie, KONTRAST);
        // jeden poziom, pięć słupków: każdy dostaje trochę inny mnożnik
        mnozniki = PROFIL.map(function (m) { return m * (0.6 + 0.4 * los()); });
      },
      swiezy: function (t) { return t - ostatni < SWIEZY_MS; },
      // docelowa wysokość słupka nr i (0..4)
      cel: function (i) { return SPOCZYNEK + (1 - SPOCZYNEK) * glosnosc * mnozniki[i]; }
    };
  }

  // jedna klatka ruchu słupka z wysokości x w stronę celu
  function krok(x, doCelu, dt) {
    return x + (doCelu - x) * (1 - Math.exp(-dt * (doCelu > x ? ATAK : OPADANIE)));
  }

  var api = { SPOCZYNEK: SPOCZYNEK, SWIEZY_MS: SWIEZY_MS, utworz: utworz, krok: krok };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else cel.AtolPoziom = api;
})(this);

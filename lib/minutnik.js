// Atol — studio SZykAI
// Minutnik: własny czas (zakres, przytrzymanie −/+, kółko myszy). Czysta logika — używa jej wyspa
// (zwykły <script>, bo strona nie ma require) i proces główny oraz testy (require).
(function (cel) {
  'use strict';

  var MIN = 1, MAKS = 180, DOMYSLNY = 15;

  // Dowolna wartość → całe minuty z zakresu (nie-liczba → domyślne)
  function ogranicz(minuty) {
    if (typeof minuty !== 'number' || !Number.isFinite(minuty)) return DOMYSLNY;
    return Math.max(MIN, Math.min(MAKS, Math.round(minuty)));
  }

  // Jeden krok w górę (kierunek 1) albo w dół (-1). Duży krok "wskakuje" na wielokrotności: 17 → 20 → 25.
  function przesun(minuty, kierunek, krok) {
    var m = ogranicz(minuty);
    if (kierunek > 0) return ogranicz((Math.floor(m / krok) + 1) * krok);
    return ogranicz((Math.ceil(m / krok) - 1) * krok);
  }

  // Przytrzymanie przycisku: kiedy ma być powtórzenie nr n (od 0) i o ile. Im dłużej, tym szybciej.
  function powtorzenie(n) {
    if (n === 0) return { po: 420, krok: 1 };      // chwila na zwykłe kliknięcie
    if (n < 6) return { po: 130, krok: 1 };
    if (n < 14) return { po: 80, krok: 1 };
    return { po: 110, krok: 5 };
  }

  // Kółko myszy: jeden ząbek (duży skok) = 1 minuta; gładzik daje wiele małych skoków — sumujemy je.
  // Kółko w górę (deltaY < 0) dodaje minuty.
  var PROG_KOLKA = 50;
  function zKolka(reszta, deltaY) {
    if (Math.abs(deltaY) >= PROG_KOLKA) return { kroki: deltaY < 0 ? 1 : -1, reszta: 0 };
    var suma = reszta + deltaY, pelne = Math.trunc(suma / PROG_KOLKA);
    return { kroki: pelne ? -pelne : 0, reszta: suma - pelne * PROG_KOLKA };
  }

  var api = { MIN: MIN, MAKS: MAKS, DOMYSLNY: DOMYSLNY, ogranicz: ogranicz, przesun: przesun, powtorzenie: powtorzenie, zKolka: zKolka };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else cel.AtolMinutnik = api;
})(this);

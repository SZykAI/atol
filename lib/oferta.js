// Atol — studio SZykAI
// Powiadomienie "Aktualizacja gotowa" (z przyciskami "Zainstaluj" i "Później"). Czysta logika: proces główny
// pamięta, które wersje już zamknięto (require), a wyspa odlicza czas pokazu (zwykły <script>) — i testy.
(function (cel) {
  'use strict';

  var CZAS_MS = 15000;          // tyle powiadomienie jest na wierzchu, jeśli nic nie kliknięto
  var PO_KURSORZE_MS = 3000;    // po zjechaniu kursorem zostaje jeszcze co najmniej tyle
  var MAKS_KROK_MS = 500;       // ukryte okno spowalnia timery — jeden długi krok nie może "zjeść" całego czasu

  // Proces główny: pamięć na czas jednego uruchomienia aplikacji (celowo nie zapisujemy na dysk).
  function pamiec() {
    var zamkniete = Object.create(null);
    return {
      // stanAktualizacji — z lib/aktualizacje.js; wlaczone — przełącznik w ustawieniach. Zwraca ofertę albo null.
      oferta: function (stanAktualizacji, wlaczone) {
        var a = stanAktualizacji;
        if (!wlaczone || !a || a.stan !== 'gotowa') return null;
        var wersja = String(a.wersja || '');
        return zamkniete[wersja] ? null : { wersja: wersja };
      },
      zamknij: function (wersja) { zamkniete[String(wersja || '')] = true; }
    };
  }

  // Wyspa: ile czasu pokazu zostało. Po przerwaniu (inne powiadomienie, rozwinięcie, pełny ekran) — od nowa.
  function licznik() {
    var zostalo = CZAS_MS;
    return {
      odNowa: function () { zostalo = CZAS_MS; },
      // true = czas minął. widoczna — wyspa jest na ekranie; kursor — mysz stoi nad powiadomieniem.
      krok: function (ms, widoczna, kursor) {
        if (!widoczna) { zostalo = CZAS_MS; return false; }
        if (kursor) { zostalo = Math.max(zostalo, PO_KURSORZE_MS); return false; }
        zostalo -= Math.max(0, Math.min(MAKS_KROK_MS, ms));
        return zostalo <= 0;
      }
    };
  }

  var api = { CZAS_MS: CZAS_MS, PO_KURSORZE_MS: PO_KURSORZE_MS, MAKS_KROK_MS: MAKS_KROK_MS, pamiec: pamiec, licznik: licznik };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else cel.AtolOferta = api;
})(this);

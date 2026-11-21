/*
 * Wyspa — ustawienia: wartości domyślne, sprawdzanie i przenoszenie starego formatu.
 * Czysta logika (bez Electrona i bez dysku), dzięki czemu można ją przetestować: `npm test`.
 *
 * Format (wersja 2):
 * {
 *   wersja: 2,
 *   moduly:        { muzyka, bateria, procesor, glosnosc, timer, schowek } — co wyspa w ogóle pokazuje
 *   powiadomienia: { timer, bateria, glosnosc, ladowanie }          — które krótkie powiadomienia są włączone
 *   wyglad:        { styl: 'pastylka' | 'notch' }                   — pastylka lewituje, notch jest przy krawędzi
 *   aktualizacje:  bool       — automatyczne sprawdzanie i pobieranie aktualizacji (4.2), domyślnie włączone
 *   autostartUstawiony: bool  — czy aplikacja już raz ustawiła autostart domyślnie (żeby nie nadpisywać
 *                               wyboru użytkownika przy każdym starcie)
 * }
 * Sam autostart nie jest tu zapisywany: jego stan trzyma Windows (rejestr), aplikacja tylko go czyta.
 * Nieznane pola (np. "wyzwalacz" z 3.0 i "unikanie" z 3.2 — usunięte funkcje) są pomijane.
 */

const MODULY = ['muzyka', 'bateria', 'procesor', 'glosnosc', 'timer', 'schowek'];
const POWIADOMIENIA = ['timer', 'bateria', 'glosnosc', 'ladowanie'];
const STYLE = ['pastylka', 'notch'];

// W spoczynku wyspa jest pustą pastylką: domyślnie włączona jest muzyka i schowek na pliki (4.1) —
// schowek nic nie pokazuje na zwiniętej wyspie, dopóki ktoś nie przeciągnie na nią pliku.
function domyslne() {
  return {
    wersja: 2,
    moduly: { muzyka: true, bateria: false, procesor: false, glosnosc: false, timer: false, schowek: true },
    powiadomienia: { timer: true, bateria: true, glosnosc: true, ladowanie: true },
    wyglad: { styl: 'pastylka' },
    aktualizacje: true,
    autostartUstawiony: false
  };
}

// Z dowolnego obiektu (wczytanego z pliku) robi poprawne ustawienia.
function normalizuj(wejscie) {
  const u = domyslne();
  if (!wejscie || typeof wejscie !== 'object') return u;

  // Wersja 1.x zapisywała płasko same powiadomienia: { timer, bateria, glosnosc, ladowanie }
  const stary = !wejscie.moduly && !wejscie.powiadomienia;
  const zrodloPowiad = stary ? wejscie : wejscie.powiadomienia;

  if (zrodloPowiad && typeof zrodloPowiad === 'object') {
    for (const k of POWIADOMIENIA) if (typeof zrodloPowiad[k] === 'boolean') u.powiadomienia[k] = zrodloPowiad[k];
  }
  if (wejscie.moduly && typeof wejscie.moduly === 'object') {
    for (const k of MODULY) if (typeof wejscie.moduly[k] === 'boolean') u.moduly[k] = wejscie.moduly[k];
  }
  if (typeof wejscie.aktualizacje === 'boolean') u.aktualizacje = wejscie.aktualizacje;
  if (typeof wejscie.autostartUstawiony === 'boolean') u.autostartUstawiony = wejscie.autostartUstawiony;
  if (wejscie.wyglad && STYLE.includes(wejscie.wyglad.styl)) u.wyglad.styl = wejscie.wyglad.styl;
  return u;
}

// Czy zdarzenie z monitora (lib/zdarzenia.js) albo koniec minutnika ma się pokazać na wyspie.
// Powiadomienia są NIEZALEŻNE od modułów: decyduje tylko przełącznik danego powiadomienia.
// (Moduły mówią, co wyspa pokazuje na stałe; powiadomienia działają nawet przy wszystkich modułach wyłączonych.)
function czyPokazac(ustawienia, typZdarzenia) {
  if (!POWIADOMIENIA.includes(typZdarzenia)) return false;
  return !!ustawienia.powiadomienia[typZdarzenia];
}

// Czy trzeba w ogóle czytać baterię / głośność (dla kafelka modułu albo dla powiadomień).
function potrzebaBaterii(u) { return !!(u.moduly.bateria || u.powiadomienia.bateria || u.powiadomienia.ladowanie); }
function potrzebaGlosnosci(u) { return !!(u.moduly.glosnosc || u.powiadomienia.glosnosc); }

module.exports = { MODULY, POWIADOMIENIA, STYLE, domyslne, normalizuj, czyPokazac, potrzebaBaterii, potrzebaGlosnosci };

// Testy logiki ustawień: uruchom `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const { domyslne, normalizuj, czyPokazac, potrzebaBaterii, potrzebaGlosnosci } = require('../lib/ustawienia');

test('wygląd: domyślnie pastylka, notch zapamiętany, nieznany styl odrzucony', () => {
  assert.equal(domyslne().wyglad.styl, 'pastylka');
  assert.equal(normalizuj({ wyglad: { styl: 'notch' } }).wyglad.styl, 'notch');
  assert.equal(normalizuj({ wyglad: { styl: 'kwadrat' } }).wyglad.styl, 'pastylka');
  assert.equal(normalizuj({ wyglad: 'notch' }).wyglad.styl, 'pastylka');
});

test('ustawienia sprzed 4.1 (bez schowka) dostają schowek włączony, wyłączony zostaje wyłączony', () => {
  assert.equal(normalizuj({ moduly: { muzyka: true, bateria: true } }).moduly.schowek, true);
  assert.equal(normalizuj({ moduly: { schowek: false } }).moduly.schowek, false);
});

test('stare ustawienia z wersji 3.2 (usunięte ustępowanie miejsca) są pomijane', () => {
  const u = normalizuj({ unikanie: { chrome: true }, moduly: { bateria: true } });
  assert.equal(u.unikanie, undefined);
  assert.equal(u.moduly.bateria, true);
});

test('stare ustawienia z wersji 3.0 (usunięty wyzwalacz okien) nie psują wczytywania', () => {
  const u = normalizuj({ wyzwalacz: { animacja: true, programy: [] }, wyglad: { styl: 'notch' } });
  assert.equal(u.wyzwalacz, undefined);
  assert.equal(u.wyglad.styl, 'notch');
});

test('domyślnie włączona jest muzyka i schowek (pusta pastylka w spoczynku)', () => {
  const u = domyslne();
  assert.deepEqual(u.moduly, { muzyka: true, tekst: false, bateria: false, procesor: false, glosnosc: false, timer: false, schowek: true });
  assert.equal(u.autostartUstawiony, false);
});

test('tekst piosenki: domyślnie wyłączony (także dla starych ustawień), włączenie zapamiętane', () => {
  assert.equal(domyslne().moduly.tekst, false);
  assert.equal(normalizuj({ moduly: { muzyka: true, schowek: true } }).moduly.tekst, false);
  assert.equal(normalizuj({ moduly: { tekst: true } }).moduly.tekst, true);
  assert.equal(normalizuj({ moduly: { tekst: 'tak' } }).moduly.tekst, false);
});

test('brak pliku, śmieci albo zły typ → ustawienia domyślne', () => {
  assert.deepEqual(normalizuj(null), domyslne());
  assert.deepEqual(normalizuj('tekst'), domyslne());
  assert.deepEqual(normalizuj({ moduly: { bateria: 'tak', procesor: 1 } }), domyslne());
});

test('stary format 1.x (płaskie powiadomienia) zostaje przeniesiony', () => {
  const u = normalizuj({ timer: false, bateria: true, glosnosc: false, ladowanie: true });
  assert.deepEqual(u.powiadomienia, { timer: false, bateria: true, glosnosc: false, ladowanie: true });
  assert.deepEqual(u.moduly, domyslne().moduly);
});

test('nowy format zostaje zachowany, nieznane klucze odrzucone', () => {
  const u = normalizuj({ moduly: { bateria: true, muzyka: false, cos: true }, powiadomienia: { glosnosc: false }, autostartUstawiony: true });
  assert.equal(u.moduly.bateria, true);
  assert.equal(u.moduly.muzyka, false);
  assert.equal(u.moduly.cos, undefined);
  assert.equal(u.powiadomienia.glosnosc, false);
  assert.equal(u.powiadomienia.timer, true);
  assert.equal(u.autostartUstawiony, true);
});

test('powiadomienia działają przy wszystkich modułach wyłączonych (niezależne od modułów)', () => {
  const u = domyslne();
  for (const k of Object.keys(u.moduly)) u.moduly[k] = false;
  assert.equal(czyPokazac(u, 'glosnosc'), true);
  assert.equal(czyPokazac(u, 'bateria'), true);
  assert.equal(czyPokazac(u, 'ladowanie'), true);
  assert.equal(czyPokazac(u, 'timer'), true);
  assert.equal(czyPokazac(u, 'nieznane'), false);
});

test('decyduje tylko przełącznik powiadomienia', () => {
  const u = domyslne();
  u.moduly.glosnosc = true;
  u.powiadomienia.glosnosc = false;
  assert.equal(czyPokazac(u, 'glosnosc'), false);          // moduł włączony, powiadomienie wyłączone → nie
  u.powiadomienia.ladowanie = false;
  assert.equal(czyPokazac(u, 'ladowanie'), false);
  assert.equal(czyPokazac(u, 'bateria'), true);            // inne powiadomienia baterii dalej działają
});

test('baterię i głośność czytamy, gdy potrzebuje ich moduł albo powiadomienie', () => {
  const u = domyslne();
  assert.equal(potrzebaBaterii(u), true);                  // powiadomienia baterii domyślnie włączone
  u.powiadomienia.bateria = false; u.powiadomienia.ladowanie = false;
  assert.equal(potrzebaBaterii(u), false);                 // nic jej nie potrzebuje → nie czytamy
  u.moduly.bateria = true;
  assert.equal(potrzebaBaterii(u), true);
  u.powiadomienia.glosnosc = false;
  assert.equal(potrzebaGlosnosci(u), false);
  u.moduly.glosnosc = true;
  assert.equal(potrzebaGlosnosci(u), true);
});

test('aktualizacje: domyślnie włączone (także dla starych ustawień), wyłączenie zapamiętane', () => {
  assert.equal(domyslne().aktualizacje, true);
  assert.equal(normalizuj({ moduly: { muzyka: true } }).aktualizacje, true);
  assert.equal(normalizuj({ aktualizacje: false }).aktualizacje, false);
  assert.equal(normalizuj({ aktualizacje: 'nie' }).aktualizacje, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const O = require('../lib/oferta');
const AKT = require('../lib/aktualizacje');
const { domyslne, normalizuj, czyPokazac } = require('../lib/ustawienia');

const gotowa = (wersja) => ({ stan: 'gotowa', wersja, postep: 100 });

test('oferta pojawia się dopiero po pobraniu aktualizacji', () => {
  const p = O.pamiec();
  for (const stan of ['brak', 'sprawdzam', 'pobieram', 'aktualna', 'blad']) {
    assert.equal(p.oferta({ stan, wersja: '9.0.0' }, true), null, stan);
  }
  assert.deepEqual(p.oferta(gotowa('9.0.0'), true), { wersja: '9.0.0' });
});

test('„Później” chowa tę wersję do końca uruchomienia; nowsza wersja i nowe uruchomienie pokazują', () => {
  const p = O.pamiec();
  p.zamknij('9.0.0');
  assert.equal(p.oferta(gotowa('9.0.0'), true), null);
  assert.deepEqual(p.oferta(gotowa('9.0.1'), true), { wersja: '9.0.1' });
  assert.deepEqual(O.pamiec().oferta(gotowa('9.0.0'), true), { wersja: '9.0.0' });
});

test('przełącznik „Aktualizacja gotowa”: domyślnie włączony (także stare ustawienia), wyłączony ukrywa', () => {
  assert.equal(domyslne().powiadomienia.aktualizacja, true);
  assert.equal(normalizuj({ powiadomienia: { timer: false } }).powiadomienia.aktualizacja, true);
  assert.equal(normalizuj({ timer: false }).powiadomienia.aktualizacja, true);      // format 1.x
  const u = normalizuj({ powiadomienia: { aktualizacja: false } });
  assert.equal(czyPokazac(u, 'aktualizacja'), false);
  assert.equal(O.pamiec().oferta(gotowa('9.0.0'), czyPokazac(u, 'aktualizacja')), null);
});

test('licznik: czas mija po 15 s widocznego pokazu', () => {
  const l = O.licznik();
  for (let t = 250; t < O.CZAS_MS; t += 250) assert.equal(l.krok(250, true, false), false);
  assert.equal(l.krok(250, true, false), true);
});

test('licznik: nie znika spod kursora, a po zjechaniu zostaje jeszcze chwila', () => {
  const l = O.licznik();
  for (let i = 0; i < 59; i++) l.krok(250, true, false);                    // zostało 250 ms
  for (let i = 0; i < 400; i++) assert.equal(l.krok(250, true, true), false);
  for (let t = 250; t < O.PO_KURSORZE_MS; t += 250) assert.equal(l.krok(250, true, false), false);
  assert.equal(l.krok(250, true, false), true);
});

test('licznik: ukryta wyspa i przerwanie zaczynają od nowa; długi krok jest przycinany', () => {
  const l = O.licznik();
  for (let i = 0; i < 59; i++) l.krok(250, true, false);
  assert.equal(l.krok(60000, false, false), false);                          // pełny ekran
  assert.equal(l.krok(60000, true, false), false);                           // pierwszy krok po powrocie
  for (let i = 0; i < 57; i++) l.krok(250, true, false);
  l.odNowa();
  assert.equal(l.krok(500, true, false), false);
});

test('aktualizator: instaluje tylko pobraną wersję i tylko na polecenie (cicho, z ponownym startem)', () => {
  const atrapa = new EventEmitter();
  const instalacje = [];
  atrapa.checkForUpdates = () => null;
  atrapa.quitAndInstall = (...a) => instalacje.push(a);
  const stany = [];
  const a = AKT.utworz({ app: { isPackaged: true }, dbg: () => {}, czyWlaczone: () => true,
    naZmiane: (s) => stany.push(s.stan), modul: () => atrapa });
  a.sprawdz();
  atrapa.emit('update-available', { version: '9.0.0' });
  a.zainstalujTeraz();
  assert.equal(instalacje.length, 0);                                        // jeszcze się pobiera
  atrapa.emit('update-downloaded', { version: '9.0.0' });
  assert.deepEqual(a.stan(), gotowa('9.0.0'));
  assert.equal(stany.at(-1), 'gotowa');
  assert.equal(instalacje.length, 0);                                        // samo pobranie nie instaluje
  a.zainstalujTeraz();
  assert.deepEqual(instalacje, [[true, true]]);
});

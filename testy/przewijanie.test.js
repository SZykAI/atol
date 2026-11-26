const test = require('node:test');
const assert = require('node:assert');
const { utworzFiltrPozycji, moznaPrzewinac, BLOKADA_PO_PRZEWINIECIU_MS } = require('../lib/przewijanie');

const utwor = { klucz: 'a', dlugosc: 200, przewijanie: true };

test('przewinięcie tylko w granicach utworu i gdy źródło pozwala', () => {
  assert.ok(moznaPrzewinac(0, utwor));
  assert.ok(moznaPrzewinac(200, utwor));
  for (const zla of [-1, 200.1, NaN, Infinity, '10', null, undefined]) {
    assert.strictEqual(moznaPrzewinac(zla, utwor), false, String(zla));
  }
  assert.strictEqual(moznaPrzewinac(10, null), false);
  assert.strictEqual(moznaPrzewinac(10, { ...utwor, przewijanie: false }), false);
  assert.strictEqual(moznaPrzewinac(0, { ...utwor, dlugosc: 0 }), false);
});

test('stara pozycja z systemu nie cofa paska przez czas blokady', () => {
  const f = utworzFiltrPozycji();
  f.przewiniecie('a', 100, 1000);
  assert.strictEqual(f.odczyt('a', 10, true, 200, 1500), 100.5);     // gra → płynie dalej
  assert.strictEqual(f.odczyt('a', 100.6, true, 200, 2000), 101);    // także po potwierdzeniu
  assert.strictEqual(f.odczyt('a', 11, false, 200, 2500), 101);      // pauza → stoi
  assert.strictEqual(f.odczyt('a', 12, true, 200, 1000 + BLOKADA_PO_PRZEWINIECIU_MS), 12);
  assert.strictEqual(f.odczyt('a', 13, true, 200, 3500), 13);
});

test('inny utwór kończy blokadę, pozycja nie wychodzi poza koniec', () => {
  const f = utworzFiltrPozycji();
  f.przewiniecie('a', 199.8, 0);
  assert.strictEqual(f.odczyt('a', 5, true, 200, 1000), 200);
  assert.strictEqual(f.odczyt('b', 3, true, 180, 1100), 3);
  assert.strictEqual(f.odczyt('a', 7, true, 200, 1200), 7);
});

test('bez przewinięcia i po wyczyszczeniu: pozycja z systemu', () => {
  const f = utworzFiltrPozycji();
  assert.strictEqual(f.odczyt('a', 42, true, 200, 0), 42);
  f.przewiniecie('a', 100, 0);
  f.wyczysc();
  assert.strictEqual(f.odczyt('a', 43, true, 200, 100), 43);
});

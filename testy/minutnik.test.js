const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../lib/minutnik');
const D = require('../okna/dzwiek');
const { domyslne, normalizuj } = require('../lib/ustawienia');

test('własny czas mieści się w zakresie 1–180 min', () => {
  assert.equal(M.ogranicz(0), 1);
  assert.equal(M.ogranicz(500), 180);
  assert.equal(M.ogranicz(7.4), 7);
  assert.equal(M.ogranicz('20'), M.DOMYSLNY);
  assert.equal(M.ogranicz(NaN), M.DOMYSLNY);
  assert.equal(M.przesun(1, -1, 1), 1);
  assert.equal(M.przesun(180, 1, 1), 180);
});

test('duży krok wskakuje na wielokrotności i nie wychodzi poza zakres', () => {
  assert.equal(M.przesun(17, 1, 5), 20);
  assert.equal(M.przesun(20, 1, 5), 25);
  assert.equal(M.przesun(17, -1, 5), 15);
  assert.equal(M.przesun(3, -1, 5), 1);
  assert.equal(M.przesun(178, 1, 5), 180);
});

test('przytrzymanie przyspiesza', () => {
  const tempo = (n) => M.powtorzenie(n).krok / M.powtorzenie(n).po;   // minut na milisekundę
  assert.ok(tempo(0) < tempo(1) && tempo(1) < tempo(6) && tempo(6) < tempo(14));
});

test('kółko: ząbek = 1 minuta, małe skoki gładzika się sumują', () => {
  assert.deepEqual(M.zKolka(0, -100), { kroki: 1, reszta: 0 });
  assert.deepEqual(M.zKolka(0, 120), { kroki: -1, reszta: 0 });
  let r = 0, suma = 0;
  for (let i = 0; i < 10; i++) { const w = M.zKolka(r, -12); r = w.reszta; suma += w.kroki; }
  assert.equal(suma, 2);          // 120 jednostek → 2 pełne progi po 50
});

test('dźwięk trwa od 1,5 do 3 s', () => {
  assert.ok(D.DLUGOSC_S >= 1.5 && D.DLUGOSC_S <= 3);
});

test('minutnik w ustawieniach: dźwięk domyślnie włączony (także dla starych), wybór zapamiętany', () => {
  assert.deepEqual(domyslne().minutnik, { dzwiek: true, wlasny: 15 });
  assert.deepEqual(normalizuj({ moduly: { timer: true } }).minutnik, { dzwiek: true, wlasny: 15 });
  assert.deepEqual(normalizuj({ minutnik: { dzwiek: false, wlasny: 42 } }).minutnik, { dzwiek: false, wlasny: 42 });
  assert.deepEqual(normalizuj({ minutnik: { dzwiek: 'nie', wlasny: 999 } }).minutnik, { dzwiek: true, wlasny: 180 });
});

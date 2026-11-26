const test = require('node:test');
const assert = require('node:assert');
const { utworzFiltrGrania } = require('../lib/granie');

test('po kliknięciu pauzy chwilowe „gra” po potwierdzeniu nie wznawia animacji', () => {
  const f = utworzFiltrGrania();
  assert.strictEqual(f.odczyt('a', true, 0), true);
  f.klikniecie(100);
  assert.strictEqual(f.odczyt('a', false, 250), false);   // system potwierdza pauzę
  assert.strictEqual(f.odczyt('a', true, 750), false);    // stary stan — ignorowany
  assert.strictEqual(f.odczyt('a', false, 1250), false);
});

test('pauza z zewnątrz: pojedynczy skok jest ignorowany, trwała zmiana przyjęta', () => {
  const f = utworzFiltrGrania();
  f.odczyt('a', true, 0);
  assert.strictEqual(f.odczyt('a', false, 500), true);
  assert.strictEqual(f.odczyt('a', false, 1000), false);
  assert.strictEqual(f.odczyt('a', true, 1500), false);   // skok
  assert.strictEqual(f.odczyt('a', false, 2000), false);
});

test('nieudane kliknięcie wraca do prawdy, a nowy utwór działa od razu', () => {
  const f = utworzFiltrGrania();
  f.odczyt('a', true, 0);
  f.klikniecie(0);
  assert.strictEqual(f.odczyt('a', true, 2100), false);
  assert.strictEqual(f.odczyt('a', true, 2600), true);
  assert.strictEqual(f.odczyt('b', false, 2700), false);
});

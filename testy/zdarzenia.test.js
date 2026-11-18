// Testy logiki powiadomień: uruchom `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const { utworzDetektor } = require('../lib/zdarzenia');

const bat = (procent, laduje = false) => ({ bateria: { procent, laduje }, glosnosc: null });
const glos = (poziom, wyciszony = false) => ({ bateria: null, glosnosc: { poziom, wyciszony } });
const typy = (z) => z.map((x) => x.typ + (x.prog ? ':' + x.prog : ''));

test('pierwszy odczyt głośności i ładowania nie daje powiadomień', () => {
  const d = utworzDetektor();
  assert.deepEqual(d({ bateria: { procent: 80, laduje: true }, glosnosc: { poziom: 30, wyciszony: false } }), []);
});

test('zmiana głośności daje powiadomienie, brak zmiany — nie', () => {
  const d = utworzDetektor();
  d(glos(30));
  assert.deepEqual(d(glos(30)), []);
  assert.deepEqual(d(glos(35)), [{ typ: 'glosnosc', poziom: 35, wyciszony: false }]);
});

test('wyciszenie też jest zmianą głośności', () => {
  const d = utworzDetektor();
  d(glos(30));
  assert.deepEqual(typy(d(glos(30, true))), ['glosnosc']);
});

test('rozpoczęcie i zakończenie ładowania', () => {
  const d = utworzDetektor();
  d(bat(70, false));
  assert.deepEqual(d(bat(70, true)), [{ typ: 'ladowanie', laduje: true, procent: 70 }]);
  assert.deepEqual(d(bat(71, true)), []);
  assert.deepEqual(d(bat(100, false)), [{ typ: 'ladowanie', laduje: false, procent: 100 }]);
});

test('spadek poniżej 20% i potem poniżej 10% — po jednym powiadomieniu', () => {
  const d = utworzDetektor();
  assert.deepEqual(d(bat(25)), []);
  assert.deepEqual(typy(d(bat(19))), ['bateria:20']);
  assert.deepEqual(d(bat(18)), []);          // bez powtórek
  assert.deepEqual(typy(d(bat(9))), ['bateria:10']);
  assert.deepEqual(d(bat(8)), []);
});

test('bateria nie ostrzega podczas ładowania', () => {
  const d = utworzDetektor();
  d(bat(30, true));
  assert.deepEqual(typy(d(bat(15, true))), []);
});

test('po naładowaniu powyżej progu ostrzeżenie działa ponownie', () => {
  const d = utworzDetektor();
  d(bat(25));
  assert.deepEqual(typy(d(bat(19))), ['bateria:20']);
  d(bat(30, true));                           // podłączono ładowarkę
  d(bat(60, false));                          // odłączono
  assert.deepEqual(typy(d(bat(19))), ['bateria:20']);
});

test('skok od razu poniżej 10% daje jedno powiadomienie (krytyczne)', () => {
  const d = utworzDetektor();
  d(bat(30));
  assert.deepEqual(typy(d(bat(8))), ['bateria:10']);
  assert.deepEqual(d(bat(7)), []);
});

test('chwilowy brak odczytu baterii nie wywołuje fałszywych zdarzeń', () => {
  const d = utworzDetektor();
  d(bat(70, true));
  assert.deepEqual(d({ bateria: null, glosnosc: null }), []);
  assert.deepEqual(d(bat(71, true)), []);     // nadal ładuje, brak "nowego" ładowania
});

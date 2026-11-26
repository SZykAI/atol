const test = require('node:test');
const assert = require('node:assert');
const P = require('../lib/poziom');

const staly = () => P.utworz(() => 1);        // bez losowości: mnożniki = profil słupków

test('bez odczytu nie ma danych, a stary odczyt przestaje być świeży', () => {
  const p = staly();
  assert.strictEqual(p.swiezy(1000), false);
  p.odczyt(0.5, 1000);
  assert.strictEqual(p.swiezy(1000 + P.SWIEZY_MS - 1), true);
  assert.strictEqual(p.swiezy(1000 + P.SWIEZY_MS + 1), false);
});

test('cisza daje spoczynek, głośny dźwięk pełny słupek', () => {
  const p = staly();
  p.odczyt(0, 0);
  for (let i = 0; i < 5; i++) assert.strictEqual(p.cel(i), P.SPOCZYNEK);
  p.odczyt(0.8, 60);
  assert.ok(Math.abs(p.cel(2) - 1) < 1e-9);
  assert.ok(p.cel(0) < p.cel(2));
});

test('przy cichej głośności słupki nadal sięgają wysoko i się ruszają', () => {
  const p = staly();
  p.odczyt(0.03, 0);
  const wysoko = p.cel(2);
  p.odczyt(0.015, 60);
  assert.ok(wysoko > 0.95);
  assert.ok(p.cel(2) < wysoko - 0.4);
});

test('po głośnym fragmencie skala dopasowuje się do cichszego', () => {
  const p = staly();
  p.odczyt(0.9, 0);
  p.odczyt(0.1, 60);
  const zaraz = p.cel(2);
  for (let t = 120; t < 15000; t += 60) p.odczyt(0.1, t);
  assert.ok(zaraz < 0.3);
  assert.ok(p.cel(2) > 0.95);
});

test('złe wartości są pomijane, za duże obcinane', () => {
  const p = staly();
  p.odczyt(NaN, 0);
  p.odczyt('1', 0);
  assert.strictEqual(p.swiezy(0), false);
  p.odczyt(7, 0);
  assert.ok(p.cel(2) <= 1);
});

test('atak jest szybszy niż opadanie', () => {
  const wGore = P.krok(0.2, 1, 0.033) - 0.2;
  const wDol = 1 - P.krok(1, 0.2, 0.033);
  assert.ok(wGore > wDol * 1.5);
});

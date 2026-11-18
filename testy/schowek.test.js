// Testy schowka na pliki: uruchom `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../lib/schowek');

test('dodawanie: nowe pliki na początku, nazwa z końca ścieżki', () => {
  let l = S.dodaj([], ['C:\\a\\raport.pdf'], 1);
  l = S.dodaj(l, ['D:\\zdjecie.png', 'C:\\b\\notatki.txt'], 2);
  assert.deepEqual(l.map((p) => p.nazwa), ['zdjecie.png', 'notatki.txt', 'raport.pdf']);
  assert.equal(l[0].dodano, 2);
});

test('ten sam plik drugi raz (inna wielkość liter) przeskakuje na początek bez duplikatu', () => {
  let l = S.dodaj([], ['C:\\a\\x.txt', 'C:\\a\\y.txt'], 1);
  l = S.dodaj(l, ['c:\\A\\Y.TXT'], 2);
  assert.equal(l.length, 2);
  assert.equal(l[0].sciezka, 'c:\\A\\Y.TXT');
  assert.equal(l[1].nazwa, 'x.txt');
});

test('złe ścieżki są odrzucane (względne, puste, nie-tekst)', () => {
  const l = S.dodaj([], ['plik.txt', '', null, 5, '..\\a', 'C:\\ok.txt'], 1);
  assert.deepEqual(l.map((p) => p.nazwa), ['ok.txt']);
});

test('limit: najstarsze pliki wypadają', () => {
  let l = [];
  for (let i = 0; i < S.LIMIT + 5; i++) l = S.dodaj(l, ['C:\\p' + i + '.txt'], i);
  assert.equal(l.length, S.LIMIT);
  assert.equal(l[0].nazwa, 'p' + (S.LIMIT + 4) + '.txt');
});

test('usuwanie i sprawdzanie, czy plik jest w schowku', () => {
  let l = S.dodaj([], ['C:\\a.txt', 'C:\\b.txt'], 1);
  assert.equal(S.zawiera(l, 'c:\\A.TXT'), true);
  l = S.usun(l, 'C:\\A.txt');
  assert.deepEqual(l.map((p) => p.nazwa), ['b.txt']);
  assert.equal(S.zawiera(l, 'C:\\a.txt'), false);
  assert.equal(S.zawiera(l, 42), false);
});

test('wczytywanie pliku: uszkodzony / pusty / z duplikatami', () => {
  assert.deepEqual(S.normalizuj(null), []);
  assert.deepEqual(S.normalizuj({ pliki: 'x' }), []);
  const l = S.normalizuj({ pliki: [{ sciezka: 'C:\\a.txt', dodano: 5 }, { sciezka: 'c:\\A.txt' }, { sciezka: 'wzgledna' }, null] });
  assert.equal(l.length, 1);
  assert.equal(l[0].dodano, 5);
});

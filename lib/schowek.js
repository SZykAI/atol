/*
 * Atol — schowek na pliki: lista plików przeciągniętych na wyspę.
 * Czysta logika (bez Electrona i bez dysku), testowana w `npm test`.
 *
 * Schowek NIE kopiuje plików — pamięta tylko, gdzie leżą (ścieżka). Dzięki temu nie zajmuje miejsca na
 * dysku, ale jeśli ktoś przeniesie albo usunie oryginał, w schowku zostanie "brakujący" wpis.
 *
 * Format pliku schowek.json: { wersja: 1, pliki: [ { sciezka, nazwa, dodano } ] } — najnowsze na początku.
 */
const path = require('path');

const LIMIT = 24;   // tyle plików mieści schowek; najstarsze wypadają

// Ścieżki w Windows nie rozróżniają wielkości liter: C:\A.txt i c:\a.TXT to ten sam plik
function klucz(sciezka) { return path.win32.normalize(sciezka).toLowerCase(); }

function poprawnaSciezka(s) {
  return typeof s === 'string' && s.length > 0 && s.length < 32768 && path.win32.isAbsolute(s) && !s.includes('\0');
}

function wpis(sciezka, dodano) {
  const s = path.win32.normalize(sciezka);
  return { sciezka: s, nazwa: path.win32.basename(s) || s, dodano };
}

// Z dowolnego obiektu (wczytanego z pliku) robi poprawną listę.
function normalizuj(wejscie) {
  const zrodlo = wejscie && Array.isArray(wejscie.pliki) ? wejscie.pliki : [];
  const lista = [];
  const byly = new Set();
  for (const p of zrodlo) {
    if (!p || !poprawnaSciezka(p.sciezka)) continue;
    const k = klucz(p.sciezka);
    if (byly.has(k)) continue;
    byly.add(k);
    lista.push(wpis(p.sciezka, Number.isFinite(p.dodano) ? p.dodano : 0));
    if (lista.length >= LIMIT) break;
  }
  return lista;
}

// Dodaje pliki na początek listy. Plik, który już jest w schowku, przeskakuje na początek (bez duplikatu).
function dodaj(lista, sciezki, teraz) {
  const nowe = [];
  const byly = new Set();
  for (const s of sciezki || []) {
    if (!poprawnaSciezka(s)) continue;
    const k = klucz(s);
    if (byly.has(k)) continue;
    byly.add(k);
    nowe.push(wpis(s, teraz));
  }
  const reszta = lista.filter((p) => !byly.has(klucz(p.sciezka)));
  return nowe.concat(reszta).slice(0, LIMIT);
}

function usun(lista, sciezka) {
  if (typeof sciezka !== 'string') return lista;
  const k = klucz(sciezka);
  return lista.filter((p) => klucz(p.sciezka) !== k);
}

function zawiera(lista, sciezka) {
  if (typeof sciezka !== 'string') return false;
  const k = klucz(sciezka);
  return lista.some((p) => klucz(p.sciezka) === k);
}

module.exports = { LIMIT, normalizuj, dodaj, usun, zawiera };

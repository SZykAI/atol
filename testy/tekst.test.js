// Testy tekstu piosenki (udawany fetch — bez internetu): `npm test`
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../lib/tekst');

const odp = (tresc, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(tresc) });

// udawany serwis: `get` i `search` to funkcje zwracające odpowiedź; zapytania są zapisywane
function serwis({ get = () => odp({}, 404), search = () => odp([]) } = {}, opcje = {}) {
  const zapytania = [];
  const fetch = async (adres, o) => {
    const u = new URL(adres);
    zapytania.push({ sciezka: u.pathname, p: Object.fromEntries(u.searchParams), naglowki: o.headers, host: u.host, protokol: u.protocol });
    return u.pathname.endsWith('/get') ? get(u.searchParams) : search(u.searchParams);
  };
  return { zapytania, ...T.utworzTeksty({ fetch, ...opcje }) };
}

const UTWOR = { tytul: 'Hello', wykonawca: 'Adele', dlugosc: 295.2 };
const LRC = '[00:01.00]Pierwsza\n[00:05.50]Druga';
const wpis = (inne) => ({ trackName: 'Hello', artistName: 'Adele', duration: 295, ...inne });

test('LRC: kilka znaczników w linii, puste linie, nagłówki i zwykłe linie pomijane', () => {
  const l = T.parsujLRC('[ar:Ktoś]\r\n[00:10.00][01:00.5]Refren\r\n[00:05]Start\n[00:20.123]\nbez czasu');
  assert.deepEqual(l, [
    { czas: 5, tekst: 'Start' },
    { czas: 10, tekst: 'Refren' },
    { czas: 20.123, tekst: '' },
    { czas: 60.5, tekst: 'Refren' }
  ]);
});

test('LRC: [offset] przesuwa czasy (dodatni = wcześniej), nie schodzi poniżej zera', () => {
  assert.deepEqual(T.parsujLRC('[offset:+1500]\n[00:01.00]a\n[00:04.00]b').map((x) => x.czas), [0, 2.5]);
  assert.deepEqual(T.parsujLRC('[offset:-500]\n[00:01.00]a').map((x) => x.czas), [1.5]);
});

test('LRC: pusty, same puste linie albo zły typ → brak tekstu', () => {
  assert.deepEqual(T.parsujLRC(''), []);
  assert.deepEqual(T.parsujLRC('[00:01.00]\n[00:02.00]'), []);
  assert.deepEqual(T.parsujLRC(null), []);
});

test('indeks aktualnej linii', () => {
  const l = [{ czas: 1 }, { czas: 5 }, { czas: 9 }];
  assert.equal(T.indeksLinii(l, 0), -1);
  assert.equal(T.indeksLinii(l, 1), 0);
  assert.equal(T.indeksLinii(l, 8.9), 1);
  assert.equal(T.indeksLinii(l, 100), 2);
  assert.equal(T.indeksLinii([], 3), -1);
});

test('czyszczenie dopisków z YouTube', () => {
  assert.deepEqual(T.oczyscUtwor('Adele - Hello (Official Music Video)', 'AdeleVEVO'), { tytul: 'Hello', wykonawca: 'Adele' });
  assert.deepEqual(T.oczyscUtwor('Małomiasteczkowy [Teledysk]', 'Dawid Podsiadło - Topic'), { tytul: 'Małomiasteczkowy', wykonawca: 'Dawid Podsiadło' });
  assert.deepEqual(T.oczyscUtwor('Taylor Swift - Anti-Hero (Official Video)', 'TaylorSwiftVEVO'), { tytul: 'Anti-Hero', wykonawca: 'Taylor Swift' });
  assert.deepEqual(T.oczyscUtwor('sanah - Szampan | Official Video', 'Jakaś Wytwórnia'), { tytul: 'Szampan', wykonawca: 'sanah' });
  assert.deepEqual(T.oczyscUtwor('Bohemian Rhapsody - Remastered 2011', 'Queen'), { tytul: 'Bohemian Rhapsody', wykonawca: 'Queen' });
  assert.equal(T.oczyscTytul('Song (Live at Wembley)'), 'Song (Live at Wembley)');     // inna wersja zostaje
  assert.equal(T.oczyscTytul('Video Games'), 'Video Games');
});

test('zapytanie: tylko tytuł, wykonawca i długość; ogólny User-Agent', async () => {
  const s = serwis({ get: () => odp(wpis({ syncedLyrics: LRC })) });
  const w = await s.pobierz({ ...UTWOR, album: 'Sekretny album', zrodlo: 'x' });
  assert.equal(w.synchroniczny, true);
  assert.equal(w.linie.length, 2);
  assert.equal(s.zapytania.length, 1);
  const z = s.zapytania[0];
  assert.equal(z.protokol + '//' + z.host + z.sciezka, 'https://lrclib.net/api/get');
  assert.deepEqual(z.p, { track_name: 'Hello', artist_name: 'Adele', duration: '295' });
  assert.equal(z.naglowki['User-Agent'], 'lyrics-client/1.0');
});

test('nie pyta bez tytułu / wykonawcy ani dla zbyt krótkich i zbyt długich', async () => {
  const s = serwis();
  assert.equal(await s.pobierz({ tytul: '', wykonawca: 'A', dlugosc: 200 }), null);
  assert.equal(await s.pobierz({ tytul: 'T', wykonawca: '  ', dlugosc: 200 }), null);
  assert.equal(await s.pobierz({ tytul: 'T', wykonawca: 'A', dlugosc: 29 }), null);
  assert.equal(await s.pobierz({ tytul: 'T', wykonawca: 'A', dlugosc: 901 }), null);
  assert.equal(s.zapytania.length, 0);
  await s.pobierz({ tytul: 'T', wykonawca: 'A', dlugosc: 0 });      // długość nieznana — pyta, bez niej
  assert.equal(s.zapytania[0].p.duration, undefined);
});

test('wyszukiwanie: wynik z synchronizacją i długością ±3 s, obce utwory odrzucone', async () => {
  const s = serwis({
    search: () => odp([
      wpis({ trackName: 'Inna piosenka', syncedLyrics: '[00:01.00]zła' }),
      wpis({ artistName: 'Ktoś Inny', syncedLyrics: '[00:01.00]zła' }),
      wpis({ duration: 340, syncedLyrics: '[00:01.00]za długa' }),
      wpis({ duration: 297, syncedLyrics: '[00:01.00]dobra' })
    ])
  });
  const w = await s.pobierz(UTWOR);
  assert.equal(w.synchroniczny, true);
  assert.equal(w.linie[0].tekst, 'dobra');
});

test('wyszukiwanie: zła długość → tylko zwykły tekst; sam obcy utwór → nic', async () => {
  const a = serwis({ search: () => odp([wpis({ duration: 340, syncedLyrics: LRC, plainLyrics: 'jeden\n\ndwa' })]) });
  assert.deepEqual(await a.pobierz(UTWOR), { synchroniczny: false, linie: [{ tekst: 'jeden' }, { tekst: '' }, { tekst: 'dwa' }] });
  const b = serwis({ search: () => odp([wpis({ trackName: 'Przypadkowa', syncedLyrics: LRC, plainLyrics: 'x' })]) });
  assert.equal(await b.pobierz(UTWOR), null);
});

test('pamięć: zapamiętuje tekst i „brak”', async () => {
  const s = serwis();
  assert.equal(await s.pobierz(UTWOR), null);
  const ile = s.zapytania.length;
  assert.equal(await s.pobierz(UTWOR), null);
  assert.equal(s.zapytania.length, ile);
});

test('pamięć: błędy sieci i serwisu nie są zapamiętywane', async () => {
  let dziala = false;
  const s = serwis({
    get: () => { if (!dziala) throw new Error('brak sieci'); return odp(wpis({ syncedLyrics: LRC })); },
    search: () => odp({}, 503)
  });
  assert.equal(await s.pobierz(UTWOR), null);
  dziala = true;
  assert.equal((await s.pobierz(UTWOR)).synchroniczny, true);
});

test('pamięć ma limit (najdawniej używany wypada)', async () => {
  const s = serwis({ get: () => odp(wpis({ syncedLyrics: LRC })) }, { limitPamieci: 2 });
  for (const d of [100, 200, 100, 300]) await s.pobierz({ ...UTWOR, dlugosc: d });
  assert.equal(s.zapytania.length, 3);
  await s.pobierz({ ...UTWOR, dlugosc: 100 });      // nadal w pamięci
  assert.equal(s.zapytania.length, 3);
  await s.pobierz({ ...UTWOR, dlugosc: 200 });      // wypadł
  assert.equal(s.zapytania.length, 4);
});

test('timeout i za duża odpowiedź kończą się brakiem tekstu, bez zapamiętania', async () => {
  const wisi = serwis({ get: () => new Promise(() => {}), search: () => new Promise(() => {}) }, { czas: 20 });
  assert.equal(await wisi.pobierz(UTWOR), null);
  await wisi.pobierz(UTWOR);
  assert.equal(wisi.zapytania.length, 4);
  const duza = serwis({ get: () => odp(wpis({ syncedLyrics: LRC })) }, { limitOdpowiedzi: 10 });
  assert.equal(await duza.pobierz(UTWOR), null);
});

test('limit rozmiaru działa też przy odpowiedzi czytanej strumieniem', async () => {
  const s = serwis({ get: () => new Response(JSON.stringify(wpis({ syncedLyrics: LRC }))), search: () => new Response('[]') });
  assert.equal((await s.pobierz(UTWOR)).synchroniczny, true);
  const m = serwis({ get: () => new Response('x'.repeat(5000)), search: () => new Response('[]') }, { limitOdpowiedzi: 100 });
  assert.equal(await m.pobierz(UTWOR), null);
});

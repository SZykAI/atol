// Atol — studio SZykAI
// Tekst piosenki z lrclib.net (moduł „tekst”, domyślnie wyłączony). Czysta logika: `fetch` jest podawany
// z zewnątrz, więc da się ją przetestować bez internetu (`npm test`).
// Do serwisu idą TYLKO: tytuł, wykonawca i długość utworu (bez albumu i bez żadnych danych o użytkowniku).

const ADRES = 'https://lrclib.net/api/';
const NAGLOWKI = { 'User-Agent': 'lyrics-client/1.0', Accept: 'application/json' };
const CZAS_NA_ODPOWIEDZ_MS = 6000;
const LIMIT_ODPOWIEDZI = 1.5 * 1024 * 1024;     // bajty
const LIMIT_PAMIECI = 50;                       // tyle utworów pamiętamy (tylko w RAM)
const LIMIT_LINII = 600;
const LIMIT_ZNAKOW_LINII = 300;
const MIN_DLUGOSC_S = 30;
const MAKS_DLUGOSC_S = 15 * 60;
const TOLERANCJA_DLUGOSCI_S = 3;

/* ---------------- format LRC ---------------- */

const ZNACZNIK = /^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;

// "[00:12.50][01:02.00]Słowa" → [{ czas: 12.5, tekst: 'Słowa' }, { czas: 62, tekst: 'Słowa' }], posortowane.
// [offset:+500] (ms): dodatni przyspiesza tekst. Pusta linia ze znacznikiem to przerwa (zostaje).
function parsujLRC(lrc) {
  if (typeof lrc !== 'string') return [];
  const o = lrc.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const przesuniecie = o ? parseInt(o[1], 10) / 1000 : 0;
  const linie = [];
  for (let wiersz of lrc.split(/\r?\n/)) {
    const czasy = [];
    let z;
    while ((z = wiersz.match(ZNACZNIK))) {
      const ulamek = z[3] ? Number('0.' + z[3]) : 0;
      czasy.push(Number(z[1]) * 60 + Number(z[2]) + ulamek);
      wiersz = wiersz.slice(z[0].length);
    }
    if (!czasy.length) continue;                 // nagłówki [ar:…] i linie bez czasu
    // znaczniki pojedynczych słów <00:12.00> (rozszerzony LRC) wyrzucamy
    const tekst = wiersz.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').replace(/\s+/g, ' ').trim()
      .slice(0, LIMIT_ZNAKOW_LINII);
    for (const c of czasy) linie.push({ czas: Math.max(0, c - przesuniecie), tekst });
  }
  if (!linie.some((l) => l.tekst)) return [];
  return linie.sort((a, b) => a.czas - b.czas).slice(0, LIMIT_LINII);
}

// Numer linii, która trwa w danej chwili (sekundy); -1 = przed pierwszą linią.
function indeksLinii(linie, pozycja) {
  let od = 0, dokad = linie.length - 1, wynik = -1;
  while (od <= dokad) {
    const s = (od + dokad) >> 1;
    if (linie[s].czas <= pozycja) { wynik = s; od = s + 1; }
    else dokad = s - 1;
  }
  return wynik;
}

/* ---------------- czyszczenie tytułu i wykonawcy ---------------- */

const DOPISEK = /(?<![\p{L}\p{N}])(official|oficjalny|oficjalna|video|wideo|audio|lyrics?|teledysk|tekst|visuali[sz]er|klip|mv|m\/v|hd|hq|4k|napisy|premiera|prod|remaster(ed)?)(?![\p{L}\p{N}])/iu;

function oczyscTytul(tytul) {
  const oryginal = String(tytul || '').trim();
  const t = oryginal
    // nawiasy z dopiskami: (Official Video), [Teledysk], 【MV】 — inne, np. (Live), zostają
    .replace(/\s*[([{【]([^()[\]{}【】]*)[)\]}】]/g, (calosc, srodek) => (DOPISEK.test(srodek) ? '' : calosc))
    // "Tytuł | Official Video"
    .replace(/\s*(\||｜|\/\/)(.*)$/, (calosc, _z, reszta) => (DOPISEK.test(reszta) ? '' : calosc))
    // dopiski bez nawiasów na końcu
    .replace(/\s*[-–—:]?\s*(?<![\p{L}\p{N}])(official(\s+(music|lyrics?))?(\s+(video|audio|visuali[sz]er|mv))?|oficjalny\s+teledysk)\s*$/iu, '')
    .replace(/\s+prod\.\s.*$/i, '')
    .replace(/\s+[-–—]\s+(\d{4}\s+)?(digital(ly)?\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|]+|[\s\-–—|]+$/g, '');
  return t || oryginal;
}

function oczyscWykonawce(wykonawca) {
  let w = String(wykonawca || '').trim().replace(/\s+-\s+topic$/i, '');
  if (/vevo$/i.test(w)) {
    w = w.replace(/\s*vevo$/i, '');
    if (!w.includes(' ')) w = w.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');   // "TaylorSwift" → "Taylor Swift"
  }
  return w.replace(/\s+(official(\s+music)?|oficjalny)$/i, '').trim();
}

// małe litery, bez polskich znaków i interpunkcji — tylko do porównywania
function uprosc(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// ten sam wykonawca: identyczny zapis albo wszystkie słowa krótszej nazwy są w dłuższej (np. z gościem)
function samArtysta(a, b) {
  const x = uprosc(a), y = uprosc(b);
  if (!x || !y) return false;
  if (x.replace(/ /g, '') === y.replace(/ /g, '')) return true;
  const [krotsza, dluzsza] = [x.split(' '), y.split(' ')].sort((p, q) => p.length - q.length);
  return krotsza.every((slowo) => dluzsza.includes(slowo));
}

function samTytul(a, b) {
  const klucz = (t) => uprosc(oczyscTytul(t).replace(/\s*[([](feat|ft)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s+(feat\.|ft\.)\s.*$/i, '')).replace(/ /g, '');
  const x = klucz(a);
  return !!x && x === klucz(b);
}

// Możliwe odczytania „tytuł + wykonawca” (na YouTube tytuł to często „Wykonawca - Tytuł”, a wykonawca
// to nazwa kanału). Pierwsze jest najbardziej prawdopodobne.
function kandydaci(tytul, wykonawca) {
  const t = oczyscTytul(tytul);
  const w = oczyscWykonawce(wykonawca);
  const m = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!m) return [{ tytul: t, wykonawca: w }];
  const lewa = m[1].trim().replace(/\s+(feat\.?|ft\.)\s.*$/i, '');
  const prawa = m[2].trim();
  if (samArtysta(lewa, w)) return [{ tytul: prawa, wykonawca: lewa }];
  if (samArtysta(prawa, w)) return [{ tytul: m[1].trim(), wykonawca: w }];
  if (/^(live|remix|radio|acoustic|akustycznie|edit|mono|stereo|from|single|version|wersja)\b/i.test(prawa)) {
    return [{ tytul: t, wykonawca: w }];
  }
  return [{ tytul: prawa, wykonawca: lewa }, { tytul: t, wykonawca: w }];
}

function oczyscUtwor(tytul, wykonawca) { return kandydaci(tytul, wykonawca)[0]; }

/* ---------------- pobieranie ---------------- */

function zeSynchronizacja(wpis) {
  const linie = parsujLRC(wpis && wpis.syncedLyrics);
  return linie.length ? { synchroniczny: true, linie } : null;
}

function zwyklyTekst(wpis) {
  if (!wpis || typeof wpis.plainLyrics !== 'string' || !wpis.plainLyrics.trim()) return null;
  const linie = wpis.plainLyrics.trim().split(/\r?\n/).slice(0, LIMIT_LINII)
    .map((l) => ({ tekst: l.trim().slice(0, LIMIT_ZNAKOW_LINII) }));
  return { synchroniczny: false, linie };
}

// treść odpowiedzi z limitem rozmiaru (żeby błąd serwisu nie zapchał pamięci)
async function przeczytaj(odp, limit) {
  const zaDuza = () => new Error('za duża odpowiedź');
  if (odp.body && odp.body.getReader) {
    const czytnik = odp.body.getReader();
    const czesci = [];
    let razem = 0;
    for (;;) {
      const { done, value } = await czytnik.read();
      if (done) break;
      razem += value.length;
      if (razem > limit) { czytnik.cancel().catch(() => {}); throw zaDuza(); }
      czesci.push(value);
    }
    return Buffer.concat(czesci).toString('utf8');
  }
  const tresc = await odp.text();
  if (tresc.length > limit) throw zaDuza();
  return tresc;
}

function utworzTeksty({ fetch, czas = CZAS_NA_ODPOWIEDZ_MS, limitPamieci = LIMIT_PAMIECI,
  limitOdpowiedzi = LIMIT_ODPOWIEDZI, dbg = () => {} }) {
  const pamiec = new Map();     // klucz utworu → wynik albo null („brak tekstu”)

  // null = serwis nie ma takiego utworu; wyjątek = błąd sieci / serwisu (nie zapamiętujemy)
  async function zapytaj(sciezka, parametry) {
    const przerwij = new AbortController();
    let stoper;
    const zaDlugo = new Promise((_ok, blad) => {
      stoper = setTimeout(() => { przerwij.abort(); blad(new Error('brak odpowiedzi na czas')); }, czas);
    });
    const pobranie = (async () => {
      const odp = await fetch(ADRES + sciezka + '?' + new URLSearchParams(parametry),
        { headers: NAGLOWKI, redirect: 'error', signal: przerwij.signal });
      if (odp.status === 404 || odp.status === 400) return null;
      if (!odp.ok) throw new Error('HTTP ' + odp.status);
      return JSON.parse(await przeczytaj(odp, limitOdpowiedzi));
    })();
    try { return await Promise.race([pobranie, zaDlugo]); }
    finally { clearTimeout(stoper); }
  }

  async function szukaj(tytul, wykonawca, dlugosc) {
    let zwykly = null;
    let blad = false;
    const bezpiecznie = async (sciezka, parametry) => {
      try { return await zapytaj(sciezka, parametry); }
      catch (e) { blad = true; dbg('tekst:', e.message); return null; }
    };
    const roznica = (w) => (dlugosc ? Math.abs((Number(w.duration) || 0) - dlugosc) : 0);

    for (const k of kandydaci(tytul, wykonawca)) {
      if (!k.tytul || !k.wykonawca) continue;
      const parametry = { track_name: k.tytul, artist_name: k.wykonawca };

      // 1) dokładne trafienie
      const wpis = await bezpiecznie('get', dlugosc ? { ...parametry, duration: String(dlugosc) } : parametry);
      if (wpis) {
        if (wpis.instrumental) return { wynik: null, blad };
        const s = zeSynchronizacja(wpis);
        if (s) return { wynik: s, blad };
        zwykly = zwyklyTekst(wpis);
      }

      // 2) wyszukiwanie — bierzemy tylko wyniki z tym samym tytułem i wykonawcą
      const lista = await bezpiecznie('search', parametry);
      const pasujace = (Array.isArray(lista) ? lista : [])
        .filter((w) => w && !w.instrumental && samTytul(w.trackName, k.tytul) && samArtysta(w.artistName, k.wykonawca))
        .sort((a, b) => roznica(a) - roznica(b));
      // synchronizacja ma sens tylko przy (prawie) tej samej długości
      for (const w of pasujace) {
        const s = roznica(w) <= TOLERANCJA_DLUGOSCI_S && zeSynchronizacja(w);
        if (s) return { wynik: s, blad };
      }
      for (const w of pasujace) zwykly = zwykly || zwyklyTekst(w);
      if (zwykly || blad) break;
    }
    return { wynik: zwykly, blad };
  }

  // → { synchroniczny, linie: [{ czas?, tekst }] } albo null
  async function pobierz({ tytul, wykonawca, dlugosc } = {}) {
    if (!String(tytul || '').trim() || !String(wykonawca || '').trim()) return null;
    const d = Number(dlugosc) > 0 ? Number(dlugosc) : 0;
    if (d && (d < MIN_DLUGOSC_S || d > MAKS_DLUGOSC_S)) return null;
    const sekundy = Math.round(d);

    const klucz = JSON.stringify([tytul, wykonawca, sekundy]);
    if (pamiec.has(klucz)) {
      const w = pamiec.get(klucz);
      pamiec.delete(klucz); pamiec.set(klucz, w);       // ostatnio używany idzie na koniec kolejki
      return w;
    }
    const { wynik, blad } = await szukaj(tytul, wykonawca, sekundy);
    // przy błędzie sieci zapamiętujemy tylko pełny sukces — resztę warto sprawdzić jeszcze raz
    if (!blad || (wynik && wynik.synchroniczny)) {
      pamiec.set(klucz, wynik);
      if (pamiec.size > limitPamieci) pamiec.delete(pamiec.keys().next().value);
    }
    return wynik;
  }

  return { pobierz };
}

module.exports = { parsujLRC, indeksLinii, oczyscTytul, oczyscWykonawce, oczyscUtwor, kandydaci, samTytul, samArtysta, utworzTeksty };

/*
 * Atol — aplikacja ustawień (menu boczne + sekcje).
 * Każda zmiana idzie od razu do procesu głównego, który zapisuje ją na dysku i przekazuje wyspie.
 * Proces główny odsyła potem aktualny stan (panel:stan), więc to okno zawsze pokazuje prawdę.
 */
(function () {
  'use strict';

  var api = window.panel;
  var $ = function (id) { return document.getElementById(id); };
  var wszystkie = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  /* ====================== nawigacja między sekcjami ====================== */
  // Ostatnio otwarta sekcja jest pamiętana (localStorage) — gdy się nie da, zaczynamy od "Wyspa".

  // Podświetlenie w menu to jeden element, który przesuwa się sprężyście pod klikniętą pozycję
  var wskaznik = document.createElement('span');
  wskaznik.className = 'menu-wskaznik';
  document.querySelector('.menu').prepend(wskaznik);

  function przesunWskaznik(przycisk, odRazu) {
    if (!przycisk) return;
    if (odRazu) wskaznik.style.transition = 'none';
    wskaznik.style.transform = 'translateY(' + przycisk.offsetTop + 'px)';
    wskaznik.style.height = przycisk.offsetHeight + 'px';
    if (odRazu) { void wskaznik.offsetWidth; wskaznik.style.transition = ''; }
  }

  // Każdy element sekcji dostaje numer (--i) — CSS opóźnia jego wejście o numer × 45 ms (wjeżdżają kolejno)
  function numeruj(sekcja) {
    var i = 0;
    Array.prototype.forEach.call(sekcja.children, function (el) {
      el.style.setProperty('--i', i++);
      if (el.classList.contains('lista') || el.classList.contains('style')) {
        Array.prototype.forEach.call(el.children, function (w) { w.style.setProperty('--i', i++); });
      }
    });
  }

  function pokazSekcje(nazwa, odRazu) {
    var sekcja = document.querySelector('.sekcja[data-sekcja="' + nazwa + '"]');
    if (!sekcja) { nazwa = 'wyspa'; sekcja = document.querySelector('.sekcja[data-sekcja="wyspa"]'); }
    numeruj(sekcja);
    wszystkie('.sekcja').forEach(function (s) { s.classList.toggle('aktywna', s === sekcja); });
    var aktywny = null;
    wszystkie('.menu-poz').forEach(function (b) {
      var ten = b.dataset.sekcja === nazwa;
      b.setAttribute('aria-current', String(ten));
      if (ten) aktywny = b;
    });
    przesunWskaznik(aktywny, odRazu);

    // tytuł: podmiana z animacją (zdjęcie i ponowne nadanie klasy uruchamia animację od nowa)
    var nag = document.querySelector('.naglowek');
    nag.classList.remove('zmiana'); void nag.offsetWidth; nag.classList.add('zmiana');
    $('tytul-sekcji').textContent = sekcja.dataset.tytul;
    $('opis-sekcji').textContent = sekcja.dataset.opis;
    $('przewijanie').scrollTop = 0;
    try { localStorage.setItem('atol-sekcja', nazwa); } catch (e) { /* bez zapamiętywania */ }
  }

  wszystkie('.menu-poz').forEach(function (b) {
    b.addEventListener('click', function () { pokazSekcje(b.dataset.sekcja); });
  });

  var startowa = 'wyspa';
  try { startowa = localStorage.getItem('atol-sekcja') || 'wyspa'; } catch (e) { /* domyślna */ }
  pokazSekcje(startowa, true);
  window.addEventListener('resize', function () {
    przesunWskaznik(document.querySelector('.menu-poz[aria-current="true"]'), true);
  });

  /* ====================== ikony i listy ====================== */

  var IK = {
    nuta: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    bateria: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/><rect x="5" y="10" width="8" height="4" rx="1" fill="currentColor" stroke="none"/></svg>',
    cpu: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/></svg>',
    glosnik: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    zegar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
    piorun: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    schowek: '<svg viewBox="0 0 24 24"><path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5.6 5h12.8L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/></svg>'
  };

  var MODULY = [
    { klucz: 'muzyka', nazwa: 'Muzyka i filmy', opis: 'Okładka i wizualizator, gdy coś gra (Spotify, YouTube…)', ikona: 'nuta', kolor: 'rozowy' },
    { klucz: 'bateria', nazwa: 'Bateria', opis: 'Poziom i ładowanie w rozwiniętej wyspie', ikona: 'bateria', kolor: 'zielony' },
    { klucz: 'procesor', nazwa: 'Procesor', opis: 'Zużycie procesora w rozwiniętej wyspie', ikona: 'cpu', kolor: 'fiolet' },
    { klucz: 'glosnosc', nazwa: 'Głośność', opis: 'Poziom głośności w rozwiniętej wyspie', ikona: 'glosnik', kolor: 'niebieski' },
    { klucz: 'timer', nazwa: 'Minutnik', opis: '1 / 5 / 10 / 25 min, licznik na zwiniętej wyspie', ikona: 'zegar', kolor: 'pomarancz' },
    { klucz: 'schowek', nazwa: 'Schowek na pliki', opis: 'Przeciągnij plik na wyspę — poczeka tam (kółkiem w dół na rozwiniętej)', ikona: 'schowek', kolor: 'zolty' }
  ];

  var POWIADOMIENIA = [
    { klucz: 'ladowanie', nazwa: 'Ładowarka', opis: 'Podłączenie i odłączenie ładowarki', ikona: 'piorun', kolor: 'zielony' },
    { klucz: 'bateria', nazwa: 'Niski poziom baterii', opis: 'Poniżej 20% i 10%', ikona: 'bateria', kolor: 'zolty' },
    { klucz: 'glosnosc', nazwa: 'Zmiana głośności', opis: 'Pasek głośności przy każdej zmianie', ikona: 'glosnik', kolor: 'niebieski' },
    { klucz: 'timer', nazwa: 'Koniec minutnika', opis: 'Gdy minutnik dobiegnie końca', ikona: 'zegar', kolor: 'pomarancz' }
  ];

  // Wiersz: ikona, nazwa z opisem i przełącznik. Klik w przełącznik zmienia go od razu (nie czekamy na odpowiedź).
  function wiersz(o, id, naZmiane) {
    var d = document.createElement('div');
    d.className = 'wiersz';
    d.innerHTML =
      '<span class="ikona ' + o.kolor + '">' + IK[o.ikona] + '</span>' +
      '<div class="tekst"><strong></strong><span></span></div>' +
      '<button type="button" class="przelacznik" role="switch" aria-checked="false"></button>';
    d.querySelector('strong').textContent = o.nazwa;
    d.querySelector('.tekst span').textContent = o.opis || '';
    var p = d.querySelector('.przelacznik');
    p.id = id;
    p.setAttribute('aria-label', o.nazwa);
    p.addEventListener('click', function () {
      var nowa = p.getAttribute('aria-checked') !== 'true';
      p.setAttribute('aria-checked', String(nowa));
      naZmiane(nowa);
    });
    return d;
  }

  MODULY.forEach(function (m) {
    $('moduly').appendChild(wiersz(m, 'modul-' + m.klucz, function (v) { api.ustawModul(m.klucz, v); }));
  });
  POWIADOMIENIA.forEach(function (p) {
    $('powiadomienia').appendChild(wiersz(p, 'pow-' + p.klucz, function (v) { api.ustawPowiadomienie(p.klucz, v); }));
  });

  /* ====================== przyciski i przełączniki ====================== */

  $('autostart').addEventListener('click', function () {
    var nowa = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', String(nowa));
    api.ustawAutostart(nowa);
  });

  $('aktualizacje').addEventListener('click', function () {
    var nowa = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', String(nowa));
    api.ustawAktualizacje(nowa);
  });
  $('btn-aktualizuj').addEventListener('click', function () {
    api.aktualizuj(this.dataset.akcja === 'zainstaluj' ? 'zainstaluj' : 'sprawdz');
  });

  $('btn-uruchom').addEventListener('click', function () { api.wyspa('uruchom'); });
  $('btn-wylacz').addEventListener('click', function () { api.wyspa('wylacz'); });
  $('btn-resetuj').addEventListener('click', function () {
    var b = this;
    b.classList.remove('kreci'); void b.offsetWidth; b.classList.add('kreci');
    api.wyspa('resetuj');
  });

  // wygląd: kafelki "Pastylka" / "Notch" (jak przyciski opcji); podgląd ekranu u góry zmienia się razem z nimi
  var obecnyStyl = null, tPrzeskoku = null;
  function zaznaczStyl(styl) {
    wszystkie('.styl[data-styl]').forEach(function (k) { k.setAttribute('aria-checked', String(k.dataset.styl === styl)); });
    var ekran = $('ekran');
    if (obecnyStyl !== null && obecnyStyl !== styl) {
      // zmiana stylu: sprężyste "przeskoczenie" wyspy w podglądzie
      ekran.classList.remove('zmiana'); void ekran.offsetWidth; ekran.classList.add('zmiana');
      clearTimeout(tPrzeskoku);
      tPrzeskoku = setTimeout(function () { ekran.classList.remove('zmiana'); }, 650);
    }
    obecnyStyl = styl;
    ekran.classList.toggle('notch', styl === 'notch');
  }
  wszystkie('.styl[data-styl]').forEach(function (k) {
    k.addEventListener('click', function () { zaznaczStyl(k.dataset.styl); api.ustawWyglad(k.dataset.styl); });
  });

  /* ====================== stan z procesu głównego ====================== */

  function pokaz(s) {
    if (!s) return;
    var u = s.ustawienia;

    // nazwa i autor (jedno źródło: lib/marka.js w procesie głównym)
    if (s.nazwa) {
      document.title = s.nazwa;
      $('marka-nazwa').textContent = s.nazwa;
      $('o-nazwa').textContent = s.nazwa;
    }
    if (s.studio) { $('marka-studio').textContent = s.studio; $('o-studio').textContent = s.studio; }
    $('wersja-bok').textContent = 'wersja ' + (s.wersja || '—');
    $('o-wersja').textContent = 'wersja ' + (s.wersja || '—');

    // stan wyspy
    document.body.classList.toggle('wylaczona', !s.wyspaDziala);
    $('stan-tekst').textContent = s.wyspaDziala ? 'Wyspa działa' : 'Wyspa wyłączona';
    $('stan-mini').textContent = s.wyspaDziala ? 'Wyspa działa' : 'Wyspa wyłączona';
    $('stan-opis').textContent = s.wyspaDziala
      ? 'Jest na górze ekranu. Kliknij ją, żeby rozwinąć.'
      : 'Aplikacja czeka w zasobniku. Uruchom wyspę, żeby wróciła.';
    $('btn-uruchom').disabled = !!s.wyspaDziala;
    $('btn-wylacz').disabled = !s.wyspaDziala;

    zaznaczStyl(u.wyglad && u.wyglad.styl === 'notch' ? 'notch' : 'pastylka');

    // autostart
    var a = $('autostart');
    if (s.autostart === null) {
      a.disabled = true;
      a.setAttribute('aria-checked', 'false');
      $('autostart-opis').textContent = 'Dostępne w zainstalowanej aplikacji (teraz działa z kodu źródłowego).';
    } else {
      a.disabled = false;
      a.setAttribute('aria-checked', String(!!s.autostart));
      $('autostart-opis').textContent = 'Wyspa pojawi się sama po zalogowaniu, bez tego okna.';
    }

    // aktualizacje
    var ak = s.aktualizacja || { dostepna: false, stan: 'brak' };
    var wl = u.aktualizacje !== false;
    $('aktualizacje').setAttribute('aria-checked', String(wl));
    var tekst = 'Dostępne w zainstalowanej aplikacji (teraz działa z kodu źródłowego).';
    var przycisk = $('btn-aktualizuj');
    przycisk.dataset.akcja = ak.stan === 'gotowa' ? 'zainstaluj' : 'sprawdz';
    przycisk.textContent = ak.stan === 'gotowa' ? 'Uruchom ponownie i zainstaluj' : 'Sprawdź aktualizacje';
    przycisk.disabled = !ak.dostepna || !wl || ak.stan === 'sprawdzam' || ak.stan === 'pobieram';
    if (ak.dostepna) {
      if (!wl) tekst = 'Automatyczne aktualizacje są wyłączone.';
      else if (ak.stan === 'sprawdzam') tekst = 'Sprawdzam…';
      else if (ak.stan === 'pobieram') tekst = 'Pobieram wersję ' + (ak.wersja || '') + ' — ' + (ak.postep || 0) + '%';
      else if (ak.stan === 'gotowa') tekst = 'Wersja ' + (ak.wersja || '') + ' jest gotowa do instalacji.';
      else if (ak.stan === 'aktualna') tekst = 'Masz najnowszą wersję.';
      else if (ak.stan === 'blad') tekst = 'Nie udało się sprawdzić (brak internetu?). Spróbuj później.';
      else tekst = 'Sprawdzam automatycznie co kilka godzin.';
    }
    $('akt-status').textContent = tekst;
    $('aktualizacje-opis').textContent = ak.dostepna ? 'Atol sam sprawdza nowe wersje i pobiera je w tle.' : 'Dostępne w zainstalowanej aplikacji.';
    $('aktualizacje').disabled = !ak.dostepna;

    MODULY.forEach(function (m) { $('modul-' + m.klucz).setAttribute('aria-checked', String(!!u.moduly[m.klucz])); });
    POWIADOMIENIA.forEach(function (p) { $('pow-' + p.klucz).setAttribute('aria-checked', String(!!u.powiadomienia[p.klucz])); });
  }

  api.naStan(pokaz);
  api.stan().then(pokaz);
})();

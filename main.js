/*
 * Atol (studio SZykAI) — proces główny (Electron)
 * ------------------------------------------------------------------
 * Jedna aplikacja, dwie części:
 *  - WYSPA: przezroczyste okno na górze ekranu (zawsze na wierzchu, bez paska zadań, klikalne tylko
 *    w obrębie pastylki). Startuje od razu, także z autostartem Windows.
 *  - USTAWIENIA: zwykłe okno konfiguracji. Otwiera się przy ręcznym uruchomieniu (skrót), przy próbie
 *    uruchomienia drugiej kopii i z menu w zasobniku.
 *
 * Tu są też: zasobnik, autostart, zapis ustawień, schowek na pliki, odczyt baterii / głośności / procesora,
 * monitor zdarzeń (powiadomienia) i proces pomocnika (multimedia + wykrywanie pełnego ekranu).
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const os = require('os');
const si = require('systeminformation');   // bateria i procesor
const loudness = require('loudness');       // głośność systemowa w Windows
const { utworzDetektor } = require('./lib/zdarzenia');
const U = require('./lib/ustawienia');
const S = require('./lib/schowek');
const MARKA = require('./lib/marka');
const AKT = require('./lib/aktualizacje');
const { utworzFiltrGrania } = require('./lib/granie');
const { utworzTeksty } = require('./lib/tekst');

// ---------- stałe ----------
const SZEROKOSC_OKNA_WYSPY = 440;   // okno jest stałe i większe niż pastylka — zmienia się tylko pastylka (CSS)
const WYSOKOSC_OKNA_WYSPY = 520;    // przezroczysty obszar wokół pastylki przepuszcza kliknięcia
const BATERIA_CACHE_MS = 2000;      // si.battery() w Windows jest wolne
const MONITOR_CO_MS = 1000;         // co ile sprawdzamy baterię / głośność / procesor
const MEDIA_PAUZA_POKAZUJ_MS = 30000; // po pauzie wyspa jeszcze tyle pokazuje utwór (żeby dało się wznowić)
const CZAS_ANIMACJI_UKRYCIA_MS = 520; // tyle czeka proces główny, zanim naprawdę schowa okno po animacji
const AUTOSTART = { name: MARKA.AUTOSTART, args: ['--autostart'] };
const DEBUG = !!process.env.WYSPA_DEBUG;

const dbg = (...a) => { if (DEBUG) console.log('[atol]', ...a); };

let oknoWyspa = null;
let oknoUstawien = null;
let tacka = null;
let wyspaRozwinieta = false;
let pelnyEkran = false;
let koniecAplikacji = false;

app.setAppUserModelId(MARKA.ID);
app.setName(MARKA.NAZWA);
// Folder danych zostaje stary (%APPDATA%\wyspa) — ustawienia z poprzednich wersji się zachowują.
// Musi być ustawiony przed blokadą jednej kopii, bo ona też korzysta z tego folderu.
// Wyjątek: gdy podano --user-data-dir (testy z osobnym profilem) — wtedy zostaje podany folder.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), MARKA.FOLDER_DANYCH));
}

const uruchomionoZAutostartu = process.argv.includes('--autostart');

// Tylko jedna kopia aplikacji naraz. Druga próba uruchomienia (np. skrót) otwiera ustawienia.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => otworzUstawienia());
}

const ikonaSciezka = path.join(__dirname, 'build', 'icon.png');

const opcjeWeb = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
};

function zyje(okno) { return okno && !okno.isDestroyed(); }
function doWyspy(kanal, dane) { if (zyje(oknoWyspa)) oknoWyspa.webContents.send(kanal, dane); }
function doUstawien(kanal, dane) { if (zyje(oknoUstawien)) oknoUstawien.webContents.send(kanal, dane); }

/* ======================== ustawienia ======================== */

let ustawienia = U.domyslne();

function plikUstawien() { return path.join(app.getPath('userData'), 'ustawienia.json'); }

function wczytajUstawienia() {
  try { ustawienia = U.normalizuj(JSON.parse(fs.readFileSync(plikUstawien(), 'utf8'))); }
  catch (e) { ustawienia = U.domyslne(); /* brak pliku lub uszkodzony — domyślne */ }
}

// Aktualizacje z GitHub Releases (tylko w zainstalowanej aplikacji; błędy sieci są ciche)
const aktualizator = AKT.utworz({
  app,
  dbg: (...a) => dbg(...a),
  czyWlaczone: () => ustawienia.aktualizacje !== false,
  naZmiane: () => doUstawien('panel:stan', stanPanelu())
});

function zapiszUstawienia() {
  // zapis przez plik tymczasowy: wyłączenie prądu w trakcie zapisu nie zostawi połówki pliku
  try {
    const plik = plikUstawien();
    fs.mkdirSync(path.dirname(plik), { recursive: true });
    fs.writeFileSync(plik + '.tmp', JSON.stringify(ustawienia, null, 2), 'utf8');
    fs.renameSync(plik + '.tmp', plik);
  } catch (e) { dbg('zapis ustawień:', e.message); }
}

// Wysyła aktualne ustawienia do obu okien i dostosowuje to, co działa w tle.
function zastosujUstawienia() {
  doWyspy('wyspa:ustawienia', ustawienia);
  doUstawien('panel:stan', stanPanelu());
  wykryjZdarzenia = utworzDetektor();      // po włączeniu modułu nie porównuj ze starym odczytem
  wyslijDoPomocnika('media ' + (ustawienia.moduly.muzyka ? 1 : 0));
  if (!ustawienia.moduly.muzyka) ustawMedia(null);
  odswiezTekst(true);                      // przełącznik tekstu: pobierz od razu albo wyczyść
}

/* ===================== schowek na pliki ===================== */
// Pliki przeciągnięte na wyspę. Zapamiętujemy tylko ścieżki (lib/schowek.js) w osobnym pliku schowek.json.
// Do wyspy idzie lista z miniaturą (obrazki i PDF-y — podgląd, inne pliki — ikona z Windows)
// i informacją, czy plik dalej istnieje.

let schowek = [];
const miniatury = new Map();     // ścieżka → { mtime, url (data:), obraz (nativeImage do przeciągania) }

function plikSchowka() { return path.join(app.getPath('userData'), 'schowek.json'); }

function wczytajSchowek() {
  try { schowek = S.normalizuj(JSON.parse(fs.readFileSync(plikSchowka(), 'utf8'))); }
  catch (e) { schowek = []; }
}

function zapiszSchowek() {
  try {
    const plik = plikSchowka();
    fs.mkdirSync(path.dirname(plik), { recursive: true });
    fs.writeFileSync(plik + '.tmp', JSON.stringify({ wersja: 1, pliki: schowek }, null, 2), 'utf8');
    fs.renameSync(plik + '.tmp', plik);
  } catch (e) { dbg('zapis schowka:', e.message); }
}

async function miniatura(sciezka, st) {
  const m = miniatury.get(sciezka);
  if (m && m.mtime === st.mtimeMs) return m;
  let obraz = null;
  // folder: wyspa rysuje własną ikonę (Windows podaje dla folderów w Temp/OneDrive dziwne ikony dysków)
  if (st.isDirectory()) { const w = { mtime: st.mtimeMs, url: null, obraz: null }; miniatury.set(sciezka, w); return w; }
  if (st.isFile()) {
    try { obraz = await nativeImage.createThumbnailFromPath(sciezka, { width: 96, height: 96 }); }
    catch (e) { obraz = null; /* brak podglądu — weźmiemy ikonę */ }
  }
  if (!obraz || obraz.isEmpty()) {
    try { obraz = await app.getFileIcon(sciezka, { size: 'large' }); } catch (e) { obraz = null; }
  }
  const wynik = { mtime: st.mtimeMs, url: obraz && !obraz.isEmpty() ? obraz.toDataURL() : null, obraz };
  miniatury.set(sciezka, wynik);
  return wynik;
}

async function opisSchowka() {
  return Promise.all(schowek.map(async (p) => {
    let st = null;
    try { st = await fs.promises.stat(p.sciezka); } catch (e) { /* plik usunięty lub przeniesiony */ }
    const m = st ? await miniatura(p.sciezka, st) : null;
    return { sciezka: p.sciezka, nazwa: p.nazwa, istnieje: !!st, folder: !!(st && st.isDirectory()), ikona: m && m.url };
  }));
}

let numerSchowka = 0;
async function wyslijSchowek() {
  const nr = ++numerSchowka;
  const lista = await opisSchowka();
  if (nr === numerSchowka) doWyspy('wyspa:schowek', lista);    // starsza (wolniejsza) odpowiedź nie nadpisze nowszej
  for (const k of miniatury.keys()) if (!S.zawiera(schowek, k)) miniatury.delete(k);
}

/* ========================= autostart ========================= */
// Autostart działa tylko w zainstalowanej / spakowanej aplikacji. Przy `npm start` Windows zapisałby
// do autostartu "goły" electron.exe, który bez kodu wyspy pokazałby tylko okno powitalne Electrona.

function autostartDostepny() { return app.isPackaged; }

function czyAutostart() {
  if (!autostartDostepny()) return null;
  try {
    const s = app.getLoginItemSettings({ path: process.execPath, args: AUTOSTART.args });
    if (Array.isArray(s.launchItems)) {
      const nasz = s.launchItems.find((i) => i.name === AUTOSTART.name);
      if (nasz) return !!nasz.enabled;
    }
    return !!s.openAtLogin;
  } catch (e) { dbg('autostart odczyt:', e.message); return null; }
}

function ustawAutostart(wlacz) {
  if (!autostartDostepny()) return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!wlacz, path: process.execPath, args: AUTOSTART.args, name: AUTOSTART.name });
  } catch (e) { dbg('autostart zapis:', e.message); }
}

// Wpisy autostartu ze starej nazwy ("Wyspa") wskazują na plik, którego po aktualizacji już nie ma.
// Usuwamy je, a jeśli były włączone — włączamy autostart pod nową nazwą.
// UWAGA: getLoginItemSettings pokazuje tylko wpisy dla podanej ścieżki programu — stary wpis wskazuje na
// Wyspa.exe (w tym samym folderze), więc pytamy właśnie o tę ścieżkę.
function przeniesStareAutostarty() {
  if (!autostartDostepny()) return;
  try {
    let byl = false;
    for (const nazwa of MARKA.STARE_AUTOSTARTY) {
      const staraSciezka = path.join(path.dirname(process.execPath), nazwa + '.exe');
      const s = app.getLoginItemSettings({ path: staraSciezka, args: AUTOSTART.args });
      const stare = (s.launchItems || []).filter((i) => i.name === nazwa);
      if (!stare.length && !s.openAtLogin) continue;
      if (stare.some((i) => i.enabled) || (!stare.length && s.openAtLogin)) byl = true;
      app.setLoginItemSettings({ openAtLogin: false, name: nazwa, path: staraSciezka, args: AUTOSTART.args });
      dbg('usunięto stary wpis autostartu:', nazwa);
    }
    if (byl) { ustawAutostart(true); dbg('autostart przeniesiony na nazwę', AUTOSTART.name); }
  } catch (e) { dbg('przenoszenie autostartu:', e.message); }
}

// Przy pierwszym uruchomieniu zainstalowanej aplikacji włączamy autostart (domyślnie: tak).
// Później już nie dotykamy — decyduje przełącznik w ustawieniach.
function autostartDomyslny() {
  if (!autostartDostepny() || ustawienia.autostartUstawiony) return;
  ustawAutostart(true);
  ustawienia.autostartUstawiony = true;
  zapiszUstawienia();
}

/* ========================= wyspa ========================= */

function polozenieWyspy() {
  // wyśrodkowana na górze głównego monitora
  const b = screen.getPrimaryDisplay().bounds;
  return {
    x: Math.round(b.x + (b.width - SZEROKOSC_OKNA_WYSPY) / 2),
    y: b.y,
    width: SZEROKOSC_OKNA_WYSPY,
    height: WYSOKOSC_OKNA_WYSPY
  };
}

function utworzOknoWyspy() {
  if (zyje(oknoWyspa)) return;
  wyspaRozwinieta = false;
  oknoWyspa = new BrowserWindow({
    ...polozenieWyspy(),
    transparent: true,       // przezroczyste tło
    frame: false,            // bez ramki
    alwaysOnTop: true,       // zawsze na wierzchu
    skipTaskbar: true,       // bez przycisku na pasku zadań
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: false,        // nie kradnie fokusu (fokus bierze tylko na czas rozwinięcia)
    show: false,
    title: MARKA.NAZWA,
    backgroundColor: '#00000000',
    webPreferences: opcjeWeb
  });

  oknoWyspa.setAlwaysOnTop(true, 'screen-saver');
  // Domyślnie kliknięcia przechodzą przez okno. "forward" przekazuje ruch myszy do strony,
  // więc wie, kiedy kursor jest nad pastylką, i wtedy sama prosi o przechwytywanie kliknięć.
  oknoWyspa.setIgnoreMouseEvents(true, { forward: true });

  oknoWyspa.loadFile(path.join(__dirname, 'okna', 'wyspa.html'));
  oknoWyspa.once('ready-to-show', () => {
    if (!zyje(oknoWyspa)) return;
    doWyspy('wyspa:ustawienia', ustawienia);
    if (ostatniaMedia) doWyspy('wyspa:media', ostatniaMedia);
    if (pelnyEkran) return;                     // jest pełny ekran: pokażemy po jego zakończeniu
    oknoWyspa.showInactive();
    doWyspy('wyspa:widocznosc', true);           // animacja wysunięcia
  });

  // Klik gdziekolwiek poza rozwiniętą wyspą: okno traci fokus → zwijamy.
  oknoWyspa.on('blur', () => { if (wyspaRozwinieta) doWyspy('wyspa:zwin'); });
  oknoWyspa.on('closed', () => { oknoWyspa = null; wyspaRozwinieta = false; odswiezTacke(); doUstawien('panel:stan', stanPanelu()); });
}

let tUkrycia = null;

// Pełny ekran w innej aplikacji: wyspa płynnie znika (animacja w oknie), potem chowamy okno naprawdę,
// żeby nie wisiało nad grą. Po wyjściu z pełnego ekranu — pokazujemy i wysuwamy.
function ustawPelnyEkran(wartosc) {
  if (pelnyEkran === wartosc) return;
  pelnyEkran = wartosc;
  dbg('pełny ekran:', wartosc);
  if (!zyje(oknoWyspa)) return;
  clearTimeout(tUkrycia);
  if (wartosc) {
    doWyspy('wyspa:widocznosc', false);
    tUkrycia = setTimeout(() => { if (zyje(oknoWyspa) && pelnyEkran) oknoWyspa.hide(); }, CZAS_ANIMACJI_UKRYCIA_MS);
  } else {
    if (!oknoWyspa.isVisible()) oknoWyspa.showInactive();
    oknoWyspa.setAlwaysOnTop(true, 'screen-saver');   // po grze system mógł zmienić kolejność okien
    doWyspy('wyspa:widocznosc', true);
  }
}

function uruchomWyspe() {
  if (zyje(oknoWyspa)) return;
  utworzOknoWyspy();
  uruchomMonitor();
  // pomocnik startuje chwilę po wyspie — jego start (PowerShell + multimedia) nie nakłada się na start okna
  clearTimeout(tStartuPomocnika);
  tStartuPomocnika = setTimeout(uruchomPomocnika, 900);
  odswiezTacke();
  doUstawien('panel:stan', stanPanelu());
}

// Wyłączenie: animacja schowania, potem zamknięcie okna i zatrzymanie pracy w tle.
// Aplikacja dalej działa (zasobnik, ustawienia), więc wyspę można włączyć ponownie.
function wylaczWyspe(potem) {
  zatrzymajMonitor();
  zatrzymajPomocnika();
  const okno = oknoWyspa;
  if (!zyje(okno)) { if (potem) potem(); return; }
  doWyspy('wyspa:widocznosc', false);
  setTimeout(() => {
    if (zyje(okno)) okno.destroy();
    if (potem) potem();
  }, okno.isVisible() ? CZAS_ANIMACJI_UKRYCIA_MS : 0);
}

// Reset: gdy coś się zawiesi — zamykamy wyspę i pomocnika, i uruchamiamy wszystko od nowa.
function resetujWyspe() {
  dbg('reset wyspy');
  wylaczWyspe(() => setTimeout(uruchomWyspe, 150));
}

// Gdy zmieni się układ monitorów lub rozdzielczość — ustaw wyspę ponownie
function pilnujPolozenia() {
  const przesun = () => { if (zyje(oknoWyspa)) oknoWyspa.setBounds(polozenieWyspy()); };
  screen.on('display-metrics-changed', przesun);
  screen.on('display-added', przesun);
  screen.on('display-removed', przesun);
}

/* ===================== okno ustawień ===================== */

function otworzUstawienia() {
  if (zyje(oknoUstawien)) {
    if (oknoUstawien.isMinimized()) oknoUstawien.restore();
    oknoUstawien.show();
    oknoUstawien.focus();
    return;
  }
  oknoUstawien = new BrowserWindow({
    width: 860,                // menu boczne + treść sekcji
    height: 620,
    minWidth: 720,
    minHeight: 520,
    show: false,
    title: MARKA.NAZWA,
    icon: ikonaSciezka,
    backgroundColor: '#0b0b10',
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: false,
    // ciemny pasek tytułu: rysujemy go sami, systemowe przyciski (—, ✕) zostają
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#101016', symbolColor: '#c9c9d6', height: 44 },
    webPreferences: opcjeWeb
  });
  oknoUstawien.loadFile(path.join(__dirname, 'okna', 'ustawienia.html'));
  oknoUstawien.once('ready-to-show', () => { oknoUstawien.show(); oknoUstawien.focus(); });
  // zamknięcie ustawień nie kończy aplikacji — wyspa działa dalej w tle
  oknoUstawien.on('closed', () => { oknoUstawien = null; });
}

function stanPanelu() {
  return {
    aktualizacja: Object.assign({ dostepna: aktualizator.dostepne() }, aktualizator.stan()),
    ustawienia,
    autostart: czyAutostart(),                 // null = niedostępny (uruchomiono z kodu, nie z instalacji)
    wyspaDziala: zyje(oknoWyspa),
    wersja: app.getVersion(),
    nazwa: MARKA.NAZWA,
    studio: MARKA.STUDIO
  };
}

/* ===================== ikona w zasobniku ===================== */

function odswiezTacke() {
  if (!tacka) return;
  const dziala = zyje(oknoWyspa);
  tacka.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ustawienia', click: otworzUstawienia },
    { type: 'separator' },
    dziala
      ? { label: 'Wyłącz wyspę', click: () => wylaczWyspe() }
      : { label: 'Uruchom wyspę', click: uruchomWyspe },
    { label: 'Resetuj wyspę', click: resetujWyspe },
    { type: 'separator' },
    { label: 'Zakończ', click: () => app.quit() }
  ]));
}

function utworzTacke() {
  if (tacka) return;
  // osobna ikona 32×32 (build/generuj-ikone.js) — ostra także przy skalowaniu ekranu 200%
  let ikona = nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png'));
  if (ikona.isEmpty()) ikona = nativeImage.createFromPath(ikonaSciezka).resize({ width: 16, height: 16 });
  tacka = new Tray(ikona);
  tacka.setToolTip(MARKA.NAZWA + ' — kliknij, żeby otworzyć ustawienia');
  tacka.on('click', otworzUstawienia);       // lewy klik w ikonę = ustawienia
  odswiezTacke();
}

/* ====================== odczyt danych ====================== */
// Każda funkcja zwraca null, gdy danych nie da się odczytać — wyspa pokaże wtedy "brak danych".

let cacheBaterii = { czas: 0, wartosc: null };

async function odczytajBaterie() {
  if (Date.now() - cacheBaterii.czas < BATERIA_CACHE_MS) return cacheBaterii.wartosc;
  let wartosc = null;
  try {
    const b = await si.battery();
    if (b && b.hasBattery && typeof b.percent === 'number') {
      wartosc = { procent: Math.round(b.percent), laduje: !!b.isCharging };
    }
  } catch (e) { dbg('bateria:', e.message); }
  cacheBaterii = { czas: Date.now(), wartosc };
  return wartosc;
}

async function odczytajProcesor() {
  try {
    const c = await si.currentLoad();
    return typeof c.currentLoad === 'number' ? Math.round(c.currentLoad) : null;
  } catch (e) { dbg('procesor:', e.message); return null; }
}

async function odczytajGlosnosc() {
  try {
    const [poziom, wyciszony] = await Promise.all([loudness.getVolume(), loudness.getMuted()]);
    return typeof poziom === 'number' ? { poziom: Math.round(poziom), wyciszony: !!wyciszony } : null;
  } catch (e) { dbg('głośność:', e.message); return null; }
}

/* ================= monitor: dane + zdarzenia ================= */
// Baterię i głośność dostarcza POMOCNIK (co 0,1 s, tylko zmiany) — wtedy zdarzenie sprawdzamy od razu.
// Pętla co 1 s czyta procesor (tylko przy rozwiniętej wyspie) i — jako zapas, gdy pomocnik nie działa —
// baterię i głośność starymi, wolniejszymi bibliotekami.
// Baterię / głośność czytamy, gdy potrzebuje ich moduł ALBO powiadomienie (powiadomienia są niezależne od modułów).

let ostatnieDane = {};
let monitorTimer = null;
let monitorDziala = false;
let wykryjZdarzenia = utworzDetektor();
let zPomocnika = { bateria: undefined, glosnosc: undefined };   // undefined = pomocnik jeszcze nie przysłał

// Nowy odczyt baterii / głośności: odśwież kafelki i sprawdź, czy zaszło zdarzenie (powiadomienie)
function nowyOdczyt(bateria, glosnosc) {
  ostatnieDane = { ...ostatnieDane, bateria, glosnosc };
  doWyspy('wyspa:dane', ostatnieDane);
  const odczyt = {
    bateria: U.potrzebaBaterii(ustawienia) ? bateria || null : null,
    glosnosc: U.potrzebaGlosnosci(ustawienia) ? glosnosc || null : null
  };
  for (const z of wykryjZdarzenia(odczyt)) {
    if (!U.czyPokazac(ustawienia, z.typ)) continue;
    dbg('zdarzenie:', JSON.stringify(z));
    doWyspy('wyspa:powiadomienie', z);
  }
}

async function krokMonitora() {
  const m = ustawienia.moduly;
  // Zapasowe (wolne, ciężkie) odczyty TYLKO gdy pomocnik naprawdę nie działa — nie w czasie jego startu.
  // (si.battery() w Windows uruchamia PowerShella z WMI, loudness — osobny program; co sekundę to było odczuwalne.)
  const zapas = (pole) => zPomocnika[pole] === undefined && zapasDozwolony();
  const [bateria, glosnosc, procesor] = await Promise.all([
    !U.potrzebaBaterii(ustawienia) ? Promise.resolve(undefined)
      : zPomocnika.bateria !== undefined ? Promise.resolve(zPomocnika.bateria)
      : zapas('bateria') ? odczytajBaterie() : Promise.resolve(ostatnieDane.bateria),
    !U.potrzebaGlosnosci(ustawienia) ? Promise.resolve(undefined)
      : zPomocnika.glosnosc !== undefined ? Promise.resolve(zPomocnika.glosnosc)
      : zapas('glosnosc') ? odczytajGlosnosc() : Promise.resolve(ostatnieDane.glosnosc),
    m.procesor && wyspaRozwinieta ? odczytajProcesor() : Promise.resolve(ostatnieDane.procesor)
  ]);
  ostatnieDane.procesor = procesor;
  nowyOdczyt(bateria, glosnosc);
}

function uruchomMonitor() {
  if (monitorDziala) return;
  monitorDziala = true;
  const petla = async () => {
    if (!monitorDziala) return;
    try { await krokMonitora(); } catch (e) { dbg('monitor:', e.message); }
    if (monitorDziala) monitorTimer = setTimeout(petla, MONITOR_CO_MS);
  };
  petla();
}

function zatrzymajMonitor() {
  monitorDziala = false;
  clearTimeout(monitorTimer);
}

/* ========= pomocnik: multimedia (GSMTC) + pełny ekran ========= */
// Długo żyjący proces PowerShell (skrypty/pomocnik.ps1). Wypisuje linie JSON na stdout,
// komendy (pauza, następny, poprzedni, włącz/wyłącz multimedia) dostaje na stdin.

let pomocnik = null;
let pomocnikRestarty = 0;
let pomocnikStop = false;
let tStartuPomocnika = null;
let pomocnikCzasStartu = 0;
let systemNiedostepny = false;

// Czy wolno użyć zapasowych odczytów: pomocnik wyłączony (testy), nie umie czytać systemu, padł na stałe
// albo działa już 8 s i dalej nic nie przysłał.
function zapasDozwolony() {
  if (process.env.WYSPA_BEZ_POMOCNIKA || systemNiedostepny || pomocnikRestarty > 5) return true;
  return !!pomocnik && pomocnikCzasStartu > 0 && Date.now() - pomocnikCzasStartu > 8000;
}
let mediaNiedostepne = false;
let ostatnioGralo = 0;
let ostatniaMedia = null;          // ostatni stan wysłany do wyspy (null = nic nie gra)
let ostatniaOkladka = null;        // okładka przychodzi raz na utwór — pamiętamy ją (np. dla resetu wyspy)
const filtrGrania = utworzFiltrGrania();   // odsiewa chwilowe, nieaktualne „gra / pauza” z systemu

function sciezkaSkryptu(nazwa) {
  // PowerShell nie odczyta pliku z archiwum asar, więc skrypty są "rozpakowane" obok
  return path.join(__dirname, 'skrypty', nazwa).replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

function ustawMedia(stan) {
  ostatniaMedia = stan;
  doWyspy('wyspa:media', stan);
  odswiezTekst();
}

/* ----- tekst piosenki (lib/tekst.js, lrclib.net) — tylko przy włączonych modułach „muzyka” i „tekst” ----- */
const OPOZNIENIE_TEKSTU_MS = 800;   // przy szybkim przeskakiwaniu utworów nie pytamy o każdy
const teksty = utworzTeksty({ fetch: (adres, opcje) => fetch(adres, opcje), dbg: (...a) => dbg(...a) });
let ostatniTekst = null;            // stan wysłany do wyspy: null | { klucz, szukam } | { klucz, synchroniczny, linie }
let zapytanieTekstu = null;         // { klucz, dlugosc } — utwór, którego tekst pobieramy albo już pobraliśmy
let tTekstu = null;

function ustawTekst(t) {
  ostatniTekst = t;
  doWyspy('wyspa:tekst', t);
}

function odswiezTekst(odRazu) {
  const m = ostatniaMedia;
  if (!m || !ustawienia.moduly.tekst || !ustawienia.moduly.muzyka) {
    clearTimeout(tTekstu);
    zapytanieTekstu = null;
    if (ostatniTekst) ustawTekst(null);
    return;
  }
  const nowyUtwor = !zapytanieTekstu || zapytanieTekstu.klucz !== m.klucz;
  // ten sam utwór: pytamy ponownie tylko, gdy odtwarzacz dopiero teraz podał (inną) długość
  if (!nowyUtwor && !(m.dlugosc > 0 && Math.abs(m.dlugosc - zapytanieTekstu.dlugosc) > 3)) return;
  const z = { klucz: m.klucz, dlugosc: m.dlugosc };
  zapytanieTekstu = z;
  clearTimeout(tTekstu);
  if (nowyUtwor) ustawTekst({ klucz: z.klucz, szukam: true });
  tTekstu = setTimeout(async () => {
    if (zapytanieTekstu !== z || !ostatniaMedia) return;
    z.dlugosc = ostatniaMedia.dlugosc;
    const wynik = await teksty.pobierz(ostatniaMedia).catch((e) => { dbg('tekst:', e.message); return null; });
    if (zapytanieTekstu !== z) return;          // spóźniona odpowiedź: inny utwór albo wyłączony moduł
    ustawTekst(wynik ? { klucz: z.klucz, ...wynik } : null);
  }, odRazu ? 0 : OPOZNIENIE_TEKSTU_MS);
}

function przetworzMedia(s) {
  if (!ustawienia.moduly.muzyka) return;
  if (s.okladkaBlad) dbg('okładka:', s.okladkaBlad);
  if (!s.aktywna) { filtrGrania.wyczysc(); if (ostatniaMedia) ustawMedia(null); return; }

  const gra = filtrGrania.odczyt(s.klucz, !!s.gra, Date.now());
  if (gra) ostatnioGralo = Date.now();
  // pokazujemy, gdy gra; po pauzie jeszcze przez chwilę (żeby dało się wznowić z wyspy)
  const pokazuj = gra || (Date.now() - ostatnioGralo < MEDIA_PAUZA_POKAZUJ_MS);
  if (!pokazuj) { if (ostatniaMedia) ustawMedia(null); return; }

  if (!ostatniaMedia || ostatniaMedia.klucz !== s.klucz) ostatniaOkladka = null;
  if (s.okladka) ostatniaOkladka = s.okladka;

  ustawMedia({
    klucz: s.klucz, gra, tytul: s.tytul || '', wykonawca: s.wykonawca || '', album: s.album || '',
    zrodlo: s.zrodlo || '', pozycja: s.pozycja || 0, dlugosc: s.dlugosc || 0,
    poprzedni: !!s.poprzedni, nastepny: !!s.nastepny,
    okladka: ostatniaOkladka || undefined
  });
}

function przetworzLiniePomocnika(linia) {
  let s;
  try { s = JSON.parse(linia); } catch (e) { return; }
  switch (s.typ) {
    case 'media': przetworzMedia(s); break;
    case 'pelny': ustawPelnyEkran(!!s.wartosc); break;
    case 'glosnosc':
      zPomocnika.glosnosc = s.brak ? null : { poziom: s.poziom, wyciszony: !!s.wyciszony };
      if (U.potrzebaGlosnosci(ustawienia)) nowyOdczyt(ostatnieDane.bateria, zPomocnika.glosnosc);
      break;
    case 'zasilanie':
      // "laduje" = ładowarka podłączona (to dokładnie moment, w którym użytkownik wpina / wypina kabel)
      zPomocnika.bateria = s.bateria ? { procent: s.procent, laduje: !!s.ladowarka } : null;
      if (U.potrzebaBaterii(ustawienia)) nowyOdczyt(zPomocnika.bateria, ostatnieDane.glosnosc);
      break;
    case 'system-niedostepny':
      systemNiedostepny = true;
      dbg('głośność/zasilanie z pomocnika niedostępne:', s.powod);
      break;
    case 'media-niedostepne':
      mediaNiedostepne = true;
      dbg('multimedia niedostępne:', s.powod);
      ustawMedia(null);
      break;
  }
}

function wyslijDoPomocnika(komenda) {
  if (!pomocnik) return;
  try { pomocnik.stdin.write(komenda + '\n'); } catch (e) { dbg('komenda:', e.message); }
}

function uruchomPomocnika() {
  if (pomocnik || koniecAplikacji) return;
  if (process.env.WYSPA_BEZ_POMOCNIKA) return;   // tylko do testów: wyłącza prawdziwy odczyt systemu
  pomocnikStop = false;
  let proces;
  try {
    proces = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', sciezkaSkryptu('pomocnik.ps1')],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    dbg('nie można uruchomić PowerShella:', e.message);
    return;
  }
  pomocnik = proces;
  const start = Date.now();
  pomocnikCzasStartu = start;
  // niższy priorytet: przy dużym obciążeniu Windows najpierw obsłuży Twoje programy, a dopiero potem pomocnika
  try { os.setPriority(proces.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* bez znaczenia */ }
  readline.createInterface({ input: proces.stdout }).on('line', przetworzLiniePomocnika);
  proces.stderr.on('data', (d) => dbg('pomocnik stderr:', String(d).slice(0, 300)));
  proces.stdin.on('error', () => { /* proces już nie żyje */ });
  proces.on('error', (e) => { dbg('pomocnik błąd:', e.message); });
  proces.on('exit', (kod) => {
    if (pomocnik === proces) pomocnik = null;
    zPomocnika = { bateria: undefined, glosnosc: undefined };   // pętla wraca do zapasowych odczytów
    ustawMedia(null);
    ustawPelnyEkran(false);
    if (pomocnikStop || koniecAplikacji) return;
    // proces żył długo → licznik awarii od zera; kilka szybkich awarii z rzędu → poddajemy się
    if (Date.now() - start > 60000) pomocnikRestarty = 0;
    pomocnikRestarty++;
    dbg('pomocnik zakończył się, kod', kod, '— próba', pomocnikRestarty);
    if (pomocnikRestarty <= 5) setTimeout(() => { if (zyje(oknoWyspa)) uruchomPomocnika(); }, 2000 * pomocnikRestarty);
  });
  if (!ustawienia.moduly.muzyka) wyslijDoPomocnika('media 0');
}

function zatrzymajPomocnika() {
  pomocnikStop = true;
  clearTimeout(tStartuPomocnika);
  pomocnikCzasStartu = 0;
  const p = pomocnik;
  pomocnik = null;
  zPomocnika = { bateria: undefined, glosnosc: undefined };
  ustawMedia(null);
  pelnyEkran = false;        // po cichu: wyspa i tak jest właśnie wyłączana albo restartowana
  if (p) {
    try { p.stdin.end(); } catch (e) { /* ignoruj */ }     // pomocnik sam kończy się po zamknięciu wejścia
    setTimeout(() => { try { p.kill(); } catch (e) { /* już nie żyje */ } }, 1500);
  }
}

const DOZWOLONE_KOMENDY_MEDIA = new Set(['toggle', 'next', 'prev']);

/* ============================ IPC: wyspa ============================ */

// widoczna: czy okno już jest pokazane (np. strona została przeładowana) — wtedy wyspa od razu się wysuwa
ipcMain.handle('wyspa:start', async () => ({
  ustawienia, dane: ostatnieDane, schowek: await opisSchowka(),
  media: ostatniaMedia, tekst: ostatniTekst,       // czytane PO await — oba z tej samej chwili
  widoczna: zyje(oknoWyspa) && oknoWyspa.isVisible() && !pelnyEkran
}));

ipcMain.on('wyspa:rozwiniecie', (_e, rozwinieta) => {
  wyspaRozwinieta = !!rozwinieta;
  if (!zyje(oknoWyspa)) return;
  if (wyspaRozwinieta) {
    // Rozwinięta wyspa bierze fokus: wtedy klik gdziekolwiek indziej daje zdarzenie "blur" i ją zwija.
    oknoWyspa.setFocusable(true);
    oknoWyspa.focus();
    if (schowek.length) wyslijSchowek();     // plik mógł zostać w międzyczasie usunięty / przeniesiony
    if (ustawienia.moduly.procesor) {
      odczytajProcesor().then((c) => { ostatnieDane = { ...ostatnieDane, procesor: c }; doWyspy('wyspa:dane', ostatnieDane); });
    }
  } else {
    oknoWyspa.setFocusable(false);
  }
});

ipcMain.on('wyspa:media-komenda', (_e, komenda) => {
  if (!DOZWOLONE_KOMENDY_MEDIA.has(komenda)) return;
  dbg('komenda media:', komenda);
  if (komenda === 'toggle') filtrGrania.klikniecie(Date.now());
  wyslijDoPomocnika(komenda);
});

// ignoruj = true → kliknięcia przechodzą do aplikacji pod spodem; false → pastylka je przechwytuje
ipcMain.on('wyspa:ignoruj-mysz', (_e, ignoruj) => {
  if (!zyje(oknoWyspa)) return;
  if (ignoruj) oknoWyspa.setIgnoreMouseEvents(true, { forward: true });
  else oknoWyspa.setIgnoreMouseEvents(false);
});

// Schowek: wyspa podaje ścieżki upuszczonych plików (z preload: webUtils.getPathForFile).
ipcMain.on('wyspa:schowek-dodaj', (_e, sciezki) => {
  if (!ustawienia.moduly.schowek || !Array.isArray(sciezki)) return;
  const istniejace = sciezki.slice(0, 50).filter((s) => typeof s === 'string' && fs.existsSync(s));
  if (!istniejace.length) return;
  schowek = S.dodaj(schowek, istniejace, Date.now());
  dbg('schowek +', istniejace.length, '→', schowek.length);
  zapiszSchowek();
  wyslijSchowek();
});

ipcMain.on('wyspa:schowek-usun', (_e, sciezka) => {
  if (!S.zawiera(schowek, sciezka)) return;
  schowek = S.usun(schowek, sciezka);
  zapiszSchowek();
  wyslijSchowek();
});

// Otwieranie i przeciąganie — tylko plików, które naprawdę są w schowku (strona nie poda dowolnej ścieżki).
ipcMain.on('wyspa:schowek-otworz', (_e, sciezka) => {
  if (!S.zawiera(schowek, sciezka)) return;
  shell.openPath(sciezka).then((blad) => { if (blad) dbg('otwieranie:', blad); });
});

ipcMain.on('wyspa:schowek-pokaz', (_e, sciezka) => {
  if (S.zawiera(schowek, sciezka)) shell.showItemInFolder(sciezka);
});

// Przeciągnięcie pliku Z wyspy do innej aplikacji (Eksplorator, przeglądarka, komunikator…).
// Windows potrzebuje obrazka pod kursorem — miniatura pliku albo ikona Atola.
ipcMain.on('wyspa:schowek-przeciagnij', (e, sciezka) => {
  if (!S.zawiera(schowek, sciezka) || !fs.existsSync(sciezka)) return;
  const m = miniatury.get(sciezka);
  let ikona = m && m.obraz && !m.obraz.isEmpty() ? m.obraz : nativeImage.createFromPath(ikonaSciezka);
  if (!ikona.isEmpty()) ikona = ikona.resize({ width: 48 });
  e.sender.startDrag({ file: sciezka, icon: ikona });
});

/* ========================== IPC: ustawienia ========================== */

ipcMain.handle('panel:stan', () => stanPanelu());

ipcMain.on('panel:modul', (_e, klucz, wartosc) => {
  if (!U.MODULY.includes(klucz) || typeof wartosc !== 'boolean') return;
  ustawienia.moduly[klucz] = wartosc;
  zapiszUstawienia();
  zastosujUstawienia();
});

ipcMain.on('panel:powiadomienie', (_e, klucz, wartosc) => {
  if (!U.POWIADOMIENIA.includes(klucz) || typeof wartosc !== 'boolean') return;
  ustawienia.powiadomienia[klucz] = wartosc;
  zapiszUstawienia();
  zastosujUstawienia();
});

ipcMain.on('panel:autostart', (_e, wartosc) => {
  ustawAutostart(!!wartosc);
  doUstawien('panel:stan', stanPanelu());
});

// Wygląd wyspy: 'pastylka' albo 'notch' — wyspa sama animuje przejście
ipcMain.on('panel:wyglad', (_e, styl) => {
  if (!U.STYLE.includes(styl)) return;
  ustawienia.wyglad = { styl };
  zapiszUstawienia();
  zastosujUstawienia();
});

ipcMain.on('panel:aktualizacje', (_e, wartosc) => {
  if (typeof wartosc !== 'boolean') return;
  ustawienia.aktualizacje = wartosc;
  zapiszUstawienia();
  aktualizator.zastosuj();
  doUstawien('panel:stan', stanPanelu());
});

ipcMain.on('panel:aktualizuj', (_e, akcja) => {
  if (akcja === 'sprawdz') aktualizator.sprawdz();
  else if (akcja === 'zainstaluj') aktualizator.zainstalujTeraz();
});

ipcMain.on('panel:wyspa', (_e, akcja) => {
  if (akcja === 'uruchom') uruchomWyspe();
  else if (akcja === 'wylacz') wylaczWyspe();
  else if (akcja === 'resetuj') resetujWyspe();
});

/* ========================= cykl życia ========================= */

app.whenReady().then(() => {
  wczytajUstawienia();
  wczytajSchowek();
  przeniesStareAutostarty();
  autostartDomyslny();
  pilnujPolozenia();
  odczytajProcesor();          // "rozgrzewka": pierwszy odczyt CPU jest niedokładny
  utworzTacke();
  uruchomWyspe();
  aktualizator.zastosuj();
  if (!uruchomionoZAutostartu) otworzUstawienia();

  // Tryb testowy (tylko z WYSPA_DEBUG=1): pozwala z zewnątrz wstrzyknąć zdarzenie, stan multimediów itp.
  if (DEBUG) {
    global.__wyspaTest = {
      zdarzenie: (z) => doWyspy('wyspa:powiadomienie', z),
      media: (m) => ustawMedia(m),
      tekst: () => ostatniTekst,
      dane: (d) => { ostatnieDane = d; doWyspy('wyspa:dane', d); },
      pelny: (v) => ustawPelnyEkran(!!v),
      pomocnik: (obiekt) => przetworzLiniePomocnika(JSON.stringify(obiekt)),   // udaje linię z pomocnika
      ustawienia: () => JSON.parse(JSON.stringify(ustawienia)),
      plikUstawien: plikUstawien(),
      schowek: () => JSON.parse(JSON.stringify(schowek)),
      dodajDoSchowka: (sciezki) => { schowek = S.dodaj(schowek, sciezki, Date.now()); zapiszSchowek(); return wyslijSchowek(); },
      okna: () => ({ wyspa: zyje(oknoWyspa), wyspaWidoczna: zyje(oknoWyspa) && oknoWyspa.isVisible(), ustawienia: zyje(oknoUstawien) })
    };
  }
});

app.on('before-quit', () => {
  koniecAplikacji = true;
  zatrzymajMonitor();
  zatrzymajPomocnika();
});

// Wyspa działa w tle z ikoną w zasobniku: zamknięcie okien nie kończy aplikacji.
// Kończy ją tylko "Zakończ" w zasobniku.
app.on('window-all-closed', () => { /* celowo nic */ });

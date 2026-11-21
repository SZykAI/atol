/*
 * Atol — automatyczne aktualizacje z GitHub Releases (electron-updater).
 * Działa tylko w zainstalowanej aplikacji (app.isPackaged). Błędy sieci łapiemy po cichu.
 * Stan: { stan: 'brak|sprawdzam|pobieram|gotowa|aktualna|blad', wersja, postep }
 */
const PIERWSZE_SPRAWDZENIE_MS = 30 * 1000;
const CO_ILE_MS = 4 * 60 * 60 * 1000;

function utworz({ app, dbg, czyWlaczone, naZmiane }) {
  let updater = null;
  let stan = { stan: 'brak', wersja: '', postep: 0 };
  let tPierwsze = null;
  let tCykl = null;

  function ustaw(zmiany) {
    stan = Object.assign({}, stan, zmiany);
    try { naZmiane(stan); } catch (e) { /* okno mogło się zamknąć */ }
  }

  function wczytaj() {
    if (updater) return updater;
    try {
      updater = require('electron-updater').autoUpdater;
    } catch (e) { dbg('aktualizacje: brak modułu:', e.message); return null; }
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.logger = null;
    updater.on('checking-for-update', () => ustaw({ stan: 'sprawdzam' }));
    updater.on('update-available', (i) => ustaw({ stan: 'pobieram', wersja: i && i.version || '', postep: 0 }));
    updater.on('update-not-available', () => ustaw({ stan: 'aktualna', postep: 0 }));
    updater.on('download-progress', (p) => ustaw({ stan: 'pobieram', postep: Math.round(p && p.percent || 0) }));
    updater.on('update-downloaded', (i) => ustaw({ stan: 'gotowa', wersja: i && i.version || stan.wersja, postep: 100 }));
    updater.on('error', (e) => { dbg('aktualizacje błąd:', e && e.message); ustaw({ stan: 'blad' }); });
    return updater;
  }

  function sprawdz() {
    if (!app.isPackaged || !czyWlaczone()) return;
    if (stan.stan === 'sprawdzam' || stan.stan === 'pobieram' || stan.stan === 'gotowa') return;
    const u = wczytaj();
    if (!u) return;
    try {
      const obietnica = u.checkForUpdates();
      if (obietnica && obietnica.catch) obietnica.catch((e) => { dbg('aktualizacje:', e && e.message); ustaw({ stan: 'blad' }); });
    } catch (e) { dbg('aktualizacje:', e.message); ustaw({ stan: 'blad' }); }
  }

  function zainstalujTeraz() {
    if (stan.stan !== 'gotowa' || !updater) return;
    try { updater.quitAndInstall(true, true); } catch (e) { dbg('aktualizacje install:', e.message); }
  }

  // uruchamia / zatrzymuje cykliczne sprawdzanie zależnie od ustawienia
  function zastosuj() {
    clearTimeout(tPierwsze);
    clearInterval(tCykl);
    tPierwsze = tCykl = null;
    if (!app.isPackaged || !czyWlaczone()) return;
    tPierwsze = setTimeout(sprawdz, PIERWSZE_SPRAWDZENIE_MS);
    tCykl = setInterval(sprawdz, CO_ILE_MS);
  }

  return { sprawdz, zainstalujTeraz, zastosuj, stan: () => stan, dostepne: () => !!app.isPackaged };
}

module.exports = { utworz };

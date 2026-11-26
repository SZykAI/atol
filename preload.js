/*
 * Wyspa — most między stronami a procesem głównym.
 * Strony nie mają dostępu do Node.js; mogą wywołać tylko te funkcje.
 *   window.wyspa — dla okna wyspy
 *   window.panel — dla okna ustawień
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const nasluch = (kanal) => (callback) => ipcRenderer.on(kanal, (_e, dane) => callback(dane));

contextBridge.exposeInMainWorld('wyspa', {
  start: () => ipcRenderer.invoke('wyspa:start'),            // ustawienia + ostatnie dane + multimedia
  naUstawienia: nasluch('wyspa:ustawienia'),
  naWidocznosc: nasluch('wyspa:widocznosc'),                 // true = pokaż (wysuń), false = schowaj
  naZwin: nasluch('wyspa:zwin'),                             // klik poza rozwiniętą wyspą
  ignorujMysz: (ignoruj) => ipcRenderer.send('wyspa:ignoruj-mysz', !!ignoruj),
  ustawRozwiniecie: (rozwinieta) => ipcRenderer.send('wyspa:rozwiniecie', !!rozwinieta),

  naDane: nasluch('wyspa:dane'),
  naPowiadomienie: nasluch('wyspa:powiadomienie'),
  naMedia: nasluch('wyspa:media'),
  mediaKomenda: (komenda) => ipcRenderer.send('wyspa:media-komenda', String(komenda)),
  naTekst: nasluch('wyspa:tekst'),                           // tekst piosenki (albo „szukam” / null)

  // schowek na pliki
  naSchowek: nasluch('wyspa:schowek'),
  // ścieżka upuszczonego pliku (od Electrona 32 nie ma już File.path — trzeba zapytać webUtils)
  sciezkaPliku: (plik) => { try { return webUtils.getPathForFile(plik) || ''; } catch (e) { return ''; } },
  schowekDodaj: (sciezki) => ipcRenderer.send('wyspa:schowek-dodaj', Array.from(sciezki || [], String)),
  schowekUsun: (sciezka) => ipcRenderer.send('wyspa:schowek-usun', String(sciezka)),
  schowekOtworz: (sciezka) => ipcRenderer.send('wyspa:schowek-otworz', String(sciezka)),
  schowekPokaz: (sciezka) => ipcRenderer.send('wyspa:schowek-pokaz', String(sciezka)),
  schowekPrzeciagnij: (sciezka) => ipcRenderer.send('wyspa:schowek-przeciagnij', String(sciezka))
});

contextBridge.exposeInMainWorld('panel', {
  stan: () => ipcRenderer.invoke('panel:stan'),
  naStan: nasluch('panel:stan'),
  ustawModul: (klucz, wartosc) => ipcRenderer.send('panel:modul', String(klucz), !!wartosc),
  ustawPowiadomienie: (klucz, wartosc) => ipcRenderer.send('panel:powiadomienie', String(klucz), !!wartosc),
  ustawAutostart: (wartosc) => ipcRenderer.send('panel:autostart', !!wartosc),
  ustawWyglad: (styl) => ipcRenderer.send('panel:wyglad', String(styl)),     // 'pastylka' | 'notch'
  ustawAktualizacje: (wartosc) => ipcRenderer.send('panel:aktualizacje', !!wartosc),
  aktualizuj: (akcja) => ipcRenderer.send('panel:aktualizuj', String(akcja)),   // 'sprawdz' | 'zainstaluj'
  wyspa: (akcja) => ipcRenderer.send('panel:wyspa', String(akcja))
});

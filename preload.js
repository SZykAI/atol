/*
 * Wyspa — most między stronami a procesem głównym.
 * Strony nie mają dostępu do Node.js; mogą wywołać tylko te funkcje.
 *   window.wyspa — dla okna wyspy
 *   window.panel — dla okna ustawień
 */
const { contextBridge, ipcRenderer } = require('electron');

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
  mediaKomenda: (komenda) => ipcRenderer.send('wyspa:media-komenda', String(komenda))
});

contextBridge.exposeInMainWorld('panel', {
  stan: () => ipcRenderer.invoke('panel:stan'),
  naStan: nasluch('panel:stan'),
  ustawModul: (klucz, wartosc) => ipcRenderer.send('panel:modul', String(klucz), !!wartosc),
  ustawPowiadomienie: (klucz, wartosc) => ipcRenderer.send('panel:powiadomienie', String(klucz), !!wartosc),
  ustawAutostart: (wartosc) => ipcRenderer.send('panel:autostart', !!wartosc),
  ustawWyglad: (styl) => ipcRenderer.send('panel:wyglad', String(styl)),     // 'pastylka' | 'notch'
  wyspa: (akcja) => ipcRenderer.send('panel:wyspa', String(akcja))
});

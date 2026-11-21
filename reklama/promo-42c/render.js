/*
 * Atol 4.2 — promo. Renderer filmu klatka po klatce.
 *
 * Strona scena.html liczy KAŻDĄ klatkę deterministycznie (czas = numer klatki / 60), więc film nie zależy od
 * szybkości komputera — nic nie "gubi klatek". Electron rysuje stronę poza ekranem (offscreen), zrzut każdej
 * klatki idzie surowymi pikselami do ffmpeg, a muzyka (składana w muzyka.js przez Web Audio) jest dokładana na końcu.
 *
 * Uruchomienie (z folderu reklama):
 *   ..\node_modules\electron\dist\electron.exe .                     → cały film: Atol-reklama.mp4
 *   ..\node_modules\electron\dist\electron.exe . --podglad=1,8.5,12  → tylko zdjęcia tych sekund (folder podglad\)
 *   ..\node_modules\electron\dist\electron.exe . --od=8 --do=16      → fragment filmu (podglad\fragment.mp4)
 */
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('force-device-scale-factor', '1');   // 1920×1080 pikseli, niezależnie od DPI ekranu
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const W = 1920, H = 1080, FPS = 60;
const FFMPEG = require('../node_modules/ffmpeg-static');

function arg(nazwa) {
  const a = process.argv.find((x) => x.startsWith('--' + nazwa + '='));
  return a ? a.slice(nazwa.length + 3) : null;
}

function log(...x) { process.stdout.write(x.join(' ') + '\n'); }

app.whenReady().then(async () => {
  const okno = new BrowserWindow({
    width: W, height: H, show: false, frame: false, useContentSize: true, enableLargerThanScreen: true,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: false }
  });
  okno.webContents.setFrameRate(FPS);
  okno.webContents.on('console-message', (e) => log('[strona]', e.message || ''));
  await okno.loadFile(path.join(__dirname, 'scena.html'));
  await okno.webContents.executeJavaScript('przygotuj()');
  const DLUGOSC = await okno.webContents.executeJavaScript('DLUGOSC');
  const wszystkich = Math.round(DLUGOSC * FPS);

  const katPodglad = path.join(__dirname, 'podglad');
  fs.mkdirSync(katPodglad, { recursive: true });

  // Klatkę bierzemy ze zdarzenia "paint" PO wymuszonym przerysowaniu (invalidate). capturePage potrafił oddać
  // poprzednią klatkę (sprawdzone: obraz spóźniony o jedno wywołanie). Czekamy na 2 malowania — drugie na pewno
  // zawiera już stan ustawiony przez klatka(n).
  let czeka = null;
  okno.webContents.on('paint', (e, brudne, obraz) => { if (czeka) { const f = czeka; czeka = null; f(obraz); } });
  const malowanie = () => new Promise((ok, zle) => {
    const t = setTimeout(() => { czeka = null; zle(new Error('brak malowania')); }, 3000);
    czeka = (obraz) => { clearTimeout(t); ok(obraz); };
    okno.webContents.invalidate();
  });
  // Każda klatka ma w lewym górnym rogu 1 piksel z zakodowanym numerem (scena.js). Czekamy, aż namalowany obraz
  // ma właściwy numer — dopiero to daje pewność, że to TA klatka. Potem piksel zastępujemy sąsiednim.
  const zgodny = (bmp, n) => Math.abs(bmp[2] - (n % 64) * 4) <= 1 && Math.abs(bmp[1] - (Math.floor(n / 64) % 64) * 4) <= 1;
  let powtorek = 0;
  const zrzut = async (n) => {
    await okno.webContents.executeJavaScript('klatka(' + n + ')');
    for (let proba = 0; proba < 60; proba++) {
      if (proba) { okno.webContents.invalidate(); await new Promise((ok) => setTimeout(ok, 8)); }
      const img = await okno.webContents.capturePage();
      const r = img.getSize();
      if (r.width !== W || r.height !== H) throw new Error('Zły rozmiar klatki: ' + r.width + '×' + r.height);
      const bmp = img.toBitmap();
      if (process.env.DEBUG_ZN && proba < 3) log('znacznik', n, [...bmp.subarray(0, 8)].join(','), 'oczekiwane R', (n % 64) * 4, 'G', (Math.floor(n / 64) % 64) * 4);
      if (zgodny(bmp, n)) {
        bmp.copy(bmp, 0, 4, 8);                    // znacznik → kolor sąsiedniego piksela
        powtorek += proba;
        return bmp;
      }
    }
    throw new Error('Nie udało się złapać klatki ' + n);
  };
  const { nativeImage } = require('electron');
  const doPng = (bmp) => nativeImage.createFromBitmap(bmp, { width: W, height: H }).toPNG();

  // ---------- tryb podglądu: pojedyncze zdjęcia ----------
  const podglad = arg('podglad');
  if (podglad) {
    const czasy = podglad.split(',').map(Number).sort((a, b) => a - b);
    for (const t of czasy) {
      const bmp = await zrzut(Math.round(t * FPS));
      fs.writeFileSync(path.join(katPodglad, 'k-' + t.toFixed(2) + '.png'), doPng(bmp));
      log('zdjęcie', t.toFixed(2), 's');
    }
    app.exit(0);
    return;
  }

  // ---------- przebieg wstępny: zbieramy czasy kliknięć / dzwonków (window.MUZ), potem czysta strona ----------
  let muz = null;
  if (!arg('bez-muzyki')) {
    await okno.webContents.executeJavaScript('klatka(' + (wszystkich - 1) + ', true)');
    muz = await okno.webContents.executeJavaScript('JSON.stringify(MUZ)');
    log('MUZ:', muz.length, 'znaków');
    await okno.loadFile(path.join(__dirname, 'scena.html'));
    await okno.webContents.executeJavaScript('przygotuj()');
    await okno.webContents.executeJavaScript('window.MUZ = ' + muz);
  }

  // ---------- muzyka ----------
  const plikWav = path.join(__dirname, 'muzyka.wav');
  if (!arg('bez-muzyki')) {
    const t0 = Date.now();
    const b64 = await okno.webContents.executeJavaScript('zrobMuzyke()');
    fs.writeFileSync(plikWav, Buffer.from(b64, 'base64'));
    log('muzyka gotowa w', ((Date.now() - t0) / 1000).toFixed(1), 's');
    if (arg('tylko-muzyka')) { app.exit(0); return; }
  }

  // ---------- film ----------
  const od = arg('od') ? Math.round(Number(arg('od')) * FPS) : 0;
  const doK = arg('do') ? Math.round(Number(arg('do')) * FPS) : wszystkich;
  const fragment = od > 0 || doK < wszystkich;
  const wynik = fragment ? path.join(katPodglad, 'fragment.mp4') : path.join(__dirname, '..', 'Atol-4.2-promo-v3.mp4');

  const argsy = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', W + 'x' + H, '-r', String(FPS), '-i', '-',
    '-ss', (od / FPS).toFixed(4), '-i', plikWav,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', fragment ? 'veryfast' : 'slow', '-crf', fragment ? '20' : '14',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'animation',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart',
    '-metadata', 'title=Atol 4.2 — promo v3', '-metadata', 'artist=studio SZykAI',
    wynik
  ];
  const ff = spawn(FFMPEG, argsy, { stdio: ['pipe', 'inherit', 'inherit'] });
  const zakonczony = new Promise((ok) => ff.on('close', ok));

  const start = Date.now();
  // przewiń stan sceny do pierwszej klatki fragmentu (sprężyny liczą się od początku)
  if (od > 0) await okno.webContents.executeJavaScript('klatka(' + (od - 1) + ', true)');
  for (let n = od; n < doK; n++) {
    const bufor = await zrzut(n);
    if (!ff.stdin.write(bufor)) await new Promise((ok) => ff.stdin.once('drain', ok));
    if (n % 60 === 0) {
      const ile = n - od + 1, minelo = (Date.now() - start) / 1000;
      log('klatka', n, '/', doK, '·', (ile / minelo).toFixed(1), 'kl./s · dodatkowych malowań:', powtorek);
    }
  }
  ff.stdin.end();
  const kod = await zakonczony;
  log(kod === 0 ? 'GOTOWE: ' + wynik : 'ffmpeg zakończył się kodem ' + kod);
  app.exit(kod === 0 ? 0 : 1);
}).catch((e) => { log('BŁĄD', e && e.stack || e); app.exit(1); });

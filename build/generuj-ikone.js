/*
 * Generator ikony Wyspy (uruchamiany Electronem, bo rysuje na <canvas>):
 *   node_modules\electron\dist\electron.exe build\generuj-ikone.js
 * Tworzy:
 *   build/icon.png  — 256×256 (okna, instalator)
 *   build/icon.ico  — 16, 20, 24, 32, 40, 48, 64, 128, 256 px (każdy rozmiar rysowany osobno, nie skalowany)
 *   build/tray.png  — 32×32 do zasobnika (ostre przy skalowaniu ekranu 200%)
 *   build/podglad-ikony.png — wszystkie rozmiary obok siebie (do obejrzenia)
 *
 * Projekt: zaokrąglony kwadrat w stylu Windows 11 z ciemnym fioletowo-granatowym gradientem, a na nim
 * czarna "dynamiczna wyspa" z delikatną poświatą; w dużych rozmiarach — okładka i słupki muzyki.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROZMIARY = [16, 20, 24, 32, 40, 48, 64, 128, 256];

// Kod rysujący (wykonywany w ukrytym oknie)
const RYSUJ = `
function rysuj(S, tryb) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const tray = tryb === 'tray';
  const m = tray ? 0 : Math.max(1, S * 0.04);             // margines
  const R = (S - 2 * m) * 0.24;                            // zaokrąglenie kwadratu
  function prost(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

  // tło: gradient fiolet → granat
  prost(m, m, S - 2 * m, S - 2 * m, R);
  const tlo = g.createLinearGradient(m, m, S - m, S - m);
  tlo.addColorStop(0, '#4a32a8'); tlo.addColorStop(0.55, '#241a5c'); tlo.addColorStop(1, '#0c0a1f');
  g.fillStyle = tlo; g.fill();
  // światło u góry
  g.save(); prost(m, m, S - 2 * m, S - 2 * m, R); g.clip();
  const sw = g.createRadialGradient(S * 0.5, S * 0.05, 0, S * 0.5, S * 0.05, S * 0.75);
  sw.addColorStop(0, 'rgba(170, 140, 255, .45)'); sw.addColorStop(1, 'rgba(170, 140, 255, 0)');
  g.fillStyle = sw; g.fillRect(0, 0, S, S); g.restore();
  // cienka jasna krawędź (tylko duże rozmiary)
  if (S >= 48) { prost(m + .5, m + .5, S - 2 * m - 1, S - 2 * m - 1, R); g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = Math.max(1, S / 128); g.stroke(); }

  // pastylka: im mniejsza ikona, tym względnie większa (żeby była czytelna)
  const maly = S < 40;
  const pw = S * (maly ? 0.74 : 0.64), ph = S * (maly ? 0.28 : 0.21);
  const px = (S - pw) / 2, py = S * 0.5 - ph / 2;
  g.save();
  g.shadowColor = 'rgba(140, 110, 255, .75)'; g.shadowBlur = S * 0.09; g.shadowOffsetY = S * 0.015;
  prost(px, py, pw, ph, ph / 2); g.fillStyle = '#000'; g.fill();
  g.restore();
  if (S >= 32) { prost(px + .5, py + .5, pw - 1, ph - 1, ph / 2); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = Math.max(.75, S / 200); g.stroke(); }

  // okładka (różowo-pomarańczowa) po lewej
  if (S >= 20) {
    const ok = ph * 0.62, ox = px + ph * 0.19, oy = py + (ph - ok) / 2;
    const gr = g.createLinearGradient(ox, oy, ox + ok, oy + ok);
    gr.addColorStop(0, '#ff4f9a'); gr.addColorStop(1, '#ffa62b');
    prost(ox, oy, ok, ok, ok * 0.28); g.fillStyle = gr; g.fill();
  }
  // słupki muzyki po prawej
  if (S >= 40) {
    const wys = [0.42, 0.78, 0.56, 0.9], bw = ph * 0.11, gap = ph * 0.085;
    let bx = px + pw - ph * 0.3 - (wys.length * bw + (wys.length - 1) * gap);
    wys.forEach(function (h) {
      const bh = ph * 0.58 * h;
      prost(bx, py + (ph - bh) / 2, bw, bh, bw / 2); g.fillStyle = '#7fe6ff'; g.fill();
      bx += bw + gap;
    });
  }
  return c.toDataURL('image/png');
}
`;

// Pakowanie PNG-ów do pliku .ico (format z obrazami PNG — obsługiwany przez Windows Vista i nowsze)
function zrobIco(obrazy) {
  const naglowek = Buffer.alloc(6 + 16 * obrazy.length);
  naglowek.writeUInt16LE(0, 0); naglowek.writeUInt16LE(1, 2); naglowek.writeUInt16LE(obrazy.length, 4);
  let przesuniecie = naglowek.length;
  obrazy.forEach(({ S, png }, i) => {
    const o = 6 + 16 * i;
    naglowek.writeUInt8(S >= 256 ? 0 : S, o);        // 0 = 256
    naglowek.writeUInt8(S >= 256 ? 0 : S, o + 1);
    naglowek.writeUInt8(0, o + 2); naglowek.writeUInt8(0, o + 3);
    naglowek.writeUInt16LE(1, o + 4); naglowek.writeUInt16LE(32, o + 6);
    naglowek.writeUInt32LE(png.length, o + 8); naglowek.writeUInt32LE(przesuniecie, o + 12);
    przesuniecie += png.length;
  });
  return Buffer.concat([naglowek, ...obrazy.map((x) => x.png)]);
}

app.whenReady().then(async () => {
  const okno = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await okno.loadURL('data:text/html,<meta charset=utf-8><body></body>');
  await okno.webContents.executeJavaScript(RYSUJ + '; true');
  const doBufora = (url) => Buffer.from(url.split(',')[1], 'base64');
  const katalog = __dirname;

  const obrazy = [];
  for (const S of ROZMIARY) obrazy.push({ S, png: doBufora(await okno.webContents.executeJavaScript(`rysuj(${S})`)) });
  fs.writeFileSync(path.join(katalog, 'icon.ico'), zrobIco(obrazy));
  fs.writeFileSync(path.join(katalog, 'icon.png'), obrazy.find((x) => x.S === 256).png);
  fs.writeFileSync(path.join(katalog, 'tray.png'), doBufora(await okno.webContents.executeJavaScript(`rysuj(32, 'tray')`)));

  // podgląd: wszystkie rozmiary w rzędzie na jasnym i ciemnym tle
  const podglad = await okno.webContents.executeJavaScript(`(async () => {
    const R = ${JSON.stringify(ROZMIARY)}; const szer = R.reduce((a, b) => a + b + 24, 24);
    const c = document.createElement('canvas'); c.width = szer; c.height = 2 * (256 + 48); const g = c.getContext('2d');
    g.fillStyle = '#f3f3f3'; g.fillRect(0, 0, szer, 304); g.fillStyle = '#202020'; g.fillRect(0, 304, szer, 304);
    for (const tlo of [0, 304]) { let x = 24; for (const S of R) { const im = new Image(); im.src = rysuj(S); await im.decode(); g.drawImage(im, x, tlo + 24 + 256 - S); x += S + 24; } }
    return c.toDataURL('image/png'); })()`);
  fs.writeFileSync(path.join(katalog, 'podglad-ikony.png'), doBufora(podglad));
  console.log('Zapisano icon.ico (' + ROZMIARY.join(', ') + ' px), icon.png, tray.png, podglad-ikony.png');
  app.quit();
});

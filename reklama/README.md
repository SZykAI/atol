# Atol — reklama (film)

Gotowy film: **`Atol-reklama.mp4`** (50,5 s, 1920×1080, 60 kl./s, H.264 + AAC 320 kb/s).

## Jak powstaje

- `scena.html` / `scena.css` / `scena.js` to strona, która rysuje każdą klatkę filmu. Czas = numer klatki / 60.
  Wyspa jest wierną kopią prawdziwej (`okna/wyspa.js`): te same rozmiary, sprężyny, clip-path i kolejność
  wejścia treści. Pulpit, przeglądarka, okładki i nazwy utworów są wymyślone (bez cudzych logo i nagrań).
- `muzyka.js` to własny utwór (120 BPM), składany w kodzie przez Web Audio. Każde cięcie wypada na uderzeniu
  stopy, a kliknięcia myszy i „dzwonki” powiadomień są zgrane z obrazem co do klatki.
- `render.js` (Electron, okno poza ekranem) robi zrzut każdej klatki i wysyła piksele do ffmpeg
  (`ffmpeg-static` w `node_modules`). Każda klatka ma w rogu 1 piksel z numerem, a render czeka, aż zrzut
  ma właściwy numer (zwykły zrzut potrafił być spóźniony o klatkę). Potem ten piksel jest zamazywany.

## Uruchomienie (z tego folderu)

```
..\node_modules\electron\dist\electron.exe .                          cały film  → Atol-reklama.mp4 (~8 min)
..\node_modules\electron\dist\electron.exe . --podglad=1,8.5,12       zdjęcia tych sekund → podglad\
..\node_modules\electron\dist\electron.exe . --od=8 --do=16           fragment → podglad\fragment.mp4
..\node_modules\electron\dist\electron.exe . --tylko-muzyka           tylko muzyka.wav
```

Uwaga: uruchamiać przez potok (`| Out-File ...`) albo normalnie w terminalu. Z przekierowaniem `>`
PowerShell nie czeka na Electrona, więc łatwo przez przypadek odpalić dwa rendery naraz (nadpisują sobie pliki).

## Scenariusz

| Czas | Ujęcie |
|---|---|
| 0–4 s | Jasne tło, wyspa pojawia się i pokazuje muzykę. „Poznaj Atol.” |
| 4–8 s | „Dynamiczna wyspa. Teraz na Windows.”, potem słowa na każde uderzenie (wyspa zmienia stan razem z nimi) |
| 8–16 s | Pulpit: włączenie muzyki, zbliżenie, klik → karta, następny utwór, „Twoja muzyka. Zawsze na wierzchu.” |
| 16–24 s | Powiadomienia: głośność, ładowanie, bateria, minutnik (poświata w kolorze powiadomienia) |
| 24–28 s | Moduły (bateria, głośność, procesor, minutnik), potem zwinięta wyspa z minutnikiem i muzyką |
| 28–32 s | Pastylka → notch (wysuwa się spod krawędzi), rozwinięcie w notchu |
| 32–36 s | Film na pełnym ekranie: wyspa znika, po wyjściu wraca |
| 36–40 s | Aplikacja ustawień: menu, moduły, przełączniki |
| 40–44 s | Szybki montaż stanów wyspy w rytm muzyki |
| 44–50,5 s | Plansza: „Atol — Dynamiczna wyspa dla Windows.”, ikona, studio SZykAI |

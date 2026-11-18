# Atol

**Atol** to dynamiczna wyspa na pulpit Windows, inspirowana tą z iPhone'a. Zbudowało ją **studio SZykAI**.
(Atol to koralowa wyspa w kształcie pierścienia.)

To mała czarna pastylka (albo notch) na środku górnej krawędzi ekranu. Gdy gra muzyka albo film, pokazuje
okładkę i animowane słupki, a po kliknięciu rozwija się w kartę z odtwarzaczem.

Aplikacja ma dwie części:

- **Wyspa** startuje razem z Windowsem i od razu pojawia się na górze ekranu. Działa w tle,
  nie ma przycisku na pasku zadań, ma ikonę w zasobniku (obok zegara).
- **Ustawienia** to okno z menu bocznym (Wyspa, Moduły, Powiadomienia, System, O aplikacji). Otwiera się po
  kliknięciu skrótu „Atol”, lewym kliknięciu ikony w zasobniku albo przez „Ustawienia” w jej menu.

> Do wersji 3.2 aplikacja nazywała się „Wyspa”. Aktualizacja do 4.0 zachowuje ustawienia, przenosi autostart
> na nową nazwę i usuwa stare skróty.

## Wyspa

| Stan | Wygląd |
|---|---|
| Spoczynek | mała, pusta czarna pastylka |
| Gra muzyka / film | okładka po lewej, słupki wizualizatora po prawej (bez tekstu); słupki skaczą, gdy gra, i opadają przy pauzie; ich kolor pochodzi z okładki |
| Działa minutnik | licznik na pomarańczowo (razem z muzyką albo sam) |
| Kliknięcie | rozwinięta karta z lekkim cieniem dookoła: okładka, tytuł, wykonawca, pasek postępu (np. `2:01` i `-0:13`), przyciski ⏮ ⏯ ⏭, a pod spodem kafelki włączonych modułów |
| Powiadomienie | wyspa na ok. 3 s rozszerza się z ikoną i opisem |

**Zachowanie**

- Kliknięcie w wyspę rozwija ją. Kliknięcie w nią ponownie, kliknięcie **gdziekolwiek poza nią** albo
  klawisz **Esc** zwija ją.
- Gdy nie ma czego rozwinąć (żaden moduł nie jest włączony i nic nie gra), przytrzymanie pustej pastylki
  lekko ją powiększa, a po puszczeniu wraca sprężyście do normalnego rozmiaru.
- Kliknięcia **obok** pastylki przechodzą do aplikacji pod spodem, tak jakby wyspy nie było.
- Gdy jakaś aplikacja przejdzie w **pełny ekran** (YouTube, film, gra), wyspa płynnie znika, a po wyjściu
  z pełnego ekranu wraca.
- Po pauzie wyspa jeszcze przez 30 s pokazuje utwór (żeby dało się go wznowić), potem wraca do pustej pastylki.
- Wszystkie animacje są sprężyste (lekkie przestrzelenie i powrót), w 60 klatkach na sekundę.

## Wygląd: pastylka albo notch

W ustawieniach (karta **Wygląd wyspy**) wybierasz jeden z dwóch stylów:

- **Pastylka:** wyspa lewituje tuż pod górną krawędzią ekranu, jak w iPhonie. Pojawia się, opadając lekko z góry.
- **Notch:** wyspa jest przyczepiona do górnej krawędzi ekranu, jak wycięcie w laptopie. Ma proste górne rogi,
  wklęsłe „uszka” łagodnie łączące ją z krawędzią i zaokrąglony dół. **Wysuwa się spod krawędzi** (rośnie
  w dół od zera) i tak samo chowa się przy pełnym ekranie. Przy rozwijaniu uszka rosną razem z nią.

Zmiana stylu działa od razu i jest animowana: stary kształt się chowa, nowy się pojawia. Wszystko inne (muzyka,
kafelki, powiadomienia, minutnik) działa w obu stylach tak samo.

## Ustawienia

Okno ma menu boczne. Podświetlenie przesuwa się sprężyście do wybranej sekcji, a karty wjeżdżają kolejno.
Zapamiętuje ostatnio otwartą sekcję.

| Sekcja | Co tam jest |
|---|---|
| **Wyspa** | podgląd ekranu z Twoją wyspą, stan (działa / wyłączona), Uruchom / Wyłącz / Resetuj, wybór wyglądu |
| **Moduły** | co wyspa pokazuje |
| **Powiadomienia** | które powiadomienia są włączone |
| **System** | autostart z Windowsem i wskazówki o pracy w tle |
| **O aplikacji** | nazwa, wersja, studio SZykAI |


- **Uruchom wyspę / Wyłącz wyspę.** Wyłączona wyspa znika z ekranu, ale aplikacja czeka w zasobniku
  (stąd można ją znowu włączyć).
- **Resetuj** uruchamia wyspę od nowa, gdy coś się zawiesi.
- **Wygląd wyspy:** pastylka albo notch (patrz wyżej).
- **Uruchamiaj z Windowsem** to autostart, domyślnie włączony. Przy autostarcie pojawia się sama wyspa,
  bez okna ustawień.
- **Moduły:** muzyka i filmy (domyślnie włączone), bateria, procesor, głośność, minutnik (domyślnie wyłączone).
  Bateria, procesor i głośność są widoczne jako kafelki w rozwiniętej wyspie; minutnik ma przyciski
  1 / 5 / 10 / 25 min i licznik na zwiniętej wyspie.
- **Powiadomienia:** podłączenie / odłączenie ładowarki, niski poziom baterii (20% i 10%), zmiana głośności,
  koniec minutnika. Są **niezależne od modułów**: działają także wtedy, gdy wszystkie moduły są wyłączone.
  Pojawiają się po ok. 0,1–0,2 s od akcji. Głośność wyświetla się 1,5 s (kolejne zmiany wydłużają pokaz),
  pozostałe powiadomienia 3 s.

Każda zmiana działa **od razu**, bez restartu. Ustawienia są zapisywane w `%APPDATA%\wyspa\ustawienia.json`
(ustawienia powiadomień z wersji 1.x są przenoszone automatycznie). Zamknięcie okna ustawień nie wyłącza wyspy.
Całą aplikację kończy „Zakończ” w menu ikony w zasobniku.

## Muzyka i filmy — skąd są dane

Wyspa czyta **systemową sesję multimediów Windows** (`GlobalSystemMediaTransportControlsSession`), tę samą,
której używa panel z klawiszami multimedialnymi. Widzi więc wszystko, co ta sesja: Spotify, YouTube i inne
strony w Chrome / Edge, odtwarzacze muzyki i wideo. Przyciski ⏮ ⏯ ⏭ naprawdę sterują odtwarzaczem.

Zrobione jest to przez mały proces pomocniczy: `powershell.exe` ze skryptem `skrypty/pomocnik.ps1`
(wbudowany w Windows, bez dodatkowych bibliotek). Biblioteki npm do GSMTC (np. NodeRT) trzeba kompilować
w Visual Studio i często psują się przy nowych wersjach Electrona, dlatego wybrany został pomocnik.
Ten sam proces:
- co 0,25 s sprawdza, czy okno na wierzchu zajmuje cały główny monitor (pełny ekran);
- co 0,1 s czyta **głośność** (Core Audio, ten sam mechanizm co suwak głośności Windows) i **zasilanie**
  (`GetSystemPowerStatus`: poziom baterii, ładowarka podłączona). Dzięki temu powiadomienia pojawiają się
  prawie od razu. Wcześniej biblioteki npm czytały baterię ~0,8 s na odczyt (WMI), co dawało 3–4 s opóźnienia.
  Gdy pomocnik naprawdę nie działa, aplikacja wraca do tych starszych, wolniejszych odczytów (nie w czasie jego startu).
- Kod C# pomocnika jest kompilowany **raz** do `%LOCALAPPDATA%\Wyspa\cache\*.dll` (nazwa folderu z poprzednich wersji), a potem tylko wczytywany
  (kompilacja przy każdym starcie obciążała komputer na 1–2 s). Pomocnik startuje chwilę po wyspie, z niższym
  priorytetem.

**Ograniczenia (szczerze)**

- **Słupki to animacja, nie prawdziwe widmo dźwięku.** Windows nie udostępnia go łatwo innym aplikacjom.
  Słupki skaczą, gdy coś gra, i opadają przy pauzie.
- Okładka, długość utworu i przyciski „następny / poprzedni” są tylko wtedy, gdy odtwarzacz przekazuje je
  Windowsowi. Bez długości pasek postępu jest ukryty, a nieobsługiwany przycisk wyszarzony.
- Przeglądarka pojawia się jako źródło dopiero wtedy, gdy karta faktycznie odtwarza dźwięk lub wideo.
- Przy zmianie utworu przeglądarka podaje nową okładkę z opóźnieniem — wyspa sprawdza ją kilka razy w ciągu
  ~10 s i podmienia, gdy się zmieni (przez pierwszą sekundę może być jeszcze widoczna poprzednia).
- Gdy gra kilka źródeł naraz, wyspa pokazuje pierwsze, które gra.
- Pełny ekran jest wykrywany tylko na **głównym** monitorze (tam, gdzie jest wyspa). Zmaksymalizowane
  zwykłe okno nie jest pełnym ekranem i nie chowa wyspy.
- Wymagany jest Windows 10 w wersji 1809 lub nowszy. Na starszym wyspa działa, tylko bez muzyki.

## Instalacja

```powershell
npm run buduj:instalator
```

Powstaje `dist\Atol-Instalator.exe`. Instaluje aplikację dla bieżącego użytkownika (bez uprawnień
administratora) do `%LOCALAPPDATA%\Programs\wyspa` (plik `Atol.exe`), dodaje skróty na pulpicie i w menu Start i od razu
uruchamia Wyspę. Przy tym pierwszym uruchomieniu aplikacja **włącza autostart** (wpis „Atol” w
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`). Później decyduje już tylko przełącznik w ustawieniach.

- **Aktualizacja:** uruchom nowy instalator. Ustawienia i wybór autostartu zostają.
- **Odinstalowanie** (Ustawienia Windows → Aplikacje) usuwa też wpis autostartu.
- **Ostrzeżenie SmartScreen:** `.exe` nie jest podpisany certyfikatem, więc Windows może pokazać
  „System Windows ochronił ten komputer”. Kliknij **Więcej informacji → Uruchom mimo to**.

> Wersja przenośna (`npm run buduj` → `dist\Atol.exe`) nadal istnieje, ale nie jest polecana:
> rozpakowuje się przy każdym starcie (17–25 s), a autostart wskazywałby na plik, który łatwo przenieść.

## Uruchomienie z kodu (do testów)

```powershell
npm install
npm start
```

> Jeśli `npm start` zgłasza brak Electrona (npm czasem nie pobiera jego binarki):
> `node node_modules\electron\install.js`

- Przy uruchomieniu z kodu **autostart jest niedostępny** (przełącznik jest wyszarzony). Inaczej Windows
  zapisałby do autostartu „goły” Electron bez kodu Wyspy.
- `npm test` uruchamia testy logiki powiadomień i ustawień (19 testów).
- `npm run ikona` generuje ikonę od nowa (`build/icon.ico`, `icon.png`, `tray.png` i podgląd
  `build/podglad-ikony.png`). Wygląd zmienia się w `build/generuj-ikone.js`.
- `$env:WYSPA_DEBUG = "1"; npm start` wypisuje logi (zdarzenia, komendy, pełny ekran).

## Struktura projektu

| Plik | Do czego służy |
|---|---|
| `main.js` | proces główny: okno wyspy i ustawień, zasobnik, autostart, zapis ustawień, odczyt baterii / procesora / głośności, pomocnik |
| `preload.js` | bezpieczny most: `window.wyspa` (wyspa) i `window.panel` (ustawienia) |
| `lib/ustawienia.js` | ustawienia: domyślne, sprawdzanie, przenoszenie formatu 1.x, które powiadomienie pokazać |
| `lib/zdarzenia.js` | wykrywanie zdarzeń (ładowanie, progi baterii, zmiana głośności) |
| `skrypty/pomocnik.ps1` | multimedia (GSMTC), pełny ekran (user32), głośność (Core Audio), zasilanie (kernel32) |
| `okna/wyspa.*` | wyspa: sprężyny, kształt (clip-path; pastylka albo notch), treść wchodząca razem z kształtem, muzyka, kafelki, minutnik, powiadomienia |
| `okna/ustawienia.*` | aplikacja ustawień |
| `testy/*.test.js` | testy (`npm test`) |
| `build/generuj-ikone.js` | generator ikony (`npm run ikona`) |
| `build/icon.*`, `build/tray.png`, `build/instalator.nsh` | ikony; dodatek do instalatora (sprzątanie autostartu) |

## Użyte biblioteki

- [Electron](https://www.electronjs.org): okna i aplikacja desktopowa
- [systeminformation](https://systeminformation.io): bateria i procesor
- [loudness](https://github.com/LinusU/node-loudness): głośność systemowa
- [electron-builder](https://www.electron.build): instalator `.exe`
- Windows PowerShell + WinRT (wbudowane w system): multimedia i pełny ekran

## Rozwiązywanie problemów

- **Wyspa zniknęła.** Może jest włączony pełny ekran w innej aplikacji. Jeśli nie, otwórz ustawienia
  (skrót „Atol”) i kliknij **Resetuj**.
- **Muzyka się nie pojawia.** Sprawdź, czy moduł „Muzyka i filmy” jest włączony i czy odtwarzacz
  naprawdę gra. Jeśli Windows nie pokazuje utworu przy klawiszach multimedialnych, wyspa też go nie zobaczy.
- **Bateria: „brak danych”.** Komputer nie ma baterii (np. stacjonarny).
- **Druga kopia się nie uruchamia.** To celowe: dwuklik na skrócie, gdy Atol już działa, otwiera ustawienia.

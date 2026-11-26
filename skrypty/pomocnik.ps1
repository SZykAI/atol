# Wyspa — pomocnik systemowy (Windows PowerShell 5.1), uruchamiany przez proces główny jako proces potomny.
#
# Robi cztery rzeczy:
#  1. MULTIMEDIA: czyta systemową sesję multimediów Windows (GlobalSystemMediaTransportControlsSession,
#     ta sama, której używa panel multimediów Windows) i nią steruje.
#  2. PEŁNY EKRAN: sprawdza, czy okno na wierzchu zakrywa cały główny monitor (film, gra, YouTube na pełnym ekranie).
#  3. GŁOŚNOŚĆ: Core Audio (ten sam mechanizm co suwak głośności Windows) — co 0,1 s, odczyt trwa mikrosekundy.
#  4. ZASILANIE: GetSystemPowerStatus (poziom baterii, ładowarka podłączona) — co 0,1 s.
#     (Biblioteki npm robiły to wolno: bateria przez WMI ~0,8 s na odczyt, głośność przez osobny program ~0,1 s.)
#
# Wyjście (stdout), po jednej linii JSON:
#   {"typ":"media", ...stan odtwarzania...}     co ~0,5 s (gdy odczyt multimediów jest włączony)
#   {"typ":"pelny","wartosc":true|false}         tylko przy zmianie
#   {"typ":"glosnosc","poziom":0-100,"wyciszony":bool}            tylko przy zmianie (pierwszy odczyt też)
#   {"typ":"zasilanie","bateria":bool,"procent":0-100,"ladowarka":bool}  tylko przy zmianie (pierwszy odczyt też)
#   {"typ":"media-niedostepne","powod":"..."}    raz, gdy system nie ma GSMTC (Windows < 10 1809)
# Wejście (stdin), komendy:
#   toggle | next | prev       pauza/play, następny, poprzedni
#   media 0 | media 1          wyłącz / włącz odczyt multimediów (moduł wyłączony w ustawieniach)
# Gdy stdin się zamknie (aplikacja się zakończyła), skrypt kończy działanie.
#
# UWAGA: plik musi być zapisany w UTF-8 z BOM (inaczej PowerShell 5.1 psuje polskie znaki).

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Wyslij($obiekt) {
    [Console]::Out.WriteLine(($obiekt | ConvertTo-Json -Compress -Depth 4))
    [Console]::Out.Flush()
}

# Kod C# kompilujemy RAZ do pliku .dll (w %LOCALAPPDATA%\Wyspa\cache) i potem tylko go wczytujemy.
# Kompilacja przy każdym starcie uruchamiała kompilator (csc.exe) i na 1–2 s mocno obciążała komputer.
# W nazwie pliku jest skrót (hash) kodu — po zmianie kodu powstaje nowa wersja.
function DodajTyp([string]$nazwa, [string]$kod) {
    $katalog = Join-Path $env:LOCALAPPDATA 'Wyspa\cache'
    $skrot = [BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($kod))).Replace('-', '').Substring(0, 16)
    $dll = Join-Path $katalog "$nazwa-$skrot.dll"
    if (-not (Test-Path $dll)) {
        New-Item -ItemType Directory -Force $katalog | Out-Null
        try { Add-Type -TypeDefinition $kod -OutputAssembly $dll -OutputType Library }
        catch { Add-Type -TypeDefinition $kod; return }        # nie da się zapisać — skompiluj tylko w pamięci
    }
    Add-Type -Path $dll
}

# =====================================================================
# 1. Pełny ekran — funkcje systemowe user32/shell32 przez mały kod C#
# =====================================================================
$script:pelnyDostepny = $true
try {
    DodajTyp 'pelny-ekran' @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class WyspaPelnyEkran {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }

    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flagi);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int indeks);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int stan);

    const int GWL_STYLE = -16;
    const int WS_CAPTION = 0x00C00000;
    const uint MONITOR_DEFAULTTONEAREST = 2;
    const uint MONITORINFOF_PRIMARY = 1;

    // true = na GŁÓWNYM monitorze (tam jest wyspa) działa coś na pełnym ekranie
    public static bool Sprawdz() {
        // Gra w "wyłącznym" pełnym ekranie (Direct3D) albo tryb prezentacji — system mówi to wprost
        int stan;
        if (SHQueryUserNotificationState(out stan) == 0 && (stan == 3 || stan == 4)) return true;

        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero || !IsWindowVisible(h)) return false;

        // pulpit i pasek zadań też "zakrywają" ekran, ale to nie pełny ekran
        StringBuilder klasa = new StringBuilder(256);
        GetClassName(h, klasa, 256);
        string k = klasa.ToString();
        if (k == "Progman" || k == "WorkerW" || k == "Shell_TrayWnd" || k == "Shell_SecondaryTrayWnd") return false;

        RECT r;
        if (!GetWindowRect(h, out r)) return false;
        MONITORINFO mi = new MONITORINFO();
        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST), ref mi)) return false;
        if ((mi.dwFlags & MONITORINFOF_PRIMARY) == 0) return false;   // pełny ekran na innym monitorze nie przeszkadza

        RECT m = mi.rcMonitor;
        bool zakrywa = r.L <= m.L && r.T <= m.T && r.R >= m.R && r.B >= m.B;
        if (!zakrywa) return false;

        // Zmaksymalizowane zwykłe okno (z paskiem tytułu) przy autoukrywanym pasku zadań też zakrywa ekran
        // — to nie jest pełny ekran
        bool maTytul = (GetWindowLong(h, GWL_STYLE) & WS_CAPTION) == WS_CAPTION;
        if (IsZoomed(h) && maTytul) return false;
        return true;
    }
}
'@
}
catch {
    $script:pelnyDostepny = $false
}

# =====================================================================
# 3. i 4. Głośność (Core Audio, COM) i zasilanie (kernel32)
# =====================================================================
# Osobny blok: jeśli coś tu się nie skompiluje, pełny ekran i multimedia działają dalej
# (a proces główny wróci do starych, wolniejszych odczytów).
$script:systemDostepny = $true
try {
    DodajTyp 'system' @'
using System;
using System.Runtime.InteropServices;

// Interfejsy COM z Core Audio (mmdeviceapi.h, endpointvolume.h). Kolejność metod musi się zgadzać
// z tabelą metod w systemie — nieużywane są wpisane jako "zaślepki", żeby zająć swoje miejsca.
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int przeplyw, int stan, out IntPtr urzadzenia);
    [PreserveSig] int GetDefaultAudioEndpoint(int przeplyw, int rola, out IMMDevice urzadzenie);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int kontekst, IntPtr parametry, [MarshalAs(UnmanagedType.IUnknown)] out object wynik);
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    [PreserveSig] int RegisterControlChangeNotify(IntPtr a);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr a);
    [PreserveSig] int GetChannelCount(out uint n);
    [PreserveSig] int SetMasterVolumeLevel(float f, IntPtr kontekst);
    [PreserveSig] int SetMasterVolumeLevelScalar(float f, IntPtr kontekst);
    [PreserveSig] int GetMasterVolumeLevel(out float f);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float f);
    [PreserveSig] int SetChannelVolumeLevel(uint n, float f, IntPtr kontekst);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint n, float f, IntPtr kontekst);
    [PreserveSig] int GetChannelVolumeLevel(uint n, out float f);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint n, out float f);
    [PreserveSig] int SetMute(int wycisz, IntPtr kontekst);
    [PreserveSig] int GetMute(out int wyciszony);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorKlasa { }

public static class WyspaSystem {
    static IMMDeviceEnumerator enumerator;
    static IAudioEndpointVolume glosnosc;
    static DateTime pobrano = DateTime.MinValue;

    // Domyślne urządzenie odtwarzania pobieramy ponownie co 3 s — użytkownik mógł przełączyć głośniki/słuchawki.
    static void PobierzUrzadzenie() {
        pobrano = DateTime.Now;
        try {
            if (glosnosc != null) { Marshal.ReleaseComObject(glosnosc); glosnosc = null; }
            if (enumerator == null) enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorKlasa());
            IMMDevice urz;
            if (enumerator.GetDefaultAudioEndpoint(0 /* odtwarzanie */, 1 /* multimedia */, out urz) != 0 || urz == null) return;
            Guid iid = typeof(IAudioEndpointVolume).GUID;
            object o;
            if (urz.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out o) == 0) glosnosc = (IAudioEndpointVolume)o;
            Marshal.ReleaseComObject(urz);
        } catch { glosnosc = null; }
    }

    // Wynik: -1 = brak urządzenia; inaczej poziom 0..100, +1000 gdy wyciszone.
    public static int Glosnosc() {
        if (glosnosc == null || (DateTime.Now - pobrano).TotalSeconds > 3) PobierzUrzadzenie();
        if (glosnosc == null) return -1;
        float f; int m;
        if (glosnosc.GetMasterVolumeLevelScalar(out f) != 0 || glosnosc.GetMute(out m) != 0) { glosnosc = null; return -1; }
        return (int)Math.Round(f * 100) + (m != 0 ? 1000 : 0);
    }

    [StructLayout(LayoutKind.Sequential)]
    struct SYSTEM_POWER_STATUS { public byte ACLineStatus, BatteryFlag, BatteryLifePercent, SystemStatusFlag; public int BatteryLifeTime, BatteryFullLifeTime; }
    [DllImport("kernel32.dll")] static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS s);

    // Wynik: -2 = błąd, -1 = komputer bez baterii; inaczej procent 0..100, +1000 gdy ładowarka podłączona.
    public static int Zasilanie() {
        SYSTEM_POWER_STATUS s;
        if (!GetSystemPowerStatus(out s)) return -2;
        if ((s.BatteryFlag & 128) != 0 || s.BatteryLifePercent > 100) return -1;   // 128 = brak baterii, 255 = nieznany
        return s.BatteryLifePercent + (s.ACLineStatus == 1 ? 1000 : 0);
    }
}
'@
}
catch {
    $script:systemDostepny = $false
    Wyslij @{ typ = 'system-niedostepny'; powod = $_.Exception.Message }
}

# =====================================================================
# 2. Multimedia (WinRT)
# =====================================================================
$script:mediaDostepne = $true
$script:mediaWlaczone = $true
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.IInputStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

    # Windows PowerShell nie potrafi "await" na operacjach WinRT, więc zamieniamy je na Task przez AsTask<T>()
    $script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

    $script:metodaStrumienia = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1

    $typMenedzera = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
    $zadanie = $script:asTask.MakeGenericMethod($typMenedzera).Invoke($null, @($typMenedzera::RequestAsync()))
    if (-not $zadanie.Wait(5000)) { throw 'przekroczono czas RequestAsync' }
    $script:menedzer = $zadanie.Result
    $script:typWlasciwosci = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
}
catch {
    # np. Windows starszy niż 10 1809 — wyspa działa dalej, tylko bez muzyki
    $script:mediaDostepne = $false
    Wyslij @{ typ = 'media-niedostepne'; powod = $_.Exception.Message }
}

function Czekaj($operacja, [Type]$typWyniku) {
    $zadanie = $script:asTask.MakeGenericMethod($typWyniku).Invoke($null, @($operacja))
    if (-not $zadanie.Wait(5000)) { throw 'przekroczono czas operacji WinRT' }
    return $zadanie.Result
}

# ---------- wybór sesji: najpierw ta, która gra; potem bieżąca sesja systemu ----------
$script:sesja = $null
function WybierzSesje {
    $sesje = @($script:menedzer.GetSessions())
    if ($sesje.Count -eq 0) { return $null }
    foreach ($s in $sesje) {
        if ($s.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { return $s }
    }
    $biezaca = $script:menedzer.GetCurrentSession()
    if ($biezaca) { return $biezaca }
    return $sesje[0]
}

# ---------- okładka ----------
# Przeglądarka przy zmianie utworu najpierw zmienia tytuł, a okładkę dopiero chwilę później — pierwszy odczyt
# bywa jeszcze STARĄ okładką (np. poprzedni film z YouTube). Dlatego po zmianie utworu sprawdzamy okładkę
# kilka razy i wysyłamy ją ponownie, gdy obrazek się zmienił (porównujemy skrót MD5 jego bajtów).
$script:ostatniKlucz = ''
$script:SPRAWDZENIA_OKLADKI = @(250, 1200, 2500, 5000, 10000)   # ms od zmiany utworu
$script:nrSprawdzenia = 0
$script:czasZmiany = 0
$script:skrotOkladki = ''
$script:md5 = [System.Security.Cryptography.MD5]::Create()

function PobierzOkladke($wlasciwosci) {
    if (-not $wlasciwosci.Thumbnail) { return $null }
    $strumien = Czekaj ($wlasciwosci.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    try {
        # PowerShell nie rzutuje obiektu COM na IInputStream, więc metodę wołamy przez refleksję .NET
        $siec = $script:metodaStrumienia.Invoke($null, @($strumien))
        $pamiec = New-Object System.IO.MemoryStream
        $siec.CopyTo($pamiec)
        if ($pamiec.Length -lt 100 -or $pamiec.Length -gt 3000000) { return $null }
        $typ = if ($strumien.ContentType) { $strumien.ContentType } else { 'image/png' }
        $bajty = $pamiec.ToArray()
        return @{
            url   = 'data:' + $typ + ';base64,' + [Convert]::ToBase64String($bajty)
            skrot = [BitConverter]::ToString($script:md5.ComputeHash($bajty))
        }
    }
    finally {
        # obiekt WinRT ma Close() (IClosable), a nie Dispose()
        try { $strumien.Close() } catch { }
    }
}

function OdczytajMedia {
    $s = WybierzSesje
    $script:sesja = $s
    if (-not $s) { return @{ typ = 'media'; aktywna = $false } }

    $w = Czekaj ($s.TryGetMediaPropertiesAsync()) $script:typWlasciwosci
    $odtwarzanie = $s.GetPlaybackInfo()
    $os = $s.GetTimelineProperties()
    $gra = ($odtwarzanie.PlaybackStatus.ToString() -eq 'Playing')

    # pozycja: ostatnia znana + czas od jej aktualizacji (jeśli gra)
    $dlugosc = ($os.EndTime - $os.StartTime).TotalSeconds
    $pozycja = ($os.Position - $os.StartTime).TotalSeconds
    if ($gra -and $os.LastUpdatedTime.Year -gt 2000) {
        $pozycja += ([DateTimeOffset]::Now - $os.LastUpdatedTime).TotalSeconds
    }
    if ($dlugosc -le 0) { $dlugosc = 0; $pozycja = 0 }
    elseif ($pozycja -gt $dlugosc) { $pozycja = $dlugosc }
    if ($pozycja -lt 0) { $pozycja = 0 }

    $klucz = $s.SourceAppUserModelId + '|' + $w.Title + '|' + $w.Artist
    if ($klucz -ne $script:ostatniKlucz) {
        $script:ostatniKlucz = $klucz
        $script:nrSprawdzenia = 0
        $script:czasZmiany = $zegar.ElapsedMilliseconds
        $script:skrotOkladki = ''           # nowy utwór: pierwszą okładkę wysyłamy zawsze
    }

    $stan = @{
        typ       = 'media'
        aktywna   = $true
        gra       = $gra
        tytul     = $w.Title
        wykonawca = $w.Artist
        album     = $w.AlbumTitle
        zrodlo    = $s.SourceAppUserModelId
        klucz     = $klucz
        pozycja   = [math]::Round($pozycja, 2)
        dlugosc   = [math]::Round($dlugosc, 2)
        poprzedni = [bool]$odtwarzanie.Controls.IsPreviousEnabled
        nastepny  = [bool]$odtwarzanie.Controls.IsNextEnabled
        przewijanie = [bool]$odtwarzanie.Controls.IsPlaybackPositionEnabled
    }

    $i = $script:nrSprawdzenia
    if ($i -lt $script:SPRAWDZENIA_OKLADKI.Count -and ($zegar.ElapsedMilliseconds - $script:czasZmiany) -ge $script:SPRAWDZENIA_OKLADKI[$i]) {
        $script:nrSprawdzenia++
        try {
            $okladka = PobierzOkladke $w
            if ($okladka -and $okladka.skrot -ne $script:skrotOkladki) {
                $script:skrotOkladki = $okladka.skrot
                $stan.okladka = $okladka.url
            }
        }
        catch { $stan.okladkaBlad = $_.Exception.Message }
    }
    return $stan
}

function WykonajKomende($komenda) {
    switch -Regex ($komenda) {
        '^media ([01])$' {
            $script:mediaWlaczone = ($Matches[1] -eq '1')
            if (-not $script:mediaWlaczone) { $script:ostatniKlucz = '' }   # po włączeniu wyślij okładkę od nowa
            return
        }
    }
    $s = $script:sesja
    if (-not $s) { return }
    if ($komenda -match '^seek (\d{1,7}(\.\d{1,3})?)$') {
        # pozycja w sekundach od początku utworu → ticki (100 ns) na osi czasu źródła (nie zawsze zaczyna się od 0)
        $sekundy = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
        $os = $s.GetTimelineProperties()
        $cel = $os.StartTime.Ticks + [long][math]::Round($sekundy * 10000000)
        if ($cel -gt $os.EndTime.Ticks) { $cel = $os.EndTime.Ticks }
        $null = Czekaj ($s.TryChangePlaybackPositionAsync($cel)) ([bool])
        return
    }
    switch ($komenda) {
        'toggle' { $null = Czekaj ($s.TryTogglePlayPauseAsync()) ([bool]) }
        'next'   { $null = Czekaj ($s.TrySkipNextAsync()) ([bool]) }
        'prev'   { $null = Czekaj ($s.TrySkipPreviousAsync()) ([bool]) }
    }
}

# =====================================================================
# Pętla główna
# =====================================================================
# [Console]::In.ReadLineAsync() w .NET Framework jest w praktyce synchroniczne i zablokowałoby pętlę,
# dlatego czytamy stdin własnym StreamReaderem, którego ReadLineAsync jest naprawdę asynchroniczne.
$wejscie = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), (New-Object System.Text.UTF8Encoding($false)))
$czytaj = $wejscie.ReadLineAsync()
$zegar = [System.Diagnostics.Stopwatch]::StartNew()
$nastepnyMedia = 0
$nastepnyPelny = 0
$ostatniPelny = $null
$nastepnySystem = 0
$ostatniaGlosnosc = $null
$ostatnieZasilanie = $null

while ($true) {
    if ($czytaj.IsCompleted) {
        $linia = $czytaj.Result
        if ($null -eq $linia) { break }          # stdin zamknięty → aplikacja zakończyła działanie
        $czytaj = $wejscie.ReadLineAsync()
        try { WykonajKomende $linia.Trim() } catch { }
        $nastepnyMedia = $zegar.ElapsedMilliseconds + 150   # szybko pokaż skutek komendy
    }

    $teraz = $zegar.ElapsedMilliseconds

    if ($script:pelnyDostepny -and $teraz -ge $nastepnyPelny) {
        $nastepnyPelny = $teraz + 250
        try {
            $pelny = [WyspaPelnyEkran]::Sprawdz()
            if ($pelny -ne $ostatniPelny) { $ostatniPelny = $pelny; Wyslij @{ typ = 'pelny'; wartosc = $pelny } }
        } catch { }
    }

    # Głośność i zasilanie: co 0,1 s, ale wysyłamy tylko zmiany (pierwszy odczyt też)
    if ($script:systemDostepny -and $teraz -ge $nastepnySystem) {
        $nastepnySystem = $teraz + 100
        try {
            $g = [WyspaSystem]::Glosnosc()
            if ($g -ne $ostatniaGlosnosc) {
                $ostatniaGlosnosc = $g
                if ($g -ge 0) { Wyslij @{ typ = 'glosnosc'; poziom = ($g % 1000); wyciszony = ($g -ge 1000) } }
                else { Wyslij @{ typ = 'glosnosc'; brak = $true } }
            }
            $z = [WyspaSystem]::Zasilanie()
            if ($z -ne $ostatnieZasilanie) {
                $ostatnieZasilanie = $z
                if ($z -ge 0) { Wyslij @{ typ = 'zasilanie'; bateria = $true; procent = ($z % 1000); ladowarka = ($z -ge 1000) } }
                elseif ($z -eq -1) { Wyslij @{ typ = 'zasilanie'; bateria = $false } }
            }
        } catch { }
    }

    if ($script:mediaDostepne -and $script:mediaWlaczone -and $teraz -ge $nastepnyMedia) {
        $nastepnyMedia = $teraz + 500
        try { Wyslij (OdczytajMedia) }
        catch { Wyslij @{ typ = 'media'; aktywna = $false; blad = $_.Exception.Message } }
    }

    Start-Sleep -Milliseconds 50
}

; Atol (studio SZykAI) — dodatki do instalatora NSIS (electron-builder, opcja "nsis.include").
;
; Autostart włącza sama aplikacja przy pierwszym uruchomieniu (instalator uruchamia ją od razu po instalacji),
; przez app.setLoginItemSettings — wpis "Atol" w HKCU\...\Run. Stary wpis "Wyspa" (wersje do 3.2) aplikacja
; sama przenosi na nową nazwę.

; Instalacja / aktualizacja: usuń skróty ze starą nazwą "Wyspa" (wskazywałyby na usunięty Wyspa.exe)
!macro customInstall
  Delete "$DESKTOP\Wyspa.lnk"
  Delete "$SMPROGRAMS\Wyspa.lnk"
!macroend

; Odinstalowanie: sprzątamy wpis autostartu, żeby Windows nie próbował uruchamiać usuniętego programu.
; Przy AKTUALIZACJI instalator najpierw po cichu odinstalowuje starą wersję — wtedy wpisu nie ruszamy
; (inaczej każda aktualizacja wyłączałaby autostart).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Atol"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Atol"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Wyspa"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Wyspa"
  ${endIf}
!macroend

/*
 * Atol — nazwa aplikacji i autor w jednym miejscu.
 * (Atol = koralowa wyspa w kształcie pierścienia — dynamiczna wyspa na górze ekranu.)
 * Żeby zmienić nazwę: tu + "productName" i "shortcutName" w package.json.
 */
module.exports = {
  NAZWA: 'Atol',
  STUDIO: 'SZykAI',
  OPIS: 'Dynamiczna wyspa na górze ekranu Windows',
  ID: 'pl.wyspa.app',                  // identyfikator systemowy — bez zmian, żeby aktualizacja zastąpiła starą wersję
  FOLDER_DANYCH: 'wyspa',              // %APPDATA%\wyspa — bez zmian, żeby zostały ustawienia z poprzednich wersji
  AUTOSTART: 'Atol',                   // nazwa wpisu w autostarcie Windows
  STARE_AUTOSTARTY: ['Wyspa']          // wpisy z poprzednich wersji — przenosimy je na nową nazwę
};

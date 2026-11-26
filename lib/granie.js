// Atol — studio SZykAI
// Stabilny stan „gra / pauza”. System (a zwłaszcza przeglądarka) tuż po zatrzymaniu potrafi na chwilę
// podać znowu „gra”, przez co słupki się wznawiały i zaraz znów stawały. Dlatego:
//  - po kliknięciu na wyspie przez 2 s trzymamy to, co wybrał użytkownik (także gdy system raz już
//    potwierdził — stary odczyt może przyjść po potwierdzeniu),
//  - zmianę z zewnątrz (klawiatura, przeglądarka) przyjmujemy dopiero, gdy utrzyma się przez 0,4 s.

const BLOKADA_PO_KLIKU_MS = 2000;
const POTWIERDZENIE_MS = 400;

function utworzFiltrGrania() {
  let klucz = null;
  let gra = false;
  let blokadaDo = 0;
  let zmianaOd = null;      // od kiedy system podaje stan inny niż pokazywany

  return {
    odczyt(nowyKlucz, graSystem, teraz) {
      if (nowyKlucz !== klucz) {                 // inny utwór / źródło: bierzemy od razu
        klucz = nowyKlucz;
        gra = graSystem;
        blokadaDo = 0;
        zmianaOd = null;
      } else if (teraz < blokadaDo || graSystem === gra) {
        zmianaOd = null;
      } else if (zmianaOd === null) {
        zmianaOd = teraz;
      } else if (teraz - zmianaOd >= POTWIERDZENIE_MS) {
        gra = graSystem;
        zmianaOd = null;
      }
      return gra;
    },
    klikniecie(teraz) {
      if (klucz === null) return;
      gra = !gra;
      blokadaDo = teraz + BLOKADA_PO_KLIKU_MS;
      zmianaOd = null;
    },
    wyczysc() {
      klucz = null;
      gra = false;
      blokadaDo = 0;
      zmianaOd = null;
    }
  };
}

module.exports = { utworzFiltrGrania, BLOKADA_PO_KLIKU_MS, POTWIERDZENIE_MS };

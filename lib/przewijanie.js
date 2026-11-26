// Atol — studio SZykAI
// Przewijanie utworu. Tuż po przewinięciu system (a zwłaszcza przeglądarka) potrafi jeszcze przez chwilę
// podawać STARĄ pozycję i pasek skakałby z powrotem. Dlatego przez 2 s trzymamy pozycję wybraną przez
// użytkownika (gdy utwór gra, płynie ona dalej), a potem znów ufamy systemowi.

const BLOKADA_PO_PRZEWINIECIU_MS = 2000;

// Czy prośbę o przewinięcie wolno przekazać dalej: źródło na to pozwala, a pozycja mieści się w utworze.
function moznaPrzewinac(sekundy, media) {
  return !!media && !!media.przewijanie && media.dlugosc > 0 &&
    Number.isFinite(sekundy) && sekundy >= 0 && sekundy <= media.dlugosc;
}

function utworzFiltrPozycji() {
  let wybor = null;         // { klucz, pozycja, ostatnio, blokadaDo }

  return {
    przewiniecie(klucz, pozycja, teraz) {
      wybor = { klucz, pozycja, ostatnio: teraz, blokadaDo: teraz + BLOKADA_PO_PRZEWINIECIU_MS };
    },
    odczyt(klucz, pozycjaSystem, gra, dlugosc, teraz) {
      if (!wybor) return pozycjaSystem;
      if (klucz !== wybor.klucz || teraz >= wybor.blokadaDo) {     // inny utwór albo minął czas
        wybor = null;
        return pozycjaSystem;
      }
      if (gra) wybor.pozycja += (teraz - wybor.ostatnio) / 1000;
      if (dlugosc > 0) wybor.pozycja = Math.min(dlugosc, wybor.pozycja);
      wybor.ostatnio = teraz;
      return wybor.pozycja;
    },
    wyczysc() {
      wybor = null;
    }
  };
}

module.exports = { utworzFiltrPozycji, moznaPrzewinac, BLOKADA_PO_PRZEWINIECIU_MS };

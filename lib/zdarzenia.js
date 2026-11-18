/*
 * Wyspa — wykrywanie zdarzeń na podstawie kolejnych odczytów systemu.
 * Czysta logika (bez Electrona i bez odczytu sprzętu), dzięki czemu można ją przetestować: `npm test`.
 *
 * Wejście:  odczyt { bateria: {procent, laduje} | null, glosnosc: {poziom, wyciszony} | null }
 * Wyjście:  lista zdarzeń, które właśnie zaszły:
 *   { typ: 'ladowanie', laduje, procent }     — zaczęło się / skończyło ładowanie
 *   { typ: 'bateria',   procent, prog }       — bateria spadła poniżej 20% (prog 20) lub 10% (prog 10)
 *   { typ: 'glosnosc',  poziom, wyciszony }   — zmieniła się głośność lub wyciszenie
 */

const PROG_OSTRZEZENIA = 20;
const PROG_KRYTYCZNY = 10;

function utworzDetektor() {
  let poprzednie = { bateria: null, glosnosc: null };
  let ostrzezono20 = false;    // już powiadomiliśmy o spadku poniżej 20%
  let ostrzezono10 = false;    // już powiadomiliśmy o spadku poniżej 10%

  return function wykryj(odczyt) {
    const zdarzenia = [];
    const b = odczyt && odczyt.bateria;
    const g = odczyt && odczyt.glosnosc;

    // --- bateria ---
    if (b) {
      // ładowanie zaczęło się / skończyło (tylko gdy znamy poprzedni stan)
      if (poprzednie.bateria && poprzednie.bateria.laduje !== b.laduje) {
        zdarzenia.push({ typ: 'ladowanie', laduje: b.laduje, procent: b.procent });
      }

      // flagi zerujemy, gdy ładowarka jest podłączona albo poziom wrócił powyżej progu,
      // dzięki temu kolejny spadek znów da powiadomienie
      if (b.laduje || b.procent >= PROG_OSTRZEZENIA) ostrzezono20 = false;
      if (b.laduje || b.procent >= PROG_KRYTYCZNY) ostrzezono10 = false;

      if (!b.laduje) {
        if (b.procent < PROG_KRYTYCZNY && !ostrzezono10) {
          ostrzezono10 = true;
          ostrzezono20 = true;   // przy skoku od razu poniżej 10% nie dublujemy komunikatu o 20%
          zdarzenia.push({ typ: 'bateria', procent: b.procent, prog: PROG_KRYTYCZNY });
        } else if (b.procent < PROG_OSTRZEZENIA && !ostrzezono20) {
          ostrzezono20 = true;
          zdarzenia.push({ typ: 'bateria', procent: b.procent, prog: PROG_OSTRZEZENIA });
        }
      }
      poprzednie.bateria = b;
    }

    // --- głośność (pierwszy odczyt tylko zapamiętujemy) ---
    if (g) {
      const p = poprzednie.glosnosc;
      if (p && (p.poziom !== g.poziom || p.wyciszony !== g.wyciszony)) {
        zdarzenia.push({ typ: 'glosnosc', poziom: g.poziom, wyciszony: g.wyciszony });
      }
      poprzednie.glosnosc = g;
    }

    return zdarzenia;
  };
}

module.exports = { utworzDetektor, PROG_OSTRZEZENIA, PROG_KRYTYCZNY };

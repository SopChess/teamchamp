import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

/**
 * Κανόνας (επιβεβαιωμένος από τον Isaak): στα κείμενα της εφαρμογής ΠΟΤΕ
 * ενικός — πάντα πληθυντικός ευγενείας. Αυτό το test σαρώνει τον κώδικα και
 * αποτυγχάνει αν βρει χαρακτηριστικούς τύπους ενικού σε γραμμές που δεν
 * είναι σχόλια. Συντηρητική λίστα: αν προκύψει νέος τύπος, προστίθεται εδώ.
 */
const FORBIDDEN =
  /(Επίλεξε|Πρόσθεσε|Ζήτα|Άνοιξε|Ανέβασε|Βεβαιώσου|Γράψε|Διάλεξε|Όρισε|Φτιάξε|Δώσε|Συμπλήρωσε|Δοκίμασε|Έλεγξε|Δημιούργησε|Αποθήκευσε|Πάτα|Επιβεβαίωσε|Καταχώρησε|Αντίγραψε|Ενημέρωσε|Εισάγαγε| σου\b|\bέχεις\b|\bθέλεις\b|\bμπορείς\b|Δεν έχεις)/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("πληθυντικός ευγενείας στα κείμενα της εφαρμογής", () => {
  it("δεν υπάρχουν τύποι ενικού σε γραμμές κώδικα (εκτός σχολίων)", () => {
    const srcDir = path.resolve(__dirname, "..");
    const offenders: string[] = [];

    for (const file of walk(srcDir)) {
      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
          if (FORBIDDEN.test(line)) {
            offenders.push(`${path.relative(srcDir, file)}:${i + 1}: ${trimmed}`);
          }
        });
    }

    expect(offenders).toEqual([]);
  });
});

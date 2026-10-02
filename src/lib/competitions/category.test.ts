import { describe, it, expect } from "vitest";
import { TOURNAMENT_CATEGORIES, CATEGORY_LABEL, isTournamentCategory } from "./category";

describe("Κατηγορία διοργάνωσης", () => {
  it("κάθε κατηγορία έχει ελληνική ετικέτα", () => {
    for (const c of TOURNAMENT_CATEGORIES) expect(CATEGORY_LABEL[c]).toBeTruthy();
  });

  it('"Άλλο" είναι μία από τις έγκυρες κατηγορίες (προεπιλογή, επιβεβαιωμένο)', () => {
    expect(TOURNAMENT_CATEGORIES).toContain("other");
    expect(CATEGORY_LABEL.other).toBe("Άλλο");
  });

  it("isTournamentCategory ξεχωρίζει έγκυρες από άκυρες τιμές", () => {
    expect(isTournamentCategory("topiko")).toBe(true);
    expect(isTournamentCategory("κάτι άλλο")).toBe(false);
  });
});

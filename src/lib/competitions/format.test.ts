import { describe, it, expect } from "vitest";
import { TOURNAMENT_FORMATS, FORMAT_LABEL, isTournamentFormat } from "./format";

describe("Σύστημα αγώνων (λίστα, επιβεβαιωμένο)", () => {
  it("κάθε επιλογή έχει ελληνική ετικέτα", () => {
    for (const f of TOURNAMENT_FORMATS) expect(FORMAT_LABEL[f]).toBeTruthy();
  });

  it("isTournamentFormat ξεχωρίζει έγκυρες από άκυρες τιμές", () => {
    expect(isTournamentFormat("swiss")).toBe(true);
    expect(isTournamentFormat("κάτι περίεργο")).toBe(false);
  });
});

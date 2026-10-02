import { describe, it, expect } from "vitest";
import { referenceYearOf, describeConstraintShort, describeConstraintsShort } from "./boardNotation";

describe("referenceYearOf", () => {
  it("χρησιμοποιεί το έτος έναρξης του τουρνουά, όχι το σημερινό (επιβεβαιωμένο)", () => {
    expect(referenceYearOf("2026-10-01")).toBe(2026);
    expect(referenceYearOf("2030-01-15")).toBe(2030);
  });

  it("χωρίς ημερομηνία έναρξης, πέφτει στο τρέχον έτος", () => {
    expect(referenceYearOf(null)).toBe(new Date().getFullYear());
    expect(referenceYearOf(undefined)).toBe(new Date().getFullYear());
  });
});

describe("describeConstraintShort", () => {
  const ref = 2026;

  it("U16 από birth_year_from=2010 (όπως στο screenshot του Isaak: 2026-2010=16)", () => {
    expect(describeConstraintShort({ type: "birth_year_from", value: "2010" }, ref)).toBe("U16");
  });

  it("U12 από birth_year_from=2014", () => {
    expect(describeConstraintShort({ type: "birth_year_from", value: "2014" }, ref)).toBe("U12");
  });

  it("O40 από birth_year_until (ηλικιωμένοι, αντίστροφο όριο)", () => {
    expect(describeConstraintShort({ type: "birth_year_until", value: "1986" }, ref)).toBe("O40");
  });

  it('φύλο: "F" για γυναίκα, "M" για άνδρα', () => {
    expect(describeConstraintShort({ type: "gender", value: "F" }, ref)).toBe("F");
    expect(describeConstraintShort({ type: "gender", value: "M" }, ref)).toBe("M");
  });

  it("βαθμός: σύντομα σύμβολα ανισότητας, χωρίς τη λέξη «Βαθμός»", () => {
    expect(describeConstraintShort({ type: "rating_min", value: "1200" }, ref)).toBe("≥1200");
    expect(describeConstraintShort({ type: "rating_max", value: "1800" }, ref)).toBe("≤1800");
  });

  it("alternates_allowed δεν παράγει κείμενο", () => {
    expect(describeConstraintShort({ type: "alternates_allowed", value: [] }, ref)).toBe("");
  });
});

describe("describeConstraintsShort", () => {
  it("συνδυάζει πολλαπλούς όρους με διαχωριστικό, παραλείπει τα κενά", () => {
    const result = describeConstraintsShort(
      [
        { type: "gender", value: "F" },
        { type: "birth_year_from", value: "2010" },
        { type: "alternates_allowed", value: [] },
      ],
      2026
    );
    expect(result).toBe("F · U16");
  });

  it("καμία συνθήκη → κενό αποτέλεσμα", () => {
    expect(describeConstraintsShort([], 2026)).toBe("");
  });
});

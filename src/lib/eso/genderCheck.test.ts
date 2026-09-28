import { describe, it, expect } from "vitest";
import { genderMismatches, type AthleteGender } from "./genderCheck";

const a = (o: Partial<AthleteGender>): AthleteGender => ({ team: "ΣΟ ΠΟΛΙΧΝΗΣ", name: "TSOUROS Georgios", declared: "M", directoryId: "PLR-1", ...o });
const eso = (o: Record<string, string | null>) => new Map(Object.entries(o));

describe("genderMismatches", () => {
  it("δηλωμένος Άνδρας, ΕΣΟ Γυναίκα → ισχυρή προειδοποίηση", () => {
    const r = genderMismatches([a({ declared: "M" })], eso({ "PLR-1": "F" }), true);
    expect(r).toHaveLength(1);
    expect(r[0].severity).toBe("strong");
  });
  it("δηλωμένη Γυναίκα, ΕΣΟ χωρίς σήμα → ήπια προειδοποίηση, μόνο αν έχει εφαρμοστεί λίστα ΕΣΟ", () => {
    expect(genderMismatches([a({ declared: "F" })], eso({ "PLR-1": null }), true)[0].severity).toBe("soft");
    expect(genderMismatches([a({ declared: "F" })], eso({ "PLR-1": null }), false)).toEqual([]);
  });
  it("ασυμφωνία μόνο όταν όντως διαφέρουν: Γυναίκα/Γυναίκα και Άνδρας/κενό είναι εντάξει", () => {
    expect(genderMismatches([a({ declared: "F" })], eso({ "PLR-1": "F" }), true)).toEqual([]);
    expect(genderMismatches([a({ declared: "M" })], eso({ "PLR-1": null }), true)).toEqual([]);
  });
  it("αθλητές χωρίς κωδικό καταλόγου ή που λείπουν από τον κατάλογο αγνοούνται", () => {
    expect(genderMismatches([a({ directoryId: null })], eso({}), true)).toEqual([]);
    expect(genderMismatches([a({ directoryId: "PLR-9" })], eso({ "PLR-1": "F" }), true)).toEqual([]);
    expect(genderMismatches([a({ declared: null })], eso({ "PLR-1": "F" }), true)).toEqual([]);
  });
  it("οι ισχυρές προηγούνται των ήπιων", () => {
    const r = genderMismatches(
      [a({ declared: "F", directoryId: "PLR-2", team: "Α" }), a({ declared: "M", directoryId: "PLR-1", team: "Ω" })],
      eso({ "PLR-1": "F", "PLR-2": null }),
      true
    );
    expect(r.map((x) => x.severity)).toEqual(["strong", "soft"]);
  });
});

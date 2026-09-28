import { describe, it, expect } from "vitest";
import { submissionWindow } from "./window";

const T0 = "2026-11-26T16:00:00.000Z";
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000);

describe("submissionWindow", () => {
  it("δεν έχει ξεκινήσει αν δεν έχει δημοσιευτεί η κλήρωση", () => {
    const s = submissionWindow({ publishedAt: null, windowMinutes: 10, extendedUntil: null });
    expect(s).toEqual({ published: false, endsAt: null, open: false, expired: false });
  });

  it("είναι ανοιχτό μέσα στα 10 λεπτά και λήγει ακριβώς στο 10ο", () => {
    const base = { publishedAt: T0, windowMinutes: 10, extendedUntil: null };
    expect(submissionWindow({ ...base, now: at(0) }).open).toBe(true);
    expect(submissionWindow({ ...base, now: at(9.9) }).open).toBe(true);
    const end = submissionWindow({ ...base, now: at(10) });
    expect(end.open).toBe(false);
    expect(end.expired).toBe(true);
  });

  it("το ρυθμιζόμενο διάστημα (π.χ. 15΄) ισχύει", () => {
    const s = submissionWindow({ publishedAt: T0, windowMinutes: 15, extendedUntil: null, now: at(12) });
    expect(s.open).toBe(true);
  });

  it("η χειροκίνητη παράταση ανοίγει ξανά το παράθυρο", () => {
    const ext = at(20).toISOString();
    const before = submissionWindow({ publishedAt: T0, windowMinutes: 10, extendedUntil: null, now: at(12) });
    const after = submissionWindow({ publishedAt: T0, windowMinutes: 10, extendedUntil: ext, now: at(12) });
    expect(before.expired).toBe(true);
    expect(after.open).toBe(true);
    expect(submissionWindow({ publishedAt: T0, windowMinutes: 10, extendedUntil: ext, now: at(20) }).expired).toBe(true);
  });

  it("μια παράταση που έχει ήδη περάσει δεν μικραίνει το κανονικό παράθυρο", () => {
    const s = submissionWindow({
      publishedAt: T0, windowMinutes: 10, extendedUntil: at(3).toISOString(), now: at(8),
    });
    expect(s.open).toBe(true);
  });
});

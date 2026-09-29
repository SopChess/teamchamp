import { describe, it, expect } from "vitest";
import { registrationStatus, REGISTRATION_STATUS_LABEL } from "./registration";

const NOW = new Date("2026-09-29T12:00:00Z");

describe("registrationStatus", () => {
  it("μελλοντική προθεσμία → open", () => {
    expect(registrationStatus("2026-10-01T00:00:00Z", NOW)).toBe("open");
  });
  it("παρελθούσα προθεσμία → closed", () => {
    expect(registrationStatus("2026-09-01T00:00:00Z", NOW)).toBe("closed");
  });
  it("χωρίς προθεσμία → unscheduled", () => {
    expect(registrationStatus(null, NOW)).toBe("unscheduled");
    expect(registrationStatus(undefined, NOW)).toBe("unscheduled");
    expect(registrationStatus("", NOW)).toBe("unscheduled");
  });
  it("άκυρη ημερομηνία → unscheduled, όχι σφάλμα", () => {
    expect(registrationStatus("όχι-ημερομηνία", NOW)).toBe("unscheduled");
  });
  it("ακριβώς τη στιγμή της προθεσμίας → closed (δεν είναι πια αυστηρά μελλοντική)", () => {
    expect(registrationStatus("2026-09-29T12:00:00Z", NOW)).toBe("closed");
  });
  it("ένα δευτερόλεπτο πριν την προθεσμία → open", () => {
    expect(registrationStatus("2026-09-29T12:00:01Z", NOW)).toBe("open");
  });
  it("οι ελληνικές ετικέτες", () => {
    expect(REGISTRATION_STATUS_LABEL).toEqual({
      open: "Ανοιχτές Εγγραφές", closed: "Έκλεισαν οι Εγγραφές", unscheduled: "Δεν έχει οριστεί προθεσμία",
    });
  });
});

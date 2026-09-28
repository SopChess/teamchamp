import { describe, it, expect } from "vitest";
import {
  accessRequestMessage,
  isValidEmail,
  normalizeEmail,
  type AccessRequestStatus,
} from "./accessRequest";

const ALL: AccessRequestStatus[] = [
  "sent",
  "not_member",
  "sending_disabled",
  "send_failed",
  "invalid_email",
  "rate_limited",
];

describe("normalizeEmail / isValidEmail", () => {
  it("κάνει trim και lowercase", () => {
    expect(normalizeEmail("  Proedros@Example.GR ")).toBe("proedros@example.gr");
  });
  it("δέχεται έγκυρα και απορρίπτει άκυρα email", () => {
    expect(isValidEmail("a@b.gr")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.gr")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("accessRequestMessage", () => {
  it("έχει μήνυμα για κάθε κατάσταση", () => {
    for (const s of ALL) expect(accessRequestMessage(s).length).toBeGreaterThan(10);
  });

  it("τα δύο βασικά μηνύματα είναι ακριβώς όπως συμφωνήθηκαν", () => {
    expect(accessRequestMessage("sent")).toBe("Στάλθηκε link πρόσβασης στο email σας.");
    expect(accessRequestMessage("not_member")).toBe(
      "Δεν ανήκετε στο επιτελείο της διοργάνωσης."
    );
  });

  it("κανένα μήνυμα δεν χρησιμοποιεί ενικό (σου/σε/Ζήτα/Εισάγαγε κ.λπ.)", () => {
    const singular = /( σου\b|\bσου\b|Ζήτα\b|Εισάγαγε\b|Δεν ανήκεις|έχεις\b)/;
    for (const s of ALL) expect(accessRequestMessage(s)).not.toMatch(singular);
  });
});

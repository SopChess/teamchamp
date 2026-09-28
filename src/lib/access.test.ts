import { describe, it, expect } from "vitest";
import { isPathAllowed, type Access } from "./access";

const COMP_A = "11111111-1111-1111-1111-111111111111";
const COMP_B = "22222222-2222-2222-2222-222222222222";

const superAdmin: Access = { role: "super_admin", label: "Isaak", competition_ids: [] };
const referee: Access = { role: "referee", label: "Διαιτητής", competition_ids: [COMP_A] };
const tournamentAdmin: Access = {
  role: "tournament_admin",
  label: "Υπεύθυνος",
  competition_ids: [COMP_A],
};

describe("isPathAllowed", () => {
  it("super_admin μπαίνει παντού σε admin και referee", () => {
    expect(isPathAllowed(superAdmin, "/admin")).toBe(true);
    expect(isPathAllowed(superAdmin, "/admin/clubs")).toBe(true);
    expect(isPathAllowed(superAdmin, `/admin/${COMP_B}/rounds`)).toBe(true);
    expect(isPathAllowed(superAdmin, "/referee")).toBe(true);
  });

  it("referee μπαίνει μόνο στο /referee", () => {
    expect(isPathAllowed(referee, "/referee")).toBe(true);
    expect(isPathAllowed(referee, "/admin")).toBe(false);
    expect(isPathAllowed(referee, `/admin/${COMP_A}`)).toBe(false);
  });

  it("tournament_admin μπαίνει στη δική του διοργάνωση", () => {
    expect(isPathAllowed(tournamentAdmin, "/admin")).toBe(true);
    expect(isPathAllowed(tournamentAdmin, `/admin/${COMP_A}`)).toBe(true);
    expect(isPathAllowed(tournamentAdmin, `/admin/${COMP_A}/rounds`)).toBe(true);
  });

  it("tournament_admin δεν μπαίνει σε ξένη διοργάνωση ή στους Συλλόγους", () => {
    expect(isPathAllowed(tournamentAdmin, `/admin/${COMP_B}`)).toBe(false);
    expect(isPathAllowed(tournamentAdmin, `/admin/${COMP_B}/meetings`)).toBe(false);
    expect(isPathAllowed(tournamentAdmin, "/admin/clubs")).toBe(false);
  });

  it("tournament_admin δεν μπαίνει στο /referee", () => {
    expect(isPathAllowed(tournamentAdmin, "/referee")).toBe(false);
  });

  it("η σάρωση QR (/r/...) επιτρέπεται σε super_admin, referee και tournament_admin", () => {
    expect(isPathAllowed(superAdmin, "/r/abc123")).toBe(true);
    expect(isPathAllowed(referee, "/r/abc123")).toBe(true);
    expect(isPathAllowed(tournamentAdmin, "/r/abc123")).toBe(true);
  });

  it("δεν μπερδεύει το /r με άλλα paths (π.χ. /rounds, /referee-x)", () => {
    expect(isPathAllowed(referee, "/rounds")).toBe(false);
    expect(isPathAllowed(referee, "/refereex")).toBe(false);
  });

  it("δεν μπερδεύει παρόμοια paths (π.χ. /administrator)", () => {
    expect(isPathAllowed(superAdmin, "/administrator")).toBe(false);
  });
});

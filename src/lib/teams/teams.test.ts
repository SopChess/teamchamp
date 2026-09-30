import { describe, it, expect } from "vitest";
import { allowsFreeEntry, clubTypeFor, nextTeamNumber, parseNumberedName, requiresEsoCode, teamDisplayName } from "./teams";

describe("teamDisplayName", () => {
  it("η πρώτη ομάδα δεν παίρνει αριθμό", () => {
    expect(teamDisplayName("Σ.Ο. Πολίχνης", 1)).toBe("Σ.Ο. Πολίχνης");
  });
  it("η δεύτερη και τρίτη παίρνουν -2 / -3", () => {
    expect(teamDisplayName("Σ.Ο. Πολίχνης", 2)).toBe("Σ.Ο. Πολίχνης-2");
    expect(teamDisplayName("Σ.Ο. Πολίχνης", 3)).toBe("Σ.Ο. Πολίχνης-3");
  });
});

describe("nextTeamNumber", () => {
  it("πρώτη ομάδα ενός συλλόγου", () => {
    expect(nextTeamNumber([], 1)).toBe(1);
    expect(nextTeamNumber([], 3)).toBe(1);
  });
  it("όριο 1: η δεύτερη ομάδα μπλοκάρεται", () => {
    expect(nextTeamNumber([1], 1)).toBeNull();
  });
  it("όριο 3: επιτρέπονται μέχρι 3 ομάδες", () => {
    expect(nextTeamNumber([1], 3)).toBe(2);
    expect(nextTeamNumber([1, 2], 3)).toBe(3);
    expect(nextTeamNumber([1, 2, 3], 3)).toBeNull();
  });
  it("δεν ξαναγεμίζει κενά από διαγραφές", () => {
    expect(nextTeamNumber([1, 3], 3)).toBeNull(); // max already 3, at the cap
    expect(nextTeamNumber([1, 3], 5)).toBe(4);
  });
});

describe("parseNumberedName", () => {
  it("όνομα χωρίς αριθμό", () => {
    expect(parseNumberedName("Σ.Ο. Πολίχνης")).toEqual({ baseName: "Σ.Ο. Πολίχνης", teamNumber: 1 });
  });
  it("όνομα με αριθμό", () => {
    expect(parseNumberedName("Σ.Ο. Πολίχνης-2")).toEqual({ baseName: "Σ.Ο. Πολίχνης", teamNumber: 2 });
    expect(parseNumberedName("Σ.Ο. Πολίχνης-12")).toEqual({ baseName: "Σ.Ο. Πολίχνης", teamNumber: 12 });
  });
  it("δεν μπερδεύει παύλα μέσα στο κανονικό όνομα (π.χ. -1 δεν είναι αρίθμηση, ξεκινά από 2)", () => {
    expect(parseNumberedName("ΣΑ ΘΕΣ/ΚΗΣ-ΚΑΤΙ")).toEqual({ baseName: "ΣΑ ΘΕΣ/ΚΗΣ-ΚΑΤΙ", teamNumber: 1 });
    expect(parseNumberedName("Όνομα-1")).toEqual({ baseName: "Όνομα-1", teamNumber: 1 });
  });
  it("είναι αντίστροφο του teamDisplayName", () => {
    expect(parseNumberedName(teamDisplayName("Χ", 5))).toEqual({ baseName: "Χ", teamNumber: 5 });
  });
});

describe("clubTypeFor", () => {
  it("σχολεία → type school", () => {
    expect(clubTypeFor("school")).toBe("school");
  });
  it("ΕΣΟ και ελεύθερη επωνυμία → type club", () => {
    expect(clubTypeFor("eso_club")).toBe("club");
    expect(clubTypeFor("free_team")).toBe("club");
  });
});

describe("allowsFreeEntry — πάντα ο ίδιος γράφει το όνομα, σε όλους τους τύπους", () => {
  it("και στους τρεις τύπους", () => {
    expect(allowsFreeEntry("school")).toBe(true);
    expect(allowsFreeEntry("eso_club")).toBe(true);
    expect(allowsFreeEntry("free_team")).toBe(true);
  });
});

describe("requiresEsoCode", () => {
  it("μόνο οι σύλλογοι ΕΣΟ", () => {
    expect(requiresEsoCode("eso_club")).toBe(true);
    expect(requiresEsoCode("school")).toBe(false);
    expect(requiresEsoCode("free_team")).toBe(false);
  });
});

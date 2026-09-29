import { describe, it, expect } from "vitest";
import { emptyBoardRule, emptyConstraint, validateBoardRules } from "./builder";
import type { BoardRule } from "./types";

describe("emptyBoardRule / emptyConstraint", () => {
  it("δημιουργεί σκακιέρα χωρίς όρους", () => {
    expect(emptyBoardRule(3)).toEqual({ board: 3, constraints: [] });
  });
  it("το φύλο ξεκινά ως 'any', οι κοινοτικοί παίκτες ως άδεια λίστα", () => {
    expect(emptyConstraint("gender")).toEqual({ type: "gender", value: "any" });
    expect(emptyConstraint("alternates_allowed")).toEqual({ type: "alternates_allowed", value: [] });
    expect(emptyConstraint("rating_min")).toEqual({ type: "rating_min", value: "" });
  });
});

describe("validateBoardRules", () => {
  it("έγκυρες σκακιέρες δεν βγάζουν σφάλμα", () => {
    const rules: BoardRule[] = [
      { board: 1, constraints: [] },
      { board: 4, constraints: [{ type: "gender", value: "F" }], exempt_from_order: true },
    ];
    expect(validateBoardRules(rules)).toEqual([]);
  });
  it("πιάνει διπλή σκακιέρα", () => {
    const rules: BoardRule[] = [{ board: 1, constraints: [] }, { board: 1, constraints: [] }];
    expect(validateBoardRules(rules)[0]).toMatch(/περισσότερες από μία/);
  });
  it("πιάνει μη έγκυρο αριθμό σκακιέρας", () => {
    expect(validateBoardRules([{ board: 0, constraints: [] }])[0]).toMatch(/Μη έγκυρος/);
  });
  it("πιάνει άκυρη ημερομηνία", () => {
    const rules: BoardRule[] = [{ board: 1, constraints: [{ type: "birth_after", value: "2010" }] }];
    expect(validateBoardRules(rules)[0]).toMatch(/εεεε-μμ-ηη/);
  });
  it("δέχεται έγκυρη ημερομηνία", () => {
    const rules: BoardRule[] = [{ board: 1, constraints: [{ type: "birth_after", value: "2010-01-01" }] }];
    expect(validateBoardRules(rules)).toEqual([]);
  });
  it("πιάνει μη αριθμητικό βαθμό", () => {
    const rules: BoardRule[] = [{ board: 1, constraints: [{ type: "rating_min", value: "abc" }] }];
    expect(validateBoardRules(rules)[0]).toMatch(/αριθμός/);
  });
});

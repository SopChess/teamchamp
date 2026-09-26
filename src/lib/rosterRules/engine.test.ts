import { describe, it, expect } from "vitest";
import {
  validateComposition,
  computeDefaultAssignment,
  effectiveRating,
} from "./engine";
import type { Player, RosterEntry, RosterRules } from "./types";

// ---------------------------------------------------------------------------
// Δείγμα #2 / #4 (Μαθητικό ΕΣΟ, 24ο Σχολικό Θεσ/νίκης-Χαλκιδικής):
// roster 6, match 4 boards, boards 1-3 strength order, board 4 exempt + girl.
// ---------------------------------------------------------------------------
const schoolRules: RosterRules = {
  assignment_mode: "strength_order",
  roster_size: 6,
  match_board_count: 4,
  board_rules: [
    { board: 1, constraints: [] },
    { board: 2, constraints: [] },
    { board: 3, constraints: [] },
    { board: 4, constraints: [{ type: "gender", value: "F" }], exempt_from_order: true },
  ],
  reserve_count: 2,
};

const schoolPlayers: Record<string, Player> = {
  p1: { id: "p1", first_name: "GEORGIOS", last_name: "PAPADOPOULOS", gender: "M", rating_national: 1842 },
  p2: { id: "p2", first_name: "ELENI", last_name: "VASILEIOU", gender: "F", rating_national: 1795 },
  p3: { id: "p3", first_name: "KONSTANTINOS", last_name: "ANTONIOU", gender: "M", rating_national: 1710 },
  p4: { id: "p4", first_name: "MARIA", last_name: "IOANNIDOU", gender: "F", rating_national: 1655 },
  p5: { id: "p5", first_name: "PANAGIOTIS", last_name: "MOUSTAKAS", gender: "M", rating_national: 1590 },
  p6: { id: "p6", first_name: "SOFIA", last_name: "NIKOLAOU", gender: "F", rating_national: 1522 },
};

const schoolRoster: RosterEntry[] = [
  { player_id: "p1", declared_order: 1 },
  { player_id: "p2", declared_order: 2 },
  { player_id: "p3", declared_order: 3 },
  { player_id: "p4", declared_order: 4, default_board: 4 },
  { player_id: "p5", declared_order: 5 },
  { player_id: "p6", declared_order: 6 },
];

describe("strength_order — δείγμα σχολικού (board 4 = υποχρεωτικά κορίτσι, εκτός σειράς)", () => {
  it("δέχεται έγκυρη σύνθεση γύρου: 1,2,5 στη σειρά + board 4 = κορίτσι εκτός σειράς", () => {
    const result = validateComposition(schoolRules, schoolRoster, schoolPlayers, [
      { board: 1, player_id: "p1" },
      { board: 2, player_id: "p2" },
      { board: 3, player_id: "p5" }, // p3 sits out, p5 fills board 3 — order 1 < 2 < 5 OK
      { board: 4, player_id: "p4" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("απορρίπτει αγόρι στη 4η σκακιέρα", () => {
    const result = validateComposition(schoolRules, schoolRoster, schoolPlayers, [
      { board: 1, player_id: "p1" },
      { board: 2, player_id: "p2" },
      { board: 3, player_id: "p3" },
      { board: 4, player_id: "p5" }, // p5 is male
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.board === 4)).toBe(true);
  });

  it("απορρίπτει παραβίαση σειράς στις μη-εξαιρεμένες σκακιέρες", () => {
    const result = validateComposition(schoolRules, schoolRoster, schoolPlayers, [
      { board: 1, player_id: "p3" }, // order 3
      { board: 2, player_id: "p1" }, // order 1 — goes backwards
      { board: 3, player_id: "p5" },
      { board: 4, player_id: "p4" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.board === 2)).toBe(true);
  });

  it("απορρίπτει παίκτη εκτός ρόστερ", () => {
    const result = validateComposition(schoolRules, schoolRoster, schoolPlayers, [
      { board: 1, player_id: "ghost" },
      { board: 2, player_id: "p2" },
      { board: 3, player_id: "p3" },
      { board: 4, player_id: "p4" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("δεν ανήκει"))).toBe(true);
  });

  it("fallback: computeDefaultAssignment χρησιμοποιεί τη βασική σύνθεση όπως δηλώθηκε", () => {
    const fallback = computeDefaultAssignment(schoolRules, schoolRoster);
    // boards 1-3 filled in declared order skipping the default_board=4 player
    expect(fallback).toEqual(
      expect.arrayContaining([
        { board: 1, player_id: "p1" },
        { board: 2, player_id: "p2" },
        { board: 3, player_id: "p3" },
        { board: 4, player_id: "p4" },
      ])
    );
    const result = validateComposition(schoolRules, schoolRoster, schoolPlayers, fallback);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Δείγμα #3 (ΕΣΣΘ-Χ Προκριματική Φάση Παίδων-Κορασίδων): fixed_category,
// κάθε board σταθερή ηλικιακή/έμφυλη κατηγορία, χωρίς έννοια σειράς.
// ---------------------------------------------------------------------------
const fixedCategoryRules: RosterRules = {
  assignment_mode: "fixed_category",
  roster_size: null,
  board_rules: [
    { board: 1, constraints: [{ type: "gender", value: "any" }, { type: "birth_after", value: "2010-01-01" }] },
    { board: 2, constraints: [{ type: "gender", value: "any" }, { type: "birth_after", value: "2012-01-01" }] },
    { board: 5, constraints: [{ type: "gender", value: "F" }, { type: "birth_after", value: "2010-01-01" }] },
  ],
  one_player_per_category: true,
};

const fixedCategoryPlayers: Record<string, Player> = {
  a: { id: "a", first_name: "NIKOS", last_name: "A", gender: "M", birth_date: "2011-05-01" },
  b: { id: "b", first_name: "GIORGOS", last_name: "B", gender: "M", birth_date: "2013-02-01" },
  c: { id: "c", first_name: "ELENI", last_name: "C", gender: "F", birth_date: "2011-07-01" },
  d: { id: "d", first_name: "MARIA", last_name: "D", gender: "F", birth_date: "2013-09-01" }, // too young for board 5's 2010 cutoff check inverted intentionally below
};

const fixedCategoryRoster: RosterEntry[] = [
  { player_id: "a", declared_order: 1, default_board: 1 },
  { player_id: "b", declared_order: 2, default_board: 2 },
  { player_id: "c", declared_order: 3, default_board: 5 },
  { player_id: "d", declared_order: 4 },
];

describe("fixed_category — δείγμα ΕΣΣΘ-Χ (σταθερές ηλικιακές/έμφυλες κατηγορίες ανά board)", () => {
  it("δέχεται σύνθεση όπου κάθε board πληροί τη δική του κατηγορία", () => {
    const result = validateComposition(fixedCategoryRules, fixedCategoryRoster, fixedCategoryPlayers, [
      { board: 1, player_id: "a" },
      { board: 2, player_id: "b" },
      { board: 5, player_id: "c" },
    ]);
    expect(result.valid).toBe(true);
  });

  it("απορρίπτει αγόρι στο board 5 (υποχρεωτικά κορίτσι)", () => {
    const result = validateComposition(fixedCategoryRules, fixedCategoryRoster, fixedCategoryPlayers, [
      { board: 1, player_id: "a" },
      { board: 2, player_id: "b" },
      { board: 5, player_id: "b" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.board === 5)).toBe(true);
  });

  it("δεν ελέγχει καμία σχέση σειράς μεταξύ boards (fixed_category)", () => {
    // c is declared_order 3 but plays board 5 while a (order 1) plays board 1 — no ordering issue expected
    const result = validateComposition(fixedCategoryRules, fixedCategoryRoster, fixedCategoryPlayers, [
      { board: 1, player_id: "a" },
      { board: 2, player_id: "b" },
      { board: 5, player_id: "c" },
    ]);
    expect(result.issues.some((i) => i.message.includes("σειρά"))).toBe(false);
  });

  it("fallback χρησιμοποιεί τα default_board από το ρόστερ", () => {
    const fallback = computeDefaultAssignment(fixedCategoryRules, fixedCategoryRoster);
    expect(fallback).toEqual(
      expect.arrayContaining([
        { board: 1, player_id: "a" },
        { board: 2, player_id: "b" },
        { board: 5, player_id: "c" },
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// Κοινοτικός παίκτης εναλλάξιμος ανά συνάντηση (δείγμα #3, §6.2-6.4)
// ---------------------------------------------------------------------------
describe("alternates_allowed — κοινοτικός παίκτης override", () => {
  const rules: RosterRules = {
    assignment_mode: "fixed_category",
    roster_size: null,
    board_rules: [
      {
        board: 3,
        constraints: [
          { type: "birth_after", value: "2014-01-01" },
          { type: "alternates_allowed", value: ["community-1", "community-2"] },
        ],
      },
    ],
  };
  const players: Record<string, Player> = {
    "community-1": { id: "community-1", first_name: "X", last_name: "Y", birth_date: "2005-01-01" }, // too old normally
  };
  const roster: RosterEntry[] = [{ player_id: "community-1", declared_order: 1 }];

  it("επιτρέπει τον κοινοτικό παίκτη έστω κι αν δεν πληροί το ηλικιακό constraint", () => {
    const result = validateComposition(rules, roster, players, [
      { board: 3, player_id: "community-1" },
    ]);
    expect(result.valid).toBe(true);
  });
});

describe("effectiveRating — FIDE → εθνικό → 800 fallback", () => {
  it("προτιμά FIDE όταν υπάρχει", () => {
    expect(effectiveRating({ id: "x", first_name: "", last_name: "", rating_fide: 1900, rating_national: 1700 })).toBe(1900);
  });
  it("πέφτει σε εθνικό όταν λείπει FIDE", () => {
    expect(effectiveRating({ id: "x", first_name: "", last_name: "", rating_national: 1700 })).toBe(1700);
  });
  it("πέφτει σε 800 όταν λείπουν και τα δύο", () => {
    expect(effectiveRating({ id: "x", first_name: "", last_name: "" })).toBe(800);
  });
});

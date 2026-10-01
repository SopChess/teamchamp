import { describe, it, expect } from "vitest";
import {
  validateComposition,
  computeDefaultAssignment,
  effectiveRating,
  satisfiesBoardRule,
} from "./engine";
import type { Player, RosterEntry, RosterRules, BoardRule } from "./types";

// ---------------------------------------------------------------------------
// Νέος τύπος όρου: έτος γέννησης (επιβεβαιωμένο) — "από το έτος Χ" = από
// 1/1/Χ και μετά, "έως το έτος Χ" = μέχρι και 31/12/Χ (ολόκληρο το έτος Χ
// μετράει και στις δύο περιπτώσεις). Δίπλα στον υπάρχοντα τύπο με ακριβή
// ημερομηνία, όχι αντικατάσταση.
describe("birth_year_from / birth_year_until", () => {
  const player = (birth_date: string | undefined): Player =>
    ({ id: "p", first_name: "N", last_name: "L", birth_date } as Player);
  const rule = (type: "birth_year_from" | "birth_year_until", value: number | string): BoardRule => ({
    board: 1,
    constraints: [{ type, value }],
  });

  it("«από το έτος 2014»: όλο το 2014 μετράει, το 2013 όχι", () => {
    const r = rule("birth_year_from", 2014);
    expect(satisfiesBoardRule(player("2014-01-01"), r)).toBe(true); // ακριβώς η 1η μέρα του έτους
    expect(satisfiesBoardRule(player("2014-12-31"), r)).toBe(true); // η τελευταία μέρα του έτους
    expect(satisfiesBoardRule(player("2015-06-15"), r)).toBe(true); // μεταγενέστερο έτος
    expect(satisfiesBoardRule(player("2013-12-31"), r)).toBe(false); // μία μέρα πριν το όριο έτους
  });

  it("«έως το έτος 2014»: όλο το 2014 μετράει, το 2015 όχι", () => {
    const r = rule("birth_year_until", 2014);
    expect(satisfiesBoardRule(player("2014-01-01"), r)).toBe(true);
    expect(satisfiesBoardRule(player("2014-12-31"), r)).toBe(true);
    expect(satisfiesBoardRule(player("2013-01-01"), r)).toBe(true); // προγενέστερο έτος
    expect(satisfiesBoardRule(player("2015-01-01"), r)).toBe(false); // μία μέρα μετά το όριο έτους
  });

  it("δουλεύει και όταν η τιμή είναι ΑΛΦΑΡΙΘΜΗΤΙΚΟ (όπως πράγματι αποθηκεύεται από τη φόρμα)", () => {
    expect(satisfiesBoardRule(player("2014-06-01"), rule("birth_year_from", "2014"))).toBe(true);
    expect(satisfiesBoardRule(player("2013-06-01"), rule("birth_year_from", "2014"))).toBe(false);
  });

  it("χωρίς ημερομηνία γέννησης, δεν ικανοποιείται ο όρος (ίδια συμπεριφορά με birth_after/birth_before)", () => {
    expect(satisfiesBoardRule(player(undefined), rule("birth_year_from", 2014))).toBe(false);
    expect(satisfiesBoardRule(player(undefined), rule("birth_year_until", 2014))).toBe(false);
  });

  it("συνδυασμός με φύλο (π.χ. «κορίτσι, γεννημένη από το 2014»)", () => {
    const combo: BoardRule = { board: 4, constraints: [{ type: "gender", value: "F" }, { type: "birth_year_from", value: 2014 }] };
    const girl2015 = { ...player("2015-01-01"), gender: "F" } as Player;
    const boy2015 = { ...player("2015-01-01"), gender: "M" } as Player;
    const girl2013 = { ...player("2013-01-01"), gender: "F" } as Player;
    expect(satisfiesBoardRule(girl2015, combo)).toBe(true);
    expect(satisfiesBoardRule(boy2015, combo)).toBe(false);
    expect(satisfiesBoardRule(girl2013, combo)).toBe(false);
  });

  it("«από» και «έως» μαζί ορίζουν ένα ηλικιακό εύρος ετών", () => {
    const range: BoardRule = { board: 1, constraints: [{ type: "birth_year_from", value: 2012 }, { type: "birth_year_until", value: 2014 }] };
    expect(satisfiesBoardRule(player("2012-01-01"), range)).toBe(true);
    expect(satisfiesBoardRule(player("2014-12-31"), range)).toBe(true);
    expect(satisfiesBoardRule(player("2011-12-31"), range)).toBe(false);
    expect(satisfiesBoardRule(player("2015-01-01"), range)).toBe(false);
  });
});

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

describe("computeDefaultAssignment — αυτόματη επιλογή όταν δεν υπάρχει ρητό default_board", () => {
  const rosterNoDefaults: RosterEntry[] = [
    { player_id: "p1", declared_order: 1 },
    { player_id: "p2", declared_order: 2 },
    { player_id: "p3", declared_order: 3 },
    { player_id: "p4", declared_order: 4 },
    { player_id: "p5", declared_order: 5 },
    { player_id: "p6", declared_order: 6 },
  ];

  it("strength_order: η γυναικεία σκακιέρα παίρνει την πρώτη κατά σειρά επιλέξιμη αθλήτρια, οι άλλες τη σειρά", () => {
    const result = computeDefaultAssignment(schoolRules, rosterNoDefaults, schoolPlayers);
    expect(result).toEqual([
      { board: 1, player_id: "p1" },
      { board: 2, player_id: "p3" },
      { board: 3, player_id: "p4" },
      { board: 4, player_id: "p2" }, // p2 = πρώτη γυναίκα κατά σειρά
    ]);
  });

  it("το αποτέλεσμα περνά πάντα την επικύρωση κανόνων", () => {
    const result = computeDefaultAssignment(schoolRules, rosterNoDefaults, schoolPlayers);
    expect(validateComposition(schoolRules, rosterNoDefaults, schoolPlayers, result).valid).toBe(true);
  });

  it("δεν βάζει τον ίδιο παίκτη σε δύο σκακιέρες", () => {
    const result = computeDefaultAssignment(schoolRules, rosterNoDefaults, schoolPlayers);
    expect(new Set(result.map((a) => a.player_id)).size).toBe(result.length);
  });

  it("fixed_category: κάθε σκακιέρα παίρνει τον πρώτο επιλέξιμο, χωρίς επανάληψη", () => {
    const roster: RosterEntry[] = [
      { player_id: "a", declared_order: 1 },
      { player_id: "b", declared_order: 2 },
      { player_id: "c", declared_order: 3 },
    ];
    const result = computeDefaultAssignment(fixedCategoryRules, roster, fixedCategoryPlayers);
    expect(result).toEqual([
      { board: 1, player_id: "a" },
      { board: 2, player_id: "b" },
      { board: 5, player_id: "c" }, // c = πρώτο κορίτσι <16 που δεν χρησιμοποιήθηκε
    ]);
  });

  it("αν δεν υπάρχει επιλέξιμος παίκτης, η σκακιέρα μένει κενή (θα την πιάσει ο έλεγχος)", () => {
    const menOnly: RosterEntry[] = [
      { player_id: "p1", declared_order: 1 },
      { player_id: "p3", declared_order: 2 },
      { player_id: "p5", declared_order: 3 },
      { player_id: "p2x", declared_order: 4 },
    ];
    const players = { ...schoolPlayers, p2x: { id: "p2x", first_name: "X", last_name: "Y", gender: "M" as const } };
    const result = computeDefaultAssignment(schoolRules, menOnly, players);
    expect(result.find((a) => a.board === 4)).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { validateBasicRoster, boardCoverageStatus, describeConstraint } from "./basicRosterCheck";
import type { RosterRules, RosterEntry, Player } from "./types";

const rules: RosterRules = {
  assignment_mode: "strength_order",
  roster_size: 6,
  match_board_count: 4,
  board_rules: [
    { board: 1, constraints: [] },
    { board: 2, constraints: [] },
    { board: 3, constraints: [] },
    { board: 4, constraints: [{ type: "gender", value: "F" }], exempt_from_order: true },
  ],
};

const player = (id: string, gender: "M" | "F"): Player => ({ id, first_name: "N", last_name: id, gender } as Player);
const entry = (id: string, order: number): RosterEntry => ({ player_id: id, declared_order: order } as RosterEntry);

describe("validateBasicRoster", () => {
  it("επαρκής κατάλογος (6 αθλητές, τουλάχιστον μία γυναίκα) → κανένα σφάλμα", () => {
    const players = { p1: player("p1", "M"), p2: player("p2", "M"), p3: player("p3", "M"), p4: player("p4", "F"), p5: player("p5", "M"), p6: player("p6", "M") };
    const roster = [1, 2, 3, 4, 5, 6].map((i) => entry(`p${i}`, i));
    expect(validateBasicRoster(rules, roster, players)).toEqual([]);
  });

  it("λιγότεροι αθλητές απ' όσες σκακιέρες → ένα σαφές μήνυμα, χωρίς ανά-σκακιέρα λεπτομέρεια", () => {
    const players = { p1: player("p1", "M"), p2: player("p2", "M") };
    const roster = [entry("p1", 1), entry("p2", 2)];
    const errors = validateBasicRoster(rules, roster, players);
    expect(errors).toEqual(["Χρειάζονται τουλάχιστον 4 αθλητές για να καλυφθούν όλες οι σκακιέρες (έχετε 2)."]);
  });

  it("αρκετοί αθλητές αλλά καμία γυναίκα → μήνυμα ειδικά για τη σκακιέρα 4", () => {
    const players = { p1: player("p1", "M"), p2: player("p2", "M"), p3: player("p3", "M"), p4: player("p4", "M") };
    const roster = [1, 2, 3, 4].map((i) => entry(`p${i}`, i));
    const errors = validateBasicRoster(rules, roster, players);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Σκακιέρα 4/);
    expect(errors[0]).toMatch(/Γυναίκα/);
  });

  it("ακριβώς αρκετοί αθλητές, όλες οι σκακιέρες καλύπτονται", () => {
    const players = { p1: player("p1", "F"), p2: player("p2", "M"), p3: player("p3", "M"), p4: player("p4", "M") };
    const roster = [1, 2, 3, 4].map((i) => entry(`p${i}`, i));
    expect(validateBasicRoster(rules, roster, players)).toEqual([]);
  });

  it("χωρίς κανέναν όρο ανά σκακιέρα, αρκεί μόνο ο αριθμός", () => {
    const simple: RosterRules = { ...rules, board_rules: [{ board: 1, constraints: [] }, { board: 2, constraints: [] }, { board: 3, constraints: [] }, { board: 4, constraints: [] }] };
    const players = { p1: player("p1", "M"), p2: player("p2", "M"), p3: player("p3", "M"), p4: player("p4", "M") };
    const roster = [1, 2, 3, 4].map((i) => entry(`p${i}`, i));
    expect(validateBasicRoster(simple, roster, players)).toEqual([]);
  });

  it("άδειος κατάλογος", () => {
    expect(validateBasicRoster(rules, [], {})[0]).toMatch(/τουλάχιστον 4/);
  });
});

describe("describeConstraint", () => {
  it("κάθε τύπο όρου σε απλή γλώσσα", () => {
    expect(describeConstraint({ type: "gender", value: "F" })).toBe("Γυναίκα");
    expect(describeConstraint({ type: "gender", value: "M" })).toBe("Άνδρας");
    expect(describeConstraint({ type: "gender", value: "any" })).toBe("");
    expect(describeConstraint({ type: "birth_year_from", value: 2014 })).toBe("Γεννημένος/η από το 2014");
    expect(describeConstraint({ type: "birth_year_until", value: 2014 })).toBe("Γεννημένος/η έως το 2014");
    expect(describeConstraint({ type: "birth_after", value: "2010-01-01" })).toBe("Γεννημένος/η μετά από 2010-01-01");
    expect(describeConstraint({ type: "rating_min", value: 1200 })).toBe("Βαθμός ≥ 1200");
    expect(describeConstraint({ type: "rating_max", value: 1800 })).toBe("Βαθμός ≤ 1800");
    expect(describeConstraint({ type: "alternates_allowed", value: [] })).toBe("");
  });
});

describe("boardCoverageStatus — ζωντανές κάρτες σκακιερών (Σχέδιο Α: καθοδηγεί, δεν μπλοκάρει)", () => {
  it("σκακιέρα χωρίς κανέναν αθλητή που να ταιριάζει → covered: false, με ετικέτα του όρου", () => {
    const status = boardCoverageStatus(rules, [], {});
    const board4 = status.find((s) => s.board === 4)!;
    expect(board4).toEqual({ board: 4, label: "Γυναίκα", shortLabel: "F", covered: false });
  });

  it("μόλις προστεθεί αθλήτρια που καλύπτει τη σκακιέρα 4, γίνεται covered: true", () => {
    const players = { p1: player("p1", "F") };
    const roster = [entry("p1", 1)];
    const board4 = boardCoverageStatus(rules, roster, players).find((s) => s.board === 4)!;
    expect(board4.covered).toBe(true);
  });

  it("οι σκακιέρες χωρίς όρους έχουν κενή ετικέτα", () => {
    const board1 = boardCoverageStatus(rules, [], {}).find((s) => s.board === 1)!;
    expect(board1.label).toBe("");
  });

  it("ΔΕΝ πετάει σφάλμα με λίγους αθλητές (σε αντίθεση με το validateBasicRoster) — απλώς όσες σκακιέρες δεν καλύπτονται ακόμα μένουν ακάλυπτες", () => {
    const status = boardCoverageStatus(rules, [entry("p1", 1)], { p1: player("p1", "M") });
    expect(status).toHaveLength(4);
    expect(status.find((s) => s.board === 4)!.covered).toBe(false); // ο μοναδικός αθλητής δεν είναι κορίτσι
  });

  it("επιστρέφει τις σκακιέρες με τη σωστή σειρά αριθμού", () => {
    const status = boardCoverageStatus(rules, [], {});
    expect(status.map((s) => s.board)).toEqual([1, 2, 3, 4]);
  });
});

import { describe, it, expect } from "vitest";
import { validateBasicRoster } from "./basicRosterCheck";
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

import { describe, it, expect } from "vitest";
import { boardScore, computeStandings, type StandingsMatch } from "./standings";

const m = (
  id: string, a: string, b: string | null, results: (string | null)[], boardCount = 4
): StandingsMatch => ({ id, teamA: a, teamB: b, boardCount, results: results as StandingsMatch["results"] });

const rowOf = (rows: ReturnType<typeof computeStandings>, id: string) => rows.find((r) => r.teamId === id)!;

describe("boardScore", () => {
  it("νίκη, ήττα, ισοπαλία, α.α.", () => {
    expect(boardScore("1-0")).toEqual([1, 0]);
    expect(boardScore("0-1")).toEqual([0, 1]);
    expect(boardScore("1/2-1/2")).toEqual([0.5, 0.5]);
    expect(boardScore("forfeit_a")).toEqual([0, 1]);
    expect(boardScore("forfeit_b")).toEqual([1, 0]);
  });
});

describe("computeStandings — πλήρεις συναντήσεις", () => {
  const teams = ["A", "B", "C", "D"];
  const matches = [
    m("1", "A", "B", ["1-0", "1-0", "1-0", "0-1"]), // A 3 - B 1
    m("2", "C", "D", ["1/2-1/2", "1/2-1/2", "1/2-1/2", "1/2-1/2"]), // 2-2
  ];

  it("μοιράζει 2/1/0 και ταξινομεί", () => {
    const rows = computeStandings(teams, matches);
    expect(rowOf(rows, "A").matchPoints).toBe(2);
    expect(rowOf(rows, "B").matchPoints).toBe(0);
    expect(rowOf(rows, "C").matchPoints).toBe(1);
    expect(rowOf(rows, "D").matchPoints).toBe(1);
    expect(rows.map((r) => r.teamId)[0]).toBe("A");
    expect(rows[3].teamId).toBe("B");
  });

  it("οι ολοκληρωμένες συναντήσεις δεν είναι προσωρινές", () => {
    const rows = computeStandings(teams, matches);
    expect(rows.every((r) => !r.provisional)).toBe(true);
  });

  it("ολόκληρα ισόβαθμες ομάδες μοιράζονται την ίδια θέση", () => {
    const rows = computeStandings(teams, matches);
    expect(rowOf(rows, "C").rank).toBe(2);
    expect(rowOf(rows, "D").rank).toBe(2);
    expect(rowOf(rows, "B").rank).toBe(4);
  });
});

describe("computeStandings — ζωντανά/μερικά αποτελέσματα", () => {
  const teams = ["A", "B", "C", "D"];

  it("συνάντηση χωρίς κανένα αποτέλεσμα δεν μοιράζει βαθμούς", () => {
    const rows = computeStandings(teams, [m("1", "A", "B", [null, null, null, null])]);
    expect(rows.every((r) => r.matchPoints === 0 && r.played === 0)).toBe(true);
  });

  it("με ένα μόνο αποτέλεσμα (1-0) η ομάδα που προηγείται παίρνει προσωρινά τη νίκη", () => {
    const rows = computeStandings(teams, [m("1", "A", "B", ["1-0", null, null, null])]);
    expect(rowOf(rows, "A").matchPoints).toBe(2);
    expect(rowOf(rows, "B").matchPoints).toBe(0);
    expect(rowOf(rows, "A").provisional).toBe(true);
    expect(rows[0].teamId).toBe("A");
  });

  it("η κατάταξη αλλάζει όταν αλλάζει το σκορ ενδιάμεσα", () => {
    const early = computeStandings(teams, [m("1", "A", "B", ["1-0", null, null, null])]);
    const later = computeStandings(teams, [m("1", "A", "B", ["1-0", "0-1", "0-1", null])]);
    expect(early[0].teamId).toBe("A");
    expect(later[0].teamId).toBe("B");
  });

  it("ισοπαλία στο τρέχον σκορ δίνει 1 βαθμό σε καθεμία, προσωρινά", () => {
    const rows = computeStandings(teams, [m("1", "A", "B", ["1-0", "0-1", null, null])]);
    expect(rowOf(rows, "A").matchPoints).toBe(1);
    expect(rowOf(rows, "B").matchPoints).toBe(1);
  });
});

describe("computeStandings — BYE και ποινή α.α.", () => {
  it("το BYE δίνει 2 βαθμούς και το μισό των σκακιερών ως πόντους", () => {
    const rows = computeStandings(["A", "B"], [m("1", "A", null, [])]);
    expect(rowOf(rows, "A").matchPoints).toBe(2);
    expect(rowOf(rows, "A").boardPoints).toBe(2);
    expect(rowOf(rows, "A").played).toBe(1);
  });

  it("το BYE δέχεται ρυθμιζόμενους βαθμούς (π.χ. 1 βαθμός και 3,5 πόντοι σε 6 σκακιέρες)", () => {
    const rows = computeStandings(["A", "B"], [m("1", "A", null, [], 6)], {
      byeMatchPoints: 1, byeBoardPoints: 3.5,
    });
    expect(rowOf(rows, "A").matchPoints).toBe(1);
    expect(rowOf(rows, "A").boardPoints).toBe(3.5);
  });

  it("ήττα χωρίς αγώνα σε όλη τη συνάντηση αφαιρεί τη ρυθμισμένη ποινή", () => {
    const rows = computeStandings(
      ["A", "B"],
      [m("1", "A", "B", ["forfeit_b", "forfeit_b", "forfeit_b", "forfeit_b"])],
      { forfeitLossPenalty: 1 }
    );
    expect(rowOf(rows, "A").matchPoints).toBe(2);
    expect(rowOf(rows, "B").matchPoints).toBe(-1);
  });

  it("η ποινή δεν εφαρμόζεται όταν λείπει μόνο μία σκακιέρα", () => {
    const rows = computeStandings(
      ["A", "B"],
      [m("1", "A", "B", ["forfeit_b", "1-0", "1-0", "1-0"])],
      { forfeitLossPenalty: 1 }
    );
    expect(rowOf(rows, "B").matchPoints).toBe(0);
  });
});

describe("computeStandings — κριτήρια ισοβαθμίας", () => {
  it("με ίδιους βαθμούς, προηγείται όποια έχει περισσότερους πόντους σκακιέρων", () => {
    // A και C νικούν από 2 βαθμούς· η A με 3-1, η C με 2,5-1,5
    const rows = computeStandings(
      ["A", "B", "C", "D"],
      [
        m("1", "A", "B", ["1-0", "1-0", "1-0", "0-1"]),
        m("2", "C", "D", ["1-0", "1-0", "1/2-1/2", "0-1"]),
      ],
      { tiebreaks: ["board_points"] }
    );
    expect(rows[0].teamId).toBe("A");
    expect(rows[1].teamId).toBe("C");
  });

  it("η σειρά των κριτηρίων ρυθμίζεται και ΑΛΛΑΖΕΙ το αποτέλεσμα", () => {
    // Α, Β, Δ τελειώνουν όλες με 2 βαθμούς.
    //  Α νίκησε Β (3-1) και έχασε από Δ (0-4)  → Α: 3 πόντοι σκακιέρων
    //  Β νίκησε Γ (4-0) και έχασε από Α (1-3)  → Β: 5 πόντοι σκακιέρων
    //  Δ νίκησε Α (4-0)                        → Δ: 4 πόντοι σκακιέρων
    const teams = ["A", "B", "C", "D"];
    const matches = [
      m("1", "A", "B", ["1-0", "1-0", "1-0", "0-1"]),
      m("2", "B", "C", ["1-0", "1-0", "1-0", "1-0"]),
      m("3", "D", "A", ["1-0", "1-0", "1-0", "1-0"]),
    ];

    const byBoardPoints = computeStandings(teams, matches, { tiebreaks: ["board_points"] });
    expect(byBoardPoints.filter((r) => r.matchPoints === 2).map((r) => r.teamId)).toEqual(["B", "D", "A"]);

    // Με πρώτο κριτήριο το μεταξύ τους αποτέλεσμα, η Β (που έχασε από την Α) πέφτει τελευταία.
    const byHeadToHead = computeStandings(teams, matches, { tiebreaks: ["head_to_head"] });
    const tiedGroup = byHeadToHead.filter((r) => r.matchPoints === 2);
    expect(tiedGroup[tiedGroup.length - 1].teamId).toBe("B");
    expect(byHeadToHead.find((r) => r.teamId === "B")!.rank).toBe(3);
    expect(byBoardPoints.find((r) => r.teamId === "B")!.rank).toBe(1);
  });

  it("το μεταξύ τους αποτέλεσμα μετράει ΜΟΝΟ ανάμεσα στις ισόβαθμες ομάδες", () => {
    // Α νίκησε Β, Β νίκησε Γ, Γ νίκησε Α: όλες 2 βαθμούς — ισοπαλία στο h2h
    const rows = computeStandings(
      ["A", "B", "C"],
      [
        m("1", "A", "B", ["1-0", "1-0", "1-0", "0-1"]),
        m("2", "B", "C", ["1-0", "1-0", "1-0", "0-1"]),
        m("3", "C", "A", ["1-0", "1-0", "1-0", "0-1"]),
      ],
      { tiebreaks: ["head_to_head"] }
    );
    expect(new Set(rows.map((r) => r.rank)).size).toBe(1);
  });

  it("board_order: προηγείται όποια έχει περισσότερους πόντους στην 1η σκακιέρα", () => {
    const rows = computeStandings(
      ["A", "B", "C", "D"],
      [
        m("1", "A", "B", ["1-0", "0-1", "1-0", "0-1"]), // 2-2, A: 1η σκακιέρα 1
        m("2", "C", "D", ["0-1", "1-0", "0-1", "1-0"]), // 2-2, C: 1η σκακιέρα 0
      ],
      { tiebreaks: ["board_order"] }
    );
    const idxA = rows.findIndex((r) => r.teamId === "A");
    const idxC = rows.findIndex((r) => r.teamId === "C");
    expect(idxA).toBeLessThan(idxC);
  });

  it("η προεπιλογή (χωρίς ρύθμιση) δεν σπάει και δίνει ντετερμινιστική σειρά", () => {
    const rows = computeStandings(["A", "B"], [m("1", "A", "B", ["1-0", "1-0", "1-0", "0-1"])]);
    expect(rows.map((r) => r.teamId)).toEqual(["A", "B"]);
  });

  it("buchholz και sonneborn_berger υπολογίζονται χωρίς σφάλμα", () => {
    const rows = computeStandings(
      ["A", "B", "C", "D"],
      [
        m("1", "A", "B", ["1-0", "1-0", "1-0", "0-1"]),
        m("2", "C", "D", ["1-0", "1-0", "1-0", "0-1"]),
        m("3", "A", "C", ["1-0", "0-1", "1-0", "0-1"]),
        m("4", "B", "D", ["1-0", "0-1", "1-0", "0-1"]),
      ],
      { tiebreaks: ["buchholz", "sonneborn_berger"] }
    );
    expect(rows).toHaveLength(4);
  });
});

import { formatPoints } from "./standings";
describe("formatPoints", () => {
  it("εμφανίζει ½ σωστά", () => {
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(0.5)).toBe("½");
    expect(formatPoints(2.5)).toBe("2½");
    expect(formatPoints(3)).toBe("3");
  });
});

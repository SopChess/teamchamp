import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSwissTeamPairings, normalizeTeamName } from "./parsePairings";

/** Αναπαράγει ακριβώς τη δομή του πραγματικού αρχείου Swiss-Manager. */
function buildWorkbookBuffer(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

const REAL_FILE_ROWS: unknown[][] = [
  ["18o Ομαδικό Πρωτάθλημα Παίδων-Κορασίδων ΕΣΣΘ-Χ 2026"],
  [],
  ["Round 1 on 2026/09/20 at 17:00"],
  [],
  ["No.", "SNo.", "Team", "MP", "Res.", "MP", "Team", "SNo."],
  [1, 1, 'ΑΣ ΘΕΣΣΑΛΟΝΙΚΗΣ "Ο ΑΡΗΣ"', "0", "-", "0", 'ΣΑ ΘΕΣ/ΚΗΣ "ΛΕΥΚΟΣ ΠΥΡΓΟΣ"', 7],
  [2, 8, "ΣΟ ΚΑΛΑΜΑΡΙΑΣ", "0", "-", "0", "ΕΣ ΘΕΣΣΑΛΟΝΙΚΗΣ", 2],
  [3, 3, "ΣΟ ΠΟΛΙΧΝΗΣ", "0", "-", "0", "ΟΣ ΤΡΙΑΝΔΡΙΑΣ", 9],
  [4, 10, "ΕΣ ΔΗΜΟΥ ΘΕΡΜΗΣ", "0", "-", "0", 'ΣΟ "ΣΑΧ" ΘΕΣΣΑΛΟΝΙΚΗΣ', 4],
  [5, 5, 'ΑΣΟ ΕΥΟΣΜΟΥ "ΙΠΠΑΡΙΟΝ"', "0", "-", "0", 'ΑΠΟ ΘΕΡΜΗΣ "Ο ΘΕΡΜΑΪΚΟΣ"', 11],
  [6, 12, "ΑΣΟ ΠΟΛΥΓΥΡΟΥ", "0", "-", "0", "ΕΣ ΚΑΛΑΜΑΡΙΑΣ", 6],
  [7, 13, "ΣΑ ΜΟΥΔΑΝΙΩΝ", "0", "0", "", "Bye", ""],
  [],
  ["Program Swiss-Manager developed and copyright © by DI.Heinz Herzog, ..."],
  ["Mail:h.herzog@swiss-manager.at, ..."],
  ["Details on this tournament can be found on http://chess-results.com"],
];

describe("parseSwissTeamPairings — πάνω στο πραγματικό δείγμα (18ο ΕΣΣΘ-Χ, Γύρος 1)", () => {
  it("βρίσκει τον σωστό αριθμό γύρου", () => {
    const { roundNumber } = parseSwissTeamPairings(buildWorkbookBuffer(REAL_FILE_ROWS));
    expect(roundNumber).toBe(1);
  });

  it("διαβάζει και τις 7 συναντήσεις με τη σωστή αρίθμηση", () => {
    const { pairings } = parseSwissTeamPairings(buildWorkbookBuffer(REAL_FILE_ROWS));
    expect(pairings).toHaveLength(7);
    expect(pairings.map((p) => p.meetingNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("διαβάζει σωστά ονόματα ομάδων με εισαγωγικά μέσα", () => {
    const { pairings } = parseSwissTeamPairings(buildWorkbookBuffer(REAL_FILE_ROWS));
    expect(pairings[0].teamAName).toBe('ΑΣ ΘΕΣΣΑΛΟΝΙΚΗΣ "Ο ΑΡΗΣ"');
    expect(pairings[0].teamBName).toBe('ΣΑ ΘΕΣ/ΚΗΣ "ΛΕΥΚΟΣ ΠΥΡΓΟΣ"');
  });

  it("αναγνωρίζει σωστά το ΣΟ ΠΟΛΙΧΝΗΣ στη Συνάντηση 3", () => {
    const { pairings } = parseSwissTeamPairings(buildWorkbookBuffer(REAL_FILE_ROWS));
    const meeting3 = pairings.find((p) => p.meetingNumber === 3);
    expect(meeting3?.teamAName).toBe("ΣΟ ΠΟΛΙΧΝΗΣ");
    expect(meeting3?.teamBName).toBe("ΟΣ ΤΡΙΑΝΔΡΙΑΣ");
  });

  it("αναγνωρίζει το BYE ως null αντίπαλο, όχι ως όνομα ομάδας", () => {
    const { pairings } = parseSwissTeamPairings(buildWorkbookBuffer(REAL_FILE_ROWS));
    const byeRow = pairings.find((p) => p.meetingNumber === 7);
    expect(byeRow?.teamAName).toBe("ΣΑ ΜΟΥΔΑΝΙΩΝ");
    expect(byeRow?.teamBName).toBeNull();
  });

  it("δεν επηρεάζεται από επιπλέον γραμμή τίτλου πριν την επικεφαλίδα", () => {
    const withExtraRow = [
      ["Έκτακτη ανακοίνωση διοργάνωσης"],
      ...REAL_FILE_ROWS,
    ];
    const { roundNumber, pairings } = parseSwissTeamPairings(buildWorkbookBuffer(withExtraRow));
    expect(roundNumber).toBe(1);
    expect(pairings).toHaveLength(7);
    expect(pairings[2].teamAName).toBe("ΣΟ ΠΟΛΙΧΝΗΣ");
  });

  it("δεν επηρεάζεται από αφαιρεμένη κενή γραμμή πριν την επικεφαλίδα", () => {
    const withoutBlankRow = REAL_FILE_ROWS.filter((_, i) => i !== 3); // αφαιρεί την κενή γραμμή πριν το "No."
    const { roundNumber, pairings } = parseSwissTeamPairings(buildWorkbookBuffer(withoutBlankRow));
    expect(roundNumber).toBe(1);
    expect(pairings).toHaveLength(7);
  });

  it("σταματάει στις υποσημειώσεις Swiss-Manager, δεν τις μπερδεύει με συναντήσεις", () => {
    const { pairings } = parseSwissTeamPairings(buildWorkbookBuffer(REAL_FILE_ROWS));
    expect(pairings.every((p) => Number.isFinite(p.meetingNumber))).toBe(true);
  });

  it("πετάει σαφές σφάλμα αν λείπει η επικεφαλίδα 'No.'", () => {
    const broken = REAL_FILE_ROWS.filter((r) => r[0] !== "No.");
    expect(() => parseSwissTeamPairings(buildWorkbookBuffer(broken))).toThrow(/No\./);
  });
});

describe("normalizeTeamName", () => {
  it("κάνει trim, uppercase, και συμπτύσσει πολλαπλά κενά", () => {
    expect(normalizeTeamName("  Σο   Πολιχνησ  ")).toBe("ΣΟ ΠΟΛΙΧΝΗΣ");
  });
});

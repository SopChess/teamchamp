import * as XLSX from "xlsx";

export interface ParsedPairing {
  meetingNumber: number;
  teamAName: string;
  /** null σημαίνει BYE — καμία αντίπαλη ομάδα */
  teamBName: string | null;
}

export interface ParsedRoundPairings {
  roundNumber: number;
  pairings: ParsedPairing[];
}

/**
 * Διαβάζει ένα αρχείο "Team Pairings for Round N" όπως το εξάγει το
 * Swiss-Manager (.xls/.xlsx). ΔΕΝ υποθέτει σταθερό αριθμό γραμμής για την
 * επικεφαλίδα ή τα δεδομένα — ο Isaak επισήμανε ρητά ότι μια γραμμή τίτλου
 * ή σχολίου μπορεί να προστεθεί/αφαιρεθεί πάνω από τον πίνακα. Αντ' αυτού:
 *
 * 1. Σαρώνει όλες τις γραμμές για να βρει αυτή όπου η πρώτη στήλη είναι
 *    ακριβώς "No." (case-insensitive, trimmed) — αυτή είναι η επικεφαλίδα.
 * 2. Διαβάζει συναντήσεις ΑΜΕΣΩΣ ΜΕΤΑ από εκείνη τη γραμμή, μέχρι η πρώτη
 *    στήλη μιας γραμμής να μην είναι πια αριθμός (τέλος πίνακα — υποσημειώσεις
 *    Swiss-Manager, κενή γραμμή, κ.λπ.).
 * 3. Ξεχωριστά, ψάχνει όλο το αρχείο για μια γραμμή "Round N on ..." για να
 *    πάρει τον αριθμό γύρου.
 * 4. Όταν η δεύτερη ομάδα είναι κυριολεκτικά "Bye" (ή κενή), το καταγράφει
 *    ως bye — καμία δεύτερη ομάδα.
 *
 * Στήλες (0-indexed) όπως τις εξάγει το Swiss-Manager:
 *   0: No.  1: SNo.  2: Team (A)  3: MP  4: Res.  5: MP  6: Team (B)  7: SNo.
 */
export function parseSwissTeamPairings(buffer: ArrayBuffer): ParsedRoundPairings {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });

  let roundNumber: number | null = null;
  let headerRowIndex: number | null = null;

  for (let i = 0; i < rows.length; i++) {
    const first = rows[i]?.[0];
    if (typeof first === "string") {
      const roundMatch = first.match(/Round\s+(\d+)/i);
      if (roundMatch) {
        roundNumber = Number(roundMatch[1]);
      }
      if (first.trim().toUpperCase() === "NO.") {
        headerRowIndex = i;
      }
    }
  }

  if (headerRowIndex == null) {
    throw new Error('Δεν βρέθηκε η γραμμή επικεφαλίδας ("No.") μέσα στο αρχείο.');
  }
  if (roundNumber == null) {
    throw new Error('Δεν βρέθηκε ο αριθμός γύρου (γραμμή "Round N on ...") μέσα στο αρχείο.');
  }

  const pairings: ParsedPairing[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const meetingNumberRaw = row[0];
    if (typeof meetingNumberRaw !== "number") break; // τέλος του πίνακα συναντήσεων

    const teamAName = String(row[2] ?? "").trim();
    const teamBNameRaw = String(row[6] ?? "").trim();
    const teamBName =
      teamBNameRaw === "" || teamBNameRaw.toUpperCase() === "BYE" ? null : teamBNameRaw;

    pairings.push({ meetingNumber: meetingNumberRaw, teamAName, teamBName });
  }

  return { roundNumber, pairings };
}

/** Κανονικοποίηση ονόματος ομάδας για ασφαλή σύγκριση (trim/uppercase/κενά). */
export function normalizeTeamName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

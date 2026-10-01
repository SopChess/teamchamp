import { describe, it, expect } from "vitest";
import {
  effectiveTournamentStatus, isRegistrationOpen, isValidTournamentStatus, TOURNAMENT_STATUS_LABEL,
} from "./tournamentStatus";

const NOW = new Date("2026-10-01T12:00:00Z");
const FUTURE = "2026-11-01T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";

describe("effectiveTournamentStatus", () => {
  it("open με μελλοντική προθεσμία → παραμένει open", () => {
    expect(effectiveTournamentStatus("open", FUTURE, NOW)).toBe("open");
  });
  it("open ΧΩΡΙΣ προθεσμία → παραμένει open (καμία αυτόματη μετάβαση)", () => {
    expect(effectiveTournamentStatus("open", null, NOW)).toBe("open");
  });
  it("open με περασμένη προθεσμία → αυτόματα closed", () => {
    expect(effectiveTournamentStatus("open", PAST, NOW)).toBe("closed");
  });
  it("ακριβώς τη στιγμή της προθεσμίας → ήδη closed (ίδιο όριο με πριν)", () => {
    expect(effectiveTournamentStatus("open", NOW.toISOString(), NOW)).toBe("closed");
  });
  it("ένα δευτερόλεπτο πριν την προθεσμία → ακόμα open", () => {
    const almostNow = new Date(NOW.getTime() + 1000).toISOString();
    expect(effectiveTournamentStatus("open", almostNow, NOW)).toBe("open");
  });

  it("closed/in_progress/completed ΔΕΝ επηρεάζονται ΠΟΤΕ από την προθεσμία — ρητή απόφαση", () => {
    expect(effectiveTournamentStatus("closed", FUTURE, NOW)).toBe("closed");
    expect(effectiveTournamentStatus("in_progress", PAST, NOW)).toBe("in_progress");
    expect(effectiveTournamentStatus("in_progress", null, NOW)).toBe("in_progress");
    expect(effectiveTournamentStatus("completed", FUTURE, NOW)).toBe("completed");
  });

  it("ο admin μπορεί να ξαναβάλει open με νέα μελλοντική προθεσμία, ακόμα κι αν ήταν closed πριν", () => {
    // (δεν υπάρχει "προηγούμενη κατάσταση" στη συνάρτηση — απλώς επιβεβαιώνουμε ότι ένα
    // φρέσκο "open" με μελλοντική προθεσμία πάντα υπολογίζεται ως ανοιχτό, ανεξαρτήτως ιστορικού)
    expect(effectiveTournamentStatus("open", FUTURE, NOW)).toBe("open");
  });
});

describe("isRegistrationOpen", () => {
  it("true μόνο όταν η αποτελεσματική κατάσταση είναι open", () => {
    expect(isRegistrationOpen("open", FUTURE, NOW)).toBe(true);
    expect(isRegistrationOpen("open", null, NOW)).toBe(true);
    expect(isRegistrationOpen("open", PAST, NOW)).toBe(false);
    expect(isRegistrationOpen("closed", null, NOW)).toBe(false);
    expect(isRegistrationOpen("in_progress", FUTURE, NOW)).toBe(false);
    expect(isRegistrationOpen("completed", FUTURE, NOW)).toBe(false);
  });
});

describe("isValidTournamentStatus", () => {
  it("οι 4 έγκυρες τιμές", () => {
    expect(isValidTournamentStatus("open")).toBe(true);
    expect(isValidTournamentStatus("closed")).toBe(true);
    expect(isValidTournamentStatus("in_progress")).toBe(true);
    expect(isValidTournamentStatus("completed")).toBe(true);
  });
  it("απορρίπτει άκυρη τιμή", () => {
    expect(isValidTournamentStatus("")).toBe(false);
    expect(isValidTournamentStatus("cancelled")).toBe(false);
  });
});

describe("TOURNAMENT_STATUS_LABEL", () => {
  it("ελληνικές ετικέτες για τις 4 καταστάσεις", () => {
    expect(TOURNAMENT_STATUS_LABEL).toEqual({
      open: "Ανοιχτές Εγγραφές", closed: "Έκλεισαν οι Εγγραφές",
      in_progress: "Σε Εξέλιξη", completed: "Ολοκληρώθηκε",
    });
  });
});

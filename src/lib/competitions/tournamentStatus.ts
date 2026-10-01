/** Κατάσταση διοργάνωσης — επιβεβαιωμένο μοντέλο: Ανοιχτό → Κλειστό (αυτόματα, μόλις
 * περάσει η προθεσμία) ή Σε Εξέλιξη (το τουρνουά ξεκίνησε, ο admin το ορίζει) →
 * Ολοκληρώθηκε (ο admin). Ο admin μπορεί να το ξαναβάλει σε Ανοιχτό οποτεδήποτε. */

export type TournamentStatus = "open" | "closed" | "in_progress" | "completed";

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  open: "Ανοιχτές Εγγραφές",
  closed: "Έκλεισαν οι Εγγραφές",
  in_progress: "Σε Εξέλιξη",
  completed: "Ολοκληρώθηκε",
};

const VALID: readonly TournamentStatus[] = ["open", "closed", "in_progress", "completed"];

export function isValidTournamentStatus(v: string): v is TournamentStatus {
  return (VALID as readonly string[]).includes(v);
}

/**
 * Η αποτελεσματική κατάσταση για εμφάνιση/έλεγχο εγγραφών — καθαρή συνάρτηση,
 * καμία εγγραφή στη βάση. Μόνο η "open" υπόκειται σε αυτόματη μετάβαση: αν η
 * προθεσμία έχει περάσει, υπολογίζεται ως "closed" — ΧΩΡΙΣ να αλλάξει η
 * αποθηκευμένη τιμή. Αν ο admin ξαναβάλει ρητά "open" ΜΕ μελλοντική (ή καμία)
 * προθεσμία, παραμένει κανονικά ανοιχτό· "closed"/"in_progress"/"completed" δεν
 * επηρεάζονται ποτέ από την προθεσμία — είναι πάντα ρητή απόφαση.
 */
export function effectiveTournamentStatus(
  stored: TournamentStatus,
  registrationDeadline: string | null,
  now: Date = new Date()
): TournamentStatus {
  if (stored === "open" && registrationDeadline && new Date(registrationDeadline) <= now) {
    return "closed";
  }
  return stored;
}

/** Επιτρέπεται δημόσια εγγραφή ομάδας αυτή τη στιγμή; */
export function isRegistrationOpen(
  stored: TournamentStatus,
  registrationDeadline: string | null,
  now: Date = new Date()
): boolean {
  return effectiveTournamentStatus(stored, registrationDeadline, now) === "open";
}

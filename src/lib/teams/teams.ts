/**
 * Πολλαπλές ομάδες από τον ίδιο σύλλογο μέσα σε μία διοργάνωση (επιβεβαιωμένο):
 * η 1η ομάδα εμφανίζεται με το όνομα του συλλόγου, η 2η με "-2", η 3η με "-3"
 * κ.ο.κ. Το πραγματικό όνομα του συλλόγου στον κατάλογο ΔΕΝ αλλάζει ποτέ — η
 * αρίθμηση είναι μόνο εμφάνιση ομάδας μέσα σε αυτή τη διοργάνωση.
 */

export type AudienceType = "school" | "eso_club" | "free_team";

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  school: "Σχολεία",
  eso_club: "Ομάδες μέλη ΕΣΟ",
  free_team: "Ομάδες ελεύθερης επωνυμίας",
};

export const AUDIENCE_FIELD_LABEL: Record<AudienceType, string> = {
  school: "Όνομα Σχολείου",
  eso_club: "Επωνυμία Συλλόγου",
  free_team: "Επωνυμία Ομάδας",
};

export const AUDIENCE_FIELD_EXAMPLE: Record<AudienceType, string> = {
  school: "π.χ. 4ο Δημοτικό Σχολείο Πολίχνης",
  eso_club: "π.χ. Σκακιστικός Όμιλος Πολίχνης",
  free_team: "π.χ. Κασκαντέρ",
};

/** Το club_or_school.type που ταιριάζει σε κάθε τύπο διοργάνωσης. */
export function clubTypeFor(audience: AudienceType): "club" | "school" {
  return audience === "school" ? "school" : "club";
}

/** Μόνο σε διοργανώσεις ελεύθερης επωνυμίας επιτρέπεται καινούργιο όνομα επιτόπου. */
export function allowsFreeEntry(audience: AudienceType): boolean {
  return audience === "free_team";
}

export function teamDisplayName(clubName: string, teamNumber: number): string {
  return teamNumber > 1 ? `${clubName}-${teamNumber}` : clubName;
}

/**
 * Επόμενος αριθμός ομάδας για έναν σύλλογο μέσα σε μία διοργάνωση. Δεν ξαναγεμίζει
 * κενά από διαγραφές (π.χ. αν μείνει μόνο η 1 και η 3, ο επόμενος θα ήταν 4, όχι
 * 2) — απλούστερο και αποτρέπει σύγχυση αν μια αρίθμηση είχε ήδη ανακοινωθεί.
 * Επιστρέφει null αν έχει φτάσει το όριο της διοργάνωσης.
 */
export function nextTeamNumber(existingNumbers: number[], maxPerClub: number): number | null {
  const next = existingNumbers.length === 0 ? 1 : Math.max(...existingNumbers) + 1;
  return next <= maxPerClub ? next : null;
}

/**
 * Αντίστροφη ανάλυση ενός ονόματος από αρχείο κλήρωσης: "Σ.Ο. Πολίχνης-2" →
 * { baseName: "Σ.Ο. Πολίχνης", teamNumber: 2 }. Χρησιμοποιείται ΜΟΝΟ ως βοήθημα
 * εμφάνισης/αναζήτησης — η αντιστοίχιση με πραγματική ομάδα γίνεται πάντα
 * συγκρίνοντας το ΥΠΟΛΟΓΙΣΜΕΝΟ όνομα κάθε ομάδας, όχι αντίστροφα.
 */
export function parseNumberedName(raw: string): { baseName: string; teamNumber: number } {
  const m = raw.match(/^(.*)-(\d+)$/);
  if (!m) return { baseName: raw, teamNumber: 1 };
  const n = Number(m[2]);
  return n >= 2 ? { baseName: m[1], teamNumber: n } : { baseName: raw, teamNumber: 1 };
}

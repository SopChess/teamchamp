export interface WindowInput {
  /** Πότε δημοσιεύτηκε η κλήρωση του γύρου (rounds.pairing_published_at). */
  publishedAt: string | null;
  /** Διάρκεια παραθύρου κατάθεσης σε λεπτά (προεπιλογή 10, ρυθμιζόμενη). */
  windowMinutes: number;
  /** Χειροκίνητη παράταση για τη συγκεκριμένη ομάδα (round_compositions.extended_until). */
  extendedUntil: string | null;
  now?: Date;
}

export interface WindowState {
  published: boolean;
  endsAt: Date | null;
  open: boolean;
  expired: boolean;
}

/**
 * Το παράθυρο κατάθεσης σύνθεσης ξεκινά ΜΟΝΟ όταν δημοσιευτεί η κλήρωση του
 * γύρου (event-driven) και διαρκεί windowMinutes. Μια χειροκίνητη παράταση
 * μετράει μόνο αν ξεπερνά τη λήξη του κανονικού παραθύρου.
 */
export function submissionWindow(input: WindowInput): WindowState {
  if (!input.publishedAt) {
    return { published: false, endsAt: null, open: false, expired: false };
  }
  const now = input.now ?? new Date();
  const base = new Date(new Date(input.publishedAt).getTime() + input.windowMinutes * 60_000);
  const extended = input.extendedUntil ? new Date(input.extendedUntil) : null;
  const endsAt = extended && extended > base ? extended : base;
  return { published: true, endsAt, open: now < endsAt, expired: now >= endsAt };
}

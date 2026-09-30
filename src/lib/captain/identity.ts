/**
 * Ταυτοποίηση υπευθύνου ομάδας: ίδιο πρόσωπο = ίδιο email ΚΑΙ ίδιο τηλέφωνο
 * (επιβεβαιωμένο). Τα κλειδιά κανονικοποιούνται ώστε μικρές διαφορές γραφής να
 * μην δημιουργούν "διαφορετικό" πρόσωπο.
 */

export function emailKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Κρατά μόνο τα ψηφία και επιστρέφει τα ΤΕΛΕΥΤΑΙΑ 10 — αγνοεί προθέματα όπως
 * "+30", "0030", "0" πριν το ελληνικό κινητό. "6971234567", "+30 697 123 4567"
 * και "00306971234567" δίνουν το ίδιο κλειδί. Λιγότερα από 10 ψηφία μετά τον
 * καθαρισμό δίνουν το κλειδί ως έχει (δεν κόβεται σε αρνητικό μήκος).
 */
export function phoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidPhone(raw: string): boolean {
  return phoneKey(raw).length >= 10;
}

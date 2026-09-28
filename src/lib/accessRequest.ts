export type AccessRequestStatus =
  | "sent"
  | "not_member"
  | "sending_disabled"
  | "send_failed"
  | "invalid_email";

export interface AccessRequestResult {
  status: AccessRequestStatus;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Μηνύματα προς τον χρήστη — ΠΑΝΤΑ σε πληθυντικό ευγενείας (επιβεβαιωμένο).
 * Το "sent" επιστρέφεται ΜΟΝΟ όταν η αποστολή έγινε πραγματικά.
 */
export function accessRequestMessage(status: AccessRequestStatus): string {
  switch (status) {
    case "sent":
      return "Στάλθηκε link πρόσβασης στο email σας.";
    case "not_member":
      return "Δεν ανήκετε στο επιτελείο της διοργάνωσης.";
    case "sending_disabled":
      return "Το email σας είναι καταχωρημένο, αλλά η αυτόματη αποστολή δεν είναι ακόμα ενεργή. Ζητήστε το link από τον διαχειριστή.";
    case "send_failed":
      return "Το email σας είναι καταχωρημένο, αλλά η αποστολή απέτυχε. Ζητήστε το link από τον διαχειριστή.";
    case "invalid_email":
      return "Παρακαλούμε εισαγάγετε ένα έγκυρο email.";
  }
}

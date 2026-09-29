/** Κατάσταση εγγραφών μιας διοργάνωσης, υπολογισμένη από την προθεσμία. */

export type RegistrationStatus = "open" | "closed" | "unscheduled";

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  open: "Ανοιχτές Εγγραφές",
  closed: "Έκλεισαν οι Εγγραφές",
  unscheduled: "Δεν έχει οριστεί προθεσμία",
};

/**
 * "open" όσο η προθεσμία δεν έχει περάσει, "closed" μόλις περάσει,
 * "unscheduled" αν δεν έχει οριστεί καθόλου προθεσμία.
 */
export function registrationStatus(deadline: string | null | undefined, now: Date = new Date()): RegistrationStatus {
  if (!deadline) return "unscheduled";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "unscheduled";
  return d.getTime() > now.getTime() ? "open" : "closed";
}

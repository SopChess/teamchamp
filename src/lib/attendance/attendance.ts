/** Βεβαίωση φοίτησης και παράβολο συμμετοχής — κανόνες χωρίς εξάρτηση από τη βάση. */

export const MAX_CERTIFICATE_BYTES = 8 * 1024 * 1024; // 8 MB — βλ. next.config.js bodySizeLimit
export const ALLOWED_CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

/** Έλεγχος πριν φτάσει το αρχείο στο storage: τύπος, μέγεθος, μη κενό. */
export function validateCertificateFile(file: FileLike | null | undefined): string | null {
  if (!file || !file.name || file.size === 0) return "Επιλέξτε αρχείο.";
  if (!ALLOWED_CERTIFICATE_TYPES.includes(file.type as (typeof ALLOWED_CERTIFICATE_TYPES)[number])) {
    return "Το αρχείο πρέπει να είναι PDF ή εικόνα (JPG/PNG).";
  }
  if (file.size > MAX_CERTIFICATE_BYTES) return "Το αρχείο ξεπερνά τα 8 MB.";
  return null;
}

/** Ασφαλές όνομα αρχείου μέσα στο path του storage (χωρίς κενά/ειδικούς χαρακτήρες). */
export function safeFileName(original: string): string {
  const dot = original.lastIndexOf(".");
  const ext = dot >= 0 ? original.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return ext ? `file.${ext}` : "file";
}

export function certificateStoragePath(teamId: string, original: string): string {
  return `${teamId}/${Date.now()}-${safeFileName(original)}`;
}

export type EntryFeeStatus = "pending" | "paid" | "waived";

export const ENTRY_FEE_STATUS_LABEL: Record<EntryFeeStatus, string> = {
  pending: "Εκκρεμεί",
  paid: "Πληρώθηκε",
  waived: "Απαλλαγή",
};

export function isEntryFeeStatus(value: string): value is EntryFeeStatus {
  return value === "pending" || value === "paid" || value === "waived";
}

import { describe, it, expect } from "vitest";
import {
  ALLOWED_CERTIFICATE_TYPES, MAX_CERTIFICATE_BYTES, ENTRY_FEE_STATUS_LABEL,
  certificateStoragePath, isEntryFeeStatus, safeFileName, validateCertificateFile,
} from "./attendance";

const file = (o: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: "βεβαίωση.pdf", type: "application/pdf", size: 1000, ...o,
});

describe("validateCertificateFile", () => {
  it("δέχεται PDF, JPG, PNG μέσα στο όριο", () => {
    expect(validateCertificateFile(file())).toBeNull();
    expect(validateCertificateFile(file({ type: "image/jpeg" }))).toBeNull();
    expect(validateCertificateFile(file({ type: "image/png" }))).toBeNull();
  });
  it("απορρίπτει άλλους τύπους αρχείου", () => {
    expect(validateCertificateFile(file({ type: "application/msword" }))).toMatch(/PDF ή εικόνα/);
    expect(validateCertificateFile(file({ type: "text/plain" }))).toMatch(/PDF ή εικόνα/);
  });
  it("απορρίπτει πάνω από 8 MB, δέχεται ακριβώς στο όριο", () => {
    expect(validateCertificateFile(file({ size: MAX_CERTIFICATE_BYTES + 1 }))).toMatch(/8 MB/);
    expect(validateCertificateFile(file({ size: MAX_CERTIFICATE_BYTES }))).toBeNull();
  });
  it("απορρίπτει κενό ή ανύπαρκτο αρχείο", () => {
    expect(validateCertificateFile(null)).toMatch(/Επιλέξτε/);
    expect(validateCertificateFile(file({ size: 0 }))).toMatch(/Επιλέξτε/);
    expect(validateCertificateFile(file({ name: "" }))).toMatch(/Επιλέξτε/);
  });
  it("η λίστα επιτρεπόμενων τύπων έχει ακριβώς τρεις τιμές", () => {
    expect(ALLOWED_CERTIFICATE_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png"]);
  });
});

describe("safeFileName / certificateStoragePath", () => {
  it("κρατά μόνο την κατάληξη, σε πεζά", () => {
    expect(safeFileName("Βεβαίωση Φοίτησης.PDF")).toBe("file.pdf");
    expect(safeFileName("photo.JPG")).toBe("file.jpg");
  });
  it("χωρίς κατάληξη ή με περίεργους χαρακτήρες δεν σκάει", () => {
    expect(safeFileName("χωρίς_κατάληξη")).toBe("file");
    expect(safeFileName("a.b.c.pdf")).toBe("file.pdf");
  });
  it("το path περιέχει το team id και ασφαλές όνομα", () => {
    const p = certificateStoragePath("team-123", "Βεβαίωση.pdf");
    expect(p).toMatch(/^team-123\/\d+-file\.pdf$/);
  });
  it("δύο διαδοχικές κλήσεις δίνουν διαφορετικό path (χρονοσφραγίδα)", async () => {
    const a = certificateStoragePath("t", "x.pdf");
    await new Promise((r) => setTimeout(r, 2));
    const b = certificateStoragePath("t", "x.pdf");
    expect(a).not.toBe(b);
  });
});

describe("entry fee status", () => {
  it("οι τρεις έγκυρες τιμές", () => {
    expect(isEntryFeeStatus("pending")).toBe(true);
    expect(isEntryFeeStatus("paid")).toBe(true);
    expect(isEntryFeeStatus("waived")).toBe(true);
  });
  it("απορρίπτει άκυρη τιμή", () => {
    expect(isEntryFeeStatus("cancelled")).toBe(false);
    expect(isEntryFeeStatus("")).toBe(false);
  });
  it("ελληνικές ετικέτες για κάθε κατάσταση", () => {
    expect(ENTRY_FEE_STATUS_LABEL).toEqual({ pending: "Εκκρεμεί", paid: "Πληρώθηκε", waived: "Απαλλαγή" });
  });
});

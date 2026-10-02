import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { callSafely } from "./safeAction";

const fd = () => new FormData();

describe('safeAction.ts — ΠΟΤΕ ξανά "use server" (επιβεβαιωμένο σοβαρό bug fix)', () => {
  it('δεν περιέχει τη δήλωση "use server" — είναι κοινό client-side βοήθημα, δέχεται συνάρτηση ως όρισμα', () => {
    // Αν ξαναμπεί "use server" εδώ, το Next.js πετάει σε production "Client Functions
    // cannot be passed directly to Server Functions" ΣΙΩΠΗΛΑ σε ΚΑΘΕ SavableForm σε όλη την
    // εφαρμογή (↑/↓/✕ στη σύνθεση, κάθε φόρμα παντού) — ακριβώς το bug που περιέγραψε ο
    // Isaak τρεις φορές πριν εντοπιστεί (ένα πραγματικό σφάλμα browser, όχι κάτι που
    // φαίνεται σε tsc/build/tests με κλήση της συνάρτησης απευθείας). Αυτό το test δεν
    // μπορεί να αναπαράγει το ίδιο το σφάλμα RSC, αλλά εμποδίζει την επιστροφή της αιτίας.
    const content = readFileSync(join(__dirname, "safeAction.ts"), "utf-8");
    expect(content).not.toMatch(/^\s*["']use server["']/m);
  });
});

describe("callSafely", () => {
  it("επιτυχία → { ok: true }", async () => {
    const action = async () => undefined;
    expect(await callSafely(action, fd())).toEqual({ ok: true });
  });

  it("thrown Error → { ok: false, message } με το ΑΚΡΙΒΕΣ μήνυμα", async () => {
    const action = async () => { throw new Error("Υπάρχει ήδη σύλλογος με αυτό το όνομα."); };
    expect(await callSafely(action, fd())).toEqual({ ok: false, message: "Υπάρχει ήδη σύλλογος με αυτό το όνομα." });
  });

  it("thrown χωρίς Error (string/undefined) → γενικό μήνυμα, όχι κενό", async () => {
    const action = async () => { throw "κάτι"; }; // eslint-disable-line @typescript-eslint/no-throw-literal
    expect(await callSafely(action, fd())).toEqual({ ok: false, message: "Παρουσιάστηκε σφάλμα." });
  });

  it("redirect() του Next.js (digest NEXT_REDIRECT) ΞΑΝΑΠΕΤΑΓΕΤΑΙ, δεν γίνεται { ok: false }", async () => {
    const err = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/admin/123;307;" });
    const action = async () => { throw err; };
    await expect(callSafely(action, fd())).rejects.toBe(err);
  });

  it("notFound() του Next.js (digest NEXT_NOT_FOUND) ΞΑΝΑΠΕΤΑΓΕΤΑΙ", async () => {
    const err = Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
    const action = async () => { throw err; };
    await expect(callSafely(action, fd())).rejects.toBe(err);
  });

  it("περνάει το ΙΔΙΟ FormData στο action", async () => {
    const formData = fd();
    formData.set("x", "1");
    let seen: FormData | null = null;
    const action = async (f: FormData) => { seen = f; };
    await callSafely(action, formData);
    expect(seen).toBe(formData);
  });
});

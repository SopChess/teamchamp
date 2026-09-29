"use server";

/**
 * Το Next.js ΑΦΑΙΡΕΙ το μήνυμα από κάθε thrown Error μέσα σε Server Action
 * όταν τρέχει σε production build — ο browser βλέπει μόνο ένα γενικό "An
 * error occurred in the Server Components render...". Οι επιστρεφόμενες
 * τιμές, αντίθετα, περνάνε αναλλοίωτες. Όλα τα actions της εφαρμογής πετάνε
 * Error στην αποτυχία τους (throw new Error("...")) — αυτό το βοήθημα τα
 * εκτελεί ΜΕΣΑ στον server και μετατρέπει ό,τι πετάξουν σε επιστρεφόμενη
 * τιμή, ώστε το πραγματικό μήνυμα να φτάνει στον χρήστη και σε production.
 * Τα redirect()/notFound() του Next.js περνάνε κανονικά (ΔΕΝ είναι σφάλμα
 * αποθήκευσης) — αναγνωρίζονται από το ειδικό digest και ξαναπετάγονται.
 */
export type ActionResult = { ok: true } | { ok: false; message: string };

export async function callSafely(
  action: (formData: FormData) => Promise<void> | void,
  formData: FormData
): Promise<ActionResult> {
  try {
    await action(formData);
    return { ok: true };
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw err;
    }
    return { ok: false, message: err instanceof Error ? err.message : "Παρουσιάστηκε σφάλμα." };
  }
}

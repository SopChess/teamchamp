"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { callSafely } from "@/lib/actions/safeAction";

interface Props {
  /** Ένα server action, όπως θα το περνούσατε σε <form action={...}>. */
  action: (formData: FormData) => Promise<void> | void;
  children: ReactNode;
  className?: string;
  /** Κείμενο μετά από επιτυχία (προεπιλογή: "Αποθηκεύτηκε."). */
  successMessage?: string;
  /** Άδειασμα της φόρμας μετά από επιτυχία (χρήσιμο για φόρμες προσθήκης). */
  resetOnSuccess?: boolean;
}

/**
 * Φόρμα με σαφή ένδειξη αποθήκευσης: "Αποθήκευση..." όσο εκτελείται, μετά
 * "✓ Αποθηκεύτηκε" ή "✗ <μήνυμα σφάλματος>". Το action τρέχει μέσα από
 * callSafely (βλ. @/lib/actions/safeAction) ώστε το πραγματικό μήνυμα να
 * φτάνει στον χρήστη ΚΑΙ σε production build — το Next.js αφαιρεί το μήνυμα
 * από κάθε thrown Error σε production, αλλά όχι από επιστρεφόμενες τιμές.
 * Το "εκτελείται" είναι δικό μας state (όχι useTransition/isPending): στο
 * σταθερό React 18 το isPending δεν μένει true κατά τη διάρκεια ενός async
 * transition — επιστρέφει false μόλις επιστραφεί το Promise, πριν ολοκληρωθεί.
 * Τα redirect() του Next.js (π.χ. μετά τη δημιουργία διοργάνωσης) περνάνε
 * κανονικά — δεν τα εμφανίζει ως σφάλμα.
 */
export default function SavableForm({ action, children, className, successMessage = "Αποθηκεύτηκε.", resetOnSuccess }: Props) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setStatus("idle");
    setPending(true);
    try {
      const result = await callSafely(action, formData);
      if (result.ok) {
        setStatus("success");
        setMessage(successMessage);
        if (resetOnSuccess) formRef.current?.reset();
      } else {
        setStatus("error");
        setMessage(result.message);
      }
    } catch (err) {
      // callSafely ξαναπετάει μόνο redirect()/notFound() του Next.js (digest
      // "NEXT_REDIRECT"/"NEXT_NOT_FOUND") — ΔΕΝ είναι αποτυχία αποθήκευσης,
      // πρέπει να συνεχίσει κανονικά η πλοήγηση.
      throw err;
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className}>
      {children}
      <div role="status" aria-live="polite">
        {pending && <p className="text-xs text-muted mt-2">Αποθήκευση...</p>}
        {!pending && status === "success" && <p className="text-xs text-good mt-2">✓ {message}</p>}
        {!pending && status === "error" && <p className="text-xs text-red-400 mt-2">✗ {message}</p>}
      </div>
    </form>
  );
}

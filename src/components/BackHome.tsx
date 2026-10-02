"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Μόνιμη γραμμή πλοήγησης — «← Πίσω» (πραγματικό ιστορικό browser) ΚΑΙ
 * «🏠 Αρχική» μαζί, σε κάθε οθόνη (επιβεβαιωμένο: σε όλα τα portals, όχι μόνο
 * στο admin). Το «Πίσω» χρειάζεται client component (router.back()) — το
 * «Αρχική» είναι απλό link, δουλεύει ακόμα κι αν δεν υπάρχει ιστορικό.
 */
export default function BackHome({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => router.back()}
        className="text-xs text-muted hover:text-gold flex items-center gap-1"
      >
        ← Πίσω
      </button>
      <Link href="/" className="text-xs text-muted hover:text-gold flex items-center gap-1">
        🏠 Αρχική
      </Link>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setAdminTheme } from "@/app/admin/themeActions";
import type { AdminTheme } from "@/lib/adminTheme";

/** Διακόπτης light/dark — μόνο admin (επιβεβαιωμένο). Αποθηκεύει σε cookie, ανανεώνει τη σελίδα. */
export default function ThemeToggle({ current }: { current: AdminTheme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: AdminTheme = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setAdminTheme(next);
          router.refresh();
        })
      }
      className="text-xs text-muted hover:text-gold whitespace-nowrap disabled:opacity-50"
      aria-label={`Εναλλαγή σε ${next === "light" ? "φωτεινό" : "σκούρο"} θέμα`}
    >
      {current === "dark" ? "☀️ Φωτεινό" : "🌙 Σκούρο"}
    </button>
  );
}

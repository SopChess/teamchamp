"use client";

import { useState, type ReactNode } from "react";

export interface CaptainTab {
  id: string;
  label: string;
  content: ReactNode;
  /** Μικρή κόκκινη κουκίδα στην καρτέλα (π.χ. όταν κάτι χρειάζεται προσοχή). */
  attention?: boolean;
}

/**
 * Εναλλαγή καρτελών ΜΕΣΑ στην ίδια σελίδα, ίδιο URL (επιβεβαιωμένο) — όχι
 * ξεχωριστές διευθύνσεις ανά καρτέλα. Όλα τα δεδομένα φορτώνονται μαζί στην
 * αρχή από τον server (όπως πριν)· εδώ γίνεται μόνο η εναλλαγή εμφάνισης. Το
 * περιεχόμενο κάθε καρτέλας μένει στο DOM (hidden, όχι unmount) ώστε η
 * κατάσταση μιας φόρμας να μη χάνεται αν ο χρήστης αλλάξει καρτέλα και
 * ξαναγυρίσει.
 */
export default function TabsShell({ tabs, defaultTab }: { tabs: CaptainTab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5 overflow-x-auto -mx-6 px-6 pb-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`relative shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              active === t.id ? "bg-gold text-bg" : "bg-panel text-muted border border-cardBorder"
            }`}
          >
            {t.label}
            {t.attention && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-400 border-2 border-bg" />
            )}
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div key={t.id} className={active === t.id ? "flex flex-col gap-5" : "hidden"}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

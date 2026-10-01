"use client";

import { useState, type ReactNode } from "react";

/**
 * Πτυσσόμενο πλαίσιο ανά τουρνουά (επιβεβαιωμένο) — το περιεχόμενο φορτώνεται
 * στο server όπως πριν (ίδιο μοτίβο με το TabsShell), ο client απλά δείχνει ή
 * κρύβει. Προαιρετικό κουμπί απόκρυψης (δική του επιλογή του υπευθύνου).
 */
export default function TournamentPanel({
  title,
  subtitle,
  defaultOpen = false,
  onHide,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  onHide?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-card border border-cardBorder rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between gap-2 text-left min-w-0"
        >
          <div className="min-w-0">
            <div className="font-serif font-bold text-base truncate">{title}</div>
            {subtitle && <div className="text-xs text-muted mt-0.5 truncate">{subtitle}</div>}
          </div>
          <span className={`text-muted flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="text-xs text-muted hover:text-red-400 flex-shrink-0 whitespace-nowrap"
          >
            Απόκρυψη
          </button>
        )}
      </div>
      <div className={open ? "border-t border-cardBorder px-4 py-4" : "hidden"}>{children}</div>
    </div>
  );
}

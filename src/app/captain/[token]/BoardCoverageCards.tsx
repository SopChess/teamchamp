import type { BoardCoverage } from "@/lib/rosterRules/basicRosterCheck";

/**
 * Ζωντανή κάρτα ανά σκακιέρα — δείχνει τον όρο της και αν καλύπτεται ήδη από
 * τον τρέχοντα κατάλογο (Σχέδιο Α, επιβεβαιωμένο): ΚΑΘΟΔΗΓΕΙ, δεν μπλοκάρει
 * καμία προσθήκη αθλητή. Ενημερώνεται μετά από κάθε προσθήκη/αφαίρεση, αφού
 * η σελίδα ήδη ξαναφορτώνει τα δεδομένα σε κάθε τέτοια ενέργεια.
 */
export default function BoardCoverageCards({ boards }: { boards: BoardCoverage[] }) {
  if (boards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {boards.map((b) => (
        <div
          key={b.board}
          className={`rounded-lg px-3 py-2.5 border text-sm transition-colors ${
            b.covered ? "bg-good/10 border-good/40" : "bg-panel border-cardBorder"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Σκακιέρα {b.board}</span>
            {b.covered && <span className="text-good text-xs">✓</span>}
          </div>
          <div className="text-xs text-muted mt-0.5">{b.shortLabel || "Χωρίς όρο"}</div>
        </div>
      ))}
    </div>
  );
}

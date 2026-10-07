import type { BoardCoverage } from "@/lib/rosterRules/basicRosterCheck";

/**
 * Πίνακας ανά σκακιέρα — Σκακιέρα / Αθλητής / Κατηγορία / Έλεγχος (επιβεβαιωμένο,
 * αντικαθιστά τις παλιές κάρτες — ίδιο περιεχόμενο, νέα παρουσίαση σε μορφή πίνακα,
 * ίδια σημειογραφία U16/F στη στήλη "Κατηγορία"). Σχέδιο Α, επιβεβαιωμένο: ΚΑΘΟΔΗΓΕΙ,
 * δεν μπλοκάρει καμία προσθήκη αθλητή. Ενημερώνεται μετά από κάθε προσθήκη/αφαίρεση.
 */
export default function BoardCoverageCards({ boards }: { boards: BoardCoverage[] }) {
  if (boards.length === 0) return null;

  return (
    <div className="bg-card border border-cardBorder rounded-xl overflow-hidden">
      {/* overflow-x-auto (επιβεβαιωμένο bug fix): χωρίς αυτό, ο πίνακας 4 στηλών ξεφεύγει
          πλάγια σε στενές οθόνες κινητού αντί να κάνει δικό του οριζόντιο scroll. */}
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[420px]">
        <thead>
          <tr className="border-b border-cardBorder">
            <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Σκακιέρα</th>
            <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Αθλητής</th>
            <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Κατηγορία</th>
            <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Έλεγχος</th>
          </tr>
        </thead>
        <tbody>
          {boards.map((b) => (
            <tr key={b.board} className="border-b border-cardBorder last:border-b-0">
              <td className="px-3 py-2.5 font-semibold">{b.board}</td>
              <td className="px-3 py-2.5">
                {b.athleteName ?? <span className="text-muted">Επιλογή αθλητή</span>}
              </td>
              <td className="px-3 py-2.5">
                {b.shortLabel ? (
                  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-infoBg text-infoText">
                    {b.shortLabel}
                  </span>
                ) : (
                  <span className="text-xs text-muted">Χωρίς όρο</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    b.covered ? "bg-okBg text-okText" : "bg-pendingBg text-pendingText"
                  }`}
                >
                  {b.covered ? "Έγκυρη" : "Εκκρεμεί"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

import { getCurrentAccess, canScoreCompetition } from "@/lib/access.server";
import { resolveScan } from "@/lib/rounds/scan";
import { recordBoardResult, getResultHistory } from "./actions";
import type { BoardResult } from "@/lib/standings/standings";
import SavableForm from "@/components/SavableForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESULT_LABEL: Record<BoardResult, string> = {
  "1-0": "1 – 0",
  "0-1": "0 – 1",
  "1/2-1/2": "½ – ½",
  forfeit_a: "Α.Α. (απουσία ομάδας Α)",
  forfeit_b: "Α.Α. (απουσία ομάδας Β)",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-5 py-8 max-w-md mx-auto flex flex-col gap-5">
      <div className="font-serif font-bold text-gold tracking-wide text-sm">TEAM ALMA</div>
      {children}
    </div>
  );
}

export default async function ScanPage({ params }: { params: { token: string } }) {
  const [scan, access] = await Promise.all([resolveScan(params.token), getCurrentAccess()]);
  const history = scan.kind === "board" ? await getResultHistory(params.token) : [];

  if (scan.kind === "unknown_token") {
    return (
      <Shell>
        <p className="text-sm text-red-400">Ο κωδικός QR δεν αναγνωρίστηκε.</p>
      </Shell>
    );
  }

  const heading = (
    <div>
      <div className="font-serif font-bold text-3xl leading-tight">Συνάντηση {scan.meetingNumber}</div>
      <div className="font-serif font-bold text-3xl leading-tight text-gold">Σκακιέρα {scan.boardNumber}</div>
    </div>
  );

  if (!canScoreCompetition(access, scan.competitionId)) {
    return (
      <Shell>
        {heading}
        <p className="text-sm text-red-400">
          Δεν έχετε πρόσβαση σε αυτή τη διοργάνωση. Ζητήστε από τον διαχειριστή να σας προσθέσει.
        </p>
      </Shell>
    );
  }

  if (scan.kind === "no_round") {
    return (
      <Shell>
        {heading}
        <p className="text-sm text-muted">
          Δεν έχει ανέβει ακόμα κλήρωση για αυτή τη Συνάντηση. Δοκιμάστε ξανά αφού δημοσιευτεί η κλήρωση του γύρου.
        </p>
      </Shell>
    );
  }

  if (scan.kind === "bye") {
    return (
      <Shell>
        {heading}
        <p className="text-sm text-muted">
          Γύρος {scan.roundNumber}: στη Συνάντηση αυτή η ομάδα {scan.teamName} έχει ελεύθερο γύρο (bye). Δεν υπάρχουν παρτίδες.
        </p>
      </Shell>
    );
  }

  const { a, b } = scan;
  const boundResult = (r: BoardResult) => recordBoardResult.bind(null, params.token, r);

  const btn = (r: BoardResult, text: string, tone: "main" | "muted" = "main") => (
    <SavableForm action={boundResult(r)} key={r}>
      <button
        type="submit"
        disabled={!scan.ready}
        className={`w-full rounded-xl py-3.5 text-sm font-semibold border disabled:opacity-40 ${
          scan.result === r
            ? "bg-gold text-bg border-gold"
            : tone === "main"
              ? "bg-card border-cardBorder"
              : "bg-panel border-cardBorder text-muted"
        }`}
      >
        {text}
      </button>
    </SavableForm>
  );

  return (
    <Shell>
      {heading}
      <div className="text-xs text-muted -mt-2">Γύρος {scan.roundNumber}</div>

      <div className="flex flex-col gap-3">
        {[a, b].map((side, i) => (
          <div key={side.teamId} className="bg-card border border-cardBorder rounded-xl px-4 py-3">
            <div className="text-xs text-muted">
              Ομάδα {i === 0 ? "Α" : "Β"} · {side.teamName}
            </div>
            {side.player ? (
              <div className="mt-1">
                <div className="text-lg font-semibold">{side.player.name}</div>
                {side.player.rating != null && (
                  <div className="text-xs text-muted">ΕΛΟ {side.player.rating}</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted mt-1">Αναμονή σύνθεσης ομάδας.</div>
            )}
          </div>
        ))}
      </div>

      <div className="text-sm">
        Τρέχον αποτέλεσμα:{" "}
        <span className="font-semibold">{scan.result ? RESULT_LABEL[scan.result] : "δεν έχει καταχωρηθεί"}</span>
      </div>

      {!scan.ready && (
        <p className="text-sm text-muted">
          Η καταχώρηση θα είναι διαθέσιμη μόλις υποβληθούν οι συνθέσεις και των δύο ομάδων.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {btn("1-0", `Νίκη: ${a.player?.name ?? "ομάδα Α"}`)}
        {btn("1/2-1/2", "Ισοπαλία")}
        {btn("0-1", `Νίκη: ${b.player?.name ?? "ομάδα Β"}`)}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {btn("forfeit_a", "Α.Α. ομάδας Α", "muted")}
          {btn("forfeit_b", "Α.Α. ομάδας Β", "muted")}
        </div>
      </div>
      <p className="text-xs text-muted">
        Μπορείτε να διορθώσετε ένα αποτέλεσμα πατώντας άλλο κουμπί. Το επιλεγμένο εμφανίζεται με χρυσό χρώμα.
      </p>

      {history.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Ιστορικό καταχωρήσεων ({history.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {history.map((h, i) => (
              <li key={i}>
                {h.old_result ? `${RESULT_LABEL[h.old_result as BoardResult] ?? h.old_result} → ` : "Πρώτη καταχώρηση: "}
                <span className="text-foreground">{RESULT_LABEL[h.new_result as BoardResult] ?? h.new_result}</span>
                {h.changed_by ? ` · ${h.changed_by}` : ""} ·{" "}
                {new Date(h.changed_at).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Shell>
  );
}

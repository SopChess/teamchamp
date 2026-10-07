import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AutoRefresh from "@/app/AutoRefresh";
import { boardScore, formatPoints, RESULT_LABEL, type BoardResult } from "@/lib/standings/standings";
import { teamDisplayName } from "@/lib/teams/teams";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClubRef = { name: string } | { name: string }[] | null;
const clubName = (raw: ClubRef): string => {
  const c = Array.isArray(raw) ? raw[0] : raw;
  return c?.name ?? "Ομάδα";
};

/**
 * Κεντρικός πίνακας ελέγχου αγωνιστικής (επιβεβαιωμένο, "Διαχείριση Αγωνιστικής") — ο
 * διοργανωτής βλέπει ΟΛΕΣ τις αναμετρήσεις ενός γύρου μαζί, με τρέχον σκορ και πίνακα
 * αποτελεσμάτων ανά σκακιέρα. Μόνο ανάγνωση εδώ — η καταχώρηση αποτελεσμάτων γίνεται από
 * τον διαιτητή μέσω QR (/r/[token]), αυτή η σελίδα απλά τα συγκεντρώνει.
 */
export default async function RoundMatchControlPage({ params }: { params: { id: string; roundId: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase.from("competitions").select("id, name").eq("id", params.id).single();
  const { data: round } = await supabase
    .from("rounds")
    .select("id, round_number")
    .eq("id", params.roundId)
    .eq("competition_id", params.id)
    .maybeSingle();
  if (!competition || !round) notFound();

  const [{ data: teams }, { data: meetings }, { data: pairings }] = await Promise.all([
    supabase.from("teams").select("id, team_number, clubs_schools(name)").eq("competition_id", params.id),
    supabase.from("meetings").select("id, meeting_number, board_count").eq("competition_id", params.id),
    supabase.from("pairings").select("id, meeting_id, team_a_id, team_b_id").eq("round_id", params.roundId),
  ]);

  const pairingIds = (pairings ?? []).map((p) => p.id);
  const { data: results } = pairingIds.length
    ? await supabase.from("board_results").select("pairing_id, board_number, result").in("pairing_id", pairingIds)
    : { data: [] as { pairing_id: string; board_number: number; result: string | null }[] };

  const teamName = (id: string | null) => {
    if (!id) return "BYE";
    const t = (teams ?? []).find((x) => x.id === id);
    return t ? teamDisplayName(clubName(t.clubs_schools as ClubRef), t.team_number ?? 1) : "Ομάδα";
  };
  const meetingOf = (meetingId: string) => (meetings ?? []).find((m) => m.id === meetingId);
  const boardCountOf = (meetingId: string) => meetingOf(meetingId)?.board_count ?? 4;
  const resultsOf = (pairingId: string) => (results ?? []).filter((r) => r.pairing_id === pairingId);

  const sortedPairings = [...(pairings ?? [])].sort(
    (a, b) => (meetingOf(a.meeting_id)?.meeting_number ?? 0) - (meetingOf(b.meeting_id)?.meeting_number ?? 0)
  );

  return (
    <div className="min-h-screen px-5 py-10 max-w-2xl mx-auto flex flex-col gap-6">
      <AutoRefresh seconds={10} />
      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-1">{competition.name}</div>
        <h1 className="font-serif font-bold text-2xl flex items-center gap-2">
          Διαχείριση Αγωνιστικής — Γύρος {round.round_number}
        </h1>
        <p className="text-sm text-muted mt-1">Κεντρικός πίνακας όλων των αναμετρήσεων του γύρου.</p>
      </div>

      <div className="flex flex-col gap-4">
        {sortedPairings.map((p) => {
          const boardCount = boardCountOf(p.meeting_id);
          const boardResults = resultsOf(p.id);
          const isBye = !p.team_b_id;

          let scoreA = 0;
          let scoreB = 0;
          for (const r of boardResults) {
            if (!r.result) continue;
            const [a, b] = boardScore(r.result as BoardResult);
            scoreA += a;
            scoreB += b;
          }

          const enteredCount = boardResults.filter((r) => r.result).length;
          const status = isBye
            ? null
            : enteredCount === 0
              ? { label: "Εκκρεμεί", bg: "bg-pendingBg", text: "text-pendingText" }
              : enteredCount < boardCount
                ? { label: "Προσωρινό αποτέλεσμα", bg: "bg-pendingBg", text: "text-pendingText" }
                : { label: "Ολοκληρωμένο", bg: "bg-okBg", text: "text-okText" };

          return (
            <div key={p.id} className="bg-card border border-cardBorder rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-cardBorder flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">{teamName(p.team_a_id)}</span>
                  {isBye ? (
                    <span className="text-sm text-muted">Ρεπό (BYE)</span>
                  ) : (
                    <>
                      <span className="text-lg font-bold text-gold">
                        {formatPoints(scoreA)} – {formatPoints(scoreB)}
                      </span>
                      <span className="font-semibold">{teamName(p.team_b_id)}</span>
                    </>
                  )}
                </div>
                {status && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                )}
              </div>

              {!isBye && (
                /* overflow-x-auto (επιβεβαιωμένο bug fix): βλ. BoardCoverageCards — ίδιο πρόβλημα,
                   εδώ χειρότερο αφού 2 στήλες επαναλαμβάνουν ολόκληρα ονόματα ομάδων. */
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-cardBorder">
                      <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Σκακιέρα</th>
                      <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Λευκά</th>
                      <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Μαύρα</th>
                      <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Αποτέλεσμα</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: boardCount }, (_, i) => i + 1).map((board) => {
                      const r = boardResults.find((x) => x.board_number === board);
                      return (
                        <tr key={board} className="border-b border-cardBorder last:border-b-0">
                          <td className="px-3 py-2.5 font-semibold">{board}</td>
                          <td className="px-3 py-2.5">{teamName(p.team_a_id)}</td>
                          <td className="px-3 py-2.5">{teamName(p.team_b_id)}</td>
                          <td className="px-3 py-2.5">
                            {r?.result ? RESULT_LABEL[r.result as BoardResult] : <span className="text-muted">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          );
        })}
        {sortedPairings.length === 0 && <p className="text-sm text-muted">Δεν υπάρχουν ακόμα αναμετρήσεις σε αυτόν τον γύρο.</p>}
      </div>
    </div>
  );
}

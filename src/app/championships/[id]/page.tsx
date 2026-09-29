import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AutoRefresh from "@/app/AutoRefresh";
import {
  boardScore,
  computeStandings,
  formatPoints,
  DEFAULT_TIEBREAKS,
  type BoardResult,
  type StandingsMatch,
  type TiebreakKey,
} from "@/lib/standings/standings";
import { teamDisplayName } from "@/lib/teams/teams";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClubRef = { name: string } | { name: string }[] | null;
const clubName = (raw: ClubRef): string => {
  const c = Array.isArray(raw) ? raw[0] : raw;
  return c?.name ?? "Ομάδα";
};

export default async function ChampionshipPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: c } = await supabase
    .from("competitions")
    .select("id, name, format, rounds_count, starts_on, ends_on, venue")
    .eq("id", params.id)
    .maybeSingle();
  if (!c) notFound();

  const [{ data: teams }, { data: rounds }, { data: meetings }, { data: scoring }, { data: rules }] =
    await Promise.all([
      supabase.from("teams").select("id, team_number, clubs_schools(name)").eq("competition_id", params.id),
      supabase
        .from("rounds")
        .select("id, round_number, pairing_published_at")
        .eq("competition_id", params.id)
        .not("pairing_published_at", "is", null)
        .order("round_number", { ascending: false }),
      supabase.from("meetings").select("id, meeting_number, board_count").eq("competition_id", params.id),
      supabase.from("scoring_rules").select("*").eq("competition_id", params.id).maybeSingle(),
      supabase.from("roster_rules").select("match_board_count").eq("competition_id", params.id).maybeSingle(),
    ]);

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: pairings } = roundIds.length
    ? await supabase
        .from("pairings")
        .select("id, round_id, meeting_id, team_a_id, team_b_id")
        .in("round_id", roundIds)
    : { data: [] as { id: string; round_id: string; meeting_id: string; team_a_id: string; team_b_id: string | null }[] };

  const pairingIds = (pairings ?? []).map((p) => p.id);
  const { data: results } = pairingIds.length
    ? await supabase.from("board_results").select("pairing_id, board_number, result").in("pairing_id", pairingIds)
    : { data: [] as { pairing_id: string; board_number: number; result: string | null }[] };

  const teamName = (id: string | null) => {
    if (!id) return "BYE";
    const t = (teams ?? []).find((x) => x.id === id);
    return t ? teamDisplayName(clubName(t.clubs_schools as ClubRef), t.team_number ?? 1) : "Ομάδα";
  };
  const defaultBoards = rules?.match_board_count ?? 4;
  const meetingOf = (id: string) => (meetings ?? []).find((m) => m.id === id);

  const matches: StandingsMatch[] = (pairings ?? []).map((p) => {
    const boardCount = meetingOf(p.meeting_id)?.board_count ?? defaultBoards;
    const res: (BoardResult | null)[] = Array(boardCount).fill(null);
    for (const r of results ?? []) {
      if (r.pairing_id === p.id && r.result && r.board_number >= 1 && r.board_number <= boardCount) {
        res[r.board_number - 1] = r.result as BoardResult;
      }
    }
    return { id: p.id, teamA: p.team_a_id, teamB: p.team_b_id, boardCount, results: res };
  });

  const tiebreaks: TiebreakKey[] =
    scoring?.tiebreak_criteria && scoring.tiebreak_criteria.length > 0
      ? (scoring.tiebreak_criteria as TiebreakKey[])
      : DEFAULT_TIEBREAKS;

  const standings = computeStandings(
    (teams ?? []).map((t) => t.id),
    matches,
    {
      winPoints: Number(scoring?.win_points ?? 2),
      drawPoints: Number(scoring?.draw_points ?? 1),
      lossPoints: Number(scoring?.loss_points ?? 0),
      forfeitLossPenalty: Number(scoring?.forfeit_loss_penalty ?? 0),
      byeMatchPoints: Number(scoring?.bye_match_points ?? 2),
      byeBoardPoints: scoring?.bye_board_points != null ? Number(scoring.bye_board_points) : null,
      defaultBoardCount: defaultBoards,
      tiebreaks,
    }
  );
  const anyProvisional = standings.some((s) => s.provisional);

  const info: [string, string | null][] = [
    ["Χώρος αγώνων", c.venue],
    ["Ημερομηνίες", [c.starts_on, c.ends_on].filter(Boolean).join(" – ") || null],
  ];

  return (
    <div className="min-h-screen px-5 py-10 max-w-xl mx-auto flex flex-col gap-8">
      <AutoRefresh seconds={5} />

      <div>
        <Link href="/" className="text-xs text-muted hover:text-gold">
          ← Αρχική
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">{c.name}</h1>
        <div className="text-xs text-muted mt-1">
          {info.filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join(" · ")}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-bold text-xl">Ζωντανή κατάταξη</h2>
          <span className="text-xs text-gold">● ζωντανά</span>
        </div>
        {(teams ?? []).length === 0 ? (
          <p className="text-sm text-muted">Δεν υπάρχουν ακόμα ομάδες.</p>
        ) : (
          <div className="bg-card border border-cardBorder rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2rem_1fr_3rem_3.5rem_2.5rem] gap-2 px-3 py-2 text-xs text-muted border-b border-cardBorder">
              <span>#</span>
              <span>Ομάδα</span>
              <span className="text-right">Βαθμοί</span>
              <span className="text-right">Πόντοι</span>
              <span className="text-right">Αγ.</span>
            </div>
            {standings.map((s) => (
              <div
                key={s.teamId}
                className="grid grid-cols-[2rem_1fr_3rem_3.5rem_2.5rem] gap-2 px-3 py-2.5 text-sm border-b border-cardBorder last:border-b-0"
              >
                <span className="text-gold font-bold">{s.rank}</span>
                <span className="truncate">{teamName(s.teamId)}</span>
                <span className="text-right font-semibold">
                  {formatPoints(s.matchPoints)}
                  {s.provisional ? "*" : ""}
                </span>
                <span className="text-right text-muted">{formatPoints(s.boardPoints)}</span>
                <span className="text-right text-muted">{s.played}</span>
              </div>
            ))}
          </div>
        )}
        {anyProvisional && (
          <p className="text-xs text-muted">
            * Προσωρινή εικόνα: περιλαμβάνει συναντήσεις που δεν έχουν ολοκληρωθεί. Η επίσημη κατάταξη
            ανακοινώνεται από τον διαιτητή/Swiss-Manager.
          </p>
        )}
      </section>

      {(rounds ?? []).map((r) => {
        const roundPairings = (pairings ?? [])
          .filter((p) => p.round_id === r.id)
          .sort((x, y) => (meetingOf(x.meeting_id)?.meeting_number ?? 0) - (meetingOf(y.meeting_id)?.meeting_number ?? 0));
        return (
          <section key={r.id} className="flex flex-col gap-3">
            <h2 className="font-serif font-bold text-xl">Γύρος {r.round_number}</h2>
            <div className="flex flex-col gap-2">
              {roundPairings.map((p) => {
                const match = matches.find((m) => m.id === p.id)!;
                let sa = 0;
                let sb = 0;
                match.results.forEach((res) => {
                  if (res) {
                    const [x, y] = boardScore(res);
                    sa += x;
                    sb += y;
                  }
                });
                const recorded = match.results.filter(Boolean).length;
                return (
                  <div key={p.id} className="bg-card border border-cardBorder rounded-xl px-4 py-3">
                    <div className="text-xs text-muted mb-1">
                      Συνάντηση {meetingOf(p.meeting_id)?.meeting_number ?? "?"}
                    </div>
                    {p.team_b_id ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm flex-1 truncate">{teamName(p.team_a_id)}</span>
                        <span className="font-serif font-bold text-lg whitespace-nowrap">
                          {recorded > 0 ? `${formatPoints(sa)} – ${formatPoints(sb)}` : "– : –"}
                        </span>
                        <span className="text-sm flex-1 truncate text-right">{teamName(p.team_b_id)}</span>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {teamName(p.team_a_id)} <span className="text-muted">· ελεύθερος γύρος (bye)</span>
                      </div>
                    )}
                    {p.team_b_id && (
                      <div className="text-xs text-muted mt-1">
                        {recorded}/{match.boardCount} σκακιέρες
                        {recorded > 0 && recorded < match.boardCount ? " · σε εξέλιξη" : ""}
                        {recorded === match.boardCount ? " · ολοκληρώθηκε" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {(rounds ?? []).length === 0 && (
        <p className="text-sm text-muted">Η κλήρωση του πρώτου γύρου δεν έχει δημοσιευτεί ακόμα.</p>
      )}
    </div>
  );
}

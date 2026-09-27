import { createClient } from "@/lib/supabase/server";
import { createRound, createPairing } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoundsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("id", params.id)
    .single();

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, round_number, submission_window_minutes")
    .eq("competition_id", params.id)
    .order("round_number");

  const { data: teams } = await supabase
    .from("teams")
    .select("id, clubs_schools(name)")
    .eq("competition_id", params.id);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, meeting_number")
    .eq("competition_id", params.id)
    .order("meeting_number");

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: pairings } = roundIds.length
    ? await supabase
        .from("pairings")
        .select("id, round_id, meeting_id, team_a_id, team_b_id")
        .in("round_id", roundIds)
    : { data: [] as { id: string; round_id: string; meeting_id: string; team_a_id: string; team_b_id: string | null }[] };

  const teamName = (id: string | null) => {
    if (!id) return "BYE";
    const t = (teams ?? []).find((x) => x.id === id) as
      | { id: string; clubs_schools: { name: string } | { name: string }[] }
      | undefined;
    const raw = t?.clubs_schools;
    const club = Array.isArray(raw) ? raw[0] : raw;
    return club?.name ?? "Ομάδα";
  };

  const meetingLabel = (id: string) =>
    `Συνάντηση ${(meetings ?? []).find((m) => m.id === id)?.meeting_number ?? "?"}`;

  const boundCreateRound = createRound.bind(null, params.id);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}`} className="text-xs text-muted hover:text-gold">
          ← {competition?.name ?? "Διοργάνωση"}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Γύροι &amp; Αντιστοίχιση</h1>
        <p className="text-xs text-muted mt-1">
          Μετά το ανέβασμα της κλήρωσης στο Swiss Manager, αντιστοίχισε εδώ χειροκίνητα
          ποιες ομάδες κάθονται σε ποια (μόνιμη) Συνάντηση αυτόν τον γύρο.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {(rounds ?? []).map((r) => {
          const roundPairings = (pairings ?? []).filter((p) => p.round_id === r.id);
          const boundCreatePairing = createPairing.bind(null, params.id, r.id);
          return (
            <div key={r.id} className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-4">
              <div className="font-semibold">Γύρος {r.round_number}</div>

              <div className="flex flex-col gap-2">
                {roundPairings.map((p) => (
                  <div key={p.id} className="text-sm bg-panel border border-cardBorder rounded-lg px-3 py-2 flex items-center justify-between">
                    <span>
                      {teamName(p.team_a_id)} vs {teamName(p.team_b_id)}
                    </span>
                    <span className="text-xs text-muted">{meetingLabel(p.meeting_id)}</span>
                  </div>
                ))}
                {roundPairings.length === 0 && (
                  <p className="text-xs text-muted">Καμία αντιστοίχιση ακόμα για αυτόν τον γύρο.</p>
                )}
              </div>

              <form action={boundCreatePairing} className="flex flex-col gap-2 border-t border-cardBorder pt-3">
                <div className="flex gap-2">
                  <select name="team_a_id" required className="bg-panel border border-cardBorder rounded-lg px-2 py-2 text-sm flex-1">
                    <option value="">Ομάδα Α</option>
                    {(teams ?? []).map((t) => {
                      const raw = t.clubs_schools as { name: string } | { name: string }[];
                      const club = Array.isArray(raw) ? raw[0] : raw;
                      return (
                        <option key={t.id} value={t.id}>
                          {club?.name}
                        </option>
                      );
                    })}
                  </select>
                  <select name="team_b_id" className="bg-panel border border-cardBorder rounded-lg px-2 py-2 text-sm flex-1">
                    <option value="">Ομάδα Β (κενό = BYE)</option>
                    {(teams ?? []).map((t) => {
                      const raw = t.clubs_schools as { name: string } | { name: string }[];
                      const club = Array.isArray(raw) ? raw[0] : raw;
                      return (
                        <option key={t.id} value={t.id}>
                          {club?.name}
                        </option>
                      );
                    })}
                  </select>
                  <select name="meeting_id" required className="bg-panel border border-cardBorder rounded-lg px-2 py-2 text-sm flex-1">
                    <option value="">Συνάντηση</option>
                    {(meetings ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        Συνάντηση {m.meeting_number}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="bg-panel border border-cardBorder rounded-lg py-2 text-sm">
                  Προσθήκη Αντιστοίχισης
                </button>
              </form>
            </div>
          );
        })}
        {(rounds ?? []).length === 0 && <p className="text-sm text-muted">Κανένας γύρος ακόμα.</p>}
      </div>

      <form action={boundCreateRound} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Νέος Γύρος</div>
        <div className="flex gap-3">
          <input
            name="round_number"
            type="number"
            required
            placeholder="Αριθμός γύρου"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
          />
          <input
            name="submission_window_minutes"
            type="number"
            defaultValue={10}
            placeholder="Παράθυρο κατάθεσης (λεπτά)"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
          />
        </div>
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Δημιουργία Γύρου
        </button>
      </form>
    </div>
  );
}

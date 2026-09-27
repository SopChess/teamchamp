import { createClient } from "@/lib/supabase/server";
import { uploadPairingsFile } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClubRef = { name: string } | { name: string }[] | null;
function clubName(raw: ClubRef): string {
  const club = Array.isArray(raw) ? raw[0] : raw;
  return club?.name ?? "Ομάδα";
}

export default async function RoundsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("id", params.id)
    .single();

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, round_number")
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

  const { data: pendingStaging } = roundIds.length
    ? await supabase.from("round_import_staging").select("round_id").in("round_id", roundIds)
    : { data: [] as { round_id: string }[] };
  const pendingRoundIds = new Set((pendingStaging ?? []).map((s) => s.round_id));

  const teamNameById = (id: string | null) => {
    if (!id) return "BYE";
    const t = (teams ?? []).find((x) => x.id === id);
    return t ? clubName(t.clubs_schools as ClubRef) : "Ομάδα";
  };

  const meetingLabel = (id: string) =>
    `Συνάντηση ${(meetings ?? []).find((m) => m.id === id)?.meeting_number ?? "?"}`;

  const boundUpload = uploadPairingsFile.bind(null, params.id);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}`} className="text-xs text-muted hover:text-gold">
          ← {competition?.name ?? "Διοργάνωση"}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Γύροι &amp; Κλήρωση</h1>
        <p className="text-xs text-muted mt-1">
          Ανέβασε το αρχείο κλήρωσης (.xls/.xlsx) όπως το εξάγει το Swiss-Manager, ανά γύρο.
          Ο γύρος και η αντιστοίχιση ομάδων σε Συναντήσεις δημιουργούνται αυτόματα.
        </p>
      </div>

      <form action={boundUpload} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Ανέβασμα Κλήρωσης Γύρου</div>
        <input
          name="file"
          type="file"
          accept=".xls,.xlsx"
          required
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-panel file:px-3 file:py-2 file:text-sm"
        />
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Ανέβασμα &amp; Αντιστοίχιση
        </button>
      </form>

      <div className="flex flex-col gap-6">
        {(rounds ?? []).map((r) => {
          const roundPairings = (pairings ?? []).filter((p) => p.round_id === r.id);
          const isPending = pendingRoundIds.has(r.id);
          return (
            <div key={r.id} className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Γύρος {r.round_number}</div>
                {isPending && (
                  <Link
                    href={`/admin/${params.id}/rounds/${r.id}/resolve`}
                    className="text-xs bg-panel border border-cardBorder rounded-full px-3 py-1 text-gold"
                  >
                    Εκκρεμεί αντιστοίχιση →
                  </Link>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {roundPairings.map((p) => (
                  <div
                    key={p.id}
                    className="text-sm bg-panel border border-cardBorder rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span>
                      {teamNameById(p.team_a_id)} vs {teamNameById(p.team_b_id)}
                    </span>
                    <span className="text-xs text-muted">{meetingLabel(p.meeting_id)}</span>
                  </div>
                ))}
                {roundPairings.length === 0 && !isPending && (
                  <p className="text-xs text-muted">Καμία αντιστοίχιση ακόμα.</p>
                )}
              </div>
            </div>
          );
        })}
        {(rounds ?? []).length === 0 && <p className="text-sm text-muted">Κανένας γύρος ακόμα.</p>}
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { uploadPairingsFile, extendSubmissionWindow } from "./actions";
import { teamDisplayName } from "@/lib/teams/teams";
import { finalizeExpiredCompositions } from "@/lib/rounds/server";
import { submissionWindow } from "@/lib/rounds/window";
import Link from "next/link";
import SavableForm from "@/components/SavableForm";

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
    .select("id, round_number, pairing_published_at, submission_window_minutes")
    .eq("competition_id", params.id)
    .order("round_number");

  // Ολοκλήρωσε τις εφεδρικές συνθέσεις που έχουν λήξει, πριν εμφανιστεί η κατάσταση.
  for (const r of rounds ?? []) {
    if (r.pairing_published_at) await finalizeExpiredCompositions(r.id);
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("id, team_number, clubs_schools(name)")
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

  const { data: compositions } = roundIds.length
    ? await supabase
        .from("round_compositions")
        .select("round_id, team_id, status, submitted_at, extended_until")
        .in("round_id", roundIds)
    : { data: [] as { round_id: string; team_id: string; status: string; submitted_at: string | null; extended_until: string | null }[] };

  const { data: captains } = await supabase
    .from("captains")
    .select("team_id, first_name, last_name, phone, is_alternate")
    .in("team_id", (teams ?? []).map((t) => t.id));

  const { data: pendingStaging } = roundIds.length
    ? await supabase.from("round_import_staging").select("round_id").in("round_id", roundIds)
    : { data: [] as { round_id: string }[] };
  const pendingRoundIds = new Set((pendingStaging ?? []).map((s) => s.round_id));

  const teamNameById = (id: string | null) => {
    if (!id) return "BYE";
    const t = (teams ?? []).find((x) => x.id === id);
    if (!t) return "Ομάδα";
    return teamDisplayName(clubName(t.clubs_schools as ClubRef) ?? "Ομάδα", t.team_number ?? 1);
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
          Ανεβάστε το αρχείο κλήρωσης (.xls/.xlsx) όπως το εξάγει το Swiss-Manager, ανά γύρο.
          Ο γύρος και η αντιστοίχιση ομάδων σε Συναντήσεις δημιουργούνται αυτόματα.
        </p>
      </div>

      <SavableForm action={boundUpload} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
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
      </SavableForm>

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
                    Εκκρεμεί αντιστοίχιση
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

              {r.pairing_published_at && (() => {
                const playing = new Set<string>();
                for (const p of roundPairings) {
                  if (!p.team_b_id) continue;
                  playing.add(p.team_a_id);
                  playing.add(p.team_b_id);
                }
                const rows = [...playing].map((teamId) => {
                  const comp = (compositions ?? []).find((c) => c.round_id === r.id && c.team_id === teamId);
                  const win = submissionWindow({
                    publishedAt: r.pairing_published_at,
                    windowMinutes: r.submission_window_minutes,
                    extendedUntil: comp?.extended_until ?? null,
                  });
                  const cap = (captains ?? []).find((c) => c.team_id === teamId && !c.is_alternate) ??
                    (captains ?? []).find((c) => c.team_id === teamId);
                  let status: "submitted" | "default" | "pending" | "expired";
                  if (comp?.status === "submitted" || comp?.status === "locked") status = "submitted";
                  else if (comp?.status === "used_default") status = "default";
                  else status = win.open ? "pending" : "expired";
                  return { teamId, comp, win, cap, status };
                });
                const done = rows.filter((x) => x.status === "submitted").length;
                const LABEL = {
                  submitted: "Υποβλήθηκε",
                  default: "Εφαρμόστηκε η βασική σύνθεση",
                  pending: "Σε αναμονή",
                  expired: "Έληξε",
                } as const;
                return (
                  <div className="border-t border-cardBorder pt-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wide text-muted">Συνθέσεις ομάδων</div>
                      <div className="text-xs text-gold">✅ {done}/{rows.length} υποβλήθηκαν</div>
                    </div>
                    {rows.map((x) => (
                      <div key={x.teamId} className="bg-panel border border-cardBorder rounded-lg px-3 py-2 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{teamNameById(x.teamId)}</span>
                          <span className={`text-xs ${x.status === "submitted" ? "text-good" : "text-muted"}`}>
                            {LABEL[x.status]}
                            {x.status === "pending" && x.win.endsAt
                              ? ` · έως ${x.win.endsAt.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}`
                              : ""}
                          </span>
                        </div>
                        <div className="text-xs text-muted">
                          {x.cap ? `Αρχηγός: ${x.cap.last_name} ${x.cap.first_name}${x.cap.phone ? ` · τηλ. ${x.cap.phone}` : ""}` : "Δεν έχει δηλωθεί αρχηγός"}
                        </div>
                        {x.status !== "submitted" && (
                          <SavableForm
                            action={extendSubmissionWindow.bind(null, params.id, r.id, x.teamId)}
                            successMessage="Δόθηκε παράταση."
                            className="flex items-center gap-2"
                          >
                            <select name="minutes" defaultValue="5" className="bg-card border border-cardBorder rounded-md px-2 py-1 text-xs">
                              <option value="5">+5΄</option>
                              <option value="10">+10΄</option>
                              <option value="15">+15΄</option>
                            </select>
                            <button type="submit" className="text-xs bg-card border border-cardBorder rounded-md px-3 py-1">
                              Παράταση
                            </button>
                          </SavableForm>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>
          );
        })}
        {(rounds ?? []).length === 0 && <p className="text-sm text-muted">Κανένας γύρος ακόμα.</p>}
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { updateTeamClubName, deleteTeam, setEntryFeeStatus } from "./actions";
import { ENTRY_FEE_STATUS_LABEL, type EntryFeeStatus } from "@/lib/attendance/attendance";
import TeamCertificateLink from "./TeamCertificateLink";
import SavableForm from "@/components/SavableForm";
import Link from "next/link";
import { genderMismatches, type AthleteGender } from "@/lib/eso/genderCheck";
import { teamDisplayName, type AudienceType } from "@/lib/teams/teams";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, audience_type, requires_certificate, entry_fee_amount")
    .eq("id", params.id)
    .single();
  const audienceType = (competition?.audience_type as AudienceType) ?? "eso_club";

  const { data: rules } = await supabase
    .from("roster_rules")
    .select("roster_size")
    .eq("competition_id", params.id)
    .maybeSingle();
  const rosterSize = rules?.roster_size ?? null;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, captain_access_token, club_or_school_id, team_number, clubs_schools(name), attendance_certificate_original_name, entry_fee_status, entry_fee_method")
    .eq("competition_id", params.id)
    .order("created_at", { ascending: false });

  const teamName = new Map<string, string>();
  const pairedTeamIds = new Set<string>();
  for (const t of teams ?? []) {
    const raw = (t as unknown as { clubs_schools: { name: string } | { name: string }[] | null }).clubs_schools;
    const clubName = (Array.isArray(raw) ? raw[0]?.name : raw?.name) ?? "Ομάδα";
    teamName.set(t.id, teamDisplayName(clubName, t.team_number ?? 1));
  }
  const teamIds = [...teamName.keys()];

  // Αριθμός αθλητών ανά ομάδα (X/Y) — αντικαθιστά την άχρηστη, πάντα-ίδια ετικέτα status.
  const athleteCount = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: countRows } = await supabase.from("roster_entries").select("team_id").in("team_id", teamIds);
    for (const r of countRows ?? []) athleteCount.set(r.team_id, (athleteCount.get(r.team_id) ?? 0) + 1);
  }

  if (teamIds.length > 0) {
    const { data: pairedRows } = await supabase
      .from("pairings")
      .select("team_a_id, team_b_id")
      .or(`team_a_id.in.(${teamIds.join(",")}),team_b_id.in.(${teamIds.join(",")})`);
    for (const p of pairedRows ?? []) {
      pairedTeamIds.add(p.team_a_id);
      if (p.team_b_id) pairedTeamIds.add(p.team_b_id);
    }
  }

  // Έλεγχος φύλου με τη λίστα ΕΣΟ (μόνο για αθλητές που επιλέχθηκαν από τον κατάλογο)
  let mismatches: ReturnType<typeof genderMismatches> = [];
  if (teamIds.length > 0) {
    const { data: entries } = await supabase.from("roster_entries").select("team_id, player_id").in("team_id", teamIds);
    const playerIds = (entries ?? []).map((e) => e.player_id);
    const { data: players } = playerIds.length
      ? await supabase.from("players").select("id, first_name, last_name, gender, directory_id").in("id", playerIds)
      : { data: [] as { id: string; first_name: string; last_name: string; gender: string | null; directory_id: string | null }[] };
    const dirIds = [...new Set((players ?? []).map((p) => p.directory_id).filter((x): x is string => !!x))];
    const sexByDir = new Map<string, string | null>();
    for (let i = 0; i < dirIds.length; i += 200) {
      const { data: dir } = await supabase.from("players_directory").select("id, sex_eso").in("id", dirIds.slice(i, i + 200));
      for (const d of (dir ?? []) as { id: string; sex_eso: string | null }[]) sexByDir.set(d.id, d.sex_eso ?? null);
    }
    const { count: imports } = await supabase.from("eso_imports").select("id", { count: "exact", head: true });
    const athletes: AthleteGender[] = (entries ?? []).flatMap((e) => {
      const p = (players ?? []).find((x) => x.id === e.player_id);
      if (!p) return [];
      return [{
        team: teamName.get(e.team_id) ?? "Ομάδα",
        name: `${p.last_name} ${p.first_name}`,
        declared: p.gender === "M" || p.gender === "F" ? p.gender : null,
        directoryId: p.directory_id,
      }];
    });
    mismatches = genderMismatches(athletes, sexByDir, (imports ?? 0) > 0);
  }
  void audienceType;

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}`} className="text-xs text-muted hover:text-gold">
          ← {competition?.name ?? "Διοργάνωση"}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Ομάδες</h1>
      </div>

      {mismatches.length > 0 && (
        <div className="bg-card border border-gold/40 rounded-xl p-4 flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-gold">Έλεγχος φύλου με τη λίστα ΕΣΟ</div>
          <p className="text-xs text-muted">
            Το φύλο το επιλέγει ο υπεύθυνος κάθε ομάδας. Παρακάτω φαίνονται οι περιπτώσεις που διαφέρει από την ένδειξη
            της ΕΣΟ και αξίζει έλεγχος πριν κριθεί η σύνθεση.
          </p>
          <ul className="text-sm flex flex-col gap-1">
            {mismatches.map((m, i) => (
              <li key={i} className={m.severity === "strong" ? "text-red-400" : "text-muted"}>
                {m.team} · {m.name}: {m.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(teams ?? []).map((t) => {
          const captainUrl = t.captain_access_token ? `/captain/${t.captain_access_token}` : null;
          const canDelete = !pairedTeamIds.has(t.id);
          const boundDelete = deleteTeam.bind(null, params.id, t.id);
          const boundUpdateClubName = updateTeamClubName.bind(null, params.id, t.id);
          const feeStatus = (t.entry_fee_status && t.entry_fee_status in ENTRY_FEE_STATUS_LABEL
            ? t.entry_fee_status
            : "pending") as EntryFeeStatus;
          const boundSetFee = setEntryFeeStatus.bind(null, params.id, t.id);
          const count = athleteCount.get(t.id) ?? 0;
          const countOk = rosterSize != null && count >= rosterSize;

          return (
            <div key={t.id} className="bg-card border border-cardBorder rounded-xl px-4 py-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold truncate">{teamName.get(t.id) ?? "Ομάδα"}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${countOk ? "bg-good/15 text-good" : "bg-panel text-muted border border-cardBorder"}`}>
                  {count}{rosterSize != null ? `/${rosterSize}` : ""} αθλητές
                </span>
              </div>

              <SavableForm
                action={boundUpdateClubName}
                successMessage="Η επωνυμία αποθηκεύτηκε, ο υπεύθυνος ενημερώθηκε."
                className="flex items-center gap-2"
              >
                <input
                  name="club_name"
                  defaultValue={(() => {
                    const raw = (t as unknown as { clubs_schools: { name: string } | { name: string }[] | null }).clubs_schools;
                    return (Array.isArray(raw) ? raw[0]?.name : raw?.name) ?? "";
                  })()}
                  className="bg-panel border border-cardBorder rounded px-2 py-1 text-xs flex-1 min-w-0"
                  aria-label="Επωνυμία συλλόγου/σχολείου"
                />
                <button type="submit" className="text-gold hover:underline text-xs whitespace-nowrap flex-shrink-0">
                  Αποθήκευση &amp; Ενημέρωση
                </button>
              </SavableForm>

              <div className="flex items-center gap-4 text-xs flex-wrap">
                {competition?.requires_certificate && (
                  <span className="flex items-center gap-1">
                    {t.attendance_certificate_original_name ? (
                      <>
                        <span className="text-good">✓</span> Βεβαίωση
                        <TeamCertificateLink teamId={t.id} name={t.attendance_certificate_original_name} />
                      </>
                    ) : (
                      <><span className="text-muted">—</span> <span className="text-muted">Βεβαίωση</span></>
                    )}
                  </span>
                )}
                {competition?.entry_fee_amount != null && (
                  <span className="flex items-center gap-1.5">
                    <span className={feeStatus === "paid" ? "text-good" : "text-muted"}>{feeStatus === "paid" ? "✓" : "—"}</span>
                    <SavableForm action={async (fd: FormData) => { "use server"; await boundSetFee(String(fd.get("status"))); }} successMessage="Ενημερώθηκε." className="flex items-center gap-1">
                      <select name="status" defaultValue={feeStatus} className="bg-panel border border-cardBorder rounded px-1.5 py-0.5 text-xs">
                        {(Object.keys(ENTRY_FEE_STATUS_LABEL) as EntryFeeStatus[]).map((s) => (
                          <option key={s} value={s}>{ENTRY_FEE_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      <button type="submit" className="text-gold hover:underline">Ενημέρωση</button>
                    </SavableForm>
                    {t.entry_fee_method && <span className="text-muted">· {t.entry_fee_method}</span>}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-3 text-xs">
                  <Link href={`/admin/${params.id}/teams/${t.id}`} className="text-gold underline">
                    Επεξεργασία σύνθεσης
                  </Link>
                  {captainUrl && <span className="text-muted break-all">{captainUrl}</span>}
                </div>
                {canDelete ? (
                  <SavableForm action={boundDelete} successMessage="Η ομάδα διαγράφηκε.">
                    <button type="submit" className="text-xs text-red-400 hover:underline whitespace-nowrap">
                      Διαγραφή
                    </button>
                  </SavableForm>
                ) : (
                  <span className="text-xs text-muted whitespace-nowrap">Έχει κληρωθεί</span>
                )}
              </div>
            </div>
          );
        })}
        {(teams ?? []).length === 0 && (
          <p className="text-sm text-muted">Καμία ομάδα ακόμα.</p>
        )}
      </div>

      <p className="text-xs text-muted">
        Οι ομάδες εγγράφονται από τους ίδιους τους υπευθύνους, από τη δημόσια σελίδα της
        διοργάνωσης. Εδώ μπορείτε να διορθώσετε την επωνυμία συλλόγου/σχολείου ή να διαγράψετε
        ομάδα πριν κληρωθεί — η σύνθεση αθλητών είναι αποκλειστικά δουλειά του υπευθύνου.
      </p>
    </div>
  );
}

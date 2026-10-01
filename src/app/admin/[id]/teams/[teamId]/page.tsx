import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  adminAddPlayerToRoster, adminAddDirectoryPlayerToRoster, adminRemoveRosterEntry,
  adminMoveRosterEntry, adminSaveCaptainInfo, adminDeleteTeamFromDetail,
} from "../actions";
import { adminSearchDirectory, adminSearchDirectoryByNumber } from "../../../directory/actions";
import { teamDisplayName } from "@/lib/teams/teams";
import SavableForm from "@/components/SavableForm";
import PlayerSearch from "@/app/captain/[token]/PlayerSearch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminTeamDetailPage({ params }: { params: { id: string; teamId: string } }) {
  const supabase = createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, team_number, status, clubs_schools(name)")
    .eq("id", params.teamId)
    .eq("competition_id", params.id)
    .maybeSingle();
  if (!team) notFound();

  const clubRaw = team.clubs_schools as { name: string } | { name: string }[] | null;
  const clubName = (Array.isArray(clubRaw) ? clubRaw[0]?.name : clubRaw?.name) ?? "Ομάδα";
  const displayName = teamDisplayName(clubName, team.team_number ?? 1);

  const { data: pairing } = await supabase
    .from("pairings")
    .select("id")
    .or(`team_a_id.eq.${params.teamId},team_b_id.eq.${params.teamId}`)
    .limit(1)
    .maybeSingle();
  const canDelete = !pairing;

  const { data: captain } = await supabase.from("captains").select("first_name, last_name, phone, email").eq("team_id", params.teamId).maybeSingle();

  const { data: entries } = await supabase
    .from("roster_entries")
    .select("id, declared_order, players(id, first_name, last_name, rating_national, rating_fide, gender)")
    .eq("team_id", params.teamId)
    .order("declared_order", { ascending: true });

  const boundAddManual = adminAddPlayerToRoster.bind(null, params.id, params.teamId);
  const boundAddDirectory = adminAddDirectoryPlayerToRoster.bind(null, params.id, params.teamId);
  const boundCaptainInfo = adminSaveCaptainInfo.bind(null, params.id, params.teamId);
  const boundDelete = adminDeleteTeamFromDetail.bind(null, params.id, params.teamId);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}/teams`} className="text-xs text-muted hover:text-gold">
          ← Ομάδες
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">{displayName}</h1>
        <p className="text-xs text-muted mt-1">Επεξεργασία σύνθεσης — οι αλλαγές εδώ ΔΕΝ περιορίζονται από την προθεσμία εγγραφών.</p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Στοιχεία Αρχηγού</div>
        <SavableForm action={boundCaptainInfo} successMessage="Τα στοιχεία αποθηκεύτηκαν." className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          <div className="flex gap-2">
            <input name="last_name" defaultValue={captain?.last_name ?? ""} placeholder="Επώνυμο (λατινικά)" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
            <input name="first_name" defaultValue={captain?.first_name ?? ""} placeholder="Όνομα (λατινικά)" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
          <input name="phone" defaultValue={captain?.phone ?? ""} placeholder="Τηλέφωνο" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
          <input name="email" defaultValue={captain?.email ?? ""} placeholder="Email" type="email" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="bg-panel border border-cardBorder rounded-lg py-2 text-sm mt-1">Αποθήκευση</button>
        </SavableForm>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Βασική Σύνθεση ({(entries ?? []).length})</div>
        <div className="flex flex-col gap-2">
          {(entries ?? []).map((entry, i) => {
            const p = entry.players as unknown as { id: string; first_name: string; last_name: string; rating_national: number | null; rating_fide: number | null; gender: string } | null;
            if (!p) return null;
            const boundRemove = adminRemoveRosterEntry.bind(null, params.id, params.teamId, entry.id);
            return (
              <div key={entry.id} className="bg-card border border-cardBorder rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{i + 1}. {p.last_name} {p.first_name}</div>
                  <div className="text-xs text-muted">
                    {p.gender === "F" ? "Γυναίκα" : "Άνδρας"}
                    {p.rating_national ? ` · ΕΛΟ ${p.rating_national}` : ""}
                    {p.rating_fide ? ` · FIDE ${p.rating_fide}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <SavableForm action={adminMoveRosterEntry.bind(null, params.id, params.teamId, entry.id, "up")}>
                    <button type="submit" disabled={i === 0} className="w-8 h-8 bg-panel border border-cardBorder rounded-lg disabled:opacity-30">↑</button>
                  </SavableForm>
                  <SavableForm action={adminMoveRosterEntry.bind(null, params.id, params.teamId, entry.id, "down")}>
                    <button type="submit" disabled={i === (entries ?? []).length - 1} className="w-8 h-8 bg-panel border border-cardBorder rounded-lg disabled:opacity-30">↓</button>
                  </SavableForm>
                  <SavableForm action={boundRemove} successMessage="Ο αθλητής αφαιρέθηκε.">
                    <button type="submit" className="w-8 h-8 bg-panel border border-cardBorder rounded-lg text-red-400">✕</button>
                  </SavableForm>
                </div>
              </div>
            );
          })}
          {(entries ?? []).length === 0 && <p className="text-sm text-muted">Κανένας αθλητής ακόμα.</p>}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Προσθήκη Αθλητή</div>
        <PlayerSearch search={adminSearchDirectory} searchByNumber={adminSearchDirectoryByNumber} add={boundAddDirectory} />
        <details className="mt-2">
          <summary className="text-xs text-muted cursor-pointer">ή χειροκίνητη καταχώρηση</summary>
          <SavableForm action={boundAddManual} resetOnSuccess successMessage="Ο αθλητής προστέθηκε." className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4 mt-2">
            <div className="flex gap-2">
              <input name="last_name" required placeholder="Επώνυμο (λατινικά)" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
              <input name="first_name" required placeholder="Όνομα (λατινικά)" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
            </div>
            <select name="gender" required className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm">
              <option value="">— Φύλο —</option>
              <option value="M">Άνδρας</option>
              <option value="F">Γυναίκα</option>
            </select>
            <input name="birth_date" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="bg-panel border border-cardBorder rounded-lg py-2 text-sm">Προσθήκη</button>
          </SavableForm>
        </details>
      </div>

      <div className="border-t border-cardBorder pt-6">
        {canDelete ? (
          <SavableForm action={boundDelete} className="flex flex-col gap-2">
            <button type="submit" className="text-sm text-red-400 border border-red-400/40 rounded-lg py-2.5 hover:bg-red-400/10">
              Διαγραφή Ομάδας
            </button>
          </SavableForm>
        ) : (
          <p className="text-xs text-muted">Η ομάδα έχει ήδη κληρωθεί σε γύρο — δεν μπορεί να διαγραφεί.</p>
        )}
      </div>
    </div>
  );
}

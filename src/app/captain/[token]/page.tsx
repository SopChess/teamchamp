import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import CaptainTeamView from "./CaptainTeamView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeamRef = { id: string; clubs_schools: { name: string } | { name: string }[] | null; competitions: { name: string } | { name: string }[] | null };
function clubName(t: TeamRef): string {
  const c = Array.isArray(t.clubs_schools) ? t.clubs_schools[0] : t.clubs_schools;
  return c?.name ?? "Ομάδα";
}
function compName(t: TeamRef): string {
  const c = Array.isArray(t.competitions) ? t.competitions[0] : t.competitions;
  return c?.name ?? "";
}

/**
 * Ρίζα του Portal Αρχηγού. Δύο τρόποι πρόσβασης (επιβεβαιωμένο, και οι δύο
 * ενεργοί ταυτόχρονα):
 *  - ΠΑΛΙΟ link: το token είναι το μόνιμο captain_access_token μίας ομάδας
 *    (ομάδες που δημιούργησε ο admin) — πάει κατευθείαν σε αυτήν.
 *  - ΝΕΟ link (captain_accounts, από τη δημόσια εγγραφή): αν ο υπεύθυνος έχει
 *    ΜΙΑ ομάδα, πάει κατευθείαν σε αυτήν· αν έχει περισσότερες, εμφανίζεται
 *    λίστα επιλογής προς /captain/[token]/[teamId].
 */
export default async function CaptainRoot({ params }: { params: { token: string } }) {
  const supabase = createClient();

  const { data: legacy } = await supabase.from("teams").select("id").eq("captain_access_token", params.token).maybeSingle();
  if (legacy) {
    return <CaptainTeamView token={params.token} teamId={legacy.id} />;
  }

  const { data: account } = await supabase.from("captain_accounts").select("id").eq("access_token", params.token).maybeSingle();
  if (!account) notFound();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, clubs_schools(name), competitions(name)")
    .eq("captain_account_id", account.id);

  if (!teams || teams.length === 0) notFound();
  if (teams.length === 1) {
    return <CaptainTeamView token={params.token} teamId={teams[0].id} />;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-serif font-bold text-2xl mt-2">Οι Ομάδες σας</h1>
        <p className="text-xs text-muted mt-1">Επιλέξτε ομάδα για διαχείριση.</p>
      </div>
      <div className="flex flex-col gap-3">
        {(teams as unknown as TeamRef[]).map((t) => (
          <Link
            key={t.id}
            href={`/captain/${params.token}/${t.id}`}
            className="bg-card border border-cardBorder rounded-xl px-4 py-3 hover:border-gold transition-colors"
          >
            <div className="font-semibold">{clubName(t)}</div>
            <div className="text-xs text-muted">{compName(t)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

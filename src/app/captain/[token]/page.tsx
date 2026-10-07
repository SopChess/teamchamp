import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CaptainTeamView from "./CaptainTeamView";
import TournamentPanel from "./TournamentPanel";
import HiddenTournamentRow from "./HiddenTournamentRow";
import { setCompetitionHidden } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeamRef = {
  id: string;
  competition_id: string;
  clubs_schools: { name: string } | { name: string }[] | null;
  competitions: { name: string } | { name: string }[] | null;
};
function clubName(t: TeamRef): string {
  const c = Array.isArray(t.clubs_schools) ? t.clubs_schools[0] : t.clubs_schools;
  return c?.name ?? "Ομάδα";
}
function compName(t: TeamRef): string {
  const c = Array.isArray(t.competitions) ? t.competitions[0] : t.competitions;
  return c?.name ?? "Τουρνουά";
}

/**
 * Ρίζα του Portal Αρχηγού (αναδιαρθρωμένο, επιβεβαιωμένο): το ΤΟΥΡΝΟΥΑ είναι
 * πλέον ο βασικός χώρος — κάθε τουρνουά στο δικό του πτυσσόμενο πλαίσιο, με
 * την ομάδα/ομάδες του μέσα. Μόνιμο αρχείο σε βάθος χρόνου: ΔΕΝ φιλτράρουμε
 * με βάση ημερομηνία/κατάσταση — κάθε τουρνουά που έχει συμμετάσχει ποτέ ο
 * υπεύθυνος παραμένει εδώ, με δυνατότητα απόκρυψης/επανεμφάνισης από τον ίδιο.
 *
 * Δύο τρόποι πρόσβασης (και οι δύο ενεργοί ταυτόχρονα):
 *  - ΠΑΛΙΟ link: το token είναι το μόνιμο captain_access_token μίας ομάδας —
 *    ένα μόνο τουρνουά, πάντα ανοιχτό, καμία επιλογή απόκρυψης (τίποτα άλλο
 *    να κρύψει).
 *  - ΝΕΟ link (captain_accounts): όλα τα τουρνουά του υπευθύνου, ομαδοποιημένα.
 */
export default async function CaptainRoot({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { athleteIssues?: string | string[] };
}) {
  const supabase = createClient();

  // Μήνυμα για αθλητές που ΔΕΝ προστέθηκαν κατά την εγγραφή της ομάδας — επιβεβαιωμένο
  // bug fix: ο έλεγχος satisfiesAnyBoard γινόταν ήδη σωστά στο backend (ο αθλητής ΔΕΝ
  // καταχωρούνταν), αλλά το μήνυμα ταξίδευε σε παράμετρο URL που ΚΑΝΕΝΑ σημείο της
  // εφαρμογής δεν διάβαζε ποτέ — ο υπεύθυνος δεν μάθαινε ποτέ γιατί λείπει κάποιος.
  // Το Next.js μπορεί τεχνικά να δώσει πίνακα αντί για string — χειρίζεται ρητά εδώ.
  const athleteIssuesRaw = searchParams?.athleteIssues;
  const athleteIssuesText = Array.isArray(athleteIssuesRaw) ? athleteIssuesRaw.join(" · ") : athleteIssuesRaw;
  const athleteIssuesBanner = athleteIssuesText ? (
    <div className="bg-pendingBg border border-pendingText/30 rounded-xl px-4 py-3">
      <div className="text-sm font-semibold text-pendingText mb-1">
        Κάποιοι αθλητές ΔΕΝ προστέθηκαν στη βασική σύνθεση:
      </div>
      <p className="text-xs text-pendingText">{athleteIssuesText}</p>
    </div>
  ) : null;

  const { data: legacy } = await supabase.from("teams").select("id, competitions(name)").eq("captain_access_token", params.token).maybeSingle();
  if (legacy) {
    const legacyComp = legacy.competitions as { name: string } | { name: string }[] | null;
    const name = Array.isArray(legacyComp) ? legacyComp[0]?.name : legacyComp?.name;
    return (
      <div className="min-h-screen px-6 py-10 max-w-sm md:max-w-xl mx-auto flex flex-col gap-4">
        {athleteIssuesBanner}
        <TournamentPanel title={name ?? "Τουρνουά"} defaultOpen>
          <CaptainTeamView token={params.token} teamId={legacy.id} />
        </TournamentPanel>
      </div>
    );
  }

  const { data: account } = await supabase.from("captain_accounts").select("id").eq("access_token", params.token).maybeSingle();
  if (!account) notFound();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, competition_id, clubs_schools(name), competitions(name)")
    .eq("captain_account_id", account.id);

  if (!teams || teams.length === 0) notFound();

  const { data: hiddenRows } = await supabase
    .from("captain_hidden_competitions")
    .select("competition_id")
    .eq("captain_account_id", account.id);
  const hiddenIds = new Set((hiddenRows ?? []).map((h) => h.competition_id));

  const visible = (teams as unknown as TeamRef[]).filter((t) => !hiddenIds.has(t.competition_id));
  const hidden = (teams as unknown as TeamRef[]).filter((t) => hiddenIds.has(t.competition_id));

  return (
    <div className="min-h-screen px-6 py-10 max-w-sm md:max-w-xl mx-auto flex flex-col gap-6">
      {athleteIssuesBanner}
      <div>
        <h1 className="font-serif font-bold text-2xl">Τα Τουρνουά σας</h1>
        <p className="text-xs text-muted mt-1">
          Όλα τα τουρνουά που έχετε συμμετάσχει, ανοιχτά ή ολοκληρωμένα — παραμένουν εδώ.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((t) => (
          <TournamentPanel
            key={t.id}
            title={compName(t)}
            subtitle={clubName(t)}
            onHide={async () => {
              "use server";
              await setCompetitionHidden(params.token, t.competition_id, true);
            }}
          >
            <CaptainTeamView token={params.token} teamId={t.id} />
          </TournamentPanel>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-muted">Όλα τα τουρνουά σας είναι κρυμμένα — δείτε παρακάτω.</p>
        )}
      </div>

      {hidden.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Κρυμμένα Τουρνουά</div>
          <div className="flex flex-col gap-2">
            {hidden.map((t) => (
              <HiddenTournamentRow
                key={t.id}
                title={`${compName(t)} — ${clubName(t)}`}
                show={async () => {
                  "use server";
                  await setCompetitionHidden(params.token, t.competition_id, false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
